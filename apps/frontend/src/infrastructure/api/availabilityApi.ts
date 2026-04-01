import type { AvailabilitySummary } from "@domain/AvailabilitySummary";
import { getEnv } from "../config/env";
import { ApiClient } from "./ApiClient";
import { getIdToken } from "../auth/CognitoClient";

export type AvailabilityFilters = {
  from: string; // ISO
  to: string; // ISO
  application?: string;
  severity?: string;
  incident_type?: string;
  status?: string;
  quarter?: string;
};

export async function fetchAvailabilitySummary(filters: AvailabilityFilters): Promise<AvailabilitySummary> {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");

  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.application) params.set("application", filters.application);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.incident_type) params.set("incident_type", filters.incident_type);
  if (filters.status) params.set("status", filters.status);
  if (filters.quarter) params.set("quarter", filters.quarter);

  const client = new ApiClient(getEnv().apiBaseUrl);
  return client.get<AvailabilitySummary>(`/api/executive-availability/incidents?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

