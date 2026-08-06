import { DurableObject } from "cloudflare:workers";

/**
 * ApiRoom — Granular REST API Durable Object
 *
 * Provides per-entity CRUD endpoints for all LMS features.
 * Each entity collection is stored individually in DO storage,
 * enabling targeted reads/writes instead of full-snapshot sync.
 *
 * Entity collections:
 *   subjects, sections, users, cocs, learning-outcomes, content,
 *   quizzes, questions, progress, submissions, announcements,
 *   activities, quiz-attempts, notifications, quiz-violations,
 *   quiz-locks, document-progress, admin-checks, activity-logs,
 *   invite-codes, playback-positions
 */

type ApiEnv = { DO: Fetcher };

interface EntityMeta {
  collection: string;
  idField: string;
}

const ENTITY_MAP: Record<string, EntityMeta> = {
  "subjects": { collection: "subjects", idField: "id" },
  "sections": { collection: "sections", idField: "id" },
  "users": { collection: "users", idField: "id" },
  "cocs": { collection: "cocs", idField: "id" },
  "learning-outcomes": { collection: "learningOutcomes", idField: "id" },
  "content": { collection: "content", idField: "id" },
  "quizzes": { collection: "quizzes", idField: "id" },
  "questions": { collection: "questions", idField: "id" },
  "progress": { collection: "progress", idField: "id" },
  "submissions": { collection: "submissions", idField: "id" },
  "announcements": { collection: "announcements", idField: "id" },
  "activities": { collection: "activities", idField: "id" },
  "quiz-attempts": { collection: "quizAttempts", idField: "id" },
  "notifications": { collection: "notifications", idField: "id" },
  "quiz-violations": { collection: "quizViolations", idField: "id" },
  "quiz-locks": { collection: "quizLocks", idField: "id" },
  "document-progress": { collection: "documentProgress", idField: "id" },
  "admin-checks": { collection: "adminChecks", idField: "id" },
  "activity-logs": { collection: "activityLogs", idField: "id" },
  "invite-codes": { collection: "inviteCodes", idField: "id" },
  "playback-positions": { collection: "playbackPositions", idField: "id" },
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

function collectionKey(collection: string): string {
  return `coll:${collection}`;
}

export class ApiRoom extends DurableObject<ApiEnv> {
  /** Get all items in a collection */
  private async getCollection<T>(collection: string): Promise<T[]> {
    const data = await this.ctx.storage.get<T[]>(collectionKey(collection));
    return data ?? [];
  }

  /** Save entire collection */
  private async putCollection<T>(collection: string, items: T[]): Promise<void> {
    await this.ctx.storage.put(collectionKey(collection), items);
  }

  /** Get a single item by ID */
  private async getItem<T extends Record<string, unknown>>(collection: string, id: string): Promise<T | null> {
    const items = await this.getCollection<T>();
    return items.find(item => (item as Record<string, unknown>)["id"] === id) ?? null;
  }

  /** Upsert a single item */
  private async upsertItem<T extends Record<string, unknown>>(collection: string, item: T): Promise<T> {
    const items = await this.getCollection<T>();
    const id = (item as Record<string, unknown>)["id"] as string;
    const idx = items.findIndex(i => (i as Record<string, unknown>)["id"] === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      items.push(item);
    }
    await this.putCollection(collection, items);
    return item;
  }

  /** Delete a single item by ID */
  private async deleteItem(collection: string, id: string): Promise<boolean> {
    const items = await this.getCollection<Record<string, unknown>>();
    const filtered = items.filter(i => i["id"] !== id);
    if (filtered.length === items.length) return false;
    await this.putCollection(collection, filtered);
    return true;
  }

  /** Replace an entire collection (bulk sync) */
  private async replaceCollection<T>(collection: string, items: T[]): Promise<void> {
    await this.putCollection(collection, items);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "") || "/";
    const segments = path.split("/").filter(Boolean);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-School-Session, X-School-User-Id, X-Resolved-User-Id",
        },
      });
    }

    // Health check
    if (segments.length === 0 || (segments.length === 1 && segments[0] === "health")) {
      return json({ ok: true, service: "aira-api", timestamp: new Date().toISOString() });
    }

    const entityKey = segments[0];
    const meta = ENTITY_MAP[entityKey];
    if (!meta) return json({ error: `Unknown entity: ${entityKey}`, available: Object.keys(ENTITY_MAP) }, 404);

    const itemId = segments[1];
    const subAction = segments[2];

    try {
      // GET /:entity — list all (with optional filters via query params)
      if (request.method === "GET" && !itemId) {
        let items = await this.getCollection<Record<string, unknown>>(meta.collection);
        // Apply query param filters
        for (const [key, value] of url.searchParams.entries()) {
          if (key === "limit") {
            const limit = parseInt(value, 10);
            if (Number.isFinite(limit) && limit > 0) items = items.slice(0, limit);
          } else if (key === "offset") {
            const offset = parseInt(value, 10);
            if (Number.isFinite(offset) && offset >= 0) items = items.slice(offset);
          } else if (key !== "token" && key !== "userId") {
            items = items.filter(item => String(item[key] ?? "") === value);
          }
        }
        return json({ data: items, count: items.length });
      }

      // GET /:entity/:id — get one
      if (request.method === "GET" && itemId && !subAction) {
        const item = await this.getItem<Record<string, unknown>>(meta.collection, itemId);
        if (!item) return json({ error: "Not found" }, 404);
        return json({ data: item });
      }

      // POST /:entity — create or bulk upsert
      if (request.method === "POST" && !itemId) {
        const body = (await request.json()) as Record<string, unknown> | Record<string, unknown>[];
        if (Array.isArray(body)) {
          // Bulk upsert
          const items = body as Record<string, unknown>[];
          for (const item of items) {
            await this.upsertItem(meta.collection, item);
          }
          return json({ ok: true, upserted: items.length });
        }
        const item = body as Record<string, unknown>;
        if (!item["id"]) item["id"] = crypto.randomUUID();
        if (!item["createdAt"]) item["createdAt"] = new Date().toISOString();
        await this.upsertItem(meta.collection, item);
        return json({ ok: true, data: item }, 201);
      }

      // POST /:entity/bulk — replace entire collection
      if (request.method === "POST" && itemId === "bulk") {
        const body = (await request.json()) as Record<string, unknown>[];
        await this.replaceCollection(meta.collection, body);
        return json({ ok: true, count: body.length });
      }

      // PUT /:entity/:id — update
      if (request.method === "PUT" && itemId) {
        const body = (await request.json()) as Record<string, unknown>;
        const existing = await this.getItem<Record<string, unknown>>(meta.collection, itemId);
        if (!existing) {
          // Create if not exists
          body["id"] = itemId;
          if (!body["createdAt"]) body["createdAt"] = new Date().toISOString();
          await this.upsertItem(meta.collection, body);
          return json({ ok: true, data: body, created: true }, 201);
        }
        const merged = { ...existing, ...body, id: itemId, updatedAt: new Date().toISOString() };
        await this.upsertItem(meta.collection, merged);
        return json({ ok: true, data: merged });
      }

      // PATCH /:entity/:id — partial update
      if (request.method === "PATCH" && itemId) {
        const body = (await request.json()) as Record<string, unknown>;
        const existing = await this.getItem<Record<string, unknown>>(meta.collection, itemId);
        if (!existing) return json({ error: "Not found" }, 404);
        const merged = { ...existing, ...body, id: itemId, updatedAt: new Date().toISOString() };
        await this.upsertItem(meta.collection, merged);
        return json({ ok: true, data: merged });
      }

      // DELETE /:entity/:id — delete one
      if (request.method === "DELETE" && itemId) {
        const deleted = await this.deleteItem(meta.collection, itemId);
        if (!deleted) return json({ error: "Not found" }, 404);
        return json({ ok: true, deleted: itemId });
      }

      // DELETE /:entity — clear collection
      if (request.method === "DELETE" && !itemId) {
        await this.putCollection(meta.collection, []);
        return json({ ok: true, cleared: meta.collection });
      }

      // GET /:entity/:id/:sub — sub-resource (e.g., progress by userId)
      if (request.method === "GET" && itemId && subAction) {
        const items = await this.getCollection<Record<string, unknown>>(meta.collection);
        const filtered = items.filter(item => String(item[subAction] ?? "") === itemId);
        return json({ data: filtered, count: filtered.length });
      }

      return json({ error: "Method not allowed" }, 405);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return json({ error: message }, 500);
    }
  }
}
