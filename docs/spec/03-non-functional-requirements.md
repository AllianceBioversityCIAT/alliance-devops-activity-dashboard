# Non-Functional Requirements

This section defines the technical, architectural, and quality constraints for the DevOps Activity Dashboard MVP.

These requirements must be strictly followed during design and implementation.

---

## 1. Architecture

### 1.1 Incremental and Modular Design
The system must be designed to support incremental development and future extensibility.

**Requirements:**
- The system must be modular and loosely coupled.
- Features must be implemented in small, independent increments.
- Changes must not require major refactoring of existing components.

---

### 1.2 Hexagonal Architecture
Both frontend and backend must follow principles inspired by hexagonal architecture.

**Backend:**
- Separate domain, application, and infrastructure layers.
- Use ports and adapters to isolate external dependencies (DynamoDB, Cognito, APIs).

**Frontend:**
- Separate business logic from UI components.
- Isolate data access and external integrations.

---

## 2. Deployment Model

### 2.1 Serverless Architecture (AWS)
The system must be deployable using serverless components in AWS.

**Frontend:**
- Must be deployable as a static application.
- Hosted in Amazon S3.
- Delivered via Amazon CloudFront (HTTPS).

**Backend:**
- Must be implemented using AWS Lambda.
- Exposed via API Gateway.

**Authentication:**
- Must use Amazon Cognito.

**Data:**
- Must use Amazon DynamoDB.

---

### 2.2 Local Development Support
The system must be executable locally for development and testing.

**Requirements:**
- Frontend must run locally (e.g., dev server).
- Backend must run locally (Node.js server or SAM local).
- Environment variables must support local configuration.
- No dependency on deployed cloud infrastructure for basic development.

---

## 2.3 Infrastructure as Code

The system infrastructure must be defined and managed as code.

**Requirements:**
- AWS infrastructure must be provisioned using Infrastructure as Code.
- The project must include versioned infrastructure definitions.
- Infrastructure changes must be reproducible across environments.
- Manual infrastructure changes in AWS console should be avoided whenever possible.

**Scope includes:**
- frontend hosting resources
- CloudFront distribution
- backend serverless resources
- API Gateway configuration
- Lambda functions
- IAM permissions
- environment-specific configuration
- optional Cognito integration references if required by deployment

**Preferred approach for MVP:**
- Use AWS SAM or AWS CloudFormation for backend and serverless resources.
- Define deployment-related resources under an `infra/` directory.

---

## 3. Configuration Management

### 3.1 Environment Variables
All configuration must be handled via environment variables.

**Requirements:**
- No hardcoded credentials or environment-specific values.
- Provide `.env.example` files for both frontend and backend.
- Support multiple environments (local, dev, prod).

**Examples:**
- Cognito configuration
- API endpoints
- AWS region
- DynamoDB table name

---

### 3.2 Secrets Management
Sensitive information must not be exposed.

**Requirements:**
- Do not store secrets in source code.
- Use environment variables or secure AWS mechanisms.

---

## 4. Authentication and Security

### 4.1 Authentication Mechanism
Authentication must be implemented using Amazon Cognito.

**Requirements:**
- Email and password login.
- Token-based session (JWT).
- Frontend must manage authentication state.
- Backend must validate tokens for protected endpoints.

---

### 4.2 Authorization (MVP Scope)
Authorization will be minimal in MVP.

**Requirements:**
- Only authenticated users can access the dashboard.
- No role-based access control required for MVP.

---

### 4.3 API Security
All backend endpoints must be secured.

**Requirements:**
- Validate JWT tokens on every request.
- Reject unauthorized requests.
- Avoid exposing internal system details in responses.

---

## 5. Code Quality

### 5.1 Linters and Formatting
The project must enforce code quality standards.

**Requirements:**
- Use ESLint.
- Use Prettier.
- Enforce consistent code formatting.
- Prevent unused variables and imports.

---

### 5.2 Type Safety
The system must use strong typing.

**Requirements:**
- Use TypeScript in both frontend and backend.
- Enable strict mode.
- Avoid usage of `any` unless justified.

---

### 5.3 Project Structure
The codebase must be well organized.

**Requirements:**
- Clear separation of concerns.
- Maintainable folder structure.
- Avoid monolithic files.

---

## 6. Error Handling

### 6.1 Backend Error Handling
The backend must handle errors gracefully.

**Requirements:**
- Return standardized error responses.
- Do not expose stack traces or internal details.
- Log errors for debugging.

---

### 6.2 Frontend Error Handling
The frontend must provide user-friendly error messages.

**Requirements:**
- Display clear messages.
- Handle API failures gracefully.
- Provide fallback UI states.

---

## 7. Logging

### 7.1 Structured Logging
The backend must implement structured logging.

**Requirements:**
- Logs must include timestamps and context.
- Logs must support debugging and monitoring.
- Avoid logging sensitive data.

---

## 8. Performance

### 8.1 Response Time
The system must provide acceptable response times.

**Targets:**
- API responses under 1–2 seconds for standard queries.

---

### 8.2 Data Handling
The system must avoid loading excessive data.

**Requirements:**
- Implement pagination or limits.
- Optimize queries to DynamoDB.

**Follow-up (Executive Summary):** The Executive Summary intentionally aggregates a full selected window per request while using Query-scoped reads. For future scale, see **§ 6.1** in `docs/spec/07-implementation-plan.md` (performance optimization — backlog).

---

## 9. Maintainability

### 9.1 Readability and Documentation
The code must be understandable and maintainable.

**Requirements:**
- Use clear naming conventions.
- Add minimal but useful comments.
- Keep documentation updated.

---

### 9.2 Spec-Driven Development
The implementation must follow the defined spec.

**Requirements:**
- All features must trace back to spec definitions.
- Updates must be reflected in documentation.
- Do not implement features outside the defined scope without updating the spec.

---

## 10. Testing (Initial Scope)

### 10.1 Basic Testing
The system must include basic test coverage.

**Requirements:**
- Unit tests for core logic.
- Validation of main use cases.
- Ensure critical flows (login, data retrieval) work correctly.

---

## 11. Compatibility

### 11.1 Browser Support
The frontend must work in modern browsers.

---

## 12. Constraints

### 12.1 MVP Scope Constraints
To keep the MVP focused:

- No real-time updates required.
- No advanced analytics required.
- No complex authorization model.
- No multi-region deployment required.