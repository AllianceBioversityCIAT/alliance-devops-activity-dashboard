export type DeploymentExecution = {
  id: string;
  /** Jenkins job name (from Dynamo `job`). */
  application: string;
  /** Deployment environment when present on the execution record. */
  environment?: string;
  executedAt: string;
  buildNumber?: number;
  status: "success" | "failure" | "unknown";
  executedBy?: string;
  stage?: string;
  pipelineUrl?: string;
  errorMessage?: string;
};
