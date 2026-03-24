# DevOps Activity Dashboard

DevOps Activity Dashboard is an MVP designed to provide visibility into deployment activity across PRMS platforms.

The first version focuses on:
- deployment counts by application
- recent deployment executions
- success/failure summary
- filtering by date, job, and status

## Objectives
- provide an executive-friendly dashboard for DevOps activity
- support secure access using Amazon Cognito
- retrieve deployment execution data from DynamoDB
- support local development and AWS serverless deployment
- follow a spec-driven development approach

## Core Technologies
- Frontend: Next.js + TypeScript
- Backend: Node.js + TypeScript
- Authentication: Amazon Cognito
- Data source: Amazon DynamoDB
- Deployment: AWS serverless
- IaC: AWS SAM / CloudFormation

## Project Structure

```text
docs/spec/     -> functional and technical specification
apps/frontend/ -> frontend application
apps/backend/  -> backend API
infra/         -> infrastructure as code
.cursor/       -> Cursor rules and project guidance