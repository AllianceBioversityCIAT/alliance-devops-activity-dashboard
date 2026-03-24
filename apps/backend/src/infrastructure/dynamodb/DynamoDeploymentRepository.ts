import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../config/env.js";
import { DeploymentRepository, ListDeploymentsFilters, ListDeploymentsPage, ListDeploymentsResult } from "../../domain/ports/DeploymentRepository.js";
import { DeploymentExecution } from "../../domain/DeploymentExecution.js";

// MVP note:
// We use a scan-based approach with optional FilterExpression due to unknown key design.
// To keep costs safe locally, we cap the scan to a reasonable upper bound per request.
const MAX_SCAN_LIMIT = 1000;

export class DynamoDeploymentRepository implements DeploymentRepository {
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

  async list(filters: ListDeploymentsFilters, page: ListDeploymentsPage): Promise<ListDeploymentsResult> {
    // Build FilterExpression over attributes: buildDate, job, result
    const exprs: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    if (filters.from) {
      exprs.push("#buildDate >= :from");
      names["#buildDate"] = "buildDate";
      values[":from"] = filters.from;
    }
    if (filters.to) {
      exprs.push("#buildDate <= :to");
      names["#buildDate"] = "buildDate";
      values[":to"] = filters.to;
    }
    if (filters.application) {
      exprs.push("#job = :job");
      names["#job"] = "job";
      values[":job"] = filters.application;
    }
    if (filters.status) {
      // Dynamo raw 'result' likely 'SUCCESS'/'FAILURE' etc.
      // We'll match case-insensitively by normalizing known values; for filter we assume upper-case in table.
      const wanted = filters.status.toUpperCase();
      exprs.push("#result = :result");
      names["#result"] = "result";
      values[":result"] = wanted;
    }

    const input: ScanCommandInput = {
      TableName: this.tableName,
      Limit: MAX_SCAN_LIMIT
    };
    if (exprs.length > 0) {
      input.FilterExpression = exprs.join(" AND ");
      input.ExpressionAttributeNames = names;
      input.ExpressionAttributeValues = values;
    }

    const scanResp = await this.doc.send(new ScanCommand(input));
    const items = (scanResp.Items ?? []).map(mapRecordToDomain);

    // Simple page/pageSize over the scanned subset
    const start = (page.page - 1) * page.pageSize;
    const paged = items.slice(start, start + page.pageSize);

    return {
      items: paged,
      total: items.length // best-effort total across scanned subset
    };
  }
}

function normalizeStatus(raw?: string | null): "success" | "failure" | "unknown" {
  const val = (raw ?? "").toString().toLowerCase();
  if (val === "success") return "success";
  if (val === "failure") return "failure";
  return "unknown";
}

function mapRecordToDomain(item: Record<string, any>): DeploymentExecution {
  // Raw spec fields:
  // id, buildDate, buildNumber, commitHash?, commitMessage?, commitUser?, exception?, job, result, stage?, url?
  return {
    id: String(item.id ?? ""),
    application: String(item.job ?? ""),
    executedAt: String(item.buildDate ?? ""),
    buildNumber: typeof item.buildNumber === "number" ? item.buildNumber : Number(item.buildNumber) || undefined,
    status: normalizeStatus(item.result),
    executedBy: item.commitUser ? String(item.commitUser) : undefined,
    stage: item.stage ? String(item.stage) : undefined,
    pipelineUrl: item.url ? String(item.url) : undefined,
    errorMessage: item.exception ? String(item.exception) : undefined
  };
}
