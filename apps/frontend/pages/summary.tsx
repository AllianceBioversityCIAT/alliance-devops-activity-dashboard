import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import type { ExecutiveSummaryDeployment } from "@domain/ExecutiveSummaryDeployment";
import { fetchExecutiveSummaryDeployments } from "@infrastructure/api/executiveSummaryApi";
import { isAuthenticated, signOut } from "../src/infrastructure/auth/CognitoClient";
import {
  applicationNameOptionsFromDataset,
  computeSummaryKpis,
  environmentOptionsFromDataset,
  failureTrend,
  groupByApplication,
  groupByProject,
  mostActiveApplication,
  mostActiveProject,
  projectOptionsFromDataset,
  repeatedFailures,
  topFailingApplications,
  APPLICATION_ENV_SEPARATOR
} from "@application/executiveSummary";
import { logExecutiveSummaryUiFinalDataset } from "@application/executiveSummaryDatasetDebug";

type StatusFilter = "" | "success" | "failure";

function firstDayOfPreviousMonthYyyyMmDd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const prev = new Date(y, m - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfPreviousMonthYyyyMmDd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth(), 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export default function SummaryPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [datasetItems, setDatasetItems] = useState<ExecutiveSummaryDeployment[]>([]);

  const [draftFromDate, setDraftFromDate] = useState(() => firstDayOfPreviousMonthYyyyMmDd());
  const [draftToDate, setDraftToDate] = useState(() => lastDayOfPreviousMonthYyyyMmDd());
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("");
  const [draftProject, setDraftProject] = useState("");
  const [draftEnvironment, setDraftEnvironment] = useState("");
  const [draftApplicationName, setDraftApplicationName] = useState("");

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
    const projects = projectOptionsFromDataset(datasetItems);
    if (draftProject && !projects.includes(draftProject)) {
      setDraftProject("");
      return;
    }
    const envs = environmentOptionsFromDataset(datasetItems, draftProject);
    if (draftEnvironment && !envs.includes(draftEnvironment)) {
      setDraftEnvironment("");
      return;
    }
    const apps = applicationNameOptionsFromDataset(datasetItems, draftProject, draftEnvironment);
    if (draftApplicationName && !apps.includes(draftApplicationName)) {
      setDraftApplicationName("");
    }
  }, [datasetItems, draftProject, draftEnvironment, draftApplicationName]);

  const projectOptions = useMemo(() => projectOptionsFromDataset(datasetItems), [datasetItems]);
  const environmentOptions = useMemo(
    () => environmentOptionsFromDataset(datasetItems, draftProject),
    [datasetItems, draftProject]
  );
  const applicationNameOptions = useMemo(
    () => applicationNameOptionsFromDataset(datasetItems, draftProject, draftEnvironment),
    [datasetItems, draftProject, draftEnvironment]
  );

  const kpis = useMemo(() => computeSummaryKpis(datasetItems), [datasetItems]);
  const byApp = useMemo(() => groupByApplication(datasetItems), [datasetItems]);
  const byProject = useMemo(() => groupByProject(datasetItems), [datasetItems]);
  const topFailing = useMemo(() => topFailingApplications(datasetItems), [datasetItems]);
  const repeated = useMemo(() => repeatedFailures(datasetItems), [datasetItems]);
  const mostActive = useMemo(() => mostActiveApplication(datasetItems), [datasetItems]);
  const mostActiveProj = useMemo(() => mostActiveProject(datasetItems), [datasetItems]);
  const trend = useMemo(() => failureTrend(datasetItems), [datasetItems]);

  const handleApplyFilters = () => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchExecutiveSummaryDeployments({
          from: `${draftFromDate}T00:00:00.000Z`,
          to: `${draftToDate}T23:59:59.999Z`,
          status: draftStatus || undefined,
          projectName: draftProject || undefined,
          environment: draftEnvironment || undefined,
          applicationName: draftApplicationName || undefined
        });
        setDatasetItems(result.items);
        setHasLoaded(true);
      } catch {
        setError("Unable to load executive summary data. Please try again.");
        setDatasetItems([]);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (loading) return;
    logExecutiveSummaryUiFinalDataset(datasetItems);
  }, [datasetItems, loading]);

  if (!checked) return null;

  function splitApplicationAndEnv(label: string): { app: string; env: string } {
    const idx = label.indexOf(APPLICATION_ENV_SEPARATOR);
    if (idx === -1) return { app: label.trim(), env: "" };
    const app = label.slice(0, idx).trim();
    const env = label.slice(idx + APPLICATION_ENV_SEPARATOR.length).trim();
    return { app, env };
  }

  function AppEnvironmentLabel({ appName, environment }: { appName: string; environment: string }) {
    const ENV_STYLES: Record<string, { backgroundColor: string; border: string; color: string }> = {
      PROD: {
        backgroundColor: "#EFF6FF",
        border: "1px solid #BFDBFE",
        color: "#1D4ED8"
      },
      STAGING: {
        backgroundColor: "#FFFBEB",
        border: "1px solid #FDE68A",
        color: "#B45309"
      },
      DEV: {
        backgroundColor: "#F3F4F6",
        border: "1px solid #D1D5DB",
        color: "#374151"
      }
    };

    const env = (environment || "").toUpperCase();
    const envStyle = ENV_STYLES[env] || ENV_STYLES.DEV;

    const badgeStyle = {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 600,
      lineHeight: 1.2,
      marginLeft: "8px",
      textTransform: "uppercase" as const,
      cursor: "default",
      whiteSpace: "nowrap" as const,
      ...envStyle
    };

    const wrapperStyle = {
      display: "inline-flex",
      alignItems: "center",
      gap: "0px",
      flexWrap: "wrap" as const
    };

    const appNameStyle = {
      fontSize: "14px",
      fontWeight: 400,
      color: "#111827"
    };

    return (
      <span style={wrapperStyle}>
        <span style={appNameStyle}>{appName}</span>
        {env ? <span style={badgeStyle}>{env}</span> : null}
      </span>
    );
  }

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
            <button type="button" className="btn btn-secondary" onClick={() => void router.push("/availability-summary")}>
              Executive Availability
            </button>
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
          <p className="filter-hint">
            Defaults are the previous calendar month. Adjust filters, then click <strong>Apply filters</strong> to load data.
            Project, environment, and application use enriched names (not Jenkins job names).
          </p>
          <div className="filters">
            <label className="field">
              <span>From date</span>
              <input className="input" type="date" value={draftFromDate} onChange={(e) => setDraftFromDate(e.target.value)} />
            </label>
            <label className="field">
              <span>To date</span>
              <input className="input" type="date" value={draftToDate} onChange={(e) => setDraftToDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Status</span>
              <select className="select" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as StatusFilter)}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
            <label className="field">
              <span>Project</span>
              <select
                className="select"
                value={draftProject}
                onChange={(e) => {
                  setDraftProject(e.target.value);
                  setDraftEnvironment("");
                  setDraftApplicationName("");
                }}
              >
                <option value="">All projects</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Environment</span>
              <select
                className="select"
                value={draftEnvironment}
                onChange={(e) => {
                  setDraftEnvironment(e.target.value);
                  setDraftApplicationName("");
                }}
              >
                <option value="">All environments</option>
                {environmentOptions.map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Application</span>
              <select
                className="select"
                value={draftApplicationName}
                onChange={(e) => setDraftApplicationName(e.target.value)}
              >
                <option value="">All applications</option>
                {applicationNameOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <div className="field field-apply">
              <span className="apply-label" aria-hidden="true">
                &nbsp;
              </span>
              <button type="button" className="btn btn-primary" onClick={handleApplyFilters} disabled={loading}>
                {loading ? "Loading…" : "Apply filters"}
              </button>
            </div>
          </div>
        </section>

        {loading ? <p className="state state-loading">Loading summary…</p> : null}
        {error ? <p className="state state-error">{error}</p> : null}
        {!loading && !error && !hasLoaded ? (
          <p className="state state-empty">Click &quot;Apply filters&quot; to load deployment data for the selected range.</p>
        ) : null}
        {!loading && !error && hasLoaded && datasetItems.length === 0 ? (
          <p className="state state-empty">No deployment data available for the selected filters.</p>
        ) : null}

        {hasLoaded ? (
          <>
            <section className="metrics">
              <div className="panel metric">
                <div className="metric-label">Total deployments</div>
                <div className="metric-value">{kpis.totalDeployments}</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Success count</div>
                <div className="metric-value success">{kpis.successCount}</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Failure count</div>
                <div className="metric-value failure">{kpis.failureCount}</div>
              </div>
              <div className="panel metric">
                <div className="metric-label">Success rate</div>
                <div className="metric-value">{kpis.successRate}%</div>
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Attention Required</h2>
              <div className="rows">
                <div className="row-title">Top failing applications (app + environment, Top 3)</div>
                {topFailing.length === 0 ? (
                  <div className="row muted">No failing applications in current filter scope.</div>
                ) : (
                  topFailing.map((x) => (
                    <div key={x.application} className="row">
                      <AppEnvironmentLabel
                        appName={splitApplicationAndEnv(x.application).app}
                        environment={splitApplicationAndEnv(x.application).env}
                      />
                      <strong>{x.failures} failures</strong>
                    </div>
                  ))
                )}
                <div className="row-title">Repeated failures</div>
                {repeated.length === 0 ? (
                  <div className="row muted">No repeated failures detected.</div>
                ) : (
                  repeated.map((x) => (
                    <div key={`rep-${x.application}`} className="row">
                      <AppEnvironmentLabel
                        appName={splitApplicationAndEnv(x.application).app}
                        environment={splitApplicationAndEnv(x.application).env}
                      />
                      <strong>{x.failures} failures</strong>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Breakdown by Application</h2>
              <p className="section-hint">Each row is application with an environment badge (e.g. Reporting Tool [PROD]).</p>
              <div className="rows">
                {byApp.map((x) => (
                  <div key={x.application} className="row">
                    <AppEnvironmentLabel
                      appName={splitApplicationAndEnv(x.application).app}
                      environment={splitApplicationAndEnv(x.application).env}
                    />
                    <span>
                      Total: {x.total} | Failures: {x.failures}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Breakdown by Project</h2>
              <div className="rows">
                {byProject.map((x) => (
                  <div key={x.project} className="row">
                    <span>{x.project}</span>
                    <span>
                      Total: {x.total} | Failures: {x.failures}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel block">
              <h2 className="block-title">Insights</h2>
              <ul className="insights">
                <li>
                  Most active application:{" "}
                  {mostActive ? (
                    <>
                      <AppEnvironmentLabel
                        appName={splitApplicationAndEnv(mostActive.application).app}
                        environment={splitApplicationAndEnv(mostActive.application).env}
                      />
                      {" "}
                      <strong>({mostActive.count})</strong>
                    </>
                  ) : (
                    <strong>N/A</strong>
                  )}
                </li>
                <li>
                  Most active project: <strong>{mostActiveProj ? `${mostActiveProj.project} (${mostActiveProj.count})` : "N/A"}</strong>
                </li>
                <li>
                  Top failing application:{" "}
                  {topFailing[0] ? (
                    <>
                      <AppEnvironmentLabel
                        appName={splitApplicationAndEnv(topFailing[0].application).app}
                        environment={splitApplicationAndEnv(topFailing[0].application).env}
                      />
                      {" "}
                      <strong>({topFailing[0].failures} failures)</strong>
                    </>
                  ) : (
                    <strong>N/A</strong>
                  )}
                </li>
                <li>
                  Failure trend vs previous period: <strong>{trend}</strong>
                </li>
              </ul>
            </section>
          </>
        ) : null}
      </main>

      <style jsx>{`
        .page {
          width: min(1160px, 100%);
          margin: 32px auto;
          padding: 0 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          margin-left: auto;
        }
        .title {
          margin: 0 0 4px;
          font-size: 28px;
          line-height: 1.2;
          color: #101828;
        }
        .subtitle {
          margin: 0;
          color: #667085;
          font-size: 14px;
        }
        .panel {
          background: #fff;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
        }
        .block {
          padding: 16px;
          margin-bottom: 24px;
        }
        .block-title {
          margin: 0 0 14px;
          font-size: 16px;
          color: #101828;
        }
        .filter-hint {
          margin: 0 0 14px;
          font-size: 13px;
          color: #667085;
          line-height: 1.45;
        }
        .section-hint {
          margin: -8px 0 12px;
          font-size: 13px;
          color: #667085;
        }
        .filters {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          width: 100%;
          align-items: end;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: #475467;
          min-width: 0;
        }
        .field-apply {
          justify-content: flex-end;
        }
        .apply-label {
          visibility: hidden;
          min-height: 1em;
        }
        .input,
        .select {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 14px;
          background: #fff;
        }
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
        .btn-primary {
          background: #111827;
          color: #fff;
        }
        .btn-primary:hover:not(:disabled) {
          background: #0f172a;
        }
        .btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
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
        .state {
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .state-loading {
          background: #eef4ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .state-empty {
          background: #f8fafc;
          color: #475467;
          border: 1px solid #e4e7ec;
        }
        .state-error {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .metric {
          padding: 14px;
        }
        .metric-label {
          color: #475467;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .metric-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.1;
          color: #101828;
        }
        .metric-value.success {
          color: #166534;
        }
        .metric-value.failure {
          color: #b42318;
        }
        .rows {
          display: grid;
          gap: 8px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #f2f4f7;
          font-size: 14px;
        }
        .row-title {
          font-weight: 600;
          color: #344054;
          margin-top: 4px;
        }
        .muted {
          color: #667085;
        }
        .insights {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 8px;
        }
        @media (max-width: 1100px) {
          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
        @media (max-width: 640px) {
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
