# Backend (DevOps Activity Dashboard)

## Prerequisites
- Node.js 18+

## Setup
```bash
cd apps/backend
npm install
```

## Environment
Copy `ENV.EXAMPLE` to `.env` and set real values:

```bash
cp ENV.EXAMPLE .env
```

Required variables include:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DYNAMODB_TABLE_NAME`
- `COGNITO_APP_CLIENT_ID`
- `COGNITO_CLIENT_SECRET`
- `COGNITO_ISSUER`
- `COGNITO_DOMAIN`
- `FRONTEND_REDIRECT_URI` (current local flow: `http://localhost:4200/auth`)

## Run locally
```bash
npm run dev
```

The API is available at `http://localhost:4000`.

## Endpoints
- Public:
  - `GET /health`
  - `GET /auth/authorize`
  - `POST /auth/exchange`
- Protected (JWT):
  - `GET /deployments`
  - `GET /api/deployments`

## Notes
- Deployment data is read from DynamoDB table configured via `DYNAMODB_TABLE_NAME`.
- JWT validation uses Cognito issuer + JWKS.
