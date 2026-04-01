import type { DeploymentMetadataRepository } from "../../domain/ports/DeploymentMetadataRepository.js";
import type { IncidentsRepository } from "../../domain/ports/IncidentsRepository.js";
import type { ApplicationIncident, EnrichedIncident } from "../../domain/Incident.js";
import { deploymentEnvironmentOrUnknown } from "../enrichment/enrichDeployment.js";

export type AvailabilityFilters = {
  from: string; // ISO
  to: string; // ISO
  applicationName?: string;
  severity?: string;
  incidentType?: string;
  status?: string;
  quarter?: string;
};

export type AvailabilitySummary = {
  kpis: {
    totalIncidents: number;
    totalDowntimeMinutes: number;
    totalDowntimeHours: number;
    /** Total minutes in selected period (from..to) */
    totalPeriodMinutes: number;
    availabilityPercentage: number;
    affectedApplicationsCount: number;
    fullOutageCount: number;
    availabilityImpactIncidentCount: number;
  };
  byApplicationDowntime: { applicationName: string; projectName: string; environment: string; totalDowntimeMinutes: number; incidentCount: number }[];
  trendByDate: { date: string; downtimeMinutes: number }[];
  breakdown: {
    bySeverity: { key: string; count: number }[];
    byIncidentType: { key: string; count: number }[];
    fullVsPartial: { key: "full" | "partial"; count: number }[];
  };
  insights: {
    topDowntimeApplication?: { applicationName: string; totalDowntimeMinutes: number; sharePercent: number };
    fullOutageSharePercent: number;
    downtimeDirectionVsPreviousPeriod: "increase" | "decrease" | "no_change" | "n/a";
    mostFrequentSeverity?: { severity: string; count: number };
  };
  items: EnrichedIncident[];
};

export class ComputeAvailabilitySummary {
  constructor(
    private readonly incidentsRepo: IncidentsRepository,
    private readonly metadataRepo: DeploymentMetadataRepository
  ) {}

  async execute(filters: AvailabilityFilters): Promise<AvailabilitySummary> {
    const from = filters.from?.trim();
    const to = filters.to?.trim();
    if (!from || !to) {
      throw new Error("from and to are required");
    }
    if (Date.parse(from) > Date.parse(to)) {
      throw new Error("from must be before or equal to to");
    }

    // Determine job_name partitions via existing metadata filtering patterns
    const jobNames = await this.metadataRepo.listJobNamesForFilters({
      projectName: undefined,
      environment: undefined,
      applicationName: filters.applicationName?.trim() || undefined
    });
    if (jobNames.length === 0) {
      return this.emptySummary(from, to, []);
    }

    const raw = await this.incidentsRepo.listIncidents({
      from,
      to,
      jobNames,
      severity: filters.severity,
      incidentType: filters.incidentType,
      status: filters.status
    });

    // Enrich using job_name -> metadata; follow fallback rules as in Executive Summary
    const uniqueJobs = [...new Set(raw.map((r) => r.jobName).filter(Boolean))];
    const metaByJob = new Map<string, Awaited<ReturnType<DeploymentMetadataRepository["getByJobName"]>>>();
    await Promise.all(
      uniqueJobs.map(async (job) => {
        const m = await this.metadataRepo.getByJobName(job);
        metaByJob.set(job, m);
      })
    );

    const items: EnrichedIncident[] = raw.map((r) => {
      const m = metaByJob.get(r.jobName) ?? null;
      const applicationName = m?.applicationName || r.jobName;
      const projectName = m?.projectName || "OTHERS";
      const env = m?.environment || deploymentEnvironmentOrUnknown({ environment: undefined } as any);
      return {
        ...r,
        applicationName,
        projectName,
        environment: env
      };
    });

    // Apply optional quarter filter purely based on incident.quarter value if provided
    const filteredItems = filters.quarter ? items.filter((x) => (x.quarter || "").toUpperCase() === filters.quarter?.toUpperCase()) : items;

    return this.aggregate(from, to, filteredItems);
  }

  private emptySummary(from: string, to: string, items: EnrichedIncident[]): AvailabilitySummary {
    const totalPeriodMinutes = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
    const kpis = {
      totalIncidents: 0,
      totalDowntimeMinutes: 0,
      totalDowntimeHours: 0,
      totalPeriodMinutes,
      availabilityPercentage: totalPeriodMinutes > 0 ? 100 : 0,
      affectedApplicationsCount: 0,
      fullOutageCount: 0,
      availabilityImpactIncidentCount: 0
    };
    return {
      kpis,
      byApplicationDowntime: [],
      trendByDate: [],
      breakdown: { bySeverity: [], byIncidentType: [], fullVsPartial: [] },
      insights: {
        fullOutageSharePercent: 0,
        downtimeDirectionVsPreviousPeriod: "n/a"
      },
      items
    };
  }

  private aggregate(from: string, to: string, items: EnrichedIncident[]): AvailabilitySummary {
    const totalPeriodMinutes = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
    const totalDowntimeMinutes = items.reduce((acc, it) => acc + (Number.isFinite(it.durationMinutes) ? it.durationMinutes : 0), 0);
    const availabilityPercentage =
      totalPeriodMinutes > 0 ? Math.max(0, Math.min(100, ((totalPeriodMinutes - totalDowntimeMinutes) / totalPeriodMinutes) * 100)) : 0;

    const totalDowntimeHours = Math.round((totalDowntimeMinutes / 60) * 10) / 10;
    const affectedApplicationsCount = new Set(items.map((x) => x.jobName)).size;
    const fullOutageCount = items.filter((x) => x.fullOutage === true).length;
    const availabilityImpactIncidentCount = items.filter((x) => x.availabilityImpact === true).length;

    const byAppMap = new Map<string, { applicationName: string; projectName: string; environment: string; totalDowntimeMinutes: number; incidentCount: number }>();
    for (const it of items) {
      const key = `${it.applicationName}||${it.projectName}||${it.environment}`;
      const cur = byAppMap.get(key) || {
        applicationName: it.applicationName,
        projectName: it.projectName,
        environment: it.environment,
        totalDowntimeMinutes: 0,
        incidentCount: 0
      };
      cur.totalDowntimeMinutes += it.durationMinutes || 0;
      cur.incidentCount += 1;
      byAppMap.set(key, cur);
    }
    const byApplicationDowntime = [...byAppMap.values()].sort((a, b) => b.totalDowntimeMinutes - a.totalDowntimeMinutes);

    const byDateMap = new Map<string, number>();
    for (const it of items) {
      const d = it.incidentDate || (it.startTime ? it.startTime.slice(0, 10) : "");
      if (!d) continue;
      byDateMap.set(d, (byDateMap.get(d) || 0) + (it.durationMinutes || 0));
    }
    const trendByDate = [...byDateMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, downtimeMinutes]) => ({ date, downtimeMinutes }));

    const countBy = (arr: string[]) => {
      const m = new Map<string, number>();
      for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
      return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    };
    const bySeverity = countBy(items.map((x) => (x.severity || "unknown").toString()));
    const byIncidentType = countBy(items.map((x) => (x.incidentType || "unknown").toString()));
    const fullVsPartial = [
      { key: "full" as const, count: fullOutageCount },
      { key: "partial" as const, count: Math.max(0, items.length - fullOutageCount) }
    ];

    const top = byApplicationDowntime[0];
    const topDowntimeApplication = top && totalDowntimeMinutes > 0
      ? {
          applicationName: top.applicationName,
          totalDowntimeMinutes: top.totalDowntimeMinutes,
          sharePercent: Math.round((top.totalDowntimeMinutes / totalDowntimeMinutes) * 1000) / 10
        }
      : undefined;
    const fullOutageSharePercent = items.length > 0 ? Math.round((fullOutageCount / items.length) * 1000) / 10 : 0;
    const mostFrequentSeverity = bySeverity[0] ? { severity: bySeverity[0].key, count: bySeverity[0].count } : undefined;

    // Simple deterministic comparison vs previous equal period by total downtime minutes
    const direction = this.compareWithPreviousPeriod(from, to, trendByDate);

    return {
      kpis: {
        totalIncidents: items.length,
        totalDowntimeMinutes,
        totalDowntimeHours,
        totalPeriodMinutes,
        availabilityPercentage: Math.round(availabilityPercentage * 10) / 10,
        affectedApplicationsCount,
        fullOutageCount,
        availabilityImpactIncidentCount
      },
      byApplicationDowntime,
      trendByDate,
      breakdown: {
        bySeverity,
        byIncidentType,
        fullVsPartial
      },
      insights: {
        topDowntimeApplication,
        fullOutageSharePercent,
        downtimeDirectionVsPreviousPeriod: direction,
        mostFrequentSeverity
      },
      items
    };
  }

  private compareWithPreviousPeriod(from: string, to: string, trendByDate: { date: string; downtimeMinutes: number }[]): "increase" | "decrease" | "no_change" | "n/a" {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return "n/a";
    const durationMs = toMs - fromMs + 1;
    const prevFrom = new Date(fromMs - durationMs);
    const prevTo = new Date(toMs - durationMs);

    const inRange = (dIso: string, a: Date, b: Date) => {
      const t = Date.parse(`${dIso}T00:00:00.000Z`);
      return t >= a.getTime() && t <= b.getTime();
    };
    const curTotal = trendByDate.reduce((acc, r) => acc + (inRange(r.date, new Date(fromMs), new Date(toMs)) ? r.downtimeMinutes : 0), 0);
    const prevTotal = trendByDate.reduce((acc, r) => acc + (inRange(r.date, prevFrom, prevTo) ? r.downtimeMinutes : 0), 0);
    if (prevTotal === curTotal) return "no_change";
    return curTotal > prevTotal ? "increase" : "decrease";
  }
}

