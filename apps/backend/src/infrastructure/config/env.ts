const DEFAULT_JOB_QUERY_CONCURRENCY = 15;

type AppConfig = {
  port: number;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  dynamoTableName: string;
  /** Caps Dynamo Scan items evaluated for /api/deployments (dashboard). Executive Summary does not use this cap. */
  dashboardDynamoMaxScannedItems: number;
  /** Executive Summary executions: Query-only strategies (no Scan on executions table). */
  execSummaryExecutionsStrategy: "job_gsi" | "month_gsi";
  execSummaryJobGsiName: string | undefined;
  execSummaryJobGsiPk: string;
  execSummaryJobGsiSk: string;
  execSummaryMonthGsiName: string | undefined;
  execSummaryMonthGsiPk: string;
  execSummaryMonthGsiSk: string;
  execSummaryJobQueryConcurrency: number;
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
    AWS_REGION_DO,
    AWS_ACCESS_KEY_ID_DO,
    AWS_SECRET_ACCESS_KEY_DO,
    // Backward-compat (temporary): allow standard names if *_DO not set
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
    LOG_LEVEL,
    DASHBOARD_DYNAMO_MAX_SCANNED_ITEMS,
    EXEC_SUMMARY_EXECUTIONS_STRATEGY,
    EXEC_SUMMARY_JOB_GSI_NAME,
    EXEC_SUMMARY_JOB_GSI_PK,
    EXEC_SUMMARY_JOB_GSI_SK,
    EXEC_SUMMARY_MONTH_GSI_NAME,
    EXEC_SUMMARY_MONTH_GSI_PK,
    EXEC_SUMMARY_MONTH_GSI_SK,
    EXEC_SUMMARY_JOB_QUERY_CONCURRENCY
  } = process.env;

  const resolvedRegion = (AWS_REGION_DO ?? AWS_REGION)?.trim();
  const resolvedAccessKeyId = (AWS_ACCESS_KEY_ID_DO ?? AWS_ACCESS_KEY_ID)?.trim();
  const resolvedSecretAccessKey = (AWS_SECRET_ACCESS_KEY_DO ?? AWS_SECRET_ACCESS_KEY)?.trim();

  if (!resolvedRegion) {
    throw new Error("Missing required environment variable: AWS_REGION_DO");
  }
  if (!resolvedAccessKeyId) {
    throw new Error("Missing required environment variable: AWS_ACCESS_KEY_ID_DO");
  }
  if (!resolvedSecretAccessKey) {
    throw new Error("Missing required environment variable: AWS_SECRET_ACCESS_KEY_DO");
  }

  const dashboardMaxParsed = Number(DASHBOARD_DYNAMO_MAX_SCANNED_ITEMS ?? 200_000);
  const dashboardDynamoMaxScannedItems =
    Number.isFinite(dashboardMaxParsed) && dashboardMaxParsed > 0 ? dashboardMaxParsed : 200_000;

  const strategyRaw = (EXEC_SUMMARY_EXECUTIONS_STRATEGY ?? "job_gsi").trim().toLowerCase();
  const execSummaryExecutionsStrategy: AppConfig["execSummaryExecutionsStrategy"] =
    strategyRaw === "month_gsi" ? "month_gsi" : "job_gsi";

  const jobConcParsed = Number(EXEC_SUMMARY_JOB_QUERY_CONCURRENCY ?? DEFAULT_JOB_QUERY_CONCURRENCY);
  const execSummaryJobQueryConcurrency =
    Number.isFinite(jobConcParsed) && jobConcParsed > 0 ? Math.min(50, Math.floor(jobConcParsed)) : DEFAULT_JOB_QUERY_CONCURRENCY;

  return {
    port: Number(PORT ?? 4000),
    awsRegion: resolvedRegion,
    awsAccessKeyId: resolvedAccessKeyId,
    awsSecretAccessKey: resolvedSecretAccessKey,
    dynamoTableName: DYNAMODB_TABLE_NAME ?? "jenkinsexecutions_test",
    dashboardDynamoMaxScannedItems,
    execSummaryExecutionsStrategy,
    execSummaryJobGsiName: EXEC_SUMMARY_JOB_GSI_NAME?.trim() || undefined,
    execSummaryJobGsiPk: (EXEC_SUMMARY_JOB_GSI_PK ?? "job").trim(),
    execSummaryJobGsiSk: (EXEC_SUMMARY_JOB_GSI_SK ?? "buildDate").trim(),
    execSummaryMonthGsiName: EXEC_SUMMARY_MONTH_GSI_NAME?.trim() || undefined,
    execSummaryMonthGsiPk: (EXEC_SUMMARY_MONTH_GSI_PK ?? "buildMonth").trim(),
    execSummaryMonthGsiSk: (EXEC_SUMMARY_MONTH_GSI_SK ?? "buildDate").trim(),
    execSummaryJobQueryConcurrency,
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
