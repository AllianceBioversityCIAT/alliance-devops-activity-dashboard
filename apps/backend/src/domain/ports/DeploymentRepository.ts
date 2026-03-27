import { DeploymentExecution } from "../DeploymentExecution.js";

/** Allowed sort fields (API `sortBy`). Server-side pagination uses buildDate / execution time only; see sortWarning on responses. */
export type DeploymentsSortBy = "executedAt" | "application" | "buildNumber" | "status" | "executedBy" | "stage";

export type ListDeploymentsFilters = {
  from?: string; // ISO string inclusive
  to?: string; // ISO string inclusive
  application?: string;
  status?: "success" | "failure" | "unknown";
  sortBy?: DeploymentsSortBy;
  sortOrder?: "asc" | "desc";
};

/** Cursor-based page (Dashboard: DynamoDB GSI Query + LastEvaluatedKey; no page numbers). */
export type ListDeploymentsQueryPage = {
  limit: number;
  /** Opaque cursor from previous response `pageInfo.nextCursor`. */
  cursor?: string;
};

export type ListDeploymentsQueryResult = {
  items: DeploymentExecution[];
  nextCursor: string | null;
  hasNextPage: boolean;
  /** Always `executedAt` / buildDate order from DynamoDB for stable pagination. */
  effectiveSortBy: DeploymentsSortBy;
  sortWarning?: string;
};

export interface DeploymentRepository {
  list(filters: ListDeploymentsFilters, page: ListDeploymentsQueryPage): Promise<ListDeploymentsQueryResult>;
}
