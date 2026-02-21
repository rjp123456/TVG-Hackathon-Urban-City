import "server-only";

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

let cached: CachedToken | null = null;

const TOKEN_URL =
  process.env.ERCOT_TOKEN_URL ??
  "https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_ROPC_Auth/oauth2/v2.0/token";

const requireEnv = (key: "ERCOT_USERNAME" | "ERCOT_PASSWORD") => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key} in environment`);
  return v;
};

export async function getErcotToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAtMs - now > 2 * 60 * 1000) return cached.token;

  const username = requireEnv("ERCOT_USERNAME");
  const password = requireEnv("ERCOT_PASSWORD");
  const clientId = process.env.ERCOT_CLIENT_ID ?? "04b07795-8ddb-461a-bbee-02f9e1bf7b46";
  const scope = process.env.ERCOT_SCOPE ?? "openid";

  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    client_id: clientId,
    scope,
    response_type: "token id_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    throw new Error(`ERCOT token request failed (${res.status})`);
  }

  const token = (parsed.id_token as string | undefined) ?? (parsed.access_token as string | undefined);
  const expiresIn = Number((parsed.expires_in as number | string | undefined) ?? 3600);
  if (!token) throw new Error("ERCOT token missing id_token/access_token");

  cached = { token, expiresAtMs: now + Math.max(300, expiresIn) * 1000 };
  return token;
}
