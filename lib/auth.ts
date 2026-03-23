const SESSION_COOKIE_NAME = "leados_session";

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

async function getSigningKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not set in .env");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string) {
  const key = await getSigningKey();

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(username: string) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

  const payload = JSON.stringify({
    username,
    expiresAt,
  });

  const payloadEncoded = base64UrlEncode(
    new TextEncoder().encode(payload)
  );

  const signature = await signValue(payloadEncoded);

  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadEncoded, signature] = parts;

  const expectedSignature = await signValue(payloadEncoded);
  if (signature !== expectedSignature) return null;

  try {
    const payloadJson = base64UrlDecode(payloadEncoded);

    const payload = JSON.parse(payloadJson) as {
      username: string;
      expiresAt: number;
    };

    if (!payload?.username || !payload?.expiresAt) return null;
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}