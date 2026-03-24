import { Deployment } from "@domain/Deployment";

export type SummaryKpis = {
  totalDeployments: number;
  successCount: number;
  failureCount: number;
  successRate: number;
};

export function computeSummaryKpis(items: Deployment[]): SummaryKpis {
  const totalDeployments = items.length;
  const successCount = items.filter((x) => x.status === "success").length;
  const failureCount = items.filter((x) => x.status === "failure").length;
  const successRate = totalDeployments === 0 ? 0 : Number(((successCount / totalDeployments) * 100).toFixed(2));
  return { totalDeployments, successCount, failureCount, successRate };
}

export function groupByApplication(items: Deployment[]): Array<{ application: string; total: number; failures: number }> {
  const map = new Map<string, { total: number; failures: number }>();
  for (const item of items) {
    const key = item.application || "unknown";
    const row = map.get(key) ?? { total: 0, failures: 0 };
    row.total += 1;
    if (item.status === "failure") row.failures += 1;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([application, v]) => ({ application, total: v.total, failures: v.failures }))
    .sort((a, b) => b.total - a.total);
}

export function groupByDate(items: Deployment[]): Array<{ date: string; total: number; success: number; failure: number }> {
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

export function topFailingApplications(items: Deployment[], top = 3): Array<{ application: string; failures: number }> {
  const byApp = groupByApplication(items)
    .filter((x) => x.failures > 0)
    .sort((a, b) => b.failures - a.failures);
  return byApp.slice(0, top).map((x) => ({ application: x.application, failures: x.failures }));
}

export function repeatedFailures(items: Deployment[]): Array<{ application: string; failures: number }> {
  return topFailingApplications(items, Number.MAX_SAFE_INTEGER).filter((x) => x.failures >= 2);
}

export function mostActiveApplication(items: Deployment[]): { application: string; count: number } | null {
  const row = groupByApplication(items)[0];
  if (!row) return null;
  return { application: row.application, count: row.total };
}

export function failureTrend(items: Deployment[]): "increase" | "decrease" | "stable" | "no_data" {
  const byDate = groupByDate(items);
  if (byDate.length < 2) return "no_data";

  // Deterministic period split over the selected filtered time range.
  const midpoint = Math.floor(byDate.length / 2);
  const previous = byDate.slice(0, midpoint).reduce((acc, x) => acc + x.failure, 0);
  const current = byDate.slice(midpoint).reduce((acc, x) => acc + x.failure, 0);

  if (current > previous) return "increase";
  if (current < previous) return "decrease";
  return "stable";
}
