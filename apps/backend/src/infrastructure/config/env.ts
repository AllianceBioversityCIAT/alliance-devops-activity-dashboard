type AppConfig = {
  port: number;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  dynamoTableName: string;
  /** Optional; when unset, metadata lookups are skipped (enrichment falls back to OTHERS). */
  deploymentMetadataTableName: string | undefined;
  cognitoUserPoolId: string | undefined;
  cognitoAppClientId: string | undefined;
  cognitoClientSecret: string | undefined;
  cognitoIssuer: string | undefined;
  cognitoDomain: string | undefined;
  frontendRedirectUri: string | undefined;
  cognitoIdentityProvider: string | undefined;
  logLevel: "debug" | "info" | "warn" | "error";
};

export function getConfig(): AppConfig {
  const {
    PORT,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    DYNAMODB_TABLE_NAME,
    DYNAMODB_DEPLOYMENT_METADATA_TABLE_NAME,
    COGNITO_USER_POOL_ID,
    COGNITO_APP_CLIENT_ID,
    COGNITO_CLIENT_SECRET,
    COGNITO_ISSUER,
    COGNITO_DOMAIN,
    FRONTEND_REDIRECT_URI,
    COGNITO_IDENTITY_PROVIDER,
    LOG_LEVEL
  } = process.env;

  if (!AWS_REGION) {
    throw new Error("Missing required environment variable: AWS_REGION");
  }
  if (!AWS_ACCESS_KEY_ID) {
    throw new Error("Missing required environment variable: AWS_ACCESS_KEY_ID");
  }
  if (!AWS_SECRET_ACCESS_KEY) {
    throw new Error("Missing required environment variable: AWS_SECRET_ACCESS_KEY");
  }

  return {
    port: Number(PORT ?? 4000),
    awsRegion: AWS_REGION,
    awsAccessKeyId: AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
    dynamoTableName: DYNAMODB_TABLE_NAME ?? "jenkinsexecutions_test",
    deploymentMetadataTableName: DYNAMODB_DEPLOYMENT_METADATA_TABLE_NAME?.trim() || undefined,
    cognitoUserPoolId: COGNITO_USER_POOL_ID,
    cognitoAppClientId: COGNITO_APP_CLIENT_ID,
    cognitoClientSecret: COGNITO_CLIENT_SECRET,
    cognitoIssuer: COGNITO_ISSUER,
    cognitoDomain: COGNITO_DOMAIN,
    frontendRedirectUri: FRONTEND_REDIRECT_URI,
    cognitoIdentityProvider: COGNITO_IDENTITY_PROVIDER,
    logLevel: (LOG_LEVEL ?? "info") as AppConfig["logLevel"]
  };
}
