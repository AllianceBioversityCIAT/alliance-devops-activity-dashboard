import { Deployment } from "@domain/Deployment";
import { getIdToken } from "../auth/CognitoClient";
import { getEnv } from "../config/env";
import { ApiClient } from "./ApiClient";

export type DeploymentFilters = {
  from?: string;
  to?: string;
  application?: string;
  status?: "success" | "failure";
};

export type DeploymentsApiResponse = {
  items: Deployment[];
  pageInfo: { page: number; pageSize: number; total?: number };
};

export async function fetchDeployments(filters: DeploymentFilters, page: number, pageSize: number): Promise<DeploymentsApiResponse> {
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
  return client.get<DeploymentsApiResponse>(`/api/deployments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
