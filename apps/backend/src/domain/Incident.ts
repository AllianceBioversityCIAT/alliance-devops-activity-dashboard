export type IncidentSeverity = "critical" | "high" | "medium" | "low" | "unknown";
export type IncidentStatus = "open" | "resolved" | "mitigated" | "unknown";

export interface ApplicationIncident {
  id: string;
  jobName: string;
  incidentDate: string; // YYYY-MM-DD
  startTime: string; // ISO8601
  endTime?: string; // ISO8601
  durationMinutes: number;
  severity: IncidentSeverity;
  incidentType?: string;
  status: IncidentStatus;
  rootCause?: string;
  correctiveAction?: string;
  responsibleTeam?: string;
  userImpact?: string;
  quarter?: string;
  availabilityImpact?: boolean;
  fullOutage?: boolean;
}

export interface EnrichedIncident extends ApplicationIncident {
  applicationName: string;
  projectName: string;
  environment: string;
}

