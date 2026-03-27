import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../config/env.js";
import type {
  ExecutiveSummaryExecutionsRepository,
  ExecutiveSummaryExecutionFilters
} from "../../domain/ports/ExecutiveSummaryExecutionsRepository.js";
import { DeploymentExecution } from "../../domain/DeploymentExecution.js";

export class DynamoExecutiveSummaryExecutionsRepository implements ExecutiveSummaryExecutionsRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const { awsRegion, awsAccessKeyId, awsSecretAccessKey, dynamoTableName } = getConfig();
    this.tableName = dynamoTableName;
    const client = new DynamoDBClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async listForExecutiveSummary(filters: ExecutiveSummaryExecutionFilters): Promise<DeploymentExecution[]> {
    const config = getConfig();
    if (config.execSummaryExecutionsStrategy === "month_gsi") {
      return this.queryByMonthGsi(filters);
    }
    return this.queryByJobGsi(filters);
  }

  private async queryByJobGsi(filters: ExecutiveSummaryExecutionFilters): Promise<DeploymentExecution[]> {
    const config = getConfig();
    const indexName = config.execSummaryJobGsiName?.trim();
    if (!indexName) {
      throw new Error(
        "Executive Summary job_gsi strategy requires EXEC_SUMMARY_JOB_GSI_NAME (GSI on executions table with job + buildDate keys)."
      );
    }
    const pkAttr = config.execSummaryJobGsiPk.trim();
    const skAttr = config.execSummaryJobGsiSk.trim();
    const jobs = [...new Set(filters.jobNames.map((j) => j.trim()).filter((j) => j.length > 0))];
    if (jobs.length === 0) {
      return [];
    }

    const concurrency = config.execSummaryJobQueryConcurrency;
    const out: DeploymentExecution[] = [];

    for (let i = 0; i < jobs.length; i += concurrency) {
      const chunk = jobs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((job) => this.queryOneJobGsi(indexName, pkAttr, skAttr, job, filters.from, filters.to, filters.status))
      );
      for (const rows of chunkResults) {
        out.push(...rows);
      }
    }

    return dedupeById(out);
  }

  private async queryOneJobGsi(
    indexName: string,
    pkAttr: string,
    skAttr: string,
    job: string,
    from: string,
    to: string,
    status: ExecutiveSummaryExecutionFilters["status"]
  ): Promise<DeploymentExecution[]> {
    const pkName = `#${pkAttr.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const skName = `#${skAttr.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const names: Record<string, string> = { [pkName]: pkAttr, [skName]: skAttr };
    const values: Record<string, unknown> = {
      ":j": job,
      ":from": from,
      ":to": to
    };

    let filterExpr: string | undefined;
    if (status) {
      names["#result"] = "result";
      values[":result"] = status.toUpperCase();
      filterExpr = "#result = :result";
    }

    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const input: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: `${pkName} = :j AND ${skName} BETWEEN :from AND :to`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ...(filterExpr ? { FilterExpression: filterExpr } : {})
      };
      if (exclusiveStartKey) {
        input.ExclusiveStartKey = exclusiveStartKey;
      }
      const resp = await this.doc.send(new QueryCommand(input));
      items.push(...(resp.Items ?? []));
      exclusiveStartKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return items.map(mapRecordToDomain);
  }

  private async queryByMonthGsi(filters: ExecutiveSummaryExecutionFilters): Promise<DeploymentExecution[]> {
    const config = getConfig();
    const indexName = config.execSummaryMonthGsiName?.trim();
    if (!indexName) {
      throw new Error(
        "Executive Summary month_gsi strategy requires EXEC_SUMMARY_MONTH_GSI_NAME (GSI with buildMonth partition and buildDate sort key)."
      );
    }
    const pkAttr = config.execSummaryMonthGsiPk.trim();
    const skAttr = config.execSummaryMonthGsiSk.trim();

    const fromMs = Date.parse(filters.from);
    const toMs = Date.parse(filters.to);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new Error("Invalid from/to ISO timestamps for Executive Summary query.");
    }

    const monthKeys = listMonthKeysInclusive(new Date(fromMs), new Date(toMs));
    const out: DeploymentExecution[] = [];

    for (const monthKey of monthKeys) {
      const { rangeStart, rangeEnd } = monthBoundsForFilter(monthKey, new Date(fromMs), new Date(toMs));
      const rows = await this.queryOneMonthPartition(
        indexName,
        pkAttr,
        skAttr,
        monthKey,
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
        filters.status
      );
      out.push(...rows);
    }

    return dedupeById(out);
  }

  private async queryOneMonthPartition(
    indexName: string,
    pkAttr: string,
    skAttr: string,
    monthKey: string,
    fromBound: string,
    toBound: string,
    status: ExecutiveSummaryExecutionFilters["status"]
  ): Promise<DeploymentExecution[]> {
    const pkName = `#${pkAttr.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const skName = `#${skAttr.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const names: Record<string, string> = { [pkName]: pkAttr, [skName]: skAttr };
    const values: Record<string, unknown> = {
      ":m": monthKey,
      ":from": fromBound,
      ":to": toBound
    };

    let filterExpr: string | undefined;
    if (status) {
      names["#result"] = "result";
      values[":result"] = status.toUpperCase();
      filterExpr = "#result = :result";
    }

    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const input: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: `${pkName} = :m AND ${skName} BETWEEN :from AND :to`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ...(filterExpr ? { FilterExpression: filterExpr } : {})
      };
      if (exclusiveStartKey) {
        input.ExclusiveStartKey = exclusiveStartKey;
      }
      const resp = await this.doc.send(new QueryCommand(input));
      items.push(...(resp.Items ?? []));
      exclusiveStartKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return items.map(mapRecordToDomain);
  }
}

function listMonthKeysInclusive(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth();

  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return keys;
}

function monthBoundsForFilter(
  monthKey: string,
  filterFrom: Date,
  filterTo: Date
): { rangeStart: Date; rangeEnd: Date } {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const mo = Number(ms) - 1;
  const monthStart = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));
  const rangeStart = filterFrom > monthStart ? filterFrom : monthStart;
  const rangeEnd = filterTo < monthEnd ? filterTo : monthEnd;
  return { rangeStart, rangeEnd };
}

function dedupeById(items: DeploymentExecution[]): DeploymentExecution[] {
  const seen = new Set<string>();
  const out: DeploymentExecution[] = [];
  for (const it of items) {
    const id = it.id || "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function normalizeStatus(raw?: string | null): "success" | "failure" | "unknown" {
  const val = (raw ?? "").toString().toLowerCase();
  if (val === "success") return "success";
  if (val === "failure") return "failure";
  return "unknown";
}

function mapRecordToDomain(item: Record<string, unknown>): DeploymentExecution {
  return {
    id: String(item.id ?? ""),
    application: String(item.job ?? ""),
    environment: item.environment != null && String(item.environment).trim() !== "" ? String(item.environment).trim() : undefined,
    executedAt: String(item.buildDate ?? ""),
    buildNumber: typeof item.buildNumber === "number" ? item.buildNumber : Number(item.buildNumber) || undefined,
    status: normalizeStatus(item.result as string | undefined),
    executedBy: item.commitUser ? String(item.commitUser) : undefined,
    stage: item.stage ? String(item.stage) : undefined,
    pipelineUrl: item.url ? String(item.url) : undefined,
    errorMessage: item.exception ? String(item.exception) : undefined
  };
}
