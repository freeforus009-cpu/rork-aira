import { DurableObject } from "cloudflare:workers";

type ChatEnv = { DO: Fetcher };

interface ChatReaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  thumbnail?: string;
  siteName?: string;
}

interface ConversationSettings {
  backgroundColor?: string;
  wallpaperImage?: string;
}

interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderProfileImage?: string;
  text: string;
  attachments?: Array<{
    id: string;
    type: string;
    url: string;
    name: string;
    size?: number;
    mimeType?: string;
    thumbnailUrl?: string;
  }>;
  createdAt: string;
  deliveryStatus: string;
  readBy: string[];
  edited?: boolean;
  editedAt?: string;
  deleted?: boolean;
  replyToId?: string;
  replyToText?: string;
  reactions?: ChatReaction[];
  linkPreview?: LinkPreview;
  pinned?: boolean;
}

interface StoredConversation {
  id: string;
  participantIds: string[];
  participantInfo: Array<{
    userId: string;
    fullName: string;
    role: string;
    profileImage?: string;
    isAdmin?: boolean;
    isMuted?: boolean;
  }>;
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  createdAt: string;
  updatedAt: string;
  archivedBy: string[];
  deletedBy: string[];
  organizationId?: string;
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  adminIds?: string[];
  sectionId?: string;
  pinnedMessageIds?: string[];
  mutedBy?: string[];
  settings?: ConversationSettings;
}

interface PresenceEntry {
  userId: string;
  status: string;
  lastActiveAt: string;
}

type WSConnection = {
  userId: string;
  conversationIds: Set<string>;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function conversationKey(id: string): string {
  return `conv:${id}`;
}

function messagePrefix(conversationId: string): string {
  return `msg:${conversationId}:`;
}

function userConversationsKey(userId: string): string {
  return `userconvs:${userId}`;
}

function presenceKey(userId: string): string {
  return `presence:${userId}`;
}

function sortedParticipantIds(ids: string[]): string[] {
  return [...ids].sort();
}

function conversationIdFromParticipants(participantIds: string[]): string {
  return sortedParticipantIds(participantIds).join("__");
}

function sectionGroupKey(sectionId: string): string {
  return `sectiongroup:${sectionId}`;
}

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "✅"];

export class ChatRoom extends DurableObject<ChatEnv> {
  private wsConnections = new Map<WebSocket, WSConnection>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = request.headers.get("X-Resolved-User-Id");
    if (!userId) return json({ error: "Unauthorized" }, 401);

    // WebSocket upgrade
    if (request.method === "GET" && url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(userId, url);
    }

    // Get or create conversation
    if (request.method === "POST" && url.pathname === "/conversations") {
      const body = (await request.json()) as {
        participantIds?: string[];
        participantInfo?: Array<{ userId: string; fullName: string; role: string; profileImage?: string; isAdmin?: boolean }>;
        organizationId?: string;
        isGroup?: boolean;
        groupName?: string;
        groupAvatar?: string;
        adminIds?: string[];
        sectionId?: string;
      };
      if (!body.participantIds || body.participantIds.length < 2) {
        return json({ error: "At least 2 participants required" }, 400);
      }
      return this.getOrCreateConversation(userId, body);
    }

    // List conversations for user
    if (request.method === "GET" && url.pathname === "/conversations") {
      return this.listConversations(userId);
    }

    // Get messages for a conversation
    const messagesMatch = url.pathname.match(/^\/conversations\/([^/]+)\/messages$/);
    if (request.method === "GET" && messagesMatch) {
      const conversationId = messagesMatch[1];
      const before = url.searchParams.get("before");
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
      return this.getMessages(userId, conversationId, before, limit);
    }

    // Send message
    if (request.method === "POST" && messagesMatch) {
      const conversationId = messagesMatch[1];
      const body = (await request.json()) as {
        text?: string;
        attachments?: StoredMessage["attachments"];
        replyToId?: string;
        replyToText?: string;
        clientMessageId?: string;
      };
      return this.sendMessage(userId, conversationId, body);
    }

    // Mark messages as read
    const readMatch = url.pathname.match(/^\/conversations\/([^/]+)\/read$/);
    if (request.method === "POST" && readMatch) {
      const conversationId = readMatch[1];
      const body = (await request.json()) as { messageIds?: string[] };
      return this.markRead(userId, conversationId, body.messageIds ?? []);
    }

    // Delete a message (soft delete)
    const deleteMsgMatch = url.pathname.match(/^\/messages\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMsgMatch) {
      const messageId = deleteMsgMatch[1];
      return this.deleteMessage(userId, messageId);
    }

    // Edit message
    const editMatch = url.pathname.match(/^\/messages\/([^/]+)\/edit$/);
    if (request.method === "PATCH" && editMatch) {
      const messageId = editMatch[1];
      const body = (await request.json()) as { text?: string };
      return this.editMessage(userId, messageId, body.text ?? "");
    }

    // React to a message
    const reactMatch = url.pathname.match(/^\/messages\/([^/]+)\/reactions$/);
    if (request.method === "POST" && reactMatch) {
      const messageId = reactMatch[1];
      const body = (await request.json()) as { emoji?: string };
      return this.toggleReaction(userId, messageId, body.emoji ?? "");
    }

    // Pin/unpin a message
    const pinMatch = url.pathname.match(/^\/conversations\/([^/]+)\/pin\/([^/]+)$/);
    if (request.method === "POST" && pinMatch) {
      const conversationId = pinMatch[1];
      const messageId = pinMatch[2];
      const body = (await request.json()) as { pinned?: boolean };
      return this.togglePin(userId, conversationId, messageId, body.pinned ?? true);
    }

    // Delete conversation (soft delete for user)
    const delConvMatch = url.pathname.match(/^\/conversations\/([^/]+)$/);
    if (request.method === "DELETE" && delConvMatch) {
      const conversationId = delConvMatch[1];
      return this.deleteConversation(userId, conversationId);
    }

    // Update conversation settings
    if (request.method === "PATCH" && delConvMatch) {
      const conversationId = delConvMatch[1];
      const body = (await request.json()) as { settings?: ConversationSettings; groupName?: string; groupAvatar?: string };
      return this.updateSettings(userId, conversationId, body);
    }

    // Add member to conversation
    const addMemberMatch = url.pathname.match(/^\/conversations\/([^/]+)\/members$/);
    if (request.method === "POST" && addMemberMatch) {
      const conversationId = addMemberMatch[1];
      const body = (await request.json()) as { userId: string; fullName?: string; role?: string; profileImage?: string; isAdmin?: boolean };
      return this.addMember(userId, conversationId, body);
    }

    // Remove member from conversation
    if (request.method === "DELETE" && addMemberMatch) {
      const conversationId = addMemberMatch[1];
      const body = (await request.json()) as { userId: string };
      return this.removeMember(userId, conversationId, body.userId);
    }

    // Mute/unmute conversation for current user
    const muteMatch = url.pathname.match(/^\/conversations\/([^/]+)\/mute$/);
    if (request.method === "POST" && muteMatch) {
      const conversationId = muteMatch[1];
      const body = (await request.json()) as { muted?: boolean };
      return this.toggleMute(userId, conversationId, body.muted ?? true);
    }

    // Mute a member (admin action)
    const muteMemberMatch = url.pathname.match(/^\/conversations\/([^/]+)\/members\/([^/]+)\/mute$/);
    if (request.method === "POST" && muteMemberMatch) {
      const conversationId = muteMemberMatch[1];
      const targetUserId = muteMemberMatch[2];
      const body = (await request.json()) as { muted?: boolean };
      return this.toggleMemberMute(userId, conversationId, targetUserId, body.muted ?? true);
    }

    // Section group chat management
    if (request.method === "POST" && url.pathname === "/section-group") {
      const body = (await request.json()) as {
        sectionId: string;
        sectionName: string;
        adminId: string;
        teacherId?: string;
        adminInfo: { userId: string; fullName: string; role: string; profileImage?: string };
        teacherInfo?: { userId: string; fullName: string; role: string; profileImage?: string };
      };
      return this.createSectionGroup(body);
    }

    // Add student to section group
    if (request.method === "POST" && url.pathname === "/section-group/add-student") {
      const body = (await request.json()) as {
        sectionId: string;
        student: { userId: string; fullName: string; role: string; profileImage?: string };
      };
      return this.addStudentToSectionGroup(body);
    }

    // Remove student from section group
    if (request.method === "POST" && url.pathname === "/section-group/remove-student") {
      const body = (await request.json()) as { sectionId: string; userId: string };
      return this.removeStudentFromSectionGroup(body);
    }

    // Update teacher for section group
    if (request.method === "POST" && url.pathname === "/section-group/update-teacher") {
      const body = (await request.json()) as {
        sectionId: string;
        oldTeacherId?: string;
        newTeacher?: { userId: string; fullName: string; role: string; profileImage?: string };
      };
      return this.updateSectionGroupTeacher(body);
    }

    // Typing indicator
    const typingMatch = url.pathname.match(/^\/conversations\/([^/]+)\/typing$/);
    if (request.method === "POST" && typingMatch) {
      const conversationId = typingMatch[1];
      const body = (await request.json()) as { isTyping?: boolean };
      return this.handleTyping(userId, conversationId, body.isTyping ?? false);
    }

    // Update presence
    if (request.method === "POST" && url.pathname === "/presence") {
      const body = (await request.json()) as { status?: string };
      return this.updatePresence(userId, body.status ?? "online");
    }

    // Get presence for users
    if (request.method === "GET" && url.pathname === "/presence") {
      const userIds = url.searchParams.get("userIds")?.split(",").filter(Boolean) ?? [];
      return this.getPresence(userIds);
    }

    // Search messages
    if (request.method === "GET" && url.pathname === "/search") {
      const query = url.searchParams.get("q") ?? "";
      const conversationId = url.searchParams.get("conversationId");
      return this.searchMessages(userId, query, conversationId);
    }

    return json({ error: "Not found" }, 404);
  }

  private async handleWebSocket(userId: string, url: URL): Promise<Response> {
    const conversationIds = url.searchParams.get("conversations")?.split(",").filter(Boolean) ?? [];
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const connection: WSConnection = {
      userId,
      conversationIds: new Set(conversationIds),
    };
    this.wsConnections.set(server, connection);

    this.ctx.acceptWebSocket(server);

    // Send initial presence update
    await this.updatePresence(userId, "online");

    // Send connected event
    server.send(JSON.stringify({ type: "connected", userId }));

    // Send current conversations
    const convs = await this.listConversationsRaw(userId);
    server.send(JSON.stringify({ type: "conversations", conversations: convs }));

    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketClose(ws: WebSocket): void {
    const conn = this.wsConnections.get(ws);
    if (conn) {
      this.wsConnections.delete(ws);
      void this.updatePresence(conn.userId, "offline");
    }
  }

  override webSocketError(ws: WebSocket): void {
    const conn = this.wsConnections.get(ws);
    if (conn) {
      this.wsConnections.delete(ws);
      void this.updatePresence(conn.userId, "offline");
    }
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    try {
      const data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
      const conn = this.wsConnections.get(ws);
      if (!conn) return;

      if (data.type === "subscribe" && data.conversationId) {
        conn.conversationIds.add(data.conversationId);
      }
      if (data.type === "typing" && data.conversationId) {
        this.broadcastToConversation(data.conversationId, {
          type: "typing",
          conversationId: data.conversationId,
          userId: conn.userId,
          isTyping: data.isTyping ?? false,
          timestamp: new Date().toISOString(),
        }, conn.userId);
      }
      if (data.type === "presence" && data.status) {
        void this.updatePresence(conn.userId, data.status);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private async getOrCreateConversation(
    userId: string,
    body: {
      participantIds: string[];
      participantInfo?: Array<{ userId: string; fullName: string; role: string; profileImage?: string; isAdmin?: boolean }>;
      organizationId?: string;
      isGroup?: boolean;
      groupName?: string;
      groupAvatar?: string;
      adminIds?: string[];
      sectionId?: string;
    },
  ): Promise<Response> {
    const participantIds = body.participantIds;
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    const convId = body.isGroup
      ? `group_${sectionGroupKey(body.sectionId ?? "")}_${Date.now()}`
      : conversationIdFromParticipants(participantIds);

    // For 1-on-1, try existing by participant key first
    let existing: StoredConversation | undefined;
    if (!body.isGroup) {
      existing = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
    }

    if (existing) {
      if (existing.deletedBy.includes(userId)) {
        existing.deletedBy = existing.deletedBy.filter((id) => id !== userId);
        await this.ctx.storage.put(conversationKey(convId), existing);
      }
      if (body.participantInfo && body.participantInfo.length > 0) {
        existing.participantInfo = body.participantInfo as StoredConversation["participantInfo"];
        await this.ctx.storage.put(conversationKey(convId), existing);
      }
      return json({ conversation: this.sanitizeConversation(existing, userId) });
    }

    const info = (body.participantInfo && body.participantInfo.length > 0
      ? body.participantInfo
      : participantIds.map((id) => ({ userId: id, fullName: id, role: "student" }))) as StoredConversation["participantInfo"];

    const now = new Date().toISOString();
    const conversation: StoredConversation = {
      id: convId,
      participantIds: body.isGroup ? participantIds : sortedParticipantIds(participantIds),
      participantInfo: info,
      lastMessageText: "",
      lastMessageAt: now,
      lastMessageSenderId: "",
      createdAt: now,
      updatedAt: now,
      archivedBy: [],
      deletedBy: [],
      organizationId: body.organizationId,
      isGroup: body.isGroup ?? false,
      groupName: body.groupName,
      groupAvatar: body.groupAvatar,
      adminIds: body.adminIds ?? [],
      sectionId: body.sectionId,
      pinnedMessageIds: [],
      mutedBy: [],
      settings: {},
    };

    await this.ctx.storage.put(conversationKey(convId), conversation);

    // Track user->conversation mappings
    for (const pid of participantIds) {
      const userConvKey = userConversationsKey(pid);
      const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
      if (!userConvs.includes(convId)) {
        userConvs.push(convId);
        await this.ctx.storage.put(userConvKey, userConvs);
      }
    }

    // For section groups, store a section->conversation mapping
    if (body.isGroup && body.sectionId) {
      await this.ctx.storage.put(sectionGroupKey(body.sectionId), convId);
    }

    this.broadcastToConversation(convId, {
      type: "conversation_update",
      conversation: this.sanitizeConversation(conversation, ""),
    });

    return json({ conversation: this.sanitizeConversation(conversation, userId) });
  }

  private async listConversations(userId: string): Promise<Response> {
    const convs = await this.listConversationsRaw(userId);
    return json({ conversations: convs });
  }

  private async listConversationsRaw(userId: string): Promise<Array<Record<string, unknown>>> {
    const userConvKey = userConversationsKey(userId);
    const convIds = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];

    const conversations: Array<Record<string, unknown>> = [];
    for (const convId of convIds) {
      const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
      if (!conv || conv.deletedBy.includes(userId)) continue;
      conversations.push(this.sanitizeConversation(conv, userId));
    }

    conversations.sort((a, b) => {
      const aTime = (a.lastMessageAt as string) ?? "";
      const bTime = (b.lastMessageAt as string) ?? "";
      return bTime.localeCompare(aTime);
    });

    return conversations;
  }

  private async getMessages(userId: string, conversationId: string, before: string | null, limit: number): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }

    const prefix = messagePrefix(conversationId);
    const entries = await this.ctx.storage.list<StoredMessage>({ prefix });
    let messages = [...entries.values()];

    messages = messages.filter((m) => !m.deleted || m.senderId === userId);
    messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (before) {
      const idx = messages.findIndex((m) => m.id === before);
      if (idx > 0) {
        messages = messages.slice(0, idx);
      } else {
        messages = [];
      }
    }

    const result = messages.slice(-limit);
    return json({ messages: result, hasMore: messages.length > limit });
  }

  private async sendMessage(
    userId: string,
    conversationId: string,
    body: { text?: string; attachments?: StoredMessage["attachments"]; replyToId?: string; replyToText?: string; clientMessageId?: string },
  ): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }

    // Check if member is muted (group only)
    if (conv.isGroup) {
      const participant = conv.participantInfo.find((p) => p.userId === userId);
      if (participant?.isMuted) {
        return json({ error: "You are muted in this conversation" }, 403);
      }
    }

    if (!body.text?.trim() && (!body.attachments || body.attachments.length === 0)) {
      return json({ error: "Message cannot be empty" }, 400);
    }

    const senderInfo = conv.participantInfo.find((p) => p.userId === userId);
    const messageId = body.clientMessageId ?? crypto.randomUUID();
    const now = new Date().toISOString();

    // Detect URLs and fetch link preview
    let linkPreview: LinkPreview | undefined;
    if (body.text) {
      const urlMatch = body.text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        linkPreview = await this.fetchLinkPreview(urlMatch[0]);
      }
    }

    const message: StoredMessage = {
      id: messageId,
      conversationId,
      senderId: userId,
      senderName: senderInfo?.fullName ?? userId,
      senderRole: senderInfo?.role ?? "student",
      senderProfileImage: senderInfo?.profileImage,
      text: body.text?.trim() ?? "",
      attachments: body.attachments,
      createdAt: now,
      deliveryStatus: "sent",
      readBy: [userId],
      replyToId: body.replyToId,
      replyToText: body.replyToText,
      reactions: [],
      linkPreview,
    };

    await this.ctx.storage.put(`${messagePrefix(conversationId)}${messageId}`, message);

    conv.lastMessageText = body.text?.trim() || (body.attachments?.length ? `[${body.attachments[0].type}]` : "") || "";
    conv.lastMessageAt = now;
    conv.lastMessageSenderId = userId;
    conv.updatedAt = now;
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    this.broadcastToConversation(conversationId, { type: "message", message });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ message });
  }

  /** Fetch OpenGraph metadata for a URL to build a link preview */
  private async fetchLinkPreview(url: string): Promise<LinkPreview | undefined> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)" },
      });
      clearTimeout(timeout);
      if (!response.ok) return undefined;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return { url, title: url, description: "" };
      }

      const html = await response.text();
      const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<title>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const thumbMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const siteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

      const title = titleMatch?.[1]?.trim() ?? url;
      const description = descMatch?.[1]?.trim() ?? "";
      const thumbnail = thumbMatch?.[1]?.trim();
      const siteName = siteMatch?.[1]?.trim();

      // Resolve relative thumbnail URLs
      let resolvedThumb = thumbnail;
      if (thumbnail && !thumbnail.startsWith("http")) {
        try {
          resolvedThumb = new URL(thumbnail, url).toString();
        } catch { /* ignore */ }
      }

      return { url, title, description, thumbnail: resolvedThumb, siteName };
    } catch {
      return undefined;
    }
  }

  private async markRead(userId: string, conversationId: string, messageIds: string[]): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }

    const updatedIds: string[] = [];
    const prefix = messagePrefix(conversationId);

    if (messageIds.length > 0) {
      for (const msgId of messageIds) {
        const msg = await this.ctx.storage.get<StoredMessage>(`${prefix}${msgId}`);
        if (msg && !msg.readBy.includes(userId)) {
          msg.readBy.push(userId);
          if (msg.deliveryStatus !== "read" && msg.senderId !== userId) {
            msg.deliveryStatus = "read";
          }
          await this.ctx.storage.put(`${prefix}${msgId}`, msg);
          updatedIds.push(msgId);
        }
      }
    } else {
      const entries = await this.ctx.storage.list<StoredMessage>({ prefix });
      for (const msg of entries.values()) {
        if (!msg.readBy.includes(userId) && !msg.deleted) {
          msg.readBy.push(userId);
          if (msg.deliveryStatus !== "read" && msg.senderId !== userId) {
            msg.deliveryStatus = "read";
          }
          await this.ctx.storage.put(`${prefix}${msg.id}`, msg);
          updatedIds.push(msg.id);
        }
      }
    }

    if (updatedIds.length > 0) {
      this.broadcastToConversation(conversationId, {
        type: "read_receipt",
        conversationId,
        messageIds: updatedIds,
        readBy: userId,
      });
    }

    return json({ ok: true, updatedCount: updatedIds.length });
  }

  private async deleteMessage(userId: string, messageId: string): Promise<Response> {
    const allConvs = await this.ctx.storage.list<StoredConversation>({ prefix: "conv:" });
    for (const conv of allConvs.values()) {
      const msg = await this.ctx.storage.get<StoredMessage>(`${messagePrefix(conv.id)}${messageId}`);
      if (msg) {
        if (msg.senderId !== userId) {
          return json({ error: "Can only delete your own messages" }, 403);
        }
        msg.deleted = true;
        msg.text = "";
        msg.attachments = [];
        await this.ctx.storage.put(`${messagePrefix(conv.id)}${messageId}`, msg);

        this.broadcastToConversation(conv.id, { type: "message_delete", messageId, conversationId: conv.id });
        return json({ ok: true });
      }
    }
    return json({ error: "Message not found" }, 404);
  }

  private async editMessage(userId: string, messageId: string, text: string): Promise<Response> {
    const allConvs = await this.ctx.storage.list<StoredConversation>({ prefix: "conv:" });
    for (const conv of allConvs.values()) {
      const msg = await this.ctx.storage.get<StoredMessage>(`${messagePrefix(conv.id)}${messageId}`);
      if (msg) {
        if (msg.senderId !== userId) {
          return json({ error: "Can only edit your own messages" }, 403);
        }
        msg.text = text.trim();
        msg.edited = true;
        msg.editedAt = new Date().toISOString();
        await this.ctx.storage.put(`${messagePrefix(conv.id)}${messageId}`, msg);

        this.broadcastToConversation(conv.id, { type: "message_update", message: msg });
        return json({ ok: true, message: msg });
      }
    }
    return json({ error: "Message not found" }, 404);
  }

  private async toggleReaction(userId: string, messageId: string, emoji: string): Promise<Response> {
    if (!emoji || !EMOJI_REACTIONS.includes(emoji)) {
      return json({ error: "Invalid reaction" }, 400);
    }
    const allConvs = await this.ctx.storage.list<StoredConversation>({ prefix: "conv:" });
    for (const conv of allConvs.values()) {
      const msgKey = `${messagePrefix(conv.id)}${messageId}`;
      const msg = await this.ctx.storage.get<StoredMessage>(msgKey);
      if (msg) {
        if (!conv.participantIds.includes(userId)) {
          return json({ error: "Access denied" }, 403);
        }
        const reactions = msg.reactions ?? [];
        const existingIdx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
        if (existingIdx >= 0) {
          // Toggle off — remove reaction
          reactions.splice(existingIdx, 1);
        } else {
          // Remove any existing reaction by this user (one reaction per user per message)
          const userReactionIdx = reactions.findIndex((r) => r.userId === userId);
          if (userReactionIdx >= 0) reactions.splice(userReactionIdx, 1);
          reactions.push({ emoji, userId, timestamp: new Date().toISOString() });
        }
        msg.reactions = reactions;
        await this.ctx.storage.put(msgKey, msg);

        this.broadcastToConversation(conv.id, {
          type: "reaction",
          conversationId: conv.id,
          messageId,
          reactions,
        });
        return json({ ok: true, reactions });
      }
    }
    return json({ error: "Message not found" }, 404);
  }

  private async togglePin(userId: string, conversationId: string, messageId: string, pinned: boolean): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    // Only admins can pin in group chats
    if (conv.isGroup && conv.adminIds && !conv.adminIds.includes(userId)) {
      return json({ error: "Only group admins can pin messages" }, 403);
    }

    const msgKey = `${messagePrefix(conversationId)}${messageId}`;
    const msg = await this.ctx.storage.get<StoredMessage>(msgKey);
    if (!msg) return json({ error: "Message not found" }, 404);

    msg.pinned = pinned;
    await this.ctx.storage.put(msgKey, msg);

    const pinnedIds = conv.pinnedMessageIds ?? [];
    if (pinned) {
      if (!pinnedIds.includes(messageId)) pinnedIds.push(messageId);
    } else {
      const idx = pinnedIds.indexOf(messageId);
      if (idx >= 0) pinnedIds.splice(idx, 1);
    }
    conv.pinnedMessageIds = pinnedIds;
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    this.broadcastToConversation(conversationId, {
      type: "pinned_message",
      conversationId,
      messageId,
      pinned,
    });

    return json({ ok: true });
  }

  private async deleteConversation(userId: string, conversationId: string): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    if (!conv.deletedBy.includes(userId)) {
      conv.deletedBy.push(userId);
      await this.ctx.storage.put(conversationKey(conv.id), conv);
    }
    return json({ ok: true });
  }

  private async updateSettings(
    userId: string,
    conversationId: string,
    body: { settings?: ConversationSettings; groupName?: string; groupAvatar?: string },
  ): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    // Only admins can update group name/avatar in group chats
    if (conv.isGroup && conv.adminIds && !conv.adminIds.includes(userId)) {
      return json({ error: "Only group admins can update group settings" }, 403);
    }
    if (body.settings) {
      conv.settings = { ...conv.settings, ...body.settings };
    }
    if (body.groupName !== undefined) conv.groupName = body.groupName;
    if (body.groupAvatar !== undefined) conv.groupAvatar = body.groupAvatar;
    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    // Broadcast settings update to all participants
    this.broadcastToConversation(conversationId, {
      type: "settings_update",
      conversationId,
      settings: conv.settings ?? {},
    });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true, conversation: this.sanitizeConversation(conv, userId) });
  }

  private async addMember(
    userId: string,
    conversationId: string,
    body: { userId: string; fullName?: string; role?: string; profileImage?: string; isAdmin?: boolean },
  ): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    // Only admins can add members in group chats
    if (conv.isGroup && conv.adminIds && !conv.adminIds.includes(userId)) {
      return json({ error: "Only group admins can add members" }, 403);
    }
    // Prevent duplicates
    if (conv.participantIds.includes(body.userId)) {
      return json({ error: "Member already in conversation" }, 400);
    }

    const newParticipant = {
      userId: body.userId,
      fullName: body.fullName ?? body.userId,
      role: body.role ?? "student",
      profileImage: body.profileImage,
      isAdmin: body.isAdmin ?? false,
    };

    conv.participantIds.push(body.userId);
    conv.participantInfo.push(newParticipant);
    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    // Track user->conversation mapping
    const userConvKey = userConversationsKey(body.userId);
    const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
    if (!userConvs.includes(conversationId)) {
      userConvs.push(conversationId);
      await this.ctx.storage.put(userConvKey, userConvs);
    }

    this.broadcastToConversation(conversationId, {
      type: "member_added",
      conversationId,
      participant: newParticipant,
    });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true, conversation: this.sanitizeConversation(conv, userId) });
  }

  private async removeMember(
    userId: string,
    conversationId: string,
    targetUserId: string,
  ): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    // Admins can remove members, or users can remove themselves
    const isSelf = userId === targetUserId;
    const isAdmin = conv.isGroup && conv.adminIds?.includes(userId);
    if (!isSelf && !isAdmin) {
      return json({ error: "Only group admins can remove members" }, 403);
    }

    conv.participantIds = conv.participantIds.filter((id) => id !== targetUserId);
    conv.participantInfo = conv.participantInfo.filter((p) => p.userId !== targetUserId);
    conv.adminIds = (conv.adminIds ?? []).filter((id) => id !== targetUserId);
    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    // Remove user->conversation mapping
    const userConvKey = userConversationsKey(targetUserId);
    const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
    await this.ctx.storage.put(userConvKey, userConvs.filter((id) => id !== conversationId));

    this.broadcastToConversation(conversationId, {
      type: "member_removed",
      conversationId,
      userId: targetUserId,
    });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true });
  }

  private async toggleMute(userId: string, conversationId: string, muted: boolean): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    const mutedBy = conv.mutedBy ?? [];
    if (muted && !mutedBy.includes(userId)) {
      mutedBy.push(userId);
    } else if (!muted) {
      const idx = mutedBy.indexOf(userId);
      if (idx >= 0) mutedBy.splice(idx, 1);
    }
    conv.mutedBy = mutedBy;
    await this.ctx.storage.put(conversationKey(conversationId), conv);
    return json({ ok: true, muted });
  }

  private async toggleMemberMute(
    userId: string,
    conversationId: string,
    targetUserId: string,
    muted: boolean,
  ): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }
    if (!conv.isGroup || !conv.adminIds?.includes(userId)) {
      return json({ error: "Only group admins can mute members" }, 403);
    }
    const participant = conv.participantInfo.find((p) => p.userId === targetUserId);
    if (!participant) return json({ error: "Member not found" }, 404);
    // Can't mute other admins
    if (conv.adminIds.includes(targetUserId)) {
      return json({ error: "Cannot mute group admins" }, 403);
    }
    participant.isMuted = muted;
    await this.ctx.storage.put(conversationKey(conversationId), conv);

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true });
  }

  // ---- Section Group Chat Management ----

  private async createSectionGroup(body: {
    sectionId: string;
    sectionName: string;
    adminId: string;
    teacherId?: string;
    adminInfo: { userId: string; fullName: string; role: string; profileImage?: string };
    teacherInfo?: { userId: string; fullName: string; role: string; profileImage?: string };
  }): Promise<Response> {
    // Check if group already exists for this section
    const existingConvId = await this.ctx.storage.get<string>(sectionGroupKey(body.sectionId));
    if (existingConvId) {
      const existing = await this.ctx.storage.get<StoredConversation>(conversationKey(existingConvId));
      if (existing) {
        return json({ conversation: this.sanitizeConversation(existing, body.adminId), created: false });
      }
    }

    const participantIds = [body.adminInfo.userId];
    const participantInfo: StoredConversation["participantInfo"] = [
      { ...body.adminInfo, isAdmin: true },
    ];
    const adminIds = [body.adminInfo.userId];

    if (body.teacherInfo && body.teacherId) {
      participantIds.push(body.teacherInfo.userId);
      participantInfo.push({ ...body.teacherInfo, isAdmin: true });
      adminIds.push(body.teacherInfo.userId);
    }

    const convId = `group_section_${body.sectionId}`;
    const now = new Date().toISOString();
    const conversation: StoredConversation = {
      id: convId,
      participantIds,
      participantInfo,
      lastMessageText: "",
      lastMessageAt: now,
      lastMessageSenderId: "",
      createdAt: now,
      updatedAt: now,
      archivedBy: [],
      deletedBy: [],
      isGroup: true,
      groupName: body.sectionName,
      adminIds,
      sectionId: body.sectionId,
      pinnedMessageIds: [],
      mutedBy: [],
      settings: {},
    };

    await this.ctx.storage.put(conversationKey(convId), conversation);
    await this.ctx.storage.put(sectionGroupKey(body.sectionId), convId);

    for (const pid of participantIds) {
      const userConvKey = userConversationsKey(pid);
      const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
      if (!userConvs.includes(convId)) {
        userConvs.push(convId);
        await this.ctx.storage.put(userConvKey, userConvs);
      }
    }

    this.broadcastToConversation(convId, {
      type: "conversation_update",
      conversation: this.sanitizeConversation(conversation, ""),
    });

    return json({ conversation: this.sanitizeConversation(conversation, body.adminId), created: true });
  }

  private async addStudentToSectionGroup(body: {
    sectionId: string;
    student: { userId: string; fullName: string; role: string; profileImage?: string };
  }): Promise<Response> {
    const convId = await this.ctx.storage.get<string>(sectionGroupKey(body.sectionId));
    if (!convId) return json({ error: "Section group not found" }, 404);

    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
    if (!conv) return json({ error: "Conversation not found" }, 404);

    // Prevent duplicates
    if (conv.participantIds.includes(body.student.userId)) {
      return json({ ok: true, alreadyMember: true });
    }

    const newParticipant = {
      userId: body.student.userId,
      fullName: body.student.fullName,
      role: body.student.role,
      profileImage: body.student.profileImage,
      isAdmin: false,
    };

    conv.participantIds.push(body.student.userId);
    conv.participantInfo.push(newParticipant);
    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(convId), conv);

    const userConvKey = userConversationsKey(body.student.userId);
    const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
    if (!userConvs.includes(convId)) {
      userConvs.push(convId);
      await this.ctx.storage.put(userConvKey, userConvs);
    }

    this.broadcastToConversation(convId, {
      type: "member_added",
      conversationId: convId,
      participant: newParticipant,
    });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true });
  }

  private async removeStudentFromSectionGroup(body: { sectionId: string; userId: string }): Promise<Response> {
    const convId = await this.ctx.storage.get<string>(sectionGroupKey(body.sectionId));
    if (!convId) return json({ error: "Section group not found" }, 404);

    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
    if (!conv) return json({ error: "Conversation not found" }, 404);

    conv.participantIds = conv.participantIds.filter((id) => id !== body.userId);
    conv.participantInfo = conv.participantInfo.filter((p) => p.userId !== body.userId);
    conv.adminIds = (conv.adminIds ?? []).filter((id) => id !== body.userId);
    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(convId), conv);

    const userConvKey = userConversationsKey(body.userId);
    const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
    await this.ctx.storage.put(userConvKey, userConvs.filter((id) => id !== convId));

    this.broadcastToConversation(convId, {
      type: "member_removed",
      conversationId: convId,
      userId: body.userId,
    });

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true });
  }

  private async updateSectionGroupTeacher(body: {
    sectionId: string;
    oldTeacherId?: string;
    newTeacher?: { userId: string; fullName: string; role: string; profileImage?: string };
  }): Promise<Response> {
    const convId = await this.ctx.storage.get<string>(sectionGroupKey(body.sectionId));
    if (!convId) return json({ error: "Section group not found" }, 404);

    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
    if (!conv) return json({ error: "Conversation not found" }, 404);

    // Remove old teacher
    if (body.oldTeacherId) {
      conv.participantIds = conv.participantIds.filter((id) => id !== body.oldTeacherId);
      conv.participantInfo = conv.participantInfo.filter((p) => p.userId !== body.oldTeacherId);
      conv.adminIds = (conv.adminIds ?? []).filter((id) => id !== body.oldTeacherId);
      const userConvKey = userConversationsKey(body.oldTeacherId);
      const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
      await this.ctx.storage.put(userConvKey, userConvs.filter((id) => id !== convId));
      this.broadcastToConversation(convId, { type: "member_removed", conversationId: convId, userId: body.oldTeacherId });
    }

    // Add new teacher
    if (body.newTeacher) {
      if (!conv.participantIds.includes(body.newTeacher.userId)) {
        conv.participantIds.push(body.newTeacher.userId);
        conv.participantInfo.push({ ...body.newTeacher, isAdmin: true });
        conv.adminIds = [...(conv.adminIds ?? []), body.newTeacher.userId];
        const userConvKey = userConversationsKey(body.newTeacher.userId);
        const userConvs = (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];
        if (!userConvs.includes(convId)) {
          userConvs.push(convId);
          await this.ctx.storage.put(userConvKey, userConvs);
        }
        this.broadcastToConversation(convId, {
          type: "member_added",
          conversationId: convId,
          participant: { ...body.newTeacher, isAdmin: true },
        });
      }
    }

    conv.updatedAt = new Date().toISOString();
    await this.ctx.storage.put(conversationKey(convId), conv);

    for (const pid of conv.participantIds) {
      const sanitized = this.sanitizeConversation(conv, pid);
      this.broadcastToUser(pid, { type: "conversation_update", conversation: sanitized });
    }

    return json({ ok: true });
  }

  private async handleTyping(userId: string, conversationId: string, isTyping: boolean): Promise<Response> {
    const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(conversationId));
    if (!conv || !conv.participantIds.includes(userId)) {
      return json({ error: "Access denied" }, 403);
    }

    this.broadcastToConversation(conversationId, {
      type: "typing",
      conversationId,
      userId,
      isTyping,
      timestamp: new Date().toISOString(),
    }, userId);

    const timerKey = `${conversationId}:${userId}`;
    const existing = this.typingTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    if (isTyping) {
      const timer = setTimeout(() => {
        this.broadcastToConversation(conversationId, {
          type: "typing",
          conversationId,
          userId,
          isTyping: false,
          timestamp: new Date().toISOString(),
        }, userId);
        this.typingTimers.delete(timerKey);
      }, 5000);
      this.typingTimers.set(timerKey, timer);
    }

    return json({ ok: true });
  }

  private async updatePresence(userId: string, status: string): Promise<Response> {
    const now = new Date().toISOString();
    const presence: PresenceEntry = { userId, status, lastActiveAt: now };
    await this.ctx.storage.put(presenceKey(userId), presence);

    const presenceEvent = { type: "presence", userId, status, lastActiveAt: now };
    for (const [ws, conn] of this.wsConnections) {
      if (conn.userId !== userId) {
        try { ws.send(JSON.stringify(presenceEvent)); } catch { /* ignore */ }
      }
    }
    return json({ ok: true });
  }

  private async getPresence(userIds: string[]): Promise<Response> {
    const presences: Record<string, PresenceEntry | null> = {};
    for (const uid of userIds) {
      const p = await this.ctx.storage.get<PresenceEntry>(presenceKey(uid));
      if (p && p.status === "online") {
        const age = Date.now() - new Date(p.lastActiveAt).getTime();
        if (age > 120000) {
          presences[uid] = { ...p, status: "offline" };
        } else {
          presences[uid] = p;
        }
      } else {
        presences[uid] = p;
      }
    }
    return json({ presences });
  }

  private async searchMessages(userId: string, query: string, conversationId: string | null): Promise<Response> {
    if (!query.trim()) return json({ results: [] });
    const userConvKey = userConversationsKey(userId);
    const convIds = conversationId
      ? [conversationId]
      : (await this.ctx.storage.get<string[]>(userConvKey)) ?? [];

    const results: Array<Record<string, unknown>> = [];
    const lowerQuery = query.toLowerCase();

    for (const convId of convIds) {
      const conv = await this.ctx.storage.get<StoredConversation>(conversationKey(convId));
      if (!conv || !conv.participantIds.includes(userId)) continue;

      const prefix = messagePrefix(convId);
      const entries = await this.ctx.storage.list<StoredMessage>({ prefix });
      for (const msg of entries.values()) {
        if (msg.deleted) continue;
        if (msg.text.toLowerCase().includes(lowerQuery)) {
          results.push({
            conversationId: convId,
            messageId: msg.id,
            text: msg.text,
            senderName: msg.senderName,
            createdAt: msg.createdAt,
          });
        }
      }
    }

    results.sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string));
    return json({ results: results.slice(0, 50) });
  }

  private sanitizeConversation(conv: StoredConversation, userId: string): Record<string, unknown> {
    return {
      id: conv.id,
      participantIds: conv.participantIds,
      participantInfo: conv.participantInfo,
      lastMessageText: conv.lastMessageText,
      lastMessageAt: conv.lastMessageAt,
      lastMessageSenderId: conv.lastMessageSenderId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      organizationId: conv.organizationId,
      isGroup: conv.isGroup ?? false,
      groupName: conv.groupName,
      groupAvatar: conv.groupAvatar,
      adminIds: conv.adminIds ?? [],
      sectionId: conv.sectionId,
      pinnedMessageIds: conv.pinnedMessageIds ?? [],
      mutedBy: conv.mutedBy ?? [],
      settings: conv.settings ?? {},
      unreadCount: 0,
    };
  }

  private broadcastToConversation(conversationId: string, event: unknown, excludeUserId?: string): void {
    const message = JSON.stringify(event);
    for (const [ws, conn] of this.wsConnections) {
      if (excludeUserId && conn.userId === excludeUserId) continue;
      if (conn.conversationIds.has(conversationId) || conn.conversationIds.size === 0) {
        try { ws.send(message); } catch { /* ignore */ }
      }
    }
  }

  private broadcastToUser(userId: string, event: unknown): void {
    const message = JSON.stringify(event);
    for (const [ws, conn] of this.wsConnections) {
      if (conn.userId === userId) {
        try { ws.send(message); } catch { /* ignore */ }
      }
    }
  }
}
