import { DeploymentExecution } from "../DeploymentExecution.js";

export type ListDeploymentsFilters = {
  from?: string; // ISO string inclusive
  to?: string;   // ISO string inclusive
  application?: string;
  status?: "success" | "failure" | "unknown";
};

export type ListDeploymentsPage = {
  page: number;
  pageSize: number;
};

export type ListDeploymentsResult = {
  items: DeploymentExecution[];
  total?: number; // optional; may be omitted for scan-based MVP
};

export interface DeploymentRepository {
  list(filters: ListDeploymentsFilters, page: ListDeploymentsPage): Promise<ListDeploymentsResult>;
}
