import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";
import { getConfig } from "../config/env.js";

export function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  // SECRET_HASH = Base64(HMAC_SHA256(clientSecret, username + clientId))
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(username + clientId, "utf8");
  return hmac.digest("base64");
}

export async function loginWithCognito(username: string, password: string) {
  const { awsRegion, cognitoAppClientId, cognitoClientSecret } = getConfig();
  if (!cognitoAppClientId || !cognitoClientSecret) {
    throw new Error("Cognito App Client ID/Secret not configured");
  }
  const client = new CognitoIdentityProviderClient({ region: awsRegion });
  const secretHash = computeSecretHash(username, cognitoAppClientId, cognitoClientSecret);

  try {
    const cmd = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: cognitoAppClientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: secretHash
      }
    });
    const resp = await client.send(cmd);
    if (!resp.AuthenticationResult) {
      throw new Error("Authentication failed (no result)");
    }
    const { AccessToken, IdToken, RefreshToken, ExpiresIn, TokenType } = resp.AuthenticationResult;
    return {
      accessToken: AccessToken ?? null,
      idToken: IdToken ?? null,
      refreshToken: RefreshToken ?? null,
      expiresIn: ExpiresIn ?? 0,
      tokenType: TokenType ?? "Bearer"
    };
  } catch (err: any) {
    // Debug logs: keep minimal and non-sensitive
    // eslint-disable-next-line no-console
    console.error("Cognito login error:", {
      name: err?.name,
      message: err?.message,
      $metadata: err?.$metadata
    });
    throw new Error("Cognito authentication failed");
  }
}
