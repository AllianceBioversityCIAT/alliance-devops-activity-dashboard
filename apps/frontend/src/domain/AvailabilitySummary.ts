export type AvailabilityKpis = {
  totalIncidents: number;
  totalDowntimeMinutes: number;
  totalDowntimeHours: number;
  totalPeriodMinutes: number;
  availabilityPercentage: number;
  affectedApplicationsCount: number;
  fullOutageCount: number;
  availabilityImpactIncidentCount: number;
};

export type AvailabilityTrendPoint = { date: string; downtimeMinutes: number };

export type AvailabilityByApplication = {
  applicationName: string;
  projectName: string;
  environment: string;
  totalDowntimeMinutes: number;
  incidentCount: number;
};

export type AvailabilityBreakdownItem = { key: string; count: number };

export type AvailabilityInsights = {
  topDowntimeApplication?: { applicationName: string; totalDowntimeMinutes: number; sharePercent: number };
  fullOutageSharePercent: number;
  downtimeDirectionVsPreviousPeriod: "increase" | "decrease" | "no_change" | "n/a";
  mostFrequentSeverity?: { severity: string; count: number };
};

export type EnrichedIncident = {
  id: string;
  jobName: string;
  incidentDate: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  severity: string;
  incidentType?: string;
  status: string;
  rootCause?: string;
  correctiveAction?: string;
  responsibleTeam?: string;
  userImpact?: string;
  quarter?: string;
  availabilityImpact?: boolean;
  fullOutage?: boolean;
  applicationName: string;
  projectName: string;
  environment: string;
};

export type AvailabilitySummary = {
  kpis: AvailabilityKpis;
  byApplicationDowntime: AvailabilityByApplication[];
  trendByDate: AvailabilityTrendPoint[];
  breakdown: {
    bySeverity: AvailabilityBreakdownItem[];
    byIncidentType: AvailabilityBreakdownItem[];
    fullVsPartial: { key: "full" | "partial"; count: number }[];
  };
  insights: AvailabilityInsights;
  items: EnrichedIncident[];
};

