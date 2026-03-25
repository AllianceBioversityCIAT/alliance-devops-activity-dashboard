import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DeploymentMetadata } from "../../domain/DeploymentMetadata.js";
import type { DeploymentMetadataRepository } from "../../domain/ports/DeploymentMetadataRepository.js";
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
    console.log("j", j);
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
