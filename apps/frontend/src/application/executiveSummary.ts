import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";

export type SummaryKpis = {
  totalDeployments: number;
  successCount: number;
  failureCount: number;
  successRate: number;
};

/** Display between application name and environment in labels (e.g. Reporting Tool — dev). */
export const APPLICATION_ENV_SEPARATOR = " — ";

export function formatApplicationEnvironmentLabel(item: ExecutiveSummaryDeployment): string {
  const name = item.applicationName?.trim() || "unknown";
  const env = item.environment?.trim() || "UNKNOWN";
  return `${name}${APPLICATION_ENV_SEPARATOR}${env}`;
}

export function computeSummaryKpis(items: ExecutiveSummaryDeployment[]): SummaryKpis {
  const totalDeployments = items.length;
  const successCount = items.filter((x) => x.status === "success").length;
  const failureCount = items.filter((x) => x.status === "failure").length;
  const successRate = totalDeployments === 0 ? 0 : Number(((successCount / totalDeployments) * 100).toFixed(2));
  return { totalDeployments, successCount, failureCount, successRate };
}

/** Groups by enriched application name + environment (distinct rows per app/env). */
export function groupByApplication(items: ExecutiveSummaryDeployment[]): Array<{ application: string; total: number; failures: number }> {
  const map = new Map<string, { total: number; failures: number }>();
  for (const item of items) {
    const key = formatApplicationEnvironmentLabel(item);
    const row = map.get(key) ?? { total: 0, failures: 0 };
    row.total += 1;
    if (item.status === "failure") row.failures += 1;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([application, v]) => ({ application, total: v.total, failures: v.failures }))
    .sort((a, b) => b.total - a.total);
}

/** Groups by enriched project name (includes OTHERS for unmapped jobs). */
export function groupByProject(items: ExecutiveSummaryDeployment[]): Array<{ project: string; total: number; failures: number }> {
  const map = new Map<string, { total: number; failures: number }>();
  for (const item of items) {
    const key = item.projectName || "OTHERS";
    const row = map.get(key) ?? { total: 0, failures: 0 };
    row.total += 1;
    if (item.status === "failure") row.failures += 1;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([project, v]) => ({ project, total: v.total, failures: v.failures }))
    .sort((a, b) => b.total - a.total);
}

export function groupByDate(items: ExecutiveSummaryDeployment[]): Array<{ date: string; total: number; success: number; failure: number }> {
  const map = new Map<string, { total: number; success: number; failure: number }>();
  for (const item of items) {
    const date = new Date(item.executedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    const row = map.get(key) ?? { total: 0, success: 0, failure: 0 };
    row.total += 1;
    if (item.status === "success") row.success += 1;
    if (item.status === "failure") row.failure += 1;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([date, row]) => ({ date, total: row.total, success: row.success, failure: row.failure }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function topFailingApplications(items: ExecutiveSummaryDeployment[], top = 3): Array<{ application: string; failures: number }> {
  const byApp = groupByApplication(items)
    .filter((x) => x.failures > 0)
    .sort((a, b) => b.failures - a.failures);
  return byApp.slice(0, top).map((x) => ({ application: x.application, failures: x.failures }));
}

export function repeatedFailures(items: ExecutiveSummaryDeployment[]): Array<{ application: string; failures: number }> {
  return topFailingApplications(items, Number.MAX_SAFE_INTEGER).filter((x) => x.failures >= 2);
}

export function mostActiveApplication(items: ExecutiveSummaryDeployment[]): { application: string; count: number } | null {
  const row = groupByApplication(items)[0];
  if (!row) return null;
  return { application: row.application, count: row.total };
}

export function mostActiveProject(items: ExecutiveSummaryDeployment[]): { project: string; count: number } | null {
  const row = groupByProject(items)[0];
  if (!row) return null;
  return { project: row.project, count: row.total };
}

export function failureTrend(items: ExecutiveSummaryDeployment[]): "increase" | "decrease" | "stable" | "no_data" {
  const byDate = groupByDate(items);
  if (byDate.length < 2) return "no_data";

  const midpoint = Math.floor(byDate.length / 2);
  const previous = byDate.slice(0, midpoint).reduce((acc, x) => acc + x.failure, 0);
  const current = byDate.slice(midpoint).reduce((acc, x) => acc + x.failure, 0);

  if (current > previous) return "increase";
  if (current < previous) return "decrease";
  return "stable";
}

// --- Client-side filters (enriched fields only; dataset = full fetch for date + status) ---

export type ExecutiveSummaryFilterState = {
  project: string;
  environment: string;
  applicationName: string;
};

export function applyExecutiveSummaryFilters(
  items: ExecutiveSummaryDeployment[],
  f: ExecutiveSummaryFilterState
): ExecutiveSummaryDeployment[] {
  return items.filter((row) => {
    if (f.project && row.projectName !== f.project) return false;
    if (f.environment && row.environment !== f.environment) return false;
    if (f.applicationName && row.applicationName !== f.applicationName) return false;
    return true;
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].filter((v) => v.length > 0).sort((a, b) => a.localeCompare(b));
}

export function projectOptionsFromDataset(items: ExecutiveSummaryDeployment[]): string[] {
  return uniqueSorted(items.map((i) => i.projectName));
}

export function environmentOptionsFromDataset(items: ExecutiveSummaryDeployment[], projectFilter: string): string[] {
  const base = projectFilter ? items.filter((i) => i.projectName === projectFilter) : items;
  return uniqueSorted(base.map((i) => i.environment));
}

export function applicationNameOptionsFromDataset(
  items: ExecutiveSummaryDeployment[],
  projectFilter: string,
  environmentFilter: string
): string[] {
  let base = items;
  if (projectFilter) base = base.filter((i) => i.projectName === projectFilter);
  if (environmentFilter) base = base.filter((i) => i.environment === environmentFilter);
  return uniqueSorted(base.map((i) => i.applicationName));
}
