import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated, signOut } from "../src/infrastructure/auth/CognitoClient";
import type { AvailabilitySummary } from "@domain/AvailabilitySummary";
import { fetchAvailabilitySummary } from "@infrastructure/api/availabilityApi";

function firstDayPrevQuarter(): string {
  const now = new Date();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);
  const startQuarterMonth = (currentQuarter - 1 + 4) % 4 * 3;
  const year = currentQuarter === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = currentQuarter === 0 ? 9 : startQuarterMonth;
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function lastDayPrevQuarter(): string {
  const start = new Date(`${firstDayPrevQuarter()}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59, 999));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
}

export default function AvailabilitySummaryPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilitySummary | null>(null);

  const [fromDate, setFromDate] = useState(firstDayPrevQuarter());
  const [toDate, setToDate] = useState(lastDayPrevQuarter());
  const [application, setApplication] = useState("");

  useEffect(() => {
    (async () => {
      const authed = await isAuthenticated();
      if (!authed) {
        router.replace("/login");
        return;
      }
      setChecked(true);
    })();
  }, [router]);

  const handleApply = () => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchAvailabilitySummary({
          from: `${fromDate}T00:00:00.000Z`,
          to: `${toDate}T23:59:59.999Z`,
          application: application || undefined
        });
        setData(resp);
      } catch {
        setError("Unable to load availability summary. Please try again.");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  };

  const k = data?.kpis;
  const byApp = data?.byApplicationDowntime ?? [];
  const breakdown = data?.breakdown;

  const totalPeriodMinutes = k?.totalPeriodMinutes ?? 0;
  const totalDowntimeMinutes = k?.totalDowntimeMinutes ?? 0;
  const totalAvailableMinutes = Math.max(0, totalPeriodMinutes - totalDowntimeMinutes);

  // Build application options from current dataset using enriched names.
  const applicationOptions = useMemo(() => {
    const map = new Map<string, Set<string>>(); // applicationName -> set of envs present
    for (const row of byApp) {
      const name = row.applicationName || "";
      const env = (row.environment || "").toUpperCase();
      if (!name) continue;
      if (!map.has(name)) map.set(name, new Set<string>());
      if (env) map.get(name)!.add(env);
    }
    const options = [...map.entries()].map(([appName, envs]) => {
      const label = envs.size === 1 ? `${appName} [${[...envs][0].toLowerCase()}]` : appName;
      return { value: appName, label };
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "All applications" }, ...options];
  }, [byApp]);

  function Donut({ downtime, available }: { downtime: number; available: number }) {
    const total = Math.max(available + downtime, 0.0001);
    const radius = 70;
    const stroke = 18;
    const circumference = 2 * Math.PI * radius;
    const downtimeRatio = downtime / total;
    const downtimeLength = circumference * downtimeRatio;
    const availableLength = circumference - downtimeLength;
    // Start at top (-90deg)
    const rotation = -90;
    return (
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Availability vs Downtime">
        <g transform={`translate(90,90) rotate(${rotation})`}>
          <circle r={radius} cx="0" cy="0" fill="transparent" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle
            r={radius}
            cx="0"
            cy="0"
            fill="transparent"
            stroke="#16a34a"
            strokeWidth={stroke}
            strokeDasharray={`${availableLength} ${circumference}`}
            strokeDashoffset={0}
          />
          <circle
            r={radius}
            cx="0"
            cy="0"
            fill="transparent"
            stroke="#b91c1c"
            strokeWidth={stroke}
            strokeDasharray={`${downtimeLength} ${circumference}`}
            strokeDashoffset={-availableLength}
          />
        </g>
        <text x="90" y="90" textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight={700} fill="#111827">
          {(k?.availabilityPercentage ?? 0).toFixed(1)}%
        </text>
      </svg>
    );
  }

  if (!checked) return null;
  return (
    <>
      <Head>
        <title>Executive Availability - DevOps Activity Dashboard</title>
      </Head>
      <main className="page">
        <div className="header">
          <div>
            <h1 className="title">Executive Availability</h1>
            <p className="subtitle">Incidents and service availability for leadership.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void router.push("/dashboard")}>
              Dashboard
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void router.push("/summary")}>
              Executive Summary
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <section className="panel block">
          <h2 className="block-title">Filters</h2>
          <div className="filters">
            <label className="field">
              <span>From date</span>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field">
              <span>To date</span>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Application</span>
              <select
                className="select"
                value={application}
                onChange={(e) => setApplication(e.target.value)}
              >
                {applicationOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field field-apply">
              <span className="apply-label" aria-hidden="true">
                &nbsp;
              </span>
              <button type="button" className="btn btn-primary" onClick={handleApply} disabled={loading}>
                {loading ? "Loading…" : "Apply filters"}
              </button>
            </div>
          </div>
        </section>

        {loading ? <p className="state state-loading">Loading availability summary…</p> : null}
        {error ? <p className="state state-error">{error}</p> : null}
        {!loading && !error && !data ? (
          <p className="state state-empty">Set filters and click Apply to load availability and incidents.</p>
        ) : null}

        {data ? (
          <>
            <section className="metrics">
              <div className="panel metric">
                <div className="metric-label">Total incidents</div>
                <div className="metric-value">{k?.totalIncidents ?? 0}</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Total downtime</div>
                <div className="metric-value">{(k?.totalDowntimeHours ?? 0).toFixed(1)} h</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Availability</div>
                <div className="metric-value">{(k?.availabilityPercentage ?? 0).toFixed(1)}%</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Affected applications</div>
                <div className="metric-value">{k?.affectedApplicationsCount ?? 0}</div>
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Availability vs Downtime</h2>
              <div className="donut-wrap">
                <Donut downtime={totalDowntimeMinutes} available={totalAvailableMinutes} />
                <div className="legend">
                  <div className="legend-row">
                    <span className="legend-dot legend-dot-available" aria-hidden="true"></span>
                    <span className="legend-label">Available time</span>
                    <strong className="legend-value">
                      {totalAvailableMinutes} min&nbsp;({((k?.availabilityPercentage ?? 0)).toFixed(1)}%)
                    </strong>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot legend-dot-downtime" aria-hidden="true"></span>
                    <span className="legend-label">Downtime</span>
                    <strong className="legend-value">
                      {totalDowntimeMinutes} min&nbsp;({(totalDowntimeMinutes / 60).toFixed(1)} h)
                    </strong>
                  </div>
                  <div className="legend-row muted">
                    <span className="legend-label">Selected period total</span>
                    <strong className="legend-value">{totalPeriodMinutes} min&nbsp;({(totalPeriodMinutes / 60).toFixed(1)} h)</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Downtime by application</h2>
              <div className="rows">
                {byApp.length === 0 ? (
                  <div className="row muted">No affected applications.</div>
                ) : (
                  byApp.map((x) => (
                    <div key={`${x.applicationName}-${x.environment}`} className="row">
                      <span>
                        {x.applicationName} <span style={{ opacity: 0.6 }}>[{x.environment}]</span>
                      </span>
                      <span>
                        <strong>{x.totalDowntimeMinutes} min</strong> &nbsp;|&nbsp; {x.incidentCount} incidents
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Incident impact breakdown</h2>
              <div className="rows">
                <div className="row-title">Full outage vs partial</div>
                {(breakdown?.fullVsPartial ?? []).map((x) => (
                  <div key={x.key} className="row">
                    <span>{x.key === "full" ? "Full outage" : "Partial"}</span>
                    <strong>{x.count}</strong>
                  </div>
                ))}
                <div className="row-title">By severity</div>
                {(breakdown?.bySeverity ?? []).map((x) => (
                  <div key={`sev-${x.key}`} className="row">
                    <span>{x.key}</span>
                    <strong>{x.count}</strong>
                  </div>
                ))}
                <div className="row-title">By incident type</div>
                {(breakdown?.byIncidentType ?? []).map((x) => (
                  <div key={`type-${x.key}`} className="row">
                    <span>{x.key}</span>
                    <strong>{x.count}</strong>
                  </div>
                ))}
              </div>
            </section>

            {/* Executive insights section removed per spec */}
          </>
        ) : null}
      </main>
      <style jsx>{`
        .page { width: min(1160px, 100%); margin: 32px auto; padding: 0 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
        .header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-left: auto; }
        .title { margin: 0 0 4px; font-size: 28px; line-height: 1.2; color: #101828; }
        .subtitle { margin: 0; color: #667085; font-size: 14px; }
        .panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; }
        .block { padding: 16px; margin-bottom: 24px; }
        .block-title { margin: 0 0 14px; font-size: 16px; color: #101828; }
        .filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; width: 100%; align-items: end; }
        .field { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #475467; min-width: 0; }
        .field-apply { justify-content: flex-end; }
        .apply-label { visibility: hidden; min-height: 1em; }
        .input, .select { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 10px; padding: 9px 10px; font-size: 14px; background: #fff; }
        .btn { border: 0; border-radius: 10px; padding: 9px 14px; font-size: 14px; font-weight: 600; line-height: 1.2; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .btn-primary { background: #111827; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #0f172a; }
        .btn-secondary { background: #fff; color: #101828; border: 1px solid #d0d5dd; }
        .btn-secondary:hover:not(:disabled) { background: #f9fafb; border-color: #98a2b3; }
        .state { border-radius: 10px; padding: 12px 14px; font-size: 14px; margin-bottom: 16px; }
        .state-loading { background: #eef4ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .state-empty { background: #f8fafc; color: #475467; border: 1px solid #e4e7ec; }
        .state-error { background: #fef3f2; color: #b42318; border: 1px solid #fecdca; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric { padding: 14px; }
        .metric-label { color: #475467; font-size: 13px; margin-bottom: 8px; }
        .metric-value { font-size: 28px; font-weight: 700; line-height: 1.1; color: #101828; }
        .rows { display: grid; gap: 8px; }
        .row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f2f4f7; font-size: 14px; }
        .row-title { font-weight: 600; color: #344054; margin-top: 4px; }

        .donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .legend { display: grid; gap: 10px; min-width: 260px; }
        .legend-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .legend-row .legend-label { color: #475467; font-size: 13px; }
        .legend-row .legend-value { font-size: 14px; }
        .legend-row.muted .legend-label { color: #667085; }
        .legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 8px; }
        .legend-dot-available { background: #16a34a; }
        .legend-dot-downtime { background: #b91c1c; }
        @media (max-width: 1100px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .header { align-items: flex-start; flex-direction: column; } }
        @media (max-width: 640px) { .filters { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}

