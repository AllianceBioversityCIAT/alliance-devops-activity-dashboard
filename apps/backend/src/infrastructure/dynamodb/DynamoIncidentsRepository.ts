import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { IncidentsRepository, IncidentFilters } from "../../domain/ports/IncidentsRepository.js";
import type { ApplicationIncident } from "../../domain/Incident.js";
import { getConfig } from "../config/env.js";

/**
 * application_incidents table:
 *  - PK: job_name (String)
 *  - SK: incident_date_incident_id (String, format YYYY-MM-DD#INC-XXX)
 *
 * MVP strategy:
 *  - Query each job_name partition with SK BETWEEN bounds derived from date range.
 *  - Avoid Scan. If metadata filters yield many jobs, performance depends on job count.
 *  - No interval overlap deduplication; duration_minutes are summed as provided.
 */
export class DynamoIncidentsRepository implements IncidentsRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const { awsRegion, awsAccessKeyId, awsSecretAccessKey } = getConfig();
    const client = new DynamoDBClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });
    this.doc = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.DDB_INCIDENTS_TABLE_NAME || "application_incidents";
  }

  async listIncidents(filters: IncidentFilters): Promise<ApplicationIncident[]> {
    const jobs = [...new Set(filters.jobNames)].filter((j) => j && j.trim().length > 0);
    if (jobs.length === 0) return [];

    const fromKey = `${filters.from.slice(0, 10)}#`;
    const toKey = `${filters.to.slice(0, 10)}#\uFFFF`;

    const out: ApplicationIncident[] = [];
    const concurrency = 5;
    for (let i = 0; i < jobs.length; i += concurrency) {
      const chunk = jobs.slice(i, i + concurrency);
      const chunkRes = await Promise.all(
        chunk.map((job) => this.queryOneJob(job, fromKey, toKey, filters))
      );
      for (const rows of chunkRes) out.push(...rows);
    }
    return out;
  }

  private async queryOneJob(jobName: string, fromKey: string, toKey: string, f: IncidentFilters): Promise<ApplicationIncident[]> {
    const names: Record<string, string> = {
      "#pk": "job_name",
      "#sk": "incident_date_incident_id"
    };
    const values: Record<string, unknown> = {
      ":j": jobName,
      ":from": fromKey,
      ":to": toKey
    };

    const filters: string[] = [];
    if (f.severity) {
      names["#severity"] = "severity";
      values[":severity"] = f.severity;
      filters.push("#severity = :severity");
    }
    if (f.incidentType) {
      names["#itype"] = "incident_type";
      values[":itype"] = f.incidentType;
      filters.push("#itype = :itype");
    }
    if (f.status) {
      names["#status"] = "status";
      values[":status"] = f.status;
      filters.push("#status = :status");
    }
    const filterExpr = filters.length > 0 ? filters.join(" AND ") : undefined;

    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const input: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: "#pk = :j AND #sk BETWEEN :from AND :to",
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

    return items.map(mapItem);
  }
}

function toNum(n: unknown): number {
  if (typeof n === "number") return n;
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}
function toBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return undefined;
}

function mapItem(item: Record<string, unknown>): ApplicationIncident {
  const sk = String(item.incident_date_incident_id ?? "");
  const [incidentDate, incidentId] = sk.includes("#") ? sk.split("#", 2) : ["", ""];
  return {
    id: String(item.incident_id ?? incidentId ?? ""),
    jobName: String(item.job_name ?? ""),
    incidentDate,
    startTime: String(item.start_time ?? ""),
    endTime: item.end_time ? String(item.end_time) : undefined,
    durationMinutes: toNum(item.duration_minutes),
    severity: (String(item.severity ?? "unknown").toLowerCase() as any) || "unknown",
    incidentType: item.incident_type ? String(item.incident_type) : undefined,
    status: (String(item.status ?? "unknown").toLowerCase() as any) || "unknown",
    rootCause: item.root_cause ? String(item.root_cause) : undefined,
    correctiveAction: item.corrective_action ? String(item.corrective_action) : undefined,
    responsibleTeam: item.responsible_team ? String(item.responsible_team) : undefined,
    userImpact: item.user_impact ? String(item.user_impact) : undefined,
    quarter: item.quarter ? String(item.quarter) : undefined,
    availabilityImpact: toBool(item.availability_impact),
    fullOutage: toBool(item.full_outage)
  };
}

