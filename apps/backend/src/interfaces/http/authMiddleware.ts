import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { getConfig } from "../../infrastructure/config/env.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  const { cognitoIssuer } = getConfig();
  if (!cognitoIssuer) {
    throw new Error("COGNITO_ISSUER is not configured");
  }
  if (!jwks) {
    // Build JWKS URL without dropping the userPoolId path segment.
    // Using a leading slash with new URL would reset the path to root.
    const jwksUri = `${cognitoIssuer.replace(/\/+$/, "")}/.well-known/jwks.json`;
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwks;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.header("authorization") || req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = auth.substring("Bearer ".length);

    const { cognitoIssuer, cognitoAppClientId } = getConfig();
    if (!cognitoIssuer || !cognitoAppClientId) {
      return res.status(500).json({ error: "Auth not configured" });
    }

    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: cognitoIssuer,
      audience: cognitoAppClientId
    });

    // Optionally attach user info to request
    (req as any).user = extractUser(payload);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function extractUser(payload: JWTPayload) {
  return {
    sub: payload.sub,
    email: (payload as any).email,
    username: (payload as any)["cognito:username"]
  };
}
