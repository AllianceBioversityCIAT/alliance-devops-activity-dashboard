import { getEnv } from "../config/env";

const TOKEN_KEY = "devops_dash_tokens";

export async function signIn(email: string, password: string) {
  throw new Error("Direct sign-in is not supported. Use startHostedLogin().");
}

export async function signOut() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const raw = localStorage.getItem(TOKEN_KEY);
  return Boolean(raw);
}

export async function getIdToken(): Promise<string | null> {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return typeof obj.idToken === "string" ? obj.idToken : null;
  } catch {
    return null;
  }
}

export function startHostedLogin() {
  const { apiBaseUrl } = getEnv();
  // eslint-disable-next-line no-console
  console.log("[AUTH] Redirecting to authorize via API", { apiBaseUrl });
  window.location.href = `${apiBaseUrl}/auth/authorize`;
}

export async function exchangeAuthCode(code: string) {
  const { apiBaseUrl } = getEnv();
  // eslint-disable-next-line no-console
  console.log("[AUTH] Exchanging code", { apiBaseUrl, hasCode: Boolean(code) });
  const res = await fetch(`${apiBaseUrl}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error("[AUTH] Exchange failed", { status: res.status, body: text?.slice(0, 500) });
    throw new Error(`Token exchange failed (${res.status})`);
  }
  const data = await res.json();
  // Normalize and store the id token under idToken for MVP usage
  const normalized = {
    idToken: data.id_token ?? null,
    accessToken: data.access_token ?? null,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    tokenType: data.token_type ?? null
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(normalized));
  return normalized;
}
