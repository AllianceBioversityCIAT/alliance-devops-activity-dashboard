import { Request, Response } from "express";
import { getConfig } from "../../infrastructure/config/env.js";

export function authorizeHandler(_req: Request, res: Response) {
  const { cognitoDomain, cognitoAppClientId, frontendRedirectUri, cognitoIdentityProvider } = getConfig();
  if (!cognitoDomain || !cognitoAppClientId || !frontendRedirectUri) {
    return res.status(500).json({ error: "OAuth not configured" });
  }
  const authorizeUrl = new URL(`/oauth2/authorize`, ensureHttps(cognitoDomain));
  authorizeUrl.searchParams.set("client_id", cognitoAppClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("redirect_uri", frontendRedirectUri);
  if (cognitoIdentityProvider && cognitoIdentityProvider.trim().length > 0) {
    authorizeUrl.searchParams.set("identity_provider", cognitoIdentityProvider);
  }
  return res.redirect(authorizeUrl.toString());
}

export async function exchangeHandler(req: Request, res: Response) {
  const { code } = req.body ?? {};
  const { cognitoDomain, cognitoAppClientId, cognitoClientSecret, frontendRedirectUri } = getConfig();
  if (!code) return res.status(400).json({ error: "code is required" });
  if (!cognitoDomain || !cognitoAppClientId || !cognitoClientSecret || !frontendRedirectUri) {
    return res.status(500).json({ error: "OAuth not configured" });
  }

  try {
    const tokenUrl = new URL(`/oauth2/token`, ensureHttps(cognitoDomain)).toString();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cognitoAppClientId,
      code,
      redirect_uri: frontendRedirectUri
    });
    const basicAuth = btoa(`${cognitoAppClientId}:${cognitoClientSecret}`);
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      },
      body: body.toString()
    });

    if (!resp.ok) {
      const text = await resp.text();
      // eslint-disable-next-line no-console
      console.error("Cognito token exchange failed:", { status: resp.status, body: text });
      return res.status(401).json({ error: "Token exchange failed" });
    }

    const tokens = await resp.json();
    // Return tokens JSON to frontend callback for storage
    return res.json(tokens);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("OAuth exchange error:", { name: err?.name, message: err?.message });
    return res.status(500).json({ error: "OAuth exchange error" });
  }
}

function ensureHttps(domainOrUrl: string): string {
  if (domainOrUrl.startsWith("http://") || domainOrUrl.startsWith("https://")) return domainOrUrl;
  return `https://${domainOrUrl}`;
}
