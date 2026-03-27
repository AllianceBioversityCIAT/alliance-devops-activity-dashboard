import { DeploymentExecution } from "../DeploymentExecution.js";

/** Allowed sort fields (API `sortBy`); applied in application/domain after fetch, before pagination. */
export type DeploymentsSortBy = "executedAt" | "application" | "buildNumber" | "status" | "executedBy" | "stage";

export type ListDeploymentsFilters = {
  from?: string; // ISO string inclusive
  to?: string;   // ISO string inclusive
  application?: string;
  status?: "success" | "failure" | "unknown";
  sortBy?: DeploymentsSortBy;
  sortOrder?: "asc" | "desc";
};

export type ListDeploymentsPage = {
  page: number;
  pageSize: number;
};

/**
 * DynamoDB Scan is paginated; optional maxScannedItems caps total items evaluated per call (dashboard cost guard).
 * Omit maxScannedItems or leave undefined to scan the full table (Executive Summary / decision views).
 */
export type ListDeploymentsListOptions = {
  maxScannedItems?: number;
};

export type ListDeploymentsResult = {
  items: DeploymentExecution[];
  total?: number; // optional; may be omitted for scan-based MVP
};

export interface DeploymentRepository {
  list(
    filters: ListDeploymentsFilters,
    page: ListDeploymentsPage,
    options?: ListDeploymentsListOptions
  ): Promise<ListDeploymentsResult>;
}
