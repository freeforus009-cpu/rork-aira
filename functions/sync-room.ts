import { DurableObject } from "cloudflare:workers";

type SyncEnv = { DO: Fetcher };
type Scope = "auth" | "data";
type Snapshot = { revision: number; updatedAt: string; scopes: Partial<Record<Scope, unknown>> };
type UploadMeta = { id: string; name: string; contentType: string; size: number; createdAt: string };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export class SyncRoom extends DurableObject<SyncEnv> {
  private async getSnapshot(): Promise<Snapshot> {
    return (await this.ctx.storage.get<Snapshot>("snapshot")) ?? { revision: 0, updatedAt: new Date(0).toISOString(), scopes: {} };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/snapshot") {
      const scope = url.searchParams.get("scope") as Scope | null;
      if (scope !== "auth" && scope !== "data") return json({ error: "Invalid scope" }, 400);
      const snapshot = await this.getSnapshot();
      return json({ scope, data: snapshot.scopes[scope] ?? null, revision: snapshot.revision, updatedAt: snapshot.updatedAt });
    }

    if (request.method === "PUT" && url.pathname === "/snapshot") {
      const body = (await request.json()) as { scope?: Scope; data?: unknown; baseRevision?: number };
      if (body.scope !== "auth" && body.scope !== "data") return json({ error: "Invalid scope" }, 400);
      const snapshot = await this.getSnapshot();
      if (typeof body.baseRevision === "number" && body.baseRevision !== snapshot.revision) {
        return json({ error: "Conflict", revision: snapshot.revision, data: snapshot.scopes[body.scope] ?? null }, 409);
      }
      const updated: Snapshot = { revision: snapshot.revision + 1, updatedAt: new Date().toISOString(), scopes: { ...snapshot.scopes, [body.scope]: body.data } };
      await this.ctx.storage.put("snapshot", updated);
      this.broadcast(body.scope, updated);
      return json({ ok: true, scope: body.scope, revision: updated.revision, updatedAt: updated.updatedAt });
    }

    if (request.method === "POST" && url.pathname === "/uploads") {
      const data = await request.arrayBuffer();
      const maxSizeHeader = request.headers.get("X-Max-Upload-Size");
      const maxBytes = maxSizeHeader ? parseInt(maxSizeHeader, 10) : 500 * 1024 * 1024;
      if (data.byteLength > maxBytes) return json({ error: `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit` }, 413);
      const id = crypto.randomUUID();
      const meta: UploadMeta = { id, name: request.headers.get("X-File-Name") ?? "upload", contentType: request.headers.get("Content-Type") ?? "application/octet-stream", size: data.byteLength, createdAt: new Date().toISOString() };
      await this.ctx.storage.put(`upload:${id}:meta`, meta);
      await this.ctx.storage.put(`upload:${id}:data`, data);
      return json({ ok: true, upload: meta, url: `/v1/uploads/${id}` });
    }

    const uploadMatch = url.pathname.match(/^\/uploads\/([a-z0-9-]+)$/i);
    if (uploadMatch) {
      const id = uploadMatch[1];
      const meta = await this.ctx.storage.get<UploadMeta>(`upload:${id}:meta`);
      if (!meta) return json({ error: "File not found" }, 404);
      if (request.method === "GET") {
        const data = await this.ctx.storage.get<ArrayBuffer>(`upload:${id}:data`);
        if (!data) return json({ error: "File not found" }, 404);
        return new Response(data, { headers: { "Content-Type": meta.contentType, "Content-Disposition": `inline; filename="${meta.name.replace(/[^a-zA-Z0-9._ -]/g, "_")}"`, "Cache-Control": "private, max-age=300" } });
      }
      if (request.method === "DELETE") {
        await this.ctx.storage.delete([`upload:${id}:meta`, `upload:${id}:data`]);
        return json({ ok: true });
      }
    }

    if (request.method === "GET" && url.pathname === "/realtime" && request.headers.get("Upgrade") === "websocket") {
      const scope = url.searchParams.get("scope") as Scope | null;
      if (scope !== "auth" && scope !== "data") return json({ error: "Invalid scope" }, 400);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [scope]);
      const snapshot = await this.getSnapshot();
      server.send(JSON.stringify({ type: "snapshot", scope, data: snapshot.scopes[scope] ?? null, revision: snapshot.revision, updatedAt: snapshot.updatedAt }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: "Not found" }, 404);
  }

  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // Writes use the authenticated HTTP endpoint. WebSockets are read-only fan-out channels.
  }

  private broadcast(scope: Scope, snapshot: Snapshot): void {
    const message = JSON.stringify({ type: "snapshot", scope, data: snapshot.scopes[scope] ?? null, revision: snapshot.revision, updatedAt: snapshot.updatedAt });
    for (const socket of this.ctx.getWebSockets(scope)) {
      try { socket.send(message); } catch (error) { console.warn("sync broadcast failed", error); }
    }
  }
}
