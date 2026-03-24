export type FrontendEnv = {
  apiBaseUrl: string;
  awsRegion: string;
  cognitoUserPoolId?: string;
  cognitoAppClientId?: string;
};

export function getEnv(): FrontendEnv {
  return {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000",
    awsRegion: process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1",
    cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    cognitoAppClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID
  };
}
