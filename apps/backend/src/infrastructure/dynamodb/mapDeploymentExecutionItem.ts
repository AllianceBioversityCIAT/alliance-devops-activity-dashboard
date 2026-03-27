import type { DeploymentExecution } from "../../domain/DeploymentExecution.js";

export function normalizeDynamoResultStatus(raw?: string | null): "success" | "failure" | "unknown" {
  const val = (raw ?? "").toString().toLowerCase();
  if (val === "success") return "success";
  if (val === "failure") return "failure";
  return "unknown";
}

/** Maps a DynamoDB executions table item (DocumentClient shape) to the domain model. */
export function mapDynamoItemToDeploymentExecution(item: Record<string, unknown>): DeploymentExecution {
  return {
    id: String(item.id ?? ""),
    application: String(item.job ?? ""),
    environment: item.environment != null && String(item.environment).trim() !== "" ? String(item.environment).trim() : undefined,
    executedAt: String(item.buildDate ?? ""),
    buildNumber: typeof item.buildNumber === "number" ? item.buildNumber : Number(item.buildNumber) || undefined,
    status: normalizeDynamoResultStatus(item.result as string | undefined),
    executedBy: item.commitUser ? String(item.commitUser) : undefined,
    stage: item.stage ? String(item.stage) : undefined,
    pipelineUrl: item.url ? String(item.url) : undefined,
    errorMessage: item.exception ? String(item.exception) : undefined
  };
}
