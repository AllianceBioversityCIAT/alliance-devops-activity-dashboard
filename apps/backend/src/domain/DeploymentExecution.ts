export type DeploymentExecution = {
  id: string;
  application: string;
  executedAt: string;
  buildNumber?: number;
  status: "success" | "failure" | "unknown";
  executedBy?: string;
  stage?: string;
  pipelineUrl?: string;
  errorMessage?: string;
};
