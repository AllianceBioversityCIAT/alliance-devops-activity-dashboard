import {
  enrichDeploymentExecution,
  type EnrichedDeploymentItem,
} from "../enrichment/enrichDeployment.js";
import type {
  DeploymentRepository,
  ListDeploymentsFilters,
  ListDeploymentsPage,
} from "../../domain/ports/DeploymentRepository.js";
import type { DeploymentMetadataRepository } from "../../domain/ports/DeploymentMetadataRepository.js";

export type ListEnrichedDeploymentsResponse = {
  items: EnrichedDeploymentItem[];
  pageInfo: { page: number; pageSize: number; total?: number };
};

const TRACE_JOB = "prms-reporting-tool-dev";

export type ListEnrichedDeploymentsOptions = {
  /** When true, logs stages A/B for this HTTP response (one page). The UI merges many pages client-side. */
  debug?: boolean;
};

export class ListEnrichedDeployments {
  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly metadata: DeploymentMetadataRepository,
  ) {}

  async execute(
    filters: ListDeploymentsFilters,
    page: ListDeploymentsPage,
    options?: ListEnrichedDeploymentsOptions,
  ): Promise<ListEnrichedDeploymentsResponse> {
    const safePage = page.page > 0 ? page.page : 1;
    const safePageSize = page.pageSize > 0 && page.pageSize <= 100 ? page.pageSize : 10;
    const debug = options?.debug === true;

    // Full DynamoDB table scan (no maxScannedItems cap) so decision metrics include all matching rows.
    const result = await this.deployments.list(filters, { page: safePage, pageSize: safePageSize });

    const uniqueJobNames = new Set<string>();
    for (const d of result.items) {
      const job = d.application.trim();
      if (job) uniqueJobNames.add(job);
    }

    const sortedUniqueJobs = [...uniqueJobNames].sort();
    if (debug) {
      const prmsJobs = sortedUniqueJobs.filter((j) => j.toLowerCase().includes("prms"));
      console.debug("[executive_summary:A_raw_deployments]", {
        note: "Single API page only. Executive Summary UI concatenates page=1,2,… until empty.",
        page: safePage,
        pageSize: safePageSize,
        repositoryTotal: result.total,
        rawDeploymentsCount: result.items.length,
        uniqueJobNamesCount: uniqueJobNames.size,
        sampleUniqueJobNames: sortedUniqueJobs.slice(0, 40),
        prmsLikeUniqueJobNames: prmsJobs,
        traceJobPresentInRawPage: sortedUniqueJobs.includes(TRACE_JOB),
      });
    }

    const metaByJobName = new Map<
      string,
      Awaited<ReturnType<DeploymentMetadataRepository["getByJobName"]>>
    >();
    await Promise.all(
      [...uniqueJobNames].map(async (jobName) => {
        const meta = await this.metadata.getByJobName(jobName);
        console.log("meta", meta);
        metaByJobName.set(jobName, meta);
      }),
    );

    const items: EnrichedDeploymentItem[] = result.items.map((d) => {
      console.log("d", d);
      const jobKey = d.application.trim();
      const meta = metaByJobName.get(jobKey) ?? null;
      return enrichDeploymentExecution(d, meta);
    });

    if (debug) {
      const prmsEnriched = items.filter((row) => row.application.toLowerCase().includes("prms"));
      const traceRows = items.filter((row) => row.application === TRACE_JOB);
      console.debug("[executive_summary:B_after_enrichment]", {
        page: safePage,
        enrichedDeploymentsCount: items.length,
        enrichedSampleFirst5: items.slice(0, 5).map((row) => ({
          job_name: row.application,
          application_name: row.applicationName,
          project_name: row.projectName,
          environment: row.environment,
        })),
        prmsLikeEnrichedRowsCount: prmsEnriched.length,
        prmsLikeEnrichedSample: prmsEnriched.slice(0, 8).map((row) => ({
          job_name: row.application,
          application_name: row.applicationName,
          project_name: row.projectName,
          environment: row.environment,
        })),
        traceJobRowsOnThisPage: traceRows.map((row) => ({
          job_name: row.application,
          application_name: row.applicationName,
          project_name: row.projectName,
          environment: row.environment,
        })),
      });
    }

    return {
      items,
      pageInfo: {
        page: safePage,
        pageSize: safePageSize,
        total: result.total,
      },
    };
  }
}
