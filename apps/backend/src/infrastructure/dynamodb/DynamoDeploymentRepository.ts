import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../config/env.js";
import {
  DeploymentRepository,
  ListDeploymentsFilters,
  ListDeploymentsQueryPage,
  ListDeploymentsQueryResult
} from "../../domain/ports/DeploymentRepository.js";
import { DeploymentExecution } from "../../domain/DeploymentExecution.js";
import type { DeploymentMetadataRepository } from "../../domain/ports/DeploymentMetadataRepository.js";
import {
  dashboardFiltersHash,
  dashboardJobsHash,
  decodeDashboardCursor,
  encodeDashboardCursor,
  type DashboardCursorPayload
} from "./dashboardDeploymentCursor.js";
import { mapDynamoItemToDeploymentExecution } from "./mapDeploymentExecutionItem.js";

/**
 * Dashboard deployments: Query-only on the job+buildDate GSI (EXEC_SUMMARY_JOB_GSI_NAME / PK / SK env).
 *
 * With `application` filter: single-partition Query + DynamoDB LastEvaluatedKey cursor.
 * Without it: job names from deployment_metadata (Scan on small metadata table), then k-way merge by
 * `buildDate` with a cursor that stores per-job ExclusiveStartKey. Executions whose job is not in metadata
 * are not included in the "all jobs" view (aligns with Executive Summary job_gsi).
 *
 * Global ordering for pagination is always buildDate (execution time) per sortOrder; other table columns
 * are not indexed for server-side re-sorts (see `sortWarning` on API responses).
 */
export class DynamoDeploymentRepository implements DeploymentRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly metadata: DeploymentMetadataRepository;

  constructor(metadata: DeploymentMetadataRepository) {
    const { awsRegion, awsAccessKeyId, awsSecretAccessKey, dynamoTableName } = getConfig();
    this.tableName = dynamoTableName;
    this.metadata = metadata;
    const client = new DynamoDBClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async list(filters: ListDeploymentsFilters, page: ListDeploymentsQueryPage): Promise<ListDeploymentsQueryResult> {
    const cfg = getConfig();
    const indexName = cfg.execSummaryJobGsiName?.trim();
    if (!indexName) {
      throw new Error(
        "Dashboard requires EXEC_SUMMARY_JOB_GSI_NAME (job+buildDate GSI) for Query-based pagination."
      );
    }

    const pkAttr = cfg.execSummaryJobGsiPk.trim();
    const skAttr = cfg.execSummaryJobGsiSk.trim();
    const limit = page.limit > 0 && page.limit <= 100 ? page.limit : 10;
    const sortOrder = filters.sortOrder ?? "desc";

    const from = filters.from?.trim();
    const to = filters.to?.trim();
    if (!from || !to) {
      return {
        items: [],
        nextCursor: null,
        hasNextPage: false,
        effectiveSortBy: "executedAt",
        sortWarning: undefined
      };
    }

    const fh = dashboardFiltersHash({
      from,
      to,
      application: filters.application,
      status: filters.status
    });

    const application = filters.application?.trim();
    if (application) {
      return this.listSingleJob({
        indexName,
        pkAttr,
        skAttr,
        job: application,
        from,
        to,
        status: filters.status,
        limit,
        sortOrder,
        cursor: page.cursor,
        fh
      });
    }

    return this.listMergedJobs({
      indexName,
      pkAttr,
      skAttr,
      from,
      to,
      status: filters.status,
      limit,
      sortOrder,
      cursor: page.cursor,
      fh
    });
  }

  private async listSingleJob(params: {
    indexName: string;
    pkAttr: string;
    skAttr: string;
    job: string;
    from: string;
    to: string;
    status?: ListDeploymentsFilters["status"];
    limit: number;
    sortOrder: "asc" | "desc";
    cursor?: string;
    fh: string;
  }): Promise<ListDeploymentsQueryResult> {
    const decoded = params.cursor ? decodeDashboardCursor(params.cursor) : null;
    let lek: Record<string, unknown> | null | undefined;
    if (decoded) {
      if (decoded.mode !== "single" || decoded.job !== params.job || decoded.fh !== params.fh) {
        lek = undefined;
      } else {
        lek = decoded.lek;
      }
    }

    const { items, lastKey } = await this.queryJobPageSequential({
      indexName: params.indexName,
      pkAttr: params.pkAttr,
      skAttr: params.skAttr,
      job: params.job,
      from: params.from,
      to: params.to,
      status: params.status,
      limit: params.limit,
      sortOrder: params.sortOrder,
      exclusiveStartKey: lek ?? undefined
    });

    const payload: DashboardCursorPayload = {
      v: 1,
      mode: "single",
      job: params.job,
      lek: lastKey,
      fh: params.fh
    };

    return {
      items,
      nextCursor: lastKey ? encodeDashboardCursor(payload) : null,
      hasNextPage: lastKey != null,
      effectiveSortBy: "executedAt",
      sortWarning: undefined
    };
  }

  private async listMergedJobs(params: {
    indexName: string;
    pkAttr: string;
    skAttr: string;
    from: string;
    to: string;
    status?: ListDeploymentsFilters["status"];
    limit: number;
    sortOrder: "asc" | "desc";
    cursor?: string;
    fh: string;
  }): Promise<ListDeploymentsQueryResult> {
    const jobs = await this.metadata.listJobNamesForFilters({});
    const jobsSorted = [...jobs].sort((a, b) => a.localeCompare(b));
    const jh = dashboardJobsHash(jobsSorted);

    if (jobsSorted.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasNextPage: false,
        effectiveSortBy: "executedAt",
        sortWarning: undefined
      };
    }

    const decoded = params.cursor ? decodeDashboardCursor(params.cursor) : null;
    const keyState = new Map<string, Record<string, unknown> | null | undefined>();
    for (const j of jobsSorted) {
      if (!decoded || decoded.mode !== "merge" || decoded.fh !== params.fh || decoded.jh !== jh) {
        keyState.set(j, undefined);
      } else {
        const v = decoded.lekByJob[j];
        if (v === undefined || !(j in decoded.lekByJob)) {
          keyState.set(j, undefined);
        } else {
          keyState.set(j, v);
        }
      }
    }

    type HeapEntry = { job: string; item: DeploymentExecution };
    const heap: HeapEntry[] = [];
    const concurrency = getConfig().execSummaryJobQueryConcurrency;

    for (let i = 0; i < jobsSorted.length; i += concurrency) {
      const chunk = jobsSorted.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (job) => {
          const item = await this.queryOneForMerge({
            indexName: params.indexName,
            pkAttr: params.pkAttr,
            skAttr: params.skAttr,
            job,
            from: params.from,
            to: params.to,
            status: params.status,
            sortOrder: params.sortOrder,
            keyState
          });
          if (item) heap.push({ job, item });
        })
      );
    }

    const result: DeploymentExecution[] = [];
    while (result.length < params.limit && heap.length > 0) {
      const idx = pickHeapIndex(heap, params.sortOrder);
      const chosen = heap[idx];
      heap.splice(idx, 1);
      result.push(chosen.item);

      const item = await this.queryOneForMerge({
        indexName: params.indexName,
        pkAttr: params.pkAttr,
        skAttr: params.skAttr,
        job: chosen.job,
        from: params.from,
        to: params.to,
        status: params.status,
        sortOrder: params.sortOrder,
        keyState
      });
      if (item) heap.push({ job: chosen.job, item });
    }

    const hasNextPage = heap.length > 0;
    /** Every job key avoids decode treating missing partitions as “from start” (would duplicate rows). */
    const lekByJob: Record<string, Record<string, unknown> | null> = {};
    for (const j of jobsSorted) {
      const s = keyState.get(j);
      if (s === undefined || s === null) lekByJob[j] = null;
      else lekByJob[j] = s;
    }

    const nextPayload: DashboardCursorPayload = {
      v: 1,
      mode: "merge",
      lekByJob,
      fh: params.fh,
      jh
    };

    return {
      items: result,
      nextCursor: hasNextPage ? encodeDashboardCursor(nextPayload) : null,
      hasNextPage,
      effectiveSortBy: "executedAt",
      sortWarning: undefined
    };
  }

  /**
   * Sequential 1-item reads per Query when status filter is used (FilterExpression can skip index entries).
   * Without status, uses larger Limits to reduce round-trips.
   */
  private async queryJobPageSequential(opts: {
    indexName: string;
    pkAttr: string;
    skAttr: string;
    job: string;
    from: string;
    to: string;
    status?: ListDeploymentsFilters["status"];
    limit: number;
    sortOrder: "asc" | "desc";
    exclusiveStartKey?: Record<string, unknown>;
  }): Promise<{ items: DeploymentExecution[]; lastKey: Record<string, unknown> | null }> {
    const names: Record<string, string> = {
      "#pk": opts.pkAttr,
      "#sk": opts.skAttr
    };
    const values: Record<string, unknown> = {
      ":j": opts.job,
      ":from": opts.from,
      ":to": opts.to
    };
    let filterExpr: string | undefined;
    if (opts.status) {
      names["#result"] = "result";
      values[":result"] = opts.status.toUpperCase();
      filterExpr = "#result = :result";
    }

    const items: DeploymentExecution[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined = opts.exclusiveStartKey;
    let nextPageKey: Record<string, unknown> | null = null;
    const useSmallChunks = Boolean(opts.status);

    while (items.length < opts.limit) {
      const chunk = useSmallChunks ? 1 : opts.limit - items.length;
      const input: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: opts.indexName,
        KeyConditionExpression: "#pk = :j AND #sk BETWEEN :from AND :to",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ScanIndexForward: opts.sortOrder === "asc",
        Limit: chunk,
        ...(filterExpr ? { FilterExpression: filterExpr } : {}),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
      };
      const resp = await this.doc.send(new QueryCommand(input));
      const lek = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
      for (const it of resp.Items ?? []) {
        items.push(mapDynamoItemToDeploymentExecution(it as Record<string, unknown>));
        if (items.length >= opts.limit) {
          nextPageKey = lek ?? null;
          break;
        }
      }
      if (items.length >= opts.limit) break;
      if (!lek) {
        nextPageKey = null;
        break;
      }
      exclusiveStartKey = lek;
      if ((resp.Items ?? []).length === 0) continue;
    }

    if (items.length < opts.limit) nextPageKey = null;
    return { items, lastKey: nextPageKey };
  }

  /** One item for merge path; updates `keyState` for `job`. */
  private async queryOneForMerge(opts: {
    indexName: string;
    pkAttr: string;
    skAttr: string;
    job: string;
    from: string;
    to: string;
    status?: ListDeploymentsFilters["status"];
    sortOrder: "asc" | "desc";
    keyState: Map<string, Record<string, unknown> | null | undefined>;
  }): Promise<DeploymentExecution | null> {
    const st = opts.keyState.get(opts.job);
    if (st === null) return null;

    const names: Record<string, string> = {
      "#pk": opts.pkAttr,
      "#sk": opts.skAttr
    };
    const values: Record<string, unknown> = {
      ":j": opts.job,
      ":from": opts.from,
      ":to": opts.to
    };
    let filterExpr: string | undefined;
    if (opts.status) {
      names["#result"] = "result";
      values[":result"] = opts.status.toUpperCase();
      filterExpr = "#result = :result";
    }

    let exclusiveStartKey: Record<string, unknown> | undefined =
      st === undefined ? undefined : (st as Record<string, unknown>);

    while (true) {
      const input: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: opts.indexName,
        KeyConditionExpression: "#pk = :j AND #sk BETWEEN :from AND :to",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ScanIndexForward: opts.sortOrder === "asc",
        Limit: 1,
        ...(filterExpr ? { FilterExpression: filterExpr } : {}),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
      };
      const resp = await this.doc.send(new QueryCommand(input));
      const lekNext = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
      const raw = resp.Items?.[0];
      if (!raw) {
        opts.keyState.set(opts.job, null);
        return null;
      }
      opts.keyState.set(opts.job, lekNext ?? null);
      return mapDynamoItemToDeploymentExecution(raw as Record<string, unknown>);
    }
  }
}

function pickHeapIndex(heap: Array<{ item: DeploymentExecution }>, sortOrder: "asc" | "desc"): number {
  let best = 0;
  for (let i = 1; i < heap.length; i++) {
    const a = heap[best].item;
    const b = heap[i].item;
    const cd = (a.executedAt || "").localeCompare(b.executedAt || "");
    if (sortOrder === "desc") {
      if (cd < 0 || (cd === 0 && (a.id || "").localeCompare(b.id || "") < 0)) best = i;
    } else {
      if (cd > 0 || (cd === 0 && (a.id || "").localeCompare(b.id || "") > 0)) best = i;
    }
  }
  return best;
}
