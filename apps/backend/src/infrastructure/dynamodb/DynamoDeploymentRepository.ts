import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../config/env.js";
import {
  DeploymentRepository,
  DeploymentsSortBy,
  ListDeploymentsFilters,
  ListDeploymentsPage,
  ListDeploymentsResult
} from "../../domain/ports/DeploymentRepository.js";
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

    const sortBy = filters.sortBy ?? "executedAt";
    const sortOrder = filters.sortOrder ?? "desc";
    const sorted = sortDeployments(items, sortBy, sortOrder);

    const start = (page.page - 1) * page.pageSize;
    const paged = sorted.slice(start, start + page.pageSize);

    return {
      items: paged,
      total: sorted.length
    };
  }
}

function sortDeployments(items: DeploymentExecution[], sortBy: DeploymentsSortBy, order: "asc" | "desc"): DeploymentExecution[] {
  const dir = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === "buildNumber") {
      return compareBuildNumber(a, b, order);
    }
    let c = 0;
    switch (sortBy) {
      case "executedAt": {
        const va = a.executedAt || "";
        const vb = b.executedAt || "";
        c = va.localeCompare(vb);
        break;
      }
      case "application":
        c = (a.application || "").localeCompare(b.application || "");
        break;
      case "status":
        c = statusSortRank(a.status) - statusSortRank(b.status);
        break;
      case "executedBy":
        c = (a.executedBy || "").localeCompare(b.executedBy || "");
        break;
      case "stage":
        c = (a.stage || "").localeCompare(b.stage || "");
        break;
      default:
        c = 0;
    }
    if (c !== 0) return dir * c;
    return (a.id || "").localeCompare(b.id || "");
  });
}

/** Null / missing build numbers sort last in both directions. */
function compareBuildNumber(a: DeploymentExecution, b: DeploymentExecution, order: "asc" | "desc"): number {
  const na = a.buildNumber;
  const nb = b.buildNumber;
  if (na == null && nb == null) return (a.id || "").localeCompare(b.id || "");
  if (na == null) return 1;
  if (nb == null) return -1;
  const d = na - nb;
  if (d !== 0) return order === "asc" ? d : -d;
  return (a.id || "").localeCompare(b.id || "");
}

/** success > failure > unknown (lower rank first when ascending). */
function statusSortRank(s: DeploymentExecution["status"]): number {
  if (s === "success") return 0;
  if (s === "failure") return 1;
  return 2;
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
    environment: item.environment != null && String(item.environment).trim() !== "" ? String(item.environment).trim() : undefined,
    executedAt: String(item.buildDate ?? ""),
    buildNumber: typeof item.buildNumber === "number" ? item.buildNumber : Number(item.buildNumber) || undefined,
    status: normalizeStatus(item.result),
    executedBy: item.commitUser ? String(item.commitUser) : undefined,
    stage: item.stage ? String(item.stage) : undefined,
    pipelineUrl: item.url ? String(item.url) : undefined,
    errorMessage: item.exception ? String(item.exception) : undefined
  };
}
