import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";
import {
  computeSummaryKpis,
  failureTrend,
  groupByApplication,
  groupByProject,
  mostActiveApplication,
  mostActiveProject,
  topFailingApplications
} from "./executiveSummary";

const TRACE_JOB = "prms-reporting-tool-dev";

function isDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXEC_SUMMARY_DEBUG === "true";
}

/**
 * Stage C: logs the same merged `items[]` array that drives Executive Summary UI
 * (after all API pages are concatenated). Enable with NEXT_PUBLIC_EXEC_SUMMARY_DEBUG=true.
 */
export function logExecutiveSummaryUiFinalDataset(items: ExecutiveSummaryDeployment[]): void {
  if (!isDebugEnabled()) return;
  if (typeof window === "undefined") return;

  const uniqueJobs = [...new Set(items.map((i) => i.application))].sort();
  const prmsRows = items.filter((i) => i.application.toLowerCase().includes("prms"));
  const traceRows = items.filter((i) => i.application === TRACE_JOB);

  const byApp = groupByApplication(items);
  const byProject = groupByProject(items);
  const topFail = topFailingApplications(items);

  console.debug("[executive_summary:C_ui_final_dataset]", {
    note: "Merged across all pages in summary.tsx — this is what the UI renders.",
    totalRows: items.length,
    uniqueJobNamesCount: uniqueJobs.length,
    sampleUniqueJobNames: uniqueJobs.slice(0, 40),
    prmsLikeRowCount: prmsRows.length,
    traceJobRowCount: traceRows.length,
    traceJobRows: traceRows.slice(0, 10).map((row) => ({
      job_name: row.application,
      application_name: row.applicationName,
      project_name: row.projectName,
      environment: row.environment
    })),
    breakdownByApplicationKeys: byApp.map((x) => x.application),
    breakdownByProjectKeys: byProject.map((x) => x.project),
    topFailingApplicationKeys: topFail.map((x) => x.application),
    insights: {
      kpis: computeSummaryKpis(items),
      mostActiveApplication: mostActiveApplication(items),
      mostActiveProject: mostActiveProject(items),
      failureTrend: failureTrend(items)
    }
  });
}

/** Log each page returned by the API while the summary page is building the merged list. */
export function logExecutiveSummaryFetchPage(context: {
  page: number;
  pageSize: number;
  itemsThisPage: number;
  uniqueJobNamesThisPage: string[];
  cumulativeRowCount: number;
}): void {
  if (!isDebugEnabled()) return;
  if (typeof window === "undefined") return;
  const prmsJobs = context.uniqueJobNamesThisPage.filter((j) => j.toLowerCase().includes("prms"));
  console.debug("[executive_summary:ui_fetch_page]", {
    note: "One HTTP response; UI concatenates pages until done.",
    ...context,
    prmsLikeJobNamesThisPage: prmsJobs,
    traceJobOnThisPage: context.uniqueJobNamesThisPage.includes(TRACE_JOB)
  });
}
