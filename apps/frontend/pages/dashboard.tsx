import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { isAuthenticated, signOut } from "../src/infrastructure/auth/CognitoClient";
import { useRouter } from "next/router";
import { Deployment } from "@domain/Deployment";
import { fetchDeployments, type DeploymentsSortBy } from "@infrastructure/api/deploymentsApi";
import { groupByApplication } from "@application/dashboard";

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthDateRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    fromDate: toDateInputValue(firstDayOfMonth),
    toDate: toDateInputValue(today)
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Deployment[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [application, setApplication] = useState("");
  const [status, setStatus] = useState<"" | "success" | "failure">("");

  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<DeploymentsSortBy>("executedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  /** Server uses DynamoDB GSI order (execution time). Cursor paginates that stream; stack replays “previous”. */
  const filterKey = useMemo(
    () => [fromDate, toDate, application, status, pageSize, sortBy, sortOrder].join("|"),
    [fromDate, toDate, application, status, pageSize, sortBy, sortOrder]
  );

  const [listPaging, setListPaging] = useState<{
    filterKey: string;
    requestCursor?: string;
    backStack: (string | undefined)[];
  }>({ filterKey, backStack: [] });

  if (listPaging.filterKey !== filterKey) {
    setListPaging({ filterKey, backStack: [], requestCursor: undefined });
  }

  const [pageMeta, setPageMeta] = useState<{ nextCursor: string | null; hasNextPage: boolean }>({
    nextCursor: null,
    hasNextPage: false
  });
  const [sortWarning, setSortWarning] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        try {
          localStorage.setItem("devops_dash_tokens", JSON.stringify({ idToken: token }));
          // Clean token from URL
          const cleanUrl = window.location.pathname + window.location.hash;
          history.replaceState(null, document.title, cleanUrl);
        } catch {
          // ignore storage errors
        }
      }
      const authed = await isAuthenticated();
      if (!authed) {
        router.replace("/login");
        return;
      }

      const defaultRange = getCurrentMonthDateRange();
      const queryFromDate = params.get("fromDate");
      const queryToDate = params.get("toDate");

      setFromDate(queryFromDate && DATE_INPUT_RE.test(queryFromDate) ? queryFromDate : defaultRange.fromDate);
      setToDate(queryToDate && DATE_INPUT_RE.test(queryToDate) ? queryToDate : defaultRange.toDate);

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
        const result = await fetchDeployments(
          {
            from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
            to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
            application: application || undefined,
            status: status || undefined,
            sortBy,
            sortOrder
          },
          { limit: pageSize, cursor: listPaging.requestCursor }
        );
        if (cancelled) return;
        setItems(result.items);
        setPageMeta({
          nextCursor: result.pageInfo.nextCursor,
          hasNextPage: result.pageInfo.hasNextPage
        });
        setSortWarning(result.pageInfo.sortWarning ?? null);
      } catch (err) {
        if (cancelled) return;
        setError("Unable to load deployments. Please try again.");
        setItems([]);
        setPageMeta({ nextCursor: null, hasNextPage: false });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checked, filterKey, listPaging.requestCursor, pageSize]);

  const handleSortColumn = (column: DeploymentsSortBy) => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortOrder("asc");
      return;
    }
    setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
  };

  /** Server orders by execution time for pagination; other columns are sorted on the current page only. */
  const displayItems = useMemo(() => {
    if (sortBy === "executedAt") return items;
    const dir = sortOrder === "asc" ? 1 : -1;
    const sorted = [...items];
    const str = (v: string | undefined) => (v ?? "").toLowerCase();
    sorted.sort((a, b) => {
      let c = 0;
      switch (sortBy) {
        case "application":
          c = str(a.application).localeCompare(str(b.application));
          break;
        case "buildNumber":
          c = (a.buildNumber ?? -1) - (b.buildNumber ?? -1);
          break;
        case "status":
          c = str(a.status).localeCompare(str(b.status));
          break;
        case "executedBy":
          c = str(a.executedBy).localeCompare(str(b.executedBy));
          break;
        case "stage":
          c = str(a.stage).localeCompare(str(b.stage));
          break;
        default:
          break;
      }
      if (c !== 0) return c * dir;
      return (a.executedAt || "").localeCompare(b.executedAt || "") * -1;
    });
    return sorted;
  }, [items, sortBy, sortOrder]);

  const byApplication = groupByApplication(displayItems);
  const pageDepth = listPaging.backStack.length + 1;

  if (!checked) return null;
  return (
    <>
      <Head>
        <title>Dashboard - DevOps Activity Dashboard</title>
      </Head>
      <main className="page">
        <div className="header">
          <div>
            <h1 className="title">Dashboard</h1>
            <p className="subtitle">Deployment activity visualization for authenticated users.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void router.push("/availability-summary")}>
              Executive Availability
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
              <input className="input" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); }} />
            </label>
            <label className="field">
              <span>To date</span>
              <input className="input" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); }} />
            </label>
            <label className="field">
              <span>Application / Job</span>
              <input className="input" value={application} onChange={(e) => { setApplication(e.target.value); }} placeholder="e.g. payments-service" />
            </label>
            <label className="field">
              <span>Status</span>
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as "" | "success" | "failure"); }}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? <p className="state state-loading">Loading deployments…</p> : null}
        {error ? <p className="state state-error">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="state state-empty">No deployment data found for the selected filters.</p>
        ) : null}

        {/* Metrics cards removed per simplification request */}

        <section className="panel block">
          <h2 className="block-title">Deployments per application</h2>
          <p className="subtitle" style={{ marginTop: -6, marginBottom: 10 }}>
            Counts reflect the current page only (full totals are not loaded).
          </p>
          <div className="rows">
            {byApplication.map((row) => (
              <div key={row.application} className="row">
                <span>{row.application}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel block">
          <h2 className="block-title">Deployments</h2>
          {sortWarning ? <p className="subtitle" style={{ marginTop: -6, marginBottom: 10 }}>{sortWarning}</p> : null}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "application" ? "is-active" : ""}`} onClick={() => handleSortColumn("application")}>
                      Application
                      {sortBy === "application" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "executedAt" ? "is-active" : ""}`} onClick={() => handleSortColumn("executedAt")}>
                      Execution date
                      {sortBy === "executedAt" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "buildNumber" ? "is-active" : ""}`} onClick={() => handleSortColumn("buildNumber")}>
                      Build #
                      {sortBy === "buildNumber" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "status" ? "is-active" : ""}`} onClick={() => handleSortColumn("status")}>
                      Status
                      {sortBy === "status" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "executedBy" ? "is-active" : ""}`} onClick={() => handleSortColumn("executedBy")}>
                      User
                      {sortBy === "executedBy" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className={`th-sort-btn ${sortBy === "stage" ? "is-active" : ""}`} onClick={() => handleSortColumn("stage")}>
                      Stage
                      {sortBy === "stage" ? <span className="sort-caret">{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                  <th scope="col">Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.application}</td>
                    <td>{item.executedAt}</td>
                    <td>{item.buildNumber ?? "-"}</td>
                    <td>
                      <span className={`pill ${item.status === "success" ? "pill-success" : item.status === "failure" ? "pill-failure" : "pill-unknown"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.executedBy ?? "-"}</td>
                    <td>{item.stage ?? "-"}</td>
                    <td className="td-pipeline">
                      {item.pipelineUrl ? (
                        <a
                          href={item.pipelineUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn-pipeline"
                          aria-label="Open deployment pipeline in a new tab"
                        >
                          <span className="btn-pipeline-icon" aria-hidden="true">
                            ↗
                          </span>
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="subtitle" style={{ margin: 0 }}>
              Page {pageDepth}
              {!pageMeta.hasNextPage && items.length > 0 ? " (last page)" : ""}
            </div>
            <div className="footer-actions">
              <select
                className="select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                }}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setListPaging((p) => {
                    if (p.backStack.length === 0) return p;
                    const nextStack = [...p.backStack];
                    const prevCursor = nextStack.pop();
                    return { ...p, backStack: nextStack, requestCursor: prevCursor };
                  });
                }}
                disabled={listPaging.backStack.length === 0 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const next = pageMeta.nextCursor;
                  if (!next) return;
                  setListPaging((p) => ({
                    ...p,
                    backStack: [...p.backStack, p.requestCursor],
                    requestCursor: next
                  }));
                }}
                disabled={!pageMeta.hasNextPage || loading}
              >
                Next
              </button>
            </div>
          </div>
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
        .block-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }

        .filters {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          width: 100%;
          align-items: start;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: #475467;
          min-width: 0;
          width: 100%;
          margin: 0;
        }
        .field span { font-weight: 500; line-height: 1.2; }
        .filters .input,
        .filters .select { min-height: 40px; width: 100%; min-width: 0; }
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
        .btn-ghost { background: #fff; border: 1px solid #e4e7ec; color: #101828; }
        .btn-primary { background: #111827; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #0f172a; }
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
        a.btn { text-decoration: none; color: #101828; display: inline-flex; align-items: center; }

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

        .rows { display: grid; gap: 6px; }
        .row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f2f4f7; font-size: 14px; }

        .table-wrap { width: 100%; overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; min-width: 840px; }
        .table th, .table td { text-align: left; border-bottom: 1px solid #eaecf0; padding: 9px 8px; font-size: 13px; vertical-align: top; }
        .table td.td-pipeline { vertical-align: middle; }
        .table th { background: #f9fafb; color: #344054; font-weight: 600; vertical-align: middle; }
        .th-sort-btn {
          border: 0;
          background: transparent;
          padding: 0;
          margin: 0;
          font: inherit;
          font-weight: 600;
          color: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          text-align: left;
          border-radius: 6px;
        }
        .th-sort-btn:hover { color: #101828; background: #f2f4f7; }
        .th-sort-btn.is-active { color: #1d4ed8; }
        .sort-caret { font-size: 12px; font-weight: 700; }

        .btn-pipeline {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          text-decoration: none;
          color: #1d4ed8;
          background: #fff;
          border: 1px solid #1d4ed8;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
        }
        .btn-pipeline:hover {
          background: #eff6ff;
          border-color: #1e40af;
          color: #1e40af;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
        }
        .btn-pipeline:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .btn-pipeline:active {
          transform: scale(0.98);
        }
        .btn-pipeline-icon {
          font-size: 11px;
          line-height: 1;
          opacity: 0.95;
        }

        .pill { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
        .pill-success { background: #dcfce7; color: #166534; }
        .pill-failure { background: #fee4e2; color: #b42318; }
        .pill-unknown { background: #f2f4f7; color: #475467; }

        .table-footer { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .footer-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

        @media (max-width: 900px) {
          .header { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 1100px) {
          .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .filters { grid-template-columns: 1fr; gap: 12px; }
        }
      `}</style>
    </>
  );
}
