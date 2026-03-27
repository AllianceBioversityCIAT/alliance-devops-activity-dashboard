import { createHash } from "node:crypto";

/**
 * Opaque pagination cursor for Dashboard list (GSI Query + merge).
 * - `single`: one job partition + buildDate SK (from application filter).
 * - `merge`: k-way merge across many job partitions (no application filter); job list must match `jh`.
 */
export type DashboardCursorPayload =
  | { v: 1; mode: "single"; job: string; lek: Record<string, unknown> | null; fh: string }
  | {
      v: 1;
      mode: "merge";
      lekByJob: Record<string, Record<string, unknown> | null>;
      fh: string;
      jh: string;
    };

export function dashboardFiltersHash(f: { from?: string; to?: string; application?: string; status?: string }): string {
  const payload = JSON.stringify({
    from: f.from ?? "",
    to: f.to ?? "",
    application: (f.application ?? "").trim(),
    status: f.status ?? ""
  });
  return createHash("sha256").update(payload).digest("base64url").slice(0, 20);
}

export function dashboardJobsHash(jobsSorted: string[]): string {
  return createHash("sha256").update(jobsSorted.join("\0")).digest("base64url").slice(0, 12);
}

export function encodeDashboardCursor(p: DashboardCursorPayload): string {
  return Buffer.from(JSON.stringify(p), "utf-8").toString("base64url");
}

export function decodeDashboardCursor(s: string): DashboardCursorPayload | null {
  try {
    const raw = JSON.parse(Buffer.from(s, "base64url").toString("utf-8")) as DashboardCursorPayload;
    if (raw?.v !== 1 || (raw.mode !== "single" && raw.mode !== "merge")) return null;
    return raw;
  } catch {
    return null;
  }
}
