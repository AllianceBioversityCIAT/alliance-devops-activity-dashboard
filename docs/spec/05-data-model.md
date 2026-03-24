# Data Model

This section defines the data structures used across the system, including raw data from DynamoDB, domain models, and API contracts.

---

## 1. Data Source (DynamoDB)

### Table
- Name: `jenkinsexecutions_test`

### Raw Record Structure

The system reads deployment execution data from DynamoDB.

```ts
type DynamoExecutionRecord = {
  id: string
  buildDate: string
  buildNumber: number
  commitHash?: string
  commitMessage?: string
  commitUser?: string
  exception?: string | null
  job: string
  result: string
  stage?: string | null
  url?: string
}