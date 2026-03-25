import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";

function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return undefined;
}

function parseStatus(v: unknown): ExecutiveSummaryDeployment["status"] {
  if (v === "success" || v === "failure" || v === "unknown") return v;
  return "unknown";
}

/**
 * Normalizes API payloads whether the backend uses camelCase or snake_case keys.
 */
export function normalizeExecutiveSummaryDeployment(raw: unknown): ExecutiveSummaryDeployment {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid executive summary deployment row");
  }
  const r = raw as Record<string, unknown>;

  const application = pickStr(r, ["application", "job", "job_name"]) ?? "";
  const applicationName = pickStr(r, ["applicationName", "application_name", "ApplicationName"]) ?? application;
  const projectName = pickStr(r, ["projectName", "project_name", "ProjectName"]) ?? "OTHERS";
  const environment = pickStr(r, ["environment", "Environment"]) ?? "UNKNOWN";

  return {
    id: String(r.id ?? ""),
    application,
    applicationName,
    projectName,
    environment,
    executedAt: String(r.executedAt ?? ""),
    buildNumber: typeof r.buildNumber === "number" ? r.buildNumber : undefined,
    status: parseStatus(r.status),
    executedBy: typeof r.executedBy === "string" ? r.executedBy : undefined,
    stage: typeof r.stage === "string" ? r.stage : undefined,
    pipelineUrl: typeof r.pipelineUrl === "string" ? r.pipelineUrl : undefined,
    errorMessage: typeof r.errorMessage === "string" ? r.errorMessage : undefined
  };
}
