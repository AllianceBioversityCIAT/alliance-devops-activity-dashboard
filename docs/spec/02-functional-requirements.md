# Functional Requirements

This section defines the core functional capabilities of the DevOps Activity Dashboard MVP.

---

## 1. Authentication

### 1.1 User Login
The system must allow users to authenticate using email and password via Amazon Cognito.

**Requirements:**
- The user must provide a valid email and password.
- The system must validate credentials against Cognito.
- Upon successful authentication, a valid session/token must be established.
- The user must be redirected to the dashboard after login.
- If authentication fails, a clear error message must be displayed.

---

### 1.2 User Logout
The system must allow authenticated users to log out.

**Requirements:**
- The session/token must be invalidated.
- The user must be redirected to the login screen.
- Protected routes must no longer be accessible after logout.

---

## 2. Dashboard Access

### 2.1 View Dashboard
The system must allow authenticated users to access the main dashboard.

**Requirements:**
- Only authenticated users can access the dashboard.
- Unauthorized users must be redirected to the login page.
- The dashboard must load initial deployment data.

---

## 3. Deployment Data Visualization

### 3.1 List Deployment Executions
The system must display a list of deployment executions retrieved from the backend.

**Requirements:**
- Data must be retrieved from the backend API.
- Each record must include:
  - application/job name
  - execution date
  - build number
  - execution status (success/failure)
  - user associated with the commit (if available)
  - stage/environment (if available)
  - link to pipeline execution
- The list must support pagination or reasonable data limits.

---

### 3.2 Filter Deployment Results
The system must allow users to filter deployment executions.

**Supported filters:**
- date range
- application/job
- execution status (success/failure)

**Requirements:**
- Filters must update the displayed data dynamically.
- Filters must be combinable.
- The system must handle empty results gracefully.

---

### 3.3 View Deployment Details (Basic)
The system must allow users to access the pipeline execution link.

**Requirements:**
- Each deployment record must include a clickable link.
- The link must open the corresponding Jenkins job in a new tab.

---

## 4. Dashboard Metrics (MVP Scope)

### 4.1 Display Deployment Summary
The system must display summary metrics on the dashboard.

**Metrics include:**
- total number of deployments (within selected period)
- number of successful deployments
- number of failed deployments

---

### 4.2 Deployments per Application
The system must display the number of deployments grouped by application/job.

---

### 4.3 Deployments Over Time
The system must display deployment trends over time.

**Requirements:**
- Data must be grouped by day or week.
- Visualization must be clear and easy to interpret.

---

## 5. System Behavior

### 5.1 Loading States
The system must display loading indicators while data is being fetched.

---

### 5.2 Empty States
The system must display a clear message when no data is available.

---

### 5.3 Error Handling
The system must handle errors gracefully.

**Requirements:**
- Display user-friendly error messages.
- Do not expose internal errors or sensitive information.

---

## 6. Security

### 6.1 Protected Routes
All dashboard routes must be protected and accessible only to authenticated users.

---

### 6.2 Token Validation
All backend requests must validate the authentication token.

---

## 7. Future Extensions (Out of MVP Scope)

The following features are explicitly excluded from the MVP but may be considered in future iterations:

- real-time deployment updates
- alerts and notifications
- advanced analytics
- multi-tenant support
- role-based access control (RBAC)