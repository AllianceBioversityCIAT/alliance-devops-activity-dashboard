import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Deployment } from "@domain/Deployment";
import { fetchDeployments } from "@infrastructure/api/deploymentsApi";
import { isAuthenticated, signOut } from "../src/infrastructure/auth/CognitoClient";
import {
  computeSummaryKpis,
  failureTrend,
  groupByApplication,
  mostActiveApplication,
  repeatedFailures,
  topFailingApplications
} from "@application/executiveSummary";

type StatusFilter = "" | "success" | "failure";

export default function SummaryPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Deployment[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [application, setApplication] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

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

  useEffect(() => {
    if (!checked) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pageSize = 100;
        let page = 1;
        let all: Deployment[] = [];
        // Reuse existing endpoint; aggregate pages client-side for summary calculations.
        while (true) {
          const result = await fetchDeployments(
            {
              from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
              to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
              application: application || undefined,
              status: status || undefined
            },
            page,
            pageSize
          );
          all = all.concat(result.items);

          const total = result.pageInfo.total;
          const hasMoreByTotal = typeof total === "number" ? page * pageSize < total : false;
          const hasMoreBySlice = result.items.length === pageSize;
          if (!(hasMoreByTotal || hasMoreBySlice)) break;
          page += 1;
          if (page > 25) break; // MVP safety cap
        }
        if (cancelled) return;
        setItems(all);
      } catch {
        if (!cancelled) {
          setError("Unable to load executive summary data. Please try again.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checked, fromDate, toDate, application, status]);

  const kpis = useMemo(() => computeSummaryKpis(items), [items]);
  const byApp = useMemo(() => groupByApplication(items), [items]);
  const topFailing = useMemo(() => topFailingApplications(items), [items]);
  const repeated = useMemo(() => repeatedFailures(items), [items]);
  const mostActive = useMemo(() => mostActiveApplication(items), [items]);
  const trend = useMemo(() => failureTrend(items), [items]);

  if (!checked) return null;

  return (
    <>
      <Head>
        <title>Executive Summary - DevOps Activity Dashboard</title>
      </Head>
      <main className="page">
        <div className="header">
          <div>
            <h1 className="title">Executive Summary</h1>
            <p className="subtitle">High-level deployment insights for leadership and operations.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void router.push("/dashboard")}>
              Dashboard
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
              <span>Application / Job</span>
              <input className="input" value={application} onChange={(e) => setApplication(e.target.value)} placeholder="e.g. payments-service" />
            </label>
            <label className="field">
              <span>Status</span>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? <p className="state state-loading">Loading summary…</p> : null}
        {error ? <p className="state state-error">{error}</p> : null}
        {!loading && !error && items.length === 0 ? <p className="state state-empty">No deployment data available for the selected filters.</p> : null}

        <section className="metrics">
          <div className="panel metric"><div className="metric-label">Total deployments</div><div className="metric-value">{kpis.totalDeployments}</div></div>
          <div className="panel metric"><div className="metric-label">Success count</div><div className="metric-value success">{kpis.successCount}</div></div>
          <div className="panel metric"><div className="metric-label">Failure count</div><div className="metric-value failure">{kpis.failureCount}</div></div>
          <div className="panel metric"><div className="metric-label">Success rate</div><div className="metric-value">{kpis.successRate}%</div></div>
        </section>

        <section className="panel block">
          <h2 className="block-title">Attention Required</h2>
          <div className="rows">
            <div className="row-title">Top failing applications (Top 3)</div>
            {topFailing.length === 0 ? <div className="row muted">No failing applications in current filter scope.</div> : topFailing.map((x) => (
              <div key={x.application} className="row"><span>{x.application}</span><strong>{x.failures} failures</strong></div>
            ))}
            <div className="row-title">Repeated failures</div>
            {repeated.length === 0 ? <div className="row muted">No repeated failures detected.</div> : repeated.map((x) => (
              <div key={`rep-${x.application}`} className="row"><span>{x.application}</span><strong>{x.failures} failures</strong></div>
            ))}
          </div>
        </section>

        <section className="panel block">
          <h2 className="block-title">Breakdown by Application</h2>
          <div className="rows">
            {byApp.map((x) => (
              <div key={x.application} className="row"><span>{x.application}</span><span>Total: {x.total} | Failures: {x.failures}</span></div>
            ))}
          </div>
        </section>

        <section className="panel block">
          <h2 className="block-title">Insights</h2>
          <ul className="insights">
            <li>Most active application: <strong>{mostActive ? `${mostActive.application} (${mostActive.count})` : "N/A"}</strong></li>
            <li>Top failing application: <strong>{topFailing[0] ? `${topFailing[0].application} (${topFailing[0].failures} failures)` : "N/A"}</strong></li>
            <li>Failure trend vs previous period: <strong>{trend}</strong></li>
          </ul>
        </section>
      </main>

      <style jsx>{`
        .page { width: min(1160px, 100%); margin: 32px auto; padding: 0 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; }
        .header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          margin-left: auto;
        }
        .title { margin: 0 0 4px; font-size: 28px; line-height: 1.2; color: #101828; }
        .subtitle { margin: 0; color: #667085; font-size: 14px; }
        .panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; }
        .block { padding: 16px; margin-bottom: 24px; }
        .block-title { margin: 0 0 14px; font-size: 16px; color: #101828; }
        .filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; width: 100%; }
        .field { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #475467; min-width: 0; }
        .input, .select { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid #d0d5dd; border-radius: 10px; padding: 9px 10px; font-size: 14px; background: #fff; }
        .btn {
          border: 0;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.2;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .btn-secondary {
          background: #fff;
          color: #101828;
          border: 1px solid #d0d5dd;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #98a2b3;
        }
        .btn-secondary:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .state { border-radius: 10px; padding: 12px 14px; font-size: 14px; margin-bottom: 16px; }
        .state-loading { background: #eef4ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .state-empty { background: #f8fafc; color: #475467; border: 1px solid #e4e7ec; }
        .state-error { background: #fef3f2; color: #b42318; border: 1px solid #fecdca; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric { padding: 14px; }
        .metric-label { color: #475467; font-size: 13px; margin-bottom: 8px; }
        .metric-value { font-size: 28px; font-weight: 700; line-height: 1.1; color: #101828; }
        .metric-value.success { color: #166534; }
        .metric-value.failure { color: #b42318; }
        .rows { display: grid; gap: 8px; }
        .row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f2f4f7; font-size: 14px; }
        .row-title { font-weight: 600; color: #344054; margin-top: 4px; }
        .muted { color: #667085; }
        .insights { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
        @media (max-width: 1100px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .header { flex-direction: column; align-items: flex-start; } }
        @media (max-width: 640px) { .filters { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
