# Frontend (DevOps Activity Dashboard)

## Prerequisites
- Node.js 18+

## Setup
```bash
cd apps/frontend
npm install
```

## Run locally
```bash
npm run dev
```

The app is available at `http://localhost:3000` (or your configured dev port).

## Environment
Create `.env.local` with:

- `NEXT_PUBLIC_API_BASE_URL` (e.g., `http://localhost:4000`)
- `NEXT_PUBLIC_AWS_REGION` (e.g., `us-east-1`)

## Auth flow (current MVP)
1. User opens `/login` and clicks **Sign in with corporate account**
2. Frontend redirects to backend `/auth/authorize`
3. Cognito redirects back to frontend `FRONTEND_REDIRECT_URI` (`/auth`)
4. Frontend `/auth` exchanges the `code` via backend `/auth/exchange`
5. Tokens are stored in localStorage and user is redirected to `/dashboard`

## Dashboard
- Protected route (`/dashboard`): unauthenticated users are redirected to `/login`
- Uses backend protected endpoint `/api/deployments`
- Supports filters (date range, application, status), pagination, loading/empty/error states, and logout
