import { DurableObject } from "cloudflare:workers";

type AuthEnv = { DO: Fetcher };
type Profile = Record<string, unknown>;
type StoredAccount = { userId: string; identifier: string; passwordHash: string; profile: Profile; createdAt: string };
type Session = { userId: string; expiresAt: number };

function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
async function hashSecret(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function safeProfile(profile: Profile): Profile {
  const { password: _password, ...rest } = profile;
  return rest;
}

export class AuthRoom extends DurableObject<AuthEnv> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/session") {
      const body = (await request.json()) as { userId?: string; identifier?: string; password?: string; profile?: Profile };
      const identifier = body.identifier?.trim().toLowerCase();
      if (!identifier || !body.password) return json({ error: "Credentials are required" }, 400);
      const accountKey = body.userId ? `account:${body.userId}` : await this.ctx.storage.get<string>(`identifier:${identifier}`);
      let account = accountKey ? await this.ctx.storage.get<StoredAccount>(accountKey) : undefined;
      const passwordHash = await hashSecret(body.password);
      if (account && account.passwordHash !== passwordHash) return json({ error: "Invalid credentials" }, 401);
      if (!account) {
        if (!body.userId || !body.profile) return json({ error: "Account not registered on the sync service" }, 401);
        account = { userId: body.userId, identifier, passwordHash, profile: safeProfile(body.profile), createdAt: new Date().toISOString() };
        await this.ctx.storage.put(`account:${account.userId}`, account);
        await this.ctx.storage.put(`identifier:${identifier}`, `account:${account.userId}`);
      } else if (body.profile) {
        account = { ...account, profile: { ...account.profile, ...safeProfile(body.profile) } };
        await this.ctx.storage.put(`account:${account.userId}`, account);
      }
      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const tokenHash = await hashSecret(token);
      await this.ctx.storage.put(`session:${tokenHash}`, { userId: account.userId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 } satisfies Session);
      return json({ ok: true, token, userId: account.userId, profile: account.profile });
    }

    if (request.method === "POST" && url.pathname === "/validate") {
      const body = (await request.json()) as { token?: string };
      if (!body.token) return json({ error: "Missing token" }, 401);
      const tokenHash = await hashSecret(body.token);
      const session = await this.ctx.storage.get<Session>(`session:${tokenHash}`);
      if (!session || session.expiresAt <= Date.now()) return json({ error: "Session expired" }, 401);
      return json({ ok: true, userId: session.userId });
    }

    if (request.method === "POST" && url.pathname === "/revoke") {
      const body = (await request.json()) as { token?: string };
      if (body.token) await this.ctx.storage.delete(`session:${await hashSecret(body.token)}`);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }
}
