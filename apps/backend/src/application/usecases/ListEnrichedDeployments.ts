import {
  enrichDeploymentExecution,
  type EnrichedDeploymentItem
} from "../enrichment/enrichDeployment.js";
import type { ExecutiveSummaryExecutionsRepository } from "../../domain/ports/ExecutiveSummaryExecutionsRepository.js";
import type { DeploymentMetadataRepository } from "../../domain/ports/DeploymentMetadataRepository.js";
import { getConfig } from "../../infrastructure/config/env.js";

export type ListEnrichedDeploymentsResponse = {
  items: EnrichedDeploymentItem[];
  pageInfo: { page: number; pageSize: number; total?: number };
};

const TRACE_JOB = "prms-reporting-tool-dev";

export type ExecutiveSummaryListFilters = {
  from: string;
  to: string;
  status?: "success" | "failure" | "unknown";
  projectName?: string;
  environment?: string;
  applicationName?: string;
  /** Exact Jenkins job name; narrows job_gsi queries. */
  job?: string;
};

export type ListEnrichedDeploymentsOptions = {
  /** When true, logs stages for this HTTP response. */
  debug?: boolean;
};

export class ListEnrichedDeployments {
  constructor(
    private readonly executions: ExecutiveSummaryExecutionsRepository,
    private readonly metadata: DeploymentMetadataRepository
  ) {}

  async execute(
    filters: ExecutiveSummaryListFilters,
    options?: ListEnrichedDeploymentsOptions
  ): Promise<ListEnrichedDeploymentsResponse> {
    const debug = options?.debug === true;
    const from = filters.from.trim();
    const to = filters.to.trim();
    if (!from || !to) {
      throw new Error("from and to are required for Executive Summary");
    }

    const strategy = getConfig().execSummaryExecutionsStrategy;
    const metaFilters = {
      projectName: filters.projectName?.trim() || undefined,
      environment: filters.environment?.trim() || undefined,
      applicationName: filters.applicationName?.trim() || undefined
    };

    let jobNames: string[] = [];
    if (strategy === "job_gsi") {
      jobNames = await this.metadata.listJobNamesForFilters(metaFilters);
      const jobExact = filters.job?.trim();
      if (jobExact) {
        jobNames = jobNames.includes(jobExact) ? [jobExact] : [];
      }
      if (jobNames.length === 0) {
        return { items: [], pageInfo: { page: 1, pageSize: 0, total: 0 } };
      }
    }

    const raw = await this.executions.listForExecutiveSummary({
      from,
      to,
      status: filters.status,
      jobNames
    });

    const uniqueJobNames = new Set<string>();
    for (const d of raw) {
      const job = d.application.trim();
      if (job) uniqueJobNames.add(job);
    }

    const sortedUniqueJobs = [...uniqueJobNames].sort();
    if (debug) {
      const prmsJobs = sortedUniqueJobs.filter((j) => j.toLowerCase().includes("prms"));
      console.debug("[executive_summary:A_raw_deployments]", {
        strategy,
        rawDeploymentsCount: raw.length,
        uniqueJobNamesCount: uniqueJobNames.size,
        sampleUniqueJobNames: sortedUniqueJobs.slice(0, 40),
        prmsLikeUniqueJobNames: prmsJobs,
        traceJobPresentInRawPage: sortedUniqueJobs.includes(TRACE_JOB)
      });
    }

    const metaByJobName = new Map<string, Awaited<ReturnType<DeploymentMetadataRepository["getByJobName"]>>>();
    await Promise.all(
      [...uniqueJobNames].map(async (jobName) => {
        const meta = await this.metadata.getByJobName(jobName);
        metaByJobName.set(jobName, meta);
      })
    );

    let items: EnrichedDeploymentItem[] = raw.map((d) => {
      const jobKey = d.application.trim();
      const meta = metaByJobName.get(jobKey) ?? null;
      return enrichDeploymentExecution(d, meta);
    });

    items = items.filter((row) => matchesEnrichedFilters(row, metaFilters));

    if (debug) {
      const prmsEnriched = items.filter((row) => row.application.toLowerCase().includes("prms"));
      const traceRows = items.filter((row) => row.application === TRACE_JOB);
      console.debug("[executive_summary:B_after_enrichment]", {
        enrichedDeploymentsCount: items.length,
        enrichedSampleFirst5: items.slice(0, 5).map((row) => ({
          job_name: row.application,
          application_name: row.applicationName,
          project_name: row.projectName,
          environment: row.environment
        })),
        prmsLikeEnrichedRowsCount: prmsEnriched.length,
        traceJobRowsOnThisPage: traceRows.map((row) => ({
          job_name: row.application,
          application_name: row.applicationName,
          project_name: row.projectName,
          environment: row.environment
        }))
      });
    }

    return {
      items,
      pageInfo: {
        page: 1,
        pageSize: items.length,
        total: items.length
      }
    };
  }
}

function matchesEnrichedFilters(
  row: EnrichedDeploymentItem,
  f: { projectName?: string; environment?: string; applicationName?: string }
): boolean {
  if (f.projectName && row.projectName !== f.projectName) return false;
  if (f.environment && row.environment !== f.environment) return false;
  if (f.applicationName && row.applicationName !== f.applicationName) return false;
  return true;
}
