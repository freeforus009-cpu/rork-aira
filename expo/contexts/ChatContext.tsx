import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Contacts from 'expo-contacts';
import {
  ChatMessage,
  ChatReaction,
  Conversation,
  ConversationParticipant,
  ConversationSettings,
  ChatContact,
  ChatConnectionState,
  ChatPresenceStatus,
  ChatWSEvent,
  MessageAttachment,
  MessageDeliveryStatus,
  User,
} from '@/types';
import { useAuth } from './AuthContext';
import { useConnectivity } from './ConnectivityContext';
import { useToast } from './ToastContext';
import { getSessionToken, uploadLocalFile } from '@/services/cloudSync';

const FUNCTIONS_URL = (process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '').replace(/\/$/, '');
const CHAT_MESSAGES_KEY = 'aira_chat_messages_v1';
const CHAT_CONVERSATIONS_KEY = 'aira_chat_conversations_v1';
const CHAT_PRESENCE_KEY = 'aira_chat_presence_v1';
const CHAT_UNREAD_KEY = 'aira_chat_unread_v1';
const CHAT_SETTINGS_KEY = 'aira_chat_settings_v1';
const CHAT_MUTED_KEY = 'aira_chat_muted_v1';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const TYPING_TIMEOUT = 5000;

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '✅'];

const BACKGROUND_PRESETS = [
  { name: 'Default', color: '' },
  { name: 'Midnight', color: '#0A1420' },
  { name: 'Deep Ocean', color: '#0D1B2A' },
  { name: 'Forest', color: '#1B2D1B' },
  { name: 'Plum', color: '#2A1B2E' },
  { name: 'Crimson', color: '#2A0E0E' },
  { name: 'Slate', color: '#1A1A2E' },
  { name: 'Teal Dark', color: '#0D2620' },
];

function chatEndpoint(path: string): string {
  return `${FUNCTIONS_URL}/v1/chat${path}`;
}

function wsEndpoint(userId: string, token: string): string {
  const wsBase = FUNCTIONS_URL.replace(/^http/, 'ws');
  return `${wsBase}/v1/chat/ws?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

async function authHeaders(userId: string): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    'X-School-User-Id': userId,
    ...(token ? { 'X-School-Session': token } : {}),
  };
}

interface PendingMessage {
  clientMessageId: string;
  conversationId: string;
  text: string;
  attachments?: MessageAttachment[];
  retryCount: number;
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const auth = useAuth();
  const { currentUser, allUsers, sections } = auth;
  const { isOnline } = useConnectivity();
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('disconnected');
  const [presence, setPresence] = useState<Record<string, ChatPresenceStatus>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Record<string, boolean>>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(new Set());
  const [conversationSettings, setConversationSettings] = useState<Record<string, ConversationSettings>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeConversationRef = useRef<string | null>(null);
  const isOnlineRef = useRef(isOnline);
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeConversationRef.current = activeConversationId; }, [activeConversationId]);

  // Load cached data from AsyncStorage on mount
  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      try {
        const [msgsRaw, convsRaw, presenceRaw, unreadRaw, mutedRaw, settingsRaw] = await Promise.all([
          AsyncStorage.getItem(CHAT_MESSAGES_KEY),
          AsyncStorage.getItem(CHAT_CONVERSATIONS_KEY),
          AsyncStorage.getItem(CHAT_PRESENCE_KEY),
          AsyncStorage.getItem(CHAT_UNREAD_KEY),
          AsyncStorage.getItem(CHAT_MUTED_KEY),
          AsyncStorage.getItem(CHAT_SETTINGS_KEY),
        ]);
        if (msgsRaw) setMessages(JSON.parse(msgsRaw));
        if (convsRaw) setConversations(JSON.parse(convsRaw));
        if (presenceRaw) setPresence(JSON.parse(presenceRaw));
        if (unreadRaw) setUnreadCounts(JSON.parse(unreadRaw));
        if (mutedRaw) setMutedConversations(new Set(JSON.parse(mutedRaw)));
        if (settingsRaw) setConversationSettings(JSON.parse(settingsRaw));
      } catch (e) {
        console.log('[Chat] Failed to load cached data');
      }
    })();
  }, [currentUser?.id]);

  const persistMessages = useCallback(async (msgs: Record<string, ChatMessage[]>) => {
    try {
      const existing = await AsyncStorage.getItem(CHAT_MESSAGES_KEY);
      const existingMsgs = existing ? JSON.parse(existing) : {};
      const merged = { ...existingMsgs, ...msgs };
      for (const key of Object.keys(merged)) {
        if (merged[key].length > 100) {
          merged[key] = merged[key].slice(-100);
        }
      }
      await AsyncStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(merged));
    } catch (e) {
      console.log('[Chat] Failed to persist messages');
    }
  }, []);

  const persistConversations = useCallback(async (convs: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(convs));
    } catch (e) {
      console.log('[Chat] Failed to persist conversations');
    }
  }, []);

  const persistUnread = useCallback(async (counts: Record<string, number>) => {
    try {
      await AsyncStorage.setItem(CHAT_UNREAD_KEY, JSON.stringify(counts));
    } catch (e) {
      console.log('[Chat] Failed to persist unread counts');
    }
  }, []);

  const persistMuted = useCallback(async (muted: Set<string>) => {
    try {
      await AsyncStorage.setItem(CHAT_MUTED_KEY, JSON.stringify([...muted]));
    } catch (e) {
      console.log('[Chat] Failed to persist muted set');
    }
  }, []);

  const persistSettings = useCallback(async (settings: Record<string, ConversationSettings>) => {
    try {
      await AsyncStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.log('[Chat] Failed to persist settings');
    }
  }, []);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!currentUser || !isOnlineRef.current || !FUNCTIONS_URL) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    setConnectionState('connecting');

    getSessionToken().then(token => {
      if (!token || !currentUserRef.current) {
        setConnectionState('disconnected');
        return;
      }

      try {
        const ws = new WebSocket(wsEndpoint(currentUserRef.current.id, token));
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setConnectionState('connected');
          console.log('[Chat] WebSocket connected');
          setPendingMessages(prev => {
            if (prev.length > 0) {
              prev.forEach(pm => { void sendPendingMessage(pm); });
            }
            return [];
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data)) as ChatWSEvent;
            handleWSEvent(data);
          } catch (e) {
            console.log('[Chat] Ignored malformed WS message');
          }
        };

        ws.onerror = () => { console.log('[Chat] WebSocket error'); };

        ws.onclose = () => {
          wsRef.current = null;
          setConnectionState('disconnected');
          if (currentUserRef.current && isOnlineRef.current) {
            scheduleReconnect();
          }
        };
      } catch (e) {
        setConnectionState('disconnected');
        scheduleReconnect();
      }
    });
  }, [currentUser]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[Chat] Max reconnection attempts reached');
      setConnectionState('disconnected');
      return;
    }
    reconnectAttemptsRef.current += 1;
    setConnectionState('reconnecting');
    const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 5);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => { connectWebSocket(); }, delay);
  }, [connectWebSocket]);

  // Handle incoming WebSocket events
  const handleWSEvent = useCallback((event: ChatWSEvent) => {
    switch (event.type) {
      case 'connected':
        break;

      case 'conversations': {
        const convs = event.conversations as Conversation[];
        setConversations(prev => {
          const merged = convs.map(c => {
            const existing = prev.find(p => p.id === c.id);
            return existing ? { ...c, unreadCount: existing.unreadCount } : c;
          });
          void persistConversations(merged);
          return merged;
        });
        break;
      }

      case 'conversation_update': {
        const updated = event.conversation as Conversation;
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === updated.id);
          if (idx === -1) {
            void persistConversations([...prev, updated]);
            return [...prev, updated];
          }
          const merged = [...prev];
          merged[idx] = { ...merged[idx], ...updated, unreadCount: merged[idx].unreadCount };
          void persistConversations(merged);
          return merged;
        });
        break;
      }

      case 'message': {
        const msg = event.message as ChatMessage;
        if (msg.deleted) return;
        setMessages(prev => {
          const convMsgs = prev[msg.conversationId] ?? [];
          if (convMsgs.some(m => m.id === msg.id)) return prev;
          const updated = { ...prev, [msg.conversationId]: [...convMsgs, msg] };
          void persistMessages({ [msg.conversationId]: updated[msg.conversationId] });
          return updated;
        });

        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === msg.conversationId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            lastMessageText: msg.text || (msg.attachments?.length ? `[${msg.attachments[0].type}]` : ''),
            lastMessageAt: msg.createdAt,
            lastMessageSenderId: msg.senderId,
          };
          void persistConversations(updated);
          return updated;
        });

        if (msg.senderId !== currentUserRef.current?.id && activeConversationRef.current !== msg.conversationId) {
          // Check if conversation is muted
          const conv = conversations.find(c => c.id === msg.conversationId);
          const isMuted = conv?.mutedBy?.includes(currentUserRef.current?.id ?? '') ?? false;
          if (!isMuted) {
            setUnreadCounts(prev => {
              const updated = { ...prev, [msg.conversationId]: (prev[msg.conversationId] ?? 0) + 1 };
              void persistUnread(updated);
              return updated;
            });
            const sender = msg.senderName || 'Someone';
            const preview = msg.text || (msg.attachments?.length ? `Sent a ${msg.attachments[0].type}` : 'New message');
            showToast('info', `${sender}: ${preview.slice(0, 60)}`, { title: 'New Message', duration: 4000 });
          }
        }
        break;
      }

      case 'message_update': {
        const msg = event.message as ChatMessage;
        setMessages(prev => {
          const convMsgs = prev[msg.conversationId] ?? [];
          const idx = convMsgs.findIndex(m => m.id === msg.id);
          if (idx === -1) return prev;
          const updated = [...convMsgs];
          updated[idx] = msg;
          return { ...prev, [msg.conversationId]: updated };
        });
        break;
      }

      case 'message_delete': {
        setMessages(prev => {
          const convMsgs = prev[event.conversationId] ?? [];
          const updated = convMsgs.map(m =>
            m.id === event.messageId ? { ...m, deleted: true, text: '', attachments: [] } : m
          );
          return { ...prev, [event.conversationId]: updated };
        });
        break;
      }

      case 'reaction': {
        const { conversationId, messageId, reactions } = event;
        setMessages(prev => {
          const convMsgs = prev[conversationId] ?? [];
          const updated = convMsgs.map(m =>
            m.id === messageId ? { ...m, reactions: reactions as ChatReaction[] } : m
          );
          void persistMessages({ [conversationId]: updated });
          return { ...prev, [conversationId]: updated };
        });
        break;
      }

      case 'member_added':
      case 'member_removed': {
        // Conversation will be updated via conversation_update broadcast
        break;
      }

      case 'pinned_message': {
        const { conversationId, messageId, pinned } = event;
        setMessages(prev => {
          const convMsgs = prev[conversationId] ?? [];
          const updated = convMsgs.map(m =>
            m.id === messageId ? { ...m, pinned } : m
          );
          void persistMessages({ [conversationId]: updated });
          return { ...prev, [conversationId]: updated };
        });
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === conversationId);
          if (idx === -1) return prev;
          const updated = [...prev];
          const pinnedIds = updated[idx].pinnedMessageIds ?? [];
          if (pinned && !pinnedIds.includes(messageId)) {
            updated[idx] = { ...updated[idx], pinnedMessageIds: [...pinnedIds, messageId] };
          } else if (!pinned) {
            updated[idx] = { ...updated[idx], pinnedMessageIds: pinnedIds.filter(id => id !== messageId) };
          }
          void persistConversations(updated);
          return updated;
        });
        break;
      }

      case 'settings_update': {
        const { conversationId, settings } = event;
        setConversationSettings(prev => {
          const updated = { ...prev, [conversationId]: settings as ConversationSettings };
          void persistSettings(updated);
          return updated;
        });
        break;
      }

      case 'typing': {
        const { conversationId, userId, isTyping } = event;
        setTypingUsers(prev => {
          const convTyping = { ...(prev[conversationId] ?? {}) };
          if (isTyping) { convTyping[userId] = true; } else { delete convTyping[userId]; }
          return { ...prev, [conversationId]: convTyping };
        });
        const timerKey = `${conversationId}:${userId}`;
        const existing = typingTimersRef.current.get(timerKey);
        if (existing) clearTimeout(existing);
        if (isTyping) {
          const timer = setTimeout(() => {
            setTypingUsers(prev => {
              const convTyping = { ...(prev[conversationId] ?? {}) };
              delete convTyping[userId];
              return { ...prev, [conversationId]: convTyping };
            });
            typingTimersRef.current.delete(timerKey);
          }, TYPING_TIMEOUT);
          typingTimersRef.current.set(timerKey, timer);
        }
        break;
      }

      case 'presence': {
        const { userId, status } = event;
        setPresence(prev => {
          const updated = { ...prev, [userId]: status as ChatPresenceStatus };
          void AsyncStorage.setItem(CHAT_PRESENCE_KEY, JSON.stringify(updated)).catch(() => undefined);
          return updated;
        });
        break;
      }

      case 'read_receipt': {
        const { conversationId, messageIds, readBy } = event;
        setMessages(prev => {
          const convMsgs = prev[conversationId] ?? [];
          const updated = convMsgs.map(m => {
            if (messageIds.includes(m.id)) {
              const readBySet = new Set([...(m.readBy ?? []), readBy]);
              const newStatus: MessageDeliveryStatus = readBySet.size >= 2 ? 'read' : 'delivered';
              return {
                ...m,
                readBy: [...readBySet],
                deliveryStatus: m.senderId === currentUserRef.current?.id ? newStatus : m.deliveryStatus,
              };
            }
            return m;
          });
          return { ...prev, [conversationId]: updated };
        });
        if (readBy === currentUserRef.current?.id) {
          setUnreadCounts(prev => {
            const updated = { ...prev, [conversationId]: 0 };
            void persistUnread(updated);
            return updated;
          });
        }
        break;
      }

      case 'error':
        console.log('[Chat] Server error:', event.error);
        break;
    }
  }, [persistConversations, persistMessages, persistUnread, persistSettings, showToast, conversations]);

  // Send a pending message (retry logic)
  const sendPendingMessage = useCallback(async (pm: PendingMessage): Promise<void> => {
    if (!currentUser) return;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint(`/conversations/${pm.conversationId}/messages`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: pm.text,
          attachments: pm.attachments,
          clientMessageId: pm.clientMessageId,
        }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      const result = await response.json() as { message: ChatMessage };
      setMessages(prev => {
        const convMsgs = prev[pm.conversationId] ?? [];
        const updated = convMsgs.map(m =>
          m.id === pm.clientMessageId
            ? { ...result.message, deliveryStatus: 'sent' as MessageDeliveryStatus }
            : m
        );
        void persistMessages({ [pm.conversationId]: updated });
        return { ...prev, [pm.conversationId]: updated };
      });
    } catch (e) {
      if (pm.retryCount < 3) {
        setTimeout(() => {
          void sendPendingMessage({ ...pm, retryCount: pm.retryCount + 1 });
        }, RECONNECT_DELAY * (pm.retryCount + 1));
      } else {
        setMessages(prev => {
          const convMsgs = prev[pm.conversationId] ?? [];
          const updated = convMsgs.map(m =>
            m.id === pm.clientMessageId ? { ...m, deliveryStatus: 'failed' as MessageDeliveryStatus } : m
          );
          return { ...prev, [pm.conversationId]: updated };
        });
        showToast('error', 'Failed to send message. Tap to retry.');
      }
    }
  }, [currentUser, persistMessages, showToast]);

  // Connect/disconnect WebSocket based on user and connectivity
  useEffect(() => {
    if (!currentUser || !isOnline || !FUNCTIONS_URL) {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setConnectionState('disconnected');
      return;
    }
    const timer = setTimeout(() => { connectWebSocket(); }, 500);
    return () => {
      clearTimeout(timer);
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };
  }, [currentUser?.id, isOnline, connectWebSocket]);

  useEffect(() => {
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      typingTimersRef.current.forEach(t => clearTimeout(t));
      typingTimersRef.current.clear();
    };
  }, []);

  // ---- API Methods ----

  const getOrCreateConversation = useCallback(async (
    otherUserId: string,
    otherUserInfo?: { fullName: string; role: User['role']; profileImage?: string },
  ): Promise<Conversation | null> => {
    if (!currentUser) return null;
    try {
      const headers = await authHeaders(currentUser.id);
      const participantInfo = [
        { userId: currentUser.id, fullName: currentUser.fullName, role: currentUser.role, profileImage: currentUser.profileImage },
        { userId: otherUserId, fullName: otherUserInfo?.fullName ?? otherUserId, role: otherUserInfo?.role ?? 'student', profileImage: otherUserInfo?.profileImage },
      ];
      const response = await fetch(chatEndpoint('/conversations'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ participantIds: [currentUser.id, otherUserId], participantInfo }),
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      const result = await response.json() as { conversation: Conversation };
      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== result.conversation.id);
        const updated = [result.conversation, ...filtered];
        void persistConversations(updated);
        return updated;
      });
      return result.conversation;
    } catch (e) {
      showToast('error', 'Could not start conversation');
      return null;
    }
  }, [currentUser, persistConversations, showToast]);

  const fetchMessages = useCallback(async (conversationId: string, before?: string): Promise<ChatMessage[]> => {
    if (!currentUser) return [];
    try {
      const headers = await authHeaders(currentUser.id);
      const params = before ? `?before=${encodeURIComponent(before)}&limit=50` : '?limit=50';
      const response = await fetch(chatEndpoint(`/conversations/${conversationId}/messages${params}`), { headers });
      if (!response.ok) return [];
      const result = await response.json() as { messages: ChatMessage[]; hasMore: boolean };
      setMessages(prev => {
        const existing = prev[conversationId] ?? [];
        const existingIds = new Set(existing.map(m => m.id));
        const newMsgs = result.messages.filter(m => !existingIds.has(m.id));
        const merged = [...newMsgs, ...existing];
        void persistMessages({ [conversationId]: merged });
        return { ...prev, [conversationId]: merged };
      });
      return result.messages;
    } catch (e) { return []; }
  }, [currentUser, persistMessages]);

  const sendMessage = useCallback(async (
    conversationId: string,
    text: string,
    attachments?: MessageAttachment[],
    replyToId?: string,
    replyToText?: string,
  ): Promise<void> => {
    if (!currentUser || (!text.trim() && (!attachments || attachments.length === 0))) return;
    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderRole: currentUser.role,
      senderProfileImage: currentUser.profileImage,
      text: text.trim(),
      attachments,
      createdAt: now,
      deliveryStatus: 'sending',
      readBy: [currentUser.id],
      replyToId,
      replyToText,
      reactions: [],
    };
    setMessages(prev => {
      const convMsgs = prev[conversationId] ?? [];
      const updated = [...convMsgs, optimisticMessage];
      void persistMessages({ [conversationId]: updated });
      return { ...prev, [conversationId]: updated };
    });
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conversationId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        lastMessageText: text.trim() || (attachments?.length ? `[${attachments[0].type}]` : ''),
        lastMessageAt: now,
        lastMessageSenderId: currentUser.id,
      };
      void persistConversations(updated);
      return updated;
    });
    if (isOnlineRef.current && connectionState === 'connected') {
      void sendPendingMessage({ clientMessageId, conversationId, text: text.trim(), attachments, retryCount: 0 });
    } else {
      setPendingMessages(prev => [...prev, { clientMessageId, conversationId, text: text.trim(), attachments, retryCount: 0 }]);
    }
  }, [currentUser, persistMessages, persistConversations, connectionState, sendPendingMessage]);

  const retryMessage = useCallback((conversationId: string, messageId: string) => {
    setMessages(prev => {
      const convMsgs = prev[conversationId] ?? [];
      const msg = convMsgs.find(m => m.id === messageId);
      if (!msg) return prev;
      void sendPendingMessage({ clientMessageId: messageId, conversationId, text: msg.text, attachments: msg.attachments, retryCount: 0 });
      const updated = convMsgs.map(m => m.id === messageId ? { ...m, deliveryStatus: 'sending' as MessageDeliveryStatus } : m);
      void persistMessages({ [conversationId]: updated });
      return { ...prev, [conversationId]: updated };
    });
  }, [sendPendingMessage, persistMessages]);

  const markConversationRead = useCallback(async (conversationId: string): Promise<void> => {
    if (!currentUser) return;
    setUnreadCounts(prev => { const updated = { ...prev, [conversationId]: 0 }; void persistUnread(updated); return updated; });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}/read`), { method: 'POST', headers, body: JSON.stringify({}) });
    } catch (e) { /* silent */ }
  }, [currentUser, persistUnread]);

  const deleteMessage = useCallback(async (conversationId: string, messageId: string): Promise<void> => {
    if (!currentUser) return;
    setMessages(prev => {
      const convMsgs = prev[conversationId] ?? [];
      const updated = convMsgs.map(m => m.id === messageId ? { ...m, deleted: true, text: '', attachments: [] } : m);
      void persistMessages({ [conversationId]: updated });
      return { ...prev, [conversationId]: updated };
    });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/messages/${messageId}`), { method: 'DELETE', headers });
    } catch (e) { /* revert */ }
  }, [currentUser, persistMessages]);

  const editMessage = useCallback(async (conversationId: string, messageId: string, newText: string): Promise<void> => {
    if (!currentUser) return;
    setMessages(prev => {
      const convMsgs = prev[conversationId] ?? [];
      const updated = convMsgs.map(m => m.id === messageId ? { ...m, text: newText.trim(), edited: true, editedAt: new Date().toISOString() } : m);
      void persistMessages({ [conversationId]: updated });
      return { ...prev, [conversationId]: updated };
    });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/messages/${messageId}/edit`), { method: 'PATCH', headers, body: JSON.stringify({ text: newText }) });
    } catch (e) { /* silent */ }
  }, [currentUser, persistMessages]);

  const deleteConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!currentUser) return;
    setConversations(prev => { const updated = prev.filter(c => c.id !== conversationId); void persistConversations(updated); return updated; });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}`), { method: 'DELETE', headers });
    } catch (e) { /* silent */ }
  }, [currentUser, persistConversations]);

  /** Toggle reaction on a message */
  const toggleReaction = useCallback(async (conversationId: string, messageId: string, emoji: string): Promise<void> => {
    if (!currentUser) return;
    // Optimistic update
    setMessages(prev => {
      const convMsgs = prev[conversationId] ?? [];
      const updated = convMsgs.map(m => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ?? [];
        const existing = reactions.find(r => r.userId === currentUser.id && r.emoji === emoji);
        if (existing) {
          return { ...m, reactions: reactions.filter(r => !(r.userId === currentUser.id && r.emoji === emoji)) };
        }
        const userReaction = reactions.find(r => r.userId === currentUser.id);
        const filtered = userReaction ? reactions.filter(r => r.userId !== currentUser.id) : reactions;
        return { ...m, reactions: [...filtered, { emoji, userId: currentUser.id, timestamp: new Date().toISOString() }] };
      });
      void persistMessages({ [conversationId]: updated });
      return { ...prev, [conversationId]: updated };
    });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/messages/${messageId}/reactions`), { method: 'POST', headers, body: JSON.stringify({ emoji }) });
    } catch (e) { /* silent */ }
  }, [currentUser, persistMessages]);

  /** Pin or unpin a message */
  const togglePin = useCallback(async (conversationId: string, messageId: string, pinned: boolean): Promise<void> => {
    if (!currentUser) return;
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}/pin/${messageId}`), { method: 'POST', headers, body: JSON.stringify({ pinned }) });
    } catch (e) { /* silent */ }
  }, [currentUser]);

  /** Mute or unmute a conversation */
  const toggleMute = useCallback(async (conversationId: string, muted: boolean): Promise<void> => {
    if (!currentUser) return;
    setMutedConversations(prev => {
      const updated = new Set(prev);
      if (muted) updated.add(conversationId); else updated.delete(conversationId);
      void persistMuted(updated);
      return updated;
    });
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conversationId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const mutedBy = updated[idx].mutedBy ?? [];
      if (muted && !mutedBy.includes(currentUser.id)) mutedBy.push(currentUser.id);
      else if (!muted) { const i = mutedBy.indexOf(currentUser.id); if (i >= 0) mutedBy.splice(i, 1); }
      updated[idx] = { ...updated[idx], mutedBy };
      void persistConversations(updated);
      return updated;
    });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}/mute`), { method: 'POST', headers, body: JSON.stringify({ muted }) });
    } catch (e) { /* silent */ }
  }, [currentUser, persistMuted, persistConversations]);

  /** Update conversation background settings */
  const updateConversationSettings = useCallback(async (conversationId: string, settings: ConversationSettings): Promise<void> => {
    if (!currentUser) return;
    setConversationSettings(prev => {
      const updated = { ...prev, [conversationId]: settings };
      void persistSettings(updated);
      return updated;
    });
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}`), { method: 'PATCH', headers, body: JSON.stringify({ settings }) });
    } catch (e) { /* silent */ }
  }, [currentUser, persistSettings]);

  /** Add a member to a group conversation */
  const addMember = useCallback(async (
    conversationId: string,
    userId: string,
    userInfo?: { fullName: string; role: User['role']; profileImage?: string },
  ): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint(`/conversations/${conversationId}/members`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, fullName: userInfo?.fullName, role: userInfo?.role, profileImage: userInfo?.profileImage }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  /** Remove a member from a group conversation */
  const removeMember = useCallback(async (conversationId: string, userId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint(`/conversations/${conversationId}/members`), {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ userId }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  /** Mute a member (admin action in group chats) */
  const toggleMemberMute = useCallback(async (conversationId: string, userId: string, muted: boolean): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint(`/conversations/${conversationId}/members/${userId}/mute`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ muted }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  /** Import device contacts and match against existing users */
  const importDeviceContacts = useCallback(async (): Promise<ChatContact[]> => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('error', 'Contacts permission denied');
        return [];
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Name],
      });
      const contacts: ChatContact[] = data.map((c, i) => ({
        id: c.id ?? `contact_${i}`,
        name: c.name ?? 'Unknown',
        phoneNumbers: (c.phoneNumbers ?? []).map(p => p.number ?? '').filter(Boolean),
        emails: (c.emails ?? []).map(e => e.email ?? '').filter(Boolean),
      }));
      // Match against existing users by email or phone
      const users = allUsers;
      for (const contact of contacts) {
        const matched = users.find(u => {
          if (u.email && contact.emails.some(e => e.toLowerCase() === u.email.toLowerCase())) return true;
          return false;
        });
        if (matched) contact.matchedUserId = matched.id;
      }
      return contacts.filter(c => c.matchedUserId);
    } catch (e) {
      showToast('error', 'Could not import contacts');
      return [];
    }
  }, [allUsers, showToast]);

  // ---- Section Group Chat Management ----

  /** Create a section group chat (called when a section is created) */
  const createSectionGroupChat = useCallback(async (
    sectionId: string,
    sectionName: string,
    adminInfo: { userId: string; fullName: string; role: User['role']; profileImage?: string },
    teacherInfo?: { userId: string; fullName: string; role: User['role']; profileImage?: string },
  ): Promise<Conversation | null> => {
    if (!currentUser || !FUNCTIONS_URL) return null;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint('/section-group'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sectionId,
          sectionName,
          adminId: currentUser.id,
          adminInfo: { userId: adminInfo.userId, fullName: adminInfo.fullName, role: adminInfo.role, profileImage: adminInfo.profileImage },
          teacherInfo: teacherInfo ? { userId: teacherInfo.userId, fullName: teacherInfo.fullName, role: teacherInfo.role, profileImage: teacherInfo.profileImage } : undefined,
        }),
      });
      if (!response.ok) return null;
      const result = await response.json() as { conversation: Conversation };
      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== result.conversation.id);
        const updated = [result.conversation, ...filtered];
        void persistConversations(updated);
        return updated;
      });
      return result.conversation;
    } catch (e) { return null; }
  }, [currentUser, persistConversations]);

  /** Add a student to a section group chat */
  const addStudentToSectionGroup = useCallback(async (
    sectionId: string,
    student: { userId: string; fullName: string; role: User['role']; profileImage?: string },
  ): Promise<boolean> => {
    if (!currentUser || !FUNCTIONS_URL) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint('/section-group/add-student'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ sectionId, student: { userId: student.userId, fullName: student.fullName, role: student.role, profileImage: student.profileImage } }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  /** Remove a student from a section group chat */
  const removeStudentFromSectionGroup = useCallback(async (sectionId: string, userId: string): Promise<boolean> => {
    if (!currentUser || !FUNCTIONS_URL) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint('/section-group/remove-student'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ sectionId, userId }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  /** Update the teacher in a section group chat */
  const updateSectionGroupTeacher = useCallback(async (
    sectionId: string,
    oldTeacherId: string | undefined,
    newTeacher?: { userId: string; fullName: string; role: User['role']; profileImage?: string },
  ): Promise<boolean> => {
    if (!currentUser || !FUNCTIONS_URL) return false;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint('/section-group/update-teacher'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sectionId,
          oldTeacherId,
          newTeacher: newTeacher ? { userId: newTeacher.userId, fullName: newTeacher.fullName, role: newTeacher.role, profileImage: newTeacher.profileImage } : undefined,
        }),
      });
      return response.ok;
    } catch (e) { return false; }
  }, [currentUser]);

  const sendTyping = useCallback(async (conversationId: string, isTyping: boolean): Promise<void> => {
    if (!currentUser || connectionState !== 'connected') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'typing', conversationId, isTyping })); } catch (e) { /* fallback */ }
      return;
    }
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint(`/conversations/${conversationId}/typing`), { method: 'POST', headers, body: JSON.stringify({ isTyping }) });
    } catch (e) { /* silent */ }
  }, [currentUser, connectionState]);

  const updatePresence = useCallback(async (status: ChatPresenceStatus): Promise<void> => {
    if (!currentUser) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'presence', status })); } catch (e) { /* fallback */ }
      return;
    }
    try {
      const headers = await authHeaders(currentUser.id);
      await fetch(chatEndpoint('/presence'), { method: 'POST', headers, body: JSON.stringify({ status }) });
    } catch (e) { /* silent */ }
  }, [currentUser]);

  const searchMessages = useCallback(async (query: string, conversationId?: string): Promise<Array<{
    conversationId: string; messageId: string; text: string; senderName: string; createdAt: string;
  }>> => {
    if (!currentUser || !query.trim()) return [];
    try {
      const headers = await authHeaders(currentUser.id);
      const params = new URLSearchParams({ q: query });
      if (conversationId) params.set('conversationId', conversationId);
      const response = await fetch(chatEndpoint(`/search?${params.toString()}`), { headers });
      if (!response.ok) return [];
      const result = await response.json() as { results: Array<{ conversationId: string; messageId: string; text: string; senderName: string; createdAt: string }> };
      return result.results;
    } catch (e) { return []; }
  }, [currentUser]);

  const uploadAttachment = useCallback(async (
    fileUri: string, fileName: string, mimeType: string,
  ): Promise<MessageAttachment | null> => {
    if (!currentUser) return null;
    try {
      const result = await uploadLocalFile(fileUri, fileName, mimeType, currentUser.id);
      if (!result) return null;
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      const type: MessageAttachment['type'] = isImage ? 'image' : isVideo ? 'video' : 'file';
      return { id: result.id, type, url: result.url, name: fileName, mimeType };
    } catch (e) {
      showToast('error', 'Failed to upload file');
      return null;
    }
  }, [currentUser, showToast]);

  const refreshConversations = useCallback(async (): Promise<void> => {
    if (!currentUser) return;
    try {
      const headers = await authHeaders(currentUser.id);
      const response = await fetch(chatEndpoint('/conversations'), { headers });
      if (!response.ok) return;
      const result = await response.json() as { conversations: Conversation[] };
      setConversations(prev => {
        const merged = result.conversations.map(c => {
          const existing = prev.find(p => p.id === c.id);
          return existing ? { ...c, unreadCount: existing.unreadCount } : c;
        });
        void persistConversations(merged);
        return merged;
      });
    } catch (e) { /* silent */ }
  }, [currentUser, persistConversations]);

  // Flush pending messages when connection restores
  useEffect(() => {
    if (connectionState === 'connected' && pendingMessages.length > 0) {
      pendingMessages.forEach(pm => void sendPendingMessage(pm));
      setPendingMessages([]);
    }
  }, [connectionState, pendingMessages, sendPendingMessage]);

  // ---- Computed values ----

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.updatedAt ?? '';
      const bTime = b.lastMessageAt ?? b.updatedAt ?? '';
      return bTime.localeCompare(aTime);
    });
  }, [conversations]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const getOtherParticipant = useCallback((conversation: Conversation): ConversationParticipant | null => {
    if (!currentUser) return null;
    if (conversation.isGroup) return null;
    return conversation.participantInfo.find(p => p.userId !== currentUser.id) ?? null;
  }, [currentUser]);

  /** Get display name for a conversation (group name or other participant's name) */
  const getConversationName = useCallback((conversation: Conversation): string => {
    if (conversation.isGroup) return conversation.groupName ?? 'Group Chat';
    const other = getOtherParticipant(conversation);
    return other?.fullName ?? 'Unknown';
  }, [getOtherParticipant]);

  /** Get avatar URL or placeholder initial for a conversation */
  const getConversationAvatar = useCallback((conversation: Conversation): { image?: string; initial: string } => {
    if (conversation.isGroup) {
      return { initial: (conversation.groupName ?? 'G').charAt(0).toUpperCase() };
    }
    const other = getOtherParticipant(conversation);
    return { image: other?.profileImage, initial: (other?.fullName ?? '?').charAt(0).toUpperCase() };
  }, [getOtherParticipant]);

  const getMessages = useCallback((conversationId: string): ChatMessage[] => {
    return messages[conversationId] ?? [];
  }, [messages]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return presence[userId] === 'online';
  }, [presence]);

  const isUserTyping = useCallback((conversationId: string, userId: string): boolean => {
    return Boolean(typingUsers[conversationId]?.[userId]);
  }, [typingUsers]);

  const getTypingUsers = useCallback((conversationId: string): string[] => {
    return Object.keys(typingUsers[conversationId] ?? {});
  }, [typingUsers]);

  /** Check if a conversation is muted by the current user */
  const isConversationMuted = useCallback((conversationId: string): boolean => {
    return mutedConversations.has(conversationId);
  }, [mutedConversations]);

  /** Get settings for a conversation */
  const getConversationSettings = useCallback((conversationId: string): ConversationSettings => {
    return conversationSettings[conversationId] ?? {};
  }, [conversationSettings]);

  /** Get group members for a group conversation */
  const getGroupMembers = useCallback((conversation: Conversation): ConversationParticipant[] => {
    return conversation.participantInfo;
  }, []);

  /** Check if current user is a group admin */
  const isGroupAdmin = useCallback((conversation: Conversation): boolean => {
    if (!currentUser || !conversation.isGroup) return false;
    return conversation.adminIds?.includes(currentUser.id) ?? false;
  }, [currentUser]);

  const getAvailableChatUsers = useCallback((): User[] => {
    if (!currentUser) return [];
    const users = allUsers.filter(u => u.id !== currentUser.id && !u.archived);
    if (currentUser.role === 'super_admin') {
      return users.filter(u => u.role === 'admin');
    }
    if (currentUser.role === 'admin') {
      return users.filter(u => {
        if (u.role === 'super_admin') return true;
        if (u.role === 'admin') return u.schoolOrganization === currentUser.schoolOrganization || u.adminId === currentUser.id;
        if (u.role === 'student') return u.adminId === currentUser.id;
        return false;
      });
    }
    return users.filter(u => {
      if (u.role === 'super_admin') return true;
      if (u.role === 'admin') return u.id === currentUser.adminId;
      return false;
    });
  }, [currentUser, allUsers]);

  // Clear chat state on logout
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setMessages({});
      setPresence({});
      setTypingUsers({});
      setUnreadCounts({});
      setPendingMessages([]);
      setActiveConversationId(null);
      setMutedConversations(new Set());
      setConversationSettings({});
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      queryClient.removeQueries({ queryKey: ['chat'] });
    }
  }, [currentUser?.id, queryClient]);

  // Update presence on mount/unmount
  useEffect(() => {
    if (currentUser) void updatePresence('online');
    return () => { if (currentUser) void updatePresence('offline'); };
  }, [currentUser?.id, updatePresence]);

  // ---- Section Group Chat Automation ----
  // Track sections that have been processed to avoid duplicate creation
  const processedSectionIdsRef = useRef<Set<string>>(new Set());

  // Auto-create group chat when a new section appears
  useEffect(() => {
    if (!currentUser || !sections || !FUNCTIONS_URL) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') return;

    for (const section of sections) {
      // Only process sections owned by this admin (or all for super_admin)
      if (currentUser.role === 'admin' && section.adminId !== currentUser.id) continue;
      if (processedSectionIdsRef.current.has(section.id)) continue;
      if (section.archived) continue;

      processedSectionIdsRef.current.add(section.id);
      // Auto-create the section group chat
      void (async () => {
        const teacherInfo = currentUser.role === 'admin' ? {
          userId: currentUser.id,
          fullName: currentUser.fullName,
          role: currentUser.role,
          profileImage: currentUser.profileImage,
        } : undefined;

        await createSectionGroupChat(
          section.id,
          section.name,
          {
            userId: currentUser.id,
            fullName: currentUser.fullName,
            role: currentUser.role,
            profileImage: currentUser.profileImage,
          },
          teacherInfo,
        );

        // Auto-add all students already in this section
        const sectionStudents = allUsers.filter(u =>
          u.role === 'student' && u.sectionId === section.id && !u.archived,
        );
        for (const student of sectionStudents) {
          await addStudentToSectionGroup(section.id, {
            userId: student.id,
            fullName: student.fullName,
            role: student.role,
            profileImage: student.profileImage,
          });
        }
      })();
    }
  }, [currentUser, sections, allUsers, createSectionGroupChat, addStudentToSectionGroup]);

  // Auto-add/remove students when their sectionId changes
  const prevStudentSectionsRef = useRef<Record<string, string | undefined>>({});
  useEffect(() => {
    if (!currentUser || !allUsers || !FUNCTIONS_URL) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') return;

    const currentStudentSections: Record<string, string | undefined> = {};
    for (const user of allUsers) {
      if (user.role === 'student') {
        currentStudentSections[user.id] = user.sectionId;
      }
    }

    const prev = prevStudentSectionsRef.current;
    for (const studentId of Object.keys(currentStudentSections)) {
      const prevSection = prev[studentId];
      const newSection = currentStudentSections[studentId];
      if (prevSection !== newSection) {
        const student = allUsers.find(u => u.id === studentId);
        if (!student) continue;
        // Remove from old section group
        if (prevSection) {
          void removeStudentFromSectionGroup(prevSection, studentId);
        }
        // Add to new section group
        if (newSection && !student.archived) {
          void addStudentToSectionGroup(newSection, {
            userId: student.id,
            fullName: student.fullName,
            role: student.role,
            profileImage: student.profileImage,
          });
        }
      }
    }

    // Check for removed/archived students
    for (const studentId of Object.keys(prev)) {
      if (!currentStudentSections[studentId] && prev[studentId]) {
        const student = allUsers.find(u => u.id === studentId);
        if (student?.archived || !allUsers.some(u => u.id === studentId)) {
          void removeStudentFromSectionGroup(prev[studentId]!, studentId);
        }
      }
    }

    prevStudentSectionsRef.current = currentStudentSections;
  }, [currentUser, allUsers, addStudentToSectionGroup, removeStudentFromSectionGroup]);

  return {
    // State
    conversations: sortedConversations,
    messages,
    connectionState,
    presence,
    unreadCounts,
    totalUnread,
    activeConversationId,
    typingUsers,
    isOnline: connectionState === 'connected',
    mutedConversations,
    conversationSettings,
    emojiReactions: EMOJI_REACTIONS,
    backgroundPresets: BACKGROUND_PRESETS,

    // Conversation management
    getOrCreateConversation,
    deleteConversation,
    refreshConversations,
    getOtherParticipant,
    getAvailableChatUsers,
    getConversationName,
    getConversationAvatar,

    // Messages
    getMessages,
    fetchMessages,
    sendMessage,
    retryMessage,
    deleteMessage,
    editMessage,

    // Reactions
    toggleReaction,

    // Pinning
    togglePin,

    // Mute
    toggleMute,
    isConversationMuted,

    // Settings
    updateConversationSettings,
    getConversationSettings,

    // Group management
    addMember,
    removeMember,
    toggleMemberMute,
    getGroupMembers,
    isGroupAdmin,

    // Contacts
    importDeviceContacts,

    // Section group chat management
    createSectionGroupChat,
    addStudentToSectionGroup,
    removeStudentFromSectionGroup,
    updateSectionGroupTeacher,

    // Read receipts
    markConversationRead,
    setActiveConversationId,

    // Typing
    sendTyping,
    isUserTyping,
    getTypingUsers,

    // Presence
    updatePresence,
    isUserOnline,

    // Search
    searchMessages,

    // Attachments
    uploadAttachment,
  };
});
