// src/lib/notifications/push-providers.server.ts
// =============================================================================
// SERVER-ONLY. Envio de push pra APNs (iOS) e FCM HTTP v1 (Android).
// Gated por credenciais em env (secrets do Worker):
//   - APNs:  APNS_KEY (.p8 PKCS8 PEM), APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID,
//            APNS_PRODUCTION ("1" = api.push.apple.com; senão sandbox)
//   - FCM:   FCM_SERVICE_ACCOUNT (JSON do service account: client_email,
//            private_key, project_id)
// Sem credencial → no-op logado (scaffold). Crypto via WebCrypto (Workers).
//
// ⚠️ NÃO VERIFICADO ainda — precisa das credenciais + teste em device real.
// =============================================================================

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const enc = new TextEncoder();

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? enc.encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function signJwt(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  key: CryptoKey,
  algo: AlgorithmIdentifier | EcdsaParams,
): Promise<string> {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(algo, key, enc.encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

// ── APNs ──────────────────────────────────────────────────────────────────────
let apnsJwtCache: { token: string; exp: number } | null = null;

async function getApnsJwt(): Promise<string | null> {
  const keyPem = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyPem || !keyId || !teamId) return null;

  const now = Math.floor(Date.now() / 1000);
  if (apnsJwtCache && apnsJwtCache.exp > now + 60) return apnsJwtCache.token;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(keyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const token = await signJwt({ alg: "ES256", kid: keyId }, { iss: teamId, iat: now }, key, {
    name: "ECDSA",
    hash: "SHA-256",
  });
  apnsJwtCache = { token, exp: now + 3000 }; // APNs aceita até 60min; renova ~50min
  return token;
}

export async function sendApns(deviceToken: string, msg: PushMessage): Promise<boolean> {
  const jwt = await getApnsJwt();
  const bundleId = process.env.APNS_BUNDLE_ID || "com.pmhybrid.app";
  if (!jwt) {
    console.warn("[push] APNs não configurado — pulando envio iOS");
    return false;
  }
  const host =
    process.env.APNS_PRODUCTION === "1" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  try {
    const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
      },
      body: JSON.stringify({
        aps: { alert: { title: msg.title, body: msg.body }, sound: "default" },
        ...(msg.data ?? {}),
      }),
    });
    if (!res.ok) {
      console.warn("[push] APNs falhou", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[push] APNs erro", e);
    return false;
  }
}

// ── FCM (HTTP v1) ─────────────────────────────────────────────────────────────
let fcmTokenCache: { token: string; exp: number } | null = null;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.warn("[push] FCM_SERVICE_ACCOUNT inválido (não é JSON)");
    return null;
  }
}

async function getFcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmTokenCache && fcmTokenCache.exp > now + 60) return fcmTokenCache.token;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const jwt = await signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    key,
    { name: "RSASSA-PKCS1-v1_5" },
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    console.warn("[push] FCM OAuth falhou", res.status);
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  fcmTokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

export async function sendFcm(deviceToken: string, msg: PushMessage): Promise<boolean> {
  const sa = readServiceAccount();
  if (!sa) {
    console.warn("[push] FCM não configurado — pulando envio Android");
    return false;
  }
  const accessToken = await getFcmAccessToken(sa);
  if (!accessToken) return false;
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: msg.title, body: msg.body },
            data: msg.data ?? {},
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn("[push] FCM falhou", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[push] FCM erro", e);
    return false;
  }
}

/** Há ALGUMA credencial de push configurada? (pra log/diagnóstico) */
export function pushConfigured(): { apns: boolean; fcm: boolean } {
  return {
    apns: !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID),
    fcm: !!process.env.FCM_SERVICE_ACCOUNT,
  };
}
