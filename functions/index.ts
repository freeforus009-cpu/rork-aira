import { AuthRoom } from "./auth-room";
import { SyncRoom } from "./sync-room";
import { ChatRoom } from "./chat-room";

export { AuthRoom } from "./auth-room";
export { SyncRoom } from "./sync-room";
export { ChatRoom } from "./chat-room";

type Env = { DO: Fetcher };

function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
function dispatch(env: Env, className: string, id: string, request: Request): Promise<Response> {
  const wrapped = new Request(request.url, request);
  wrapped.headers.set("X-Rork-DO-Class", className);
  wrapped.headers.set("X-Rork-DO-Id", id);
  return env.DO.fetch(wrapped);
}

async function validateSession(env: Env, request: Request): Promise<{ userId: string; token: string } | null> {
  const url = new URL(request.url);
  const token = request.headers.get("X-School-Session") ?? url.searchParams.get("token");
  if (!token) return null;
  const validation = await dispatch(env, "AuthRoom", "global", new Request("https://internal/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }));
  if (!validation.ok) return null;
  const result = (await validation.json()) as { userId?: string };
  const requestedUserId = request.headers.get("X-School-User-Id") ?? url.searchParams.get("userId");
  if (!result.userId || (requestedUserId && requestedUserId !== result.userId)) return null;
  return { userId: result.userId, token };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ping") return json({ ok: true, now: new Date().toISOString(), service: "school-sync" });

    if (url.pathname === "/v1/auth/session" && request.method === "POST") return dispatch(env, "AuthRoom", "global", new Request("https://internal/session", request));
    if (url.pathname === "/v1/auth/revoke" && request.method === "POST") return dispatch(env, "AuthRoom", "global", new Request("https://internal/revoke", request));

    // Chat routes — authenticated, routed to ChatRoom DO (per-user instance)
    if (url.pathname.startsWith("/v1/chat")) {
      const session = await validateSession(env, request);
      if (!session) return json({ error: "Unauthorized" }, 401);
      const forwarded = new Request(request.url, request);
      forwarded.headers.set("X-Resolved-User-Id", session.userId);
      const chatRequest = new URL(request.url);
      chatRequest.pathname = chatRequest.pathname.replace(/^\/v1\/chat/, "") || "/";
      // Add token to query for WebSocket upgrade
      if (request.headers.get("Upgrade") === "websocket") {
        chatRequest.searchParams.set("token", session.token);
        chatRequest.searchParams.set("userId", session.userId);
      }
      // Use a shared DO instance so all users on the same ChatRoom can communicate in real-time
      return dispatch(env, "ChatRoom", "shared", new Request(chatRequest.toString(), forwarded));
    }

    const protectedRoute = url.pathname.startsWith("/v1/sync/") || url.pathname.startsWith("/v1/uploads/") || url.pathname === "/v1/uploads";
    if (!protectedRoute) return json({ error: "Not found" }, 404);
    const session = await validateSession(env, request);
    if (!session) return json({ error: "Unauthorized" }, 401);

    const forwarded = new Request(request.url, request);
    forwarded.headers.set("X-Resolved-User-Id", session.userId);
    const doRequest = new URL(request.url);
    doRequest.pathname = doRequest.pathname.replace(/^\/v1\/sync/, "").replace(/^\/v1/, "") || "/";
    return dispatch(env, "SyncRoom", session.userId, new Request(doRequest.toString(), forwarded));
  },
} satisfies ExportedHandler<Env>;
