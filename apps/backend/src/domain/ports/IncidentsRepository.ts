import type { ApplicationIncident } from "../Incident.js";

export type IncidentFilters = {
  from: string; // ISO
  to: string; // ISO
  jobNames: readonly string[]; // exact job_name list to query by partition
  severity?: string;
  incidentType?: string;
  status?: string;
};

export interface IncidentsRepository {
  /** Query by job partitions and SK range; no table scans for MVP. */
  listIncidents(filters: IncidentFilters): Promise<ApplicationIncident[]>;
}

