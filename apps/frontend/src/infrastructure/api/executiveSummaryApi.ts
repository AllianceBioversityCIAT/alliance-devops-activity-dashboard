import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";
import { getIdToken } from "../auth/CognitoClient";
import { getEnv } from "../config/env";
import { ApiClient } from "./ApiClient";
import { normalizeExecutiveSummaryDeployment } from "./normalizeExecutiveSummaryDeployment";

export type ExecutiveSummaryDeploymentsResponse = {
  items: ExecutiveSummaryDeployment[];
  pageInfo: { page: number; pageSize: number; total?: number };
};

/** Filters sent only when the user applies them (single request, no pagination). */
export type ExecutiveSummaryRequestFilters = {
  from: string;
  to: string;
  status?: "success" | "failure";
  projectName?: string;
  environment?: string;
  applicationName?: string;
  job?: string;
};

export async function fetchExecutiveSummaryDeployments(
  filters: ExecutiveSummaryRequestFilters
): Promise<ExecutiveSummaryDeploymentsResponse> {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const query = new URLSearchParams();
  query.set("from", filters.from);
  query.set("to", filters.to);
  if (filters.status) query.set("status", filters.status);
  if (filters.projectName) query.set("projectName", filters.projectName);
  if (filters.environment) query.set("environment", filters.environment);
  if (filters.applicationName) query.set("applicationName", filters.applicationName);
  if (filters.job) query.set("job", filters.job);

  const client = new ApiClient(getEnv().apiBaseUrl);
  const raw = await client.get<ExecutiveSummaryDeploymentsResponse>(
    `/api/executive-summary/deployments?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return {
    pageInfo: raw.pageInfo,
    items: raw.items.map((item) => normalizeExecutiveSummaryDeployment(item))
  };
}
