import type { DeploymentExecution } from "../../domain/DeploymentExecution.js";
import type { DeploymentMetadata } from "../../domain/DeploymentMetadata.js";

export type EnrichedDeploymentItem = {
  id: string;
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

/** Normalized environment for metadata lookup and fallback (matches enrichment rules). */
export function deploymentEnvironmentOrUnknown(d: DeploymentExecution): string {
  const raw = d.environment?.trim();
  return raw && raw.length > 0 ? raw : "UNKNOWN";
}

export function enrichDeploymentExecution(
  d: DeploymentExecution,
  metadata: DeploymentMetadata | null,
): EnrichedDeploymentItem {
  const jobName = d.application;
  const envOrUnknown = deploymentEnvironmentOrUnknown(d);

  console.log("metadata", metadata);

  if (metadata) {
    const metaEnv = metadata.environment?.trim();
    const resolvedEnv = metaEnv && metaEnv.length > 0 ? metaEnv : envOrUnknown;

    return {
      id: d.id,
      application: jobName,
      applicationName: metadata.applicationName,
      projectName: metadata.projectName,
      environment: resolvedEnv,
      executedAt: d.executedAt,
      buildNumber: d.buildNumber,
      status: d.status,
      executedBy: d.executedBy,
      stage: d.stage,
      pipelineUrl: d.pipelineUrl,
      errorMessage: d.errorMessage,
    };
  }

  return {
    id: d.id,
    application: jobName,
    applicationName: jobName,
    projectName: "OTHERS",
    environment: envOrUnknown,
    executedAt: d.executedAt,
    buildNumber: d.buildNumber,
    status: d.status,
    executedBy: d.executedBy,
    stage: d.stage,
    pipelineUrl: d.pipelineUrl,
    errorMessage: d.errorMessage,
  };
}
