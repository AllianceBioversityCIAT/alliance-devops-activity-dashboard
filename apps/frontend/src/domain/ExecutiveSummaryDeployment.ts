/** Deployment row enriched for Executive Summary (from `/api/executive-summary/deployments`). */
export type ExecutiveSummaryDeployment = {
  id: string;
  /** Raw Jenkins job name. */
  application: string;
  applicationName: string;
  projectName: string;
  environment: string;
  executedAt: string;
  buildNumber?: number;
  status: "success" | "failure" | "unknown";
  executedBy?: string;
  stage?: string;
  pipelineUrl?: string;
  errorMessage?: string;
};
