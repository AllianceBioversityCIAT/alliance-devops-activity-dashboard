# Implementation Plan

This document defines the step-by-step implementation strategy for the DevOps Activity Dashboard MVP.

The implementation must follow an incremental approach aligned with the defined specification.

---

## 1. Implementation Strategy

The system will be developed in small, controlled iterations.

Each phase must:
- deliver working functionality
- be testable locally
- align with the defined spec
- avoid unnecessary complexity

The goal is to progressively move from a local MVP to a fully deployed serverless solution.

---

## 2. Technology Decisions

### Frontend
- Framework: Next.js (static rendering)
- Language: TypeScript
- Styling: simple (no heavy UI framework required for MVP)

### Backend
- Runtime: Node.js
- Language: TypeScript
- Architecture: Hexagonal (domain, application, infrastructure, interfaces)

### Infrastructure
- AWS SAM (Infrastructure as Code)

### Cloud Services
- S3 + CloudFront (frontend)
- API Gateway + Lambda (backend)
- Cognito (authentication)
- DynamoDB (data source)

---

## 3. Implementation Phases

---

### Phase 1 — Project Setup & Local Foundation

**Goal:**
Establish a working local development environment with base structure and tooling.

**Tasks:**
- Initialize frontend project (Next.js)
- Initialize backend project (Node.js + TypeScript)
- Configure ESLint and Prettier
- Configure TypeScript (strict mode)
- Create `.env.example` files for frontend and backend
- Implement basic project structure (hexagonal for backend)

**Backend:**
- Create `/health` endpoint
- Create mock `/deployments` endpoint

**Frontend:**
- Create basic layout
- Create login page (UI only, no Cognito yet)
- Create dashboard page (placeholder)

**Acceptance Criteria:**
- Frontend runs locally
- Backend runs locally
- API can be called from frontend
- Linting passes

---

### Phase 2 — Authentication (Cognito Integration)

**Goal:**
Enable secure authentication using Amazon Cognito.

**Tasks:**
- Implement login with email/password
- Integrate Cognito in frontend
- Store authentication tokens
- Protect frontend routes
- Implement backend JWT validation middleware

**Acceptance Criteria:**
- Users can log in using Cognito
- Unauthorized users cannot access dashboard
- Backend rejects requests without valid token

---

### Phase 3 — DynamoDB Integration

**Goal:**
Connect backend to DynamoDB and retrieve real deployment data.

**Tasks:**
- Implement DynamoDB adapter (infrastructure layer)
- Implement repository interface
- Implement use case: list deployments
- Map DynamoDB records to domain model
- Support filtering (date, job, status)

**Acceptance Criteria:**
- Backend retrieves real data from DynamoDB
- Data is correctly mapped to domain model
- API returns clean, structured responses

---

### Phase 4 — Dashboard Implementation

**Goal:**
Provide visual insights into deployment activity.

**Tasks:**
- Implement summary metrics (total, success, failure)
- Implement deployments per application
- Implement deployments over time
- Implement deployments table
- Implement filters (date, job, status)
- Handle loading, empty, and error states

**Acceptance Criteria:**
- Dashboard displays real data
- Filters work correctly
- UI is clear and usable

---

### Phase 5 — Infrastructure & Deployment (IaC)

**Goal:**
Deploy the system to AWS using Infrastructure as Code.

**Tasks:**
- Create SAM template in `infra/`
- Define Lambda, API Gateway, IAM roles
- Define S3 and CloudFront for frontend
- Parameterize environment variables
- Configure deployment per environment

**Acceptance Criteria:**
- Backend deployed via SAM
- Frontend deployed to S3 + CloudFront
- Application accessible via public URL

---

### Phase 6 — Integration & Validation

**Goal:**
Ensure full system integration and correctness.

**Tasks:**
- Validate authentication flow end-to-end
- Validate frontend ↔ backend integration
- Validate backend ↔ DynamoDB integration
- Validate environment configuration
- Fix issues and refine UX

**Acceptance Criteria:**
- End-to-end flow works correctly
- No critical errors
- Application is stable

---

### Phase 7 — UI/UX Refinement

**Goal:**
Improve the visual quality, usability, and consistency of the user interface without modifying core functionality.

**Tasks:**
- Improve login page layout (split-screen design)
- Improve dashboard layout and visual hierarchy
- Standardize spacing, typography, and alignment
- Improve filter usability and positioning
- Improve table readability and structure
- Improve loading, empty, and error states UI
- Ensure responsive behavior across devices
- Apply consistent styling across components

**Scope Constraints:**
- No changes to business logic
- No changes to authentication flow
- No backend modifications
- No new features outside the defined MVP scope

**Acceptance Criteria:**
- Login page has a clean split layout (image + login section)
- Dashboard is visually clear and easy to understand
- Filters are usable and intuitive
- UI components are consistent (cards, tables, spacing)
- Loading, empty, and error states are visually clear
- Application is responsive on different screen sizes

---

---

### Phase 8 — Executive Summary Module

**Goal:**
Provide a high-level, decision-oriented view of deployment activity to support leadership and operational decision-making.

This module focuses on insights and trends rather than raw operational data.

---

### Approach

- Implement as a new module, separate from the main dashboard
- Accessible via navigation (e.g., sidebar or top menu)
- Do NOT modify existing dashboard behavior
- Reuse existing data sources and APIs where possible
- Follow Spec-Driven Development (SDD): all functionality must be driven by the defined spec

---

### Spec — Executive Summary Module

module: executive_summary

data_source:
  - deployments (existing API)

metrics:
  - totalDeployments
  - successCount
  - failureCount
  - successRate

groupings:
  - byApplication
  - byDate

insights:
  - topFailingApplications (top 3 by failure count)
  - mostActiveApplication
  - failureTrend (increase/decrease vs previous period)

filters:
  - dateFrom
  - dateTo
  - application
  - status

constraints:
  - calculations must be deterministic
  - data must be derived from real deployment records
  - no inferred or synthetic data
  - results must reflect selected filters

---

### Functional Scope

#### 1. Summary KPIs

Display key metrics for the selected period:

- total deployments
- success count
- failure count
- success rate

Optional (if feasible):
- comparison vs previous period

---

#### 2. Attention Required

Highlight risk areas:

- applications with highest failure count
- repeated failures in same application/job
- unstable areas (based on failure concentration)

Goal:
Enable quick identification of problem areas.

---

#### 3. Deployment Trends

Display:

- deployments over time (grouped by day or week)
- success vs failure trend

Goal:
Understand system behavior over time.

---

#### 4. Breakdown by Application

Display:

- number of deployments per application/job
- highlight top active applications
- highlight applications with most failures

---

#### 5. Auto-Generated Insights

Display simple textual insights:

- most active application
- application with most failures
- noticeable increase or decrease in failures

Goal:
Provide quick, human-readable conclusions.

---

### UI Requirements

- implement as a new page (e.g., `/summary` or `/executive-summary`)
- add navigation entry (sidebar or header menu)
- maintain visual consistency with existing design system
- keep layout clean and readable
- no heavy UI frameworks required

---

### Backend Requirements

- reuse existing `/api/deployments` endpoint
- perform aggregation in frontend or backend (prefer simplest approach)
- avoid creating new endpoints unless strictly necessary
- ensure calculations align with defined spec

---

### Constraints

- do not modify existing dashboard functionality
- do not break current features
- do not introduce advanced analytics beyond MVP
- keep implementation simple and maintainable

---

### Acceptance Criteria

- module accessible from navigation
- displays summary KPIs correctly
- shows at least one meaningful insight
- trend visualization is present
- application breakdown is visible
- results respond to filters
- no impact on existing dashboard

---

## 4. Development Workflow

Each phase must follow this workflow:

1. Review spec
2. Generate plan (with Cursor)
3. Implement incrementally
4. Run locally
5. Validate against acceptance criteria
6. Update spec documentation if needed

---

## 5. Cursor Usage Strategy

Cursor must be used as an implementation assistant, not as a black-box generator.

### Rules:
- Always reference `docs/spec`
- Implement one phase at a time
- Do not generate the entire system at once
- Validate each step before proceeding

### Example Prompt:

```text
Read docs/spec and implement Phase 1 of the implementation plan.

Requirements:
- Do not implement Cognito yet
- Do not connect to DynamoDB
- Focus only on local setup and basic structure
- Ensure project runs locally
- Follow hexagonal architecture for backend