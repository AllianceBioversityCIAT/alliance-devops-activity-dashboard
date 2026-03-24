# Deployment

This section defines the deployment strategy for the DevOps Activity Dashboard MVP, including local execution, AWS deployment model, and Infrastructure as Code approach.

---

## 1. Deployment Objectives

The solution must support two execution modes:

1. Local development and testing
2. Cloud deployment in AWS using serverless components

The deployment process must be reproducible, environment-based, and managed through Infrastructure as Code.

---

## 2. Target AWS Deployment Model

The MVP must be deployed using the following AWS services:

### Frontend
- Amazon S3 for static asset hosting
- Amazon CloudFront for HTTPS delivery and caching

### Backend
- Amazon API Gateway for HTTP API exposure
- AWS Lambda for serverless compute

### Authentication
- Amazon Cognito for user authentication
- Existing Cognito resources must be referenced through configuration

### Data
- Amazon DynamoDB as read-only data source for deployment execution records
- Existing DynamoDB table must be referenced through configuration

---

## 3. Infrastructure as Code Strategy

Infrastructure must be managed as code and versioned in the repository.

### Requirements
- Infrastructure definitions must be stored under the `infra/` directory
- Deployment must be reproducible across environments
- Manual changes in the AWS Console should be avoided whenever possible
- Infrastructure definitions must be parameterized by environment

### Recommended Approach
For the MVP, the preferred approach is:

- **AWS SAM** for backend and serverless resources
- **AWS SAM or CloudFormation** for frontend hosting resources

### Resources Managed by This Project
The project should provision, at minimum:

- S3 bucket for frontend hosting
- CloudFront distribution
- API Gateway
- Lambda function(s)
- IAM roles and policies required by Lambda
- Environment-specific configuration for deployed workloads

### External Resources Referenced by This Project
The project will reference existing shared resources instead of creating them:

- Cognito User Pool
- Cognito App Client
- DynamoDB table `jenkinsexecutions_test`

These values must be provided through environment variables or deployment parameters.

---

## 4. Environment Strategy

The solution must support multiple environments.

### Initial Environments
- local
- dev
- prod

### Environment Differences
Each environment may differ in:
- API base URL
- Cognito identifiers
- AWS region
- DynamoDB table name
- CloudFront domain
- logging behavior

### Configuration Rules
- No environment-specific values may be hardcoded
- All configuration must be externalized
- `.env.example` files must be provided for local development
- Deployment templates must support parameter overrides per environment

---

## 5. Local Development Deployment

The solution must be runnable locally for development and testing.

### Frontend Local Execution
The frontend must run through a local development server.

Example:
```bash
cd apps/frontend
npm install
npm run dev