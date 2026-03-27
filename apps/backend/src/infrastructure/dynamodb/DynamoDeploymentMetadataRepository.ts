import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import type { DeploymentMetadata } from "../../domain/DeploymentMetadata.js";
import type {
  DeploymentMetadataRepository,
  MetadataJobNameFilters
} from "../../domain/ports/DeploymentMetadataRepository.js";
import { getConfig } from "../config/env.js";
import { readNonEmptyString } from "./metadataAttributes.js";

/**
 * Expects table `deployment_metadata` (or configured name) with:
 * - PK: job_name (string)
 * - Attributes may include: application_name, project_name, environment (optional on item)
 * Lookup uses partition key only; first returned item is used.
 */
export class DynamoDeploymentMetadataRepository implements DeploymentMetadataRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string | undefined;

  constructor() {
    const { awsRegion, awsAccessKeyId, awsSecretAccessKey, deploymentMetadataTableName } =
      getConfig();
    this.tableName = deploymentMetadataTableName?.trim() || undefined;
    const client = new DynamoDBClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async getByJobName(jobName: string): Promise<DeploymentMetadata | null> {
    if (!this.tableName) {
      return null;
    }

    const j = jobName.trim();
    if (!j) {
      return null;
    }

    const config = getConfig();

    const resp = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "job_name = :j",
        ExpressionAttributeValues: {
          ":j": j,
        },
        Limit: 1,
      }),
    );

    const raw = resp.Items?.[0];
    const mapped = raw ? mapItemToMetadata(raw as Record<string, unknown>, j) : null;

    if (config.logLevel === "debug") {
      console.debug("[deployment_metadata:lookup]", {
        job_name: j,
        metadata_found: Boolean(raw),
        dynamo_item_keys: raw ? Object.keys(raw) : [],
        application_name: mapped?.applicationName,
        project_name: mapped?.projectName,
      });
    }

    return mapped;
  }

  async listJobNamesForFilters(filters: MetadataJobNameFilters): Promise<string[]> {
    if (!this.tableName) {
      return [];
    }

    const exprs: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    if (filters.projectName?.trim()) {
      exprs.push("#pn = :pn");
      names["#pn"] = "project_name";
      values[":pn"] = filters.projectName.trim();
    }
    if (filters.environment?.trim()) {
      exprs.push("#env = :env");
      names["#env"] = "environment";
      values[":env"] = filters.environment.trim();
    }
    if (filters.applicationName?.trim()) {
      exprs.push("#an = :an");
      names["#an"] = "application_name";
      values[":an"] = filters.applicationName.trim();
    }

    const out = new Set<string>();
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const input: ScanCommandInput = {
        TableName: this.tableName,
        ...(exprs.length > 0
          ? {
              FilterExpression: exprs.join(" AND "),
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values
            }
          : {})
      };
      if (exclusiveStartKey) {
        input.ExclusiveStartKey = exclusiveStartKey;
      }
      const resp = await this.doc.send(new ScanCommand(input));
      for (const item of resp.Items ?? []) {
        const jn = readNonEmptyString(item as Record<string, unknown>, ["job_name", "jobName", "JobName"]);
        if (jn) out.add(jn.trim());
      }
      exclusiveStartKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return [...out].sort((a, b) => a.localeCompare(b));
  }
}

const APPLICATION_KEYS = [
  "application_name",
  "applicationName",
  "ApplicationName",
  "app_name",
  "appName",
];
const PROJECT_KEYS = ["project_name", "projectName", "ProjectName"];
const ENV_KEYS = ["environment", "Environment", "env"];

function mapItemToMetadata(
  item: Record<string, unknown>,
  fallbackJob: string,
): DeploymentMetadata | null {
  const jobName = readNonEmptyString(item, ["job_name", "jobName", "JobName"]) ?? fallbackJob;

  const applicationName = readNonEmptyString(item, APPLICATION_KEYS) ?? jobName;

  // Row exists in metadata table: do not default to OTHERS here (that is only for jobs with no metadata row).
  const projectName = readNonEmptyString(item, PROJECT_KEYS) ?? "UNKNOWN";

  const envStr = readNonEmptyString(item, ENV_KEYS);
  const environment = envStr !== undefined ? envStr : undefined;

  return {
    jobName,
    applicationName,
    projectName,
    ...(environment !== undefined ? { environment } : {}),
  };
}
