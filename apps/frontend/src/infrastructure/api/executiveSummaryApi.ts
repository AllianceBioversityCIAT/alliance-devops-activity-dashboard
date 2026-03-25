import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";
import { getIdToken } from "../auth/CognitoClient";
import { getEnv } from "../config/env";
import { ApiClient } from "./ApiClient";
import type { DeploymentFilters } from "./deploymentsApi";
import { normalizeExecutiveSummaryDeployment } from "./normalizeExecutiveSummaryDeployment";

export type ExecutiveSummaryDeploymentsResponse = {
  items: ExecutiveSummaryDeployment[];
  pageInfo: { page: number; pageSize: number; total?: number };
};

export async function fetchExecutiveSummaryDeployments(
  filters: DeploymentFilters,
  page: number,
  pageSize: number
): Promise<ExecutiveSummaryDeploymentsResponse> {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.application) query.set("application", filters.application);
  if (filters.status) query.set("status", filters.status);
  query.set("page", String(page));
  query.set("pageSize", String(pageSize));

  const client = new ApiClient(getEnv().apiBaseUrl);
  const raw = await client.get<ExecutiveSummaryDeploymentsResponse>(`/api/executive-summary/deployments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return {
    pageInfo: raw.pageInfo,
    items: raw.items.map((item) => normalizeExecutiveSummaryDeployment(item))
  };
}
