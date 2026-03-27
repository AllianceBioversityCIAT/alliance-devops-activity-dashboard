import { Deployment } from "@domain/Deployment";
import { getIdToken } from "../auth/CognitoClient";
import { getEnv } from "../config/env";
import { ApiClient } from "./ApiClient";

export type DeploymentsSortBy = "executedAt" | "application" | "buildNumber" | "status" | "executedBy" | "stage";

export type DeploymentFilters = {
  from?: string;
  to?: string;
  application?: string;
  status?: "success" | "failure";
  sortBy?: DeploymentsSortBy;
  sortOrder?: "asc" | "desc";
};

export type DeploymentsApiResponse = {
  items: Deployment[];
  pageInfo: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
    effectiveSortBy: DeploymentsSortBy;
    sortWarning?: string;
  };
};

export type FetchDeploymentsPage = {
  limit: number;
  /** Opaque cursor from `pageInfo.nextCursor` for the previous response; omit for the first page. */
  cursor?: string;
};

export async function fetchDeployments(
  filters: DeploymentFilters,
  page: FetchDeploymentsPage
): Promise<DeploymentsApiResponse> {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.application) query.set("application", filters.application);
  if (filters.status) query.set("status", filters.status);
  if (filters.sortBy) query.set("sortBy", filters.sortBy);
  if (filters.sortOrder) query.set("sortOrder", filters.sortOrder);
  query.set("pageSize", String(page.limit));
  if (page.cursor) query.set("cursor", page.cursor);

  const client = new ApiClient(getEnv().apiBaseUrl);
  return client.get<DeploymentsApiResponse>(`/api/deployments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
