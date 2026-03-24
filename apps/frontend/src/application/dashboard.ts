import { Deployment } from "@domain/Deployment";

export type SummaryMetrics = {
  total: number;
  success: number;
  failure: number;
};

export function computeSummary(items: Deployment[]): SummaryMetrics {
  let success = 0;
  let failure = 0;
  for (const item of items) {
    if (item.status === "success") success += 1;
    if (item.status === "failure") failure += 1;
  }
  return { total: items.length, success, failure };
}

export function groupByApplication(items: Deployment[]): Array<{ application: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.application || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([application, count]) => ({ application, count }))
    .sort((a, b) => b.count - a.count);
}

export function groupOverTime(items: Deployment[], granularity: "day" | "week"): Array<{ bucket: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const date = new Date(item.executedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = granularity === "week" ? isoWeekKey(date) : date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function isoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
