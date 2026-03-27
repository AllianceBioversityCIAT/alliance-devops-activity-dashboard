import type { DeploymentExecution } from "../DeploymentExecution.js";

export type ExecutiveSummaryExecutionFilters = {
  from: string;
  to: string;
  status?: "success" | "failure" | "unknown";
  /**
   * For job_gsi strategy: jobs to read (typically from deployment_metadata).
   * Ignored for month_gsi strategy (full partition queries by month).
   */
  jobNames: readonly string[];
};

export interface ExecutiveSummaryExecutionsRepository {
  /** Query-based reads only (no Scan). Returns all matching executions in range. */
  listForExecutiveSummary(filters: ExecutiveSummaryExecutionFilters): Promise<DeploymentExecution[]>;
}
