"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Agent, CronJob, CronRun } from "@/lib/types";
import { useAgentsContext } from "@/app/agents-provider";
import type { Pipeline } from "@/lib/cron-pipelines";
import { formatDuration, timeAgo, nextRunLabel } from "@/lib/cron-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, BarChart3, Calendar, GitBranch, Copy, Check } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { WeeklySchedule } from "@/components/crons/WeeklySchedule";
const PipelineGraph = dynamic(() => import("@/components/crons/PipelineGraph").then(m => ({ default: m.PipelineGraph })), { ssr: false });
import { PipelineDetailPanel } from "@/components/crons/PipelineDetailPanel";
import { PipelineWizard } from "@/components/crons/PipelineWizard";

/* ─── Types ─────────────────────────────────────────────────────── */

type Filter = "all" | "ok" | "error" | "idle";
type Tab = "overview" | "schedule" | "pipelines";

const STATUS_DOT: Record<string, string> = {
  ok: "var(--system-green)",
  error: "var(--system-red)",
  idle: "var(--text-tertiary)",
};

const PILLS: { key: Filter; label: string; dotColor: string }[] = [
  { key: "all", label: "All", dotColor: "var(--text-primary)" },
  { key: "ok", label: "OK", dotColor: "var(--system-green)" },
  { key: "error", label: "Errors", dotColor: "var(--system-red)" },
  { key: "idle", label: "Idle", dotColor: "var(--text-tertiary)" },
];

const TAB_ICONS: Record<Tab, React.ComponentType<{ size: number; className?: string }>> = {
  overview: BarChart3,
  schedule: Calendar,
  pipelines: GitBranch,
};

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Schedule" },
  { key: "pipelines", label: "Pipelines" },
];

/* ─── Delivery helpers ─────────────────────────────────────────── */

function DeliveryBadge({ cron }: { cron: CronJob }) {
  if (!cron.delivery) {
    return (
      <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>
        No delivery configured
      </span>
    );
  }

  const { delivery, lastDeliveryStatus } = cron;
  const hasMissingTarget = !delivery.to;

  if (hasMissingTarget) {
    return (
      <span style={{ fontSize: "var(--text-caption1)", color: "var(--system-red)" }}>
        Target missing — add &apos;to&apos; field to delivery config
      </span>
    );
  }

  const isDelivered = lastDeliveryStatus === "delivered";
  const isUnknown = !lastDeliveryStatus || lastDeliveryStatus === "unknown";
  const color = isDelivered ? "var(--system-green)" : isUnknown ? "var(--system-orange)" : "var(--system-orange)";
  const statusText = isDelivered ? "Delivered" : isUnknown ? "Unknown" : lastDeliveryStatus;

  // Truncate the "to" field for display
  const toDisplay = delivery.to && delivery.to.length > 20
    ? delivery.to.slice(0, 17) + "..."
    : delivery.to;

  return (
    <span style={{ fontSize: "var(--text-caption1)" }}>
      <span style={{ color }}>
        {isDelivered ? "\u2713" : "\u25CB"}{" "}
      </span>
      <span style={{ color: "var(--text-secondary)" }}>
        {delivery.channel}
      </span>
      {toDisplay && (
        <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>
          {toDisplay}
        </span>
      )}
      <span style={{ color, marginLeft: 8, fontWeight: 500 }}>
        {statusText}
      </span>
    </span>
  );
}

/* ─── Summary Cards ──────────────────────────────────────────── */

function HealthCard({ ok, total }: { ok: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((ok / total) * 100);
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="var(--fill-tertiary)" strokeWidth="5" />
          <circle
            cx="24" cy="24" r={r} fill="none"
            stroke="var(--system-green)" strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 24 24)"
            style={{ transition: "stroke-dashoffset 600ms var(--ease-smooth)" }}
          />
          <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
            fill="var(--text-primary)" fontSize="11" fontWeight="700">{pct}%</text>
        </svg>
        <div>
          <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)" }}>
            Health
          </div>
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)" }}>
            {ok}/{total} healthy
          </div>
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ errors }: { errors: CronJob[] }) {
  const hasErrors = errors.length > 0;
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Attention
      </div>
      {hasErrors ? (
        <>
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--system-red)", fontWeight: "var(--weight-semibold)" }}>
            {errors.length} need{errors.length === 1 ? "s" : ""} fix
          </div>
          <div className="truncate" style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginTop: 2 }}>
            {errors[0].name}
          </div>
        </>
      ) : (
        <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--system-green)" strokeWidth="1.5" />
            <polyline points="5 8 7 10 11 6" stroke="var(--system-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: "var(--text-footnote)", color: "var(--system-green)", fontWeight: "var(--weight-semibold)" }}>
            All clear
          </span>
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ crons }: { crons: CronJob[] }) {
  const withDelivery = crons.filter(c => c.delivery);
  const configured = withDelivery.filter(c => c.delivery?.to);
  const missing = withDelivery.filter(c => !c.delivery?.to);

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Delivery
      </div>
      <div style={{ fontSize: "var(--text-footnote)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)" }}>
        {configured.length} configured
      </div>
      {missing.length > 0 && (
        <div style={{ fontSize: "var(--text-caption2)", color: "var(--system-orange)", marginTop: 2 }}>
          {missing.length} missing target
        </div>
      )}
    </div>
  );
}

/* ─── Categorized Error Banners ──────────────────────────────── */

function ErrorsBanners({
  crons,
  agentMap,
  onCopy,
  copiedId,
}: {
  crons: CronJob[];
  agentMap: Map<string, Agent>;
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
}) {
  // Execution errors: status=error with actual error messages (not delivery target issues)
  const execErrors = crons.filter(c => c.status === "error" && c.lastError && !c.lastError.includes("delivery target is missing"));
  // Config issues: delivery target missing
  const configIssues = crons.filter(c => c.delivery && !c.delivery.to);

  if (execErrors.length === 0 && configIssues.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
      {/* Execution Errors */}
      {execErrors.length > 0 && (
        <div
          style={{
            background: "rgba(255,69,58,0.04)",
            borderLeft: "3px solid var(--system-red)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--system-red)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
            {execErrors.length} execution error{execErrors.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {execErrors.map((cron) => {
              const agent = cron.agentId ? agentMap.get(cron.agentId) : null;
              return (
                <div key={cron.id} className="flex items-center" style={{ gap: "var(--space-2)", fontSize: "var(--text-caption1)", minHeight: 28 }}>
                  <span className="flex-shrink-0 rounded-full animate-error-pulse" style={{ width: 6, height: 6, background: "var(--system-red)" }} />
                  <span className="flex-shrink-0" style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>{cron.name}</span>
                  {cron.lastError && (
                    <span className="truncate" style={{ color: "var(--text-tertiary)", flex: 1, minWidth: 0 }}>{cron.lastError}</span>
                  )}
                  {cron.consecutiveErrors > 1 && (
                    <span style={{ fontSize: "var(--text-caption2)", color: "var(--system-orange)", flexShrink: 0 }}>
                      {cron.consecutiveErrors}x
                    </span>
                  )}
                  {cron.lastError && (
                    <button
                      onClick={() => onCopy(cron.id, cron.lastError!)}
                      className="btn-ghost focus-ring flex-shrink-0"
                      aria-label={`Copy error for ${cron.name}`}
                      style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-medium)", display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      {copiedId === cron.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === cron.id ? "Copied" : "Copy"}
                    </button>
                  )}
                  {agent && (
                    <Link href={`/chat/${agent.id}`} className="flex-shrink-0 focus-ring" style={{ fontSize: "var(--text-caption2)", color: "var(--system-blue)", textDecoration: "none" }}>
                      {agent.name}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Configuration Issues */}
      {configIssues.length > 0 && (
        <div
          style={{
            background: "rgba(255,149,0,0.04)",
            borderLeft: "3px solid var(--system-orange)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--system-orange)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
            {configIssues.length} delivery target{configIssues.length !== 1 ? "s" : ""} missing
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {configIssues.map((cron) => (
              <div key={cron.id} className="flex items-center" style={{ gap: "var(--space-2)", fontSize: "var(--text-caption1)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--system-orange)", flexShrink: 0 }} />
                <span style={{ color: "var(--text-primary)", fontWeight: "var(--weight-medium)" }}>{cron.name}</span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  {cron.delivery?.channel} — no &apos;to&apos; field
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Recent Activity (all jobs) ─────────────────────────────── */

function RecentActivity({
  crons,
  agentMap,
}: {
  crons: CronJob[];
  agentMap: Map<string, Agent>;
}) {
  const [runs, setRuns] = useState<CronRun[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cron-runs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setRuns((data as CronRun[]).slice(0, 10));
        setLoading(false);
      })
      .catch(() => {
        setRuns([]);
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)" }}>
          Recent Activity
        </div>
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", marginTop: 2 }}>
          Latest cron summaries and failures across all scheduled jobs
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 20, width: "100%" }} />
          ))}
        </div>
      ) : !runs || runs.length === 0 ? (
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>
          No recent cron activity yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {runs.map((run, index) => {
            const cron = crons.find((item) => item.id === run.jobId);
            const agent = cron?.agentId ? agentMap.get(cron.agentId) : null;
            const isError = run.status === "error";
            const text = isError
              ? run.error || "Run failed"
              : run.summary || "Run completed";

            return (
              <div
                key={`${run.jobId}-${run.ts}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "var(--space-2)",
                  alignItems: "start",
                  paddingBottom: index < runs.length - 1 ? "var(--space-2)" : 0,
                  borderBottom: index < runs.length - 1 ? "1px solid var(--separator)" : "none",
                }}
              >
                <span
                  className={`flex-shrink-0 rounded-full ${isError ? "animate-error-pulse" : ""}`}
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 6,
                    background: isError ? "var(--system-red)" : "var(--system-green)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)" }}>
                      {cron?.name || run.jobId}
                    </span>
                    {agent && (
                      <Link
                        href={`/chat/${agent.id}`}
                        style={{ fontSize: "var(--text-caption2)", color: "var(--system-blue)", textDecoration: "none" }}
                      >
                        {agent.name}
                      </Link>
                    )}
                    {run.deliveryStatus && (
                      <span style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)" }}>
                        Delivery {run.deliveryStatus}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-caption1)",
                      color: isError ? "var(--system-red)" : "var(--text-secondary)",
                      marginTop: 2,
                      lineHeight: "var(--leading-relaxed)",
                      wordBreak: "break-word",
                    }}
                  >
                    {text}
                  </div>
                </div>
                <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                  {timeAgo(new Date(run.ts).toISOString())}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Recent Runs (lazy-loaded) ──────────────────────────────── */

function RecentRuns({ jobId }: { jobId: string }) {
  const [runs, setRuns] = useState<CronRun[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cron-runs?jobId=${encodeURIComponent(jobId)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setRuns((data as CronRun[]).slice(0, 5)); setLoading(false); })
      .catch(() => { setRuns([]); setLoading(false); });
  }, [jobId]);

  if (loading) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
          Recent Runs
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} style={{ height: 16, marginBottom: 4, width: "80%" }} />
        ))}
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
          Recent Runs
        </div>
        <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)" }}>No run history</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
        Recent Runs
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {runs.map((run, i) => {
          const statusDot = run.status === "ok" ? "var(--system-green)" : "var(--system-red)";
          const ago = timeAgo(new Date(run.ts).toISOString());
          const duration = formatDuration(run.durationMs);
          const deliveryStat = run.deliveryStatus === "delivered" ? "Delivered" : run.deliveryStatus === "unknown" ? "Unknown" : run.deliveryStatus || "—";
          const summaryText = run.status === "error" ? (run.error || "Error") : (run.summary || "—");
          const truncatedSummary = summaryText.length > 60 ? summaryText.slice(0, 57) + "..." : summaryText;

          return (
            <div
              key={`${run.ts}-${i}`}
              className="flex items-center"
              style={{
                gap: "var(--space-2)",
                fontSize: "var(--text-caption2)",
                minHeight: 22,
                padding: "2px 0",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
              <span style={{ color: "var(--text-tertiary)", minWidth: 52, flexShrink: 0 }}>{ago}</span>
              <span style={{ color: "var(--text-secondary)", minWidth: 52, flexShrink: 0 }}>{duration}</span>
              <span style={{ color: run.deliveryStatus === "delivered" ? "var(--system-green)" : "var(--text-tertiary)", minWidth: 60, flexShrink: 0 }}>
                {deliveryStat}
              </span>
              <span className="truncate" style={{ color: "var(--text-tertiary)", minWidth: 0, flex: 1 }}>
                {truncatedSummary}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function CronsPage() {
  const { agents } = useAgentsContext();
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<Tab>("overview");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAgo, setUpdatedAgo] = useState("just now");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPipelineJob, setSelectedPipelineJob] = useState<string | null>(null);

  const pillsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch("/api/crons")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load crons");
        return r.json();
      })
      .then((cronData) => {
        if (Array.isArray(cronData)) {
          setCrons(cronData);
          setPipelines([]);
        } else {
          setCrons(cronData.crons);
          setPipelines(cronData.pipelines || []);
        }
        setLastRefresh(new Date());
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const tick = () => setUpdatedAgo(timeAgo(lastRefresh.toISOString()));
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [lastRefresh]);

  /* Derived data */
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const statusOrder: Record<string, number> = { error: 0, idle: 1, ok: 2 };
  const filtered = crons
    .filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  const counts = {
    all: crons.length,
    ok: crons.filter((c) => c.status === "ok").length,
    error: crons.filter((c) => c.status === "error").length,
    idle: crons.filter((c) => c.status === "idle").length,
  };
  const errorCrons = crons.filter((c) => c.status === "error");

  function handlePillKeyDown(e: React.KeyboardEvent) {
    const pills = pillsRef.current;
    if (!pills) return;
    const buttons = Array.from(pills.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = buttons.findIndex((b) => b.getAttribute("aria-selected") === "true");
    let next = current;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (current + 1) % buttons.length; }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (current - 1 + buttons.length) % buttons.length; }
    if (next !== current) { buttons[next].focus(); buttons[next].click(); }
  }

  function copyError(cronId: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(cronId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (error && crons.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: "var(--bg)" }}>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: "var(--material-regular)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderBottom: "1px solid var(--separator)",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "var(--space-4) var(--space-6)" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-title1)", fontWeight: "var(--weight-bold)", color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: "var(--leading-tight)" }}>
              Scheduled
            </h1>
            {!loading && (
              <p style={{ fontSize: "var(--text-footnote)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
                {counts.all} job{counts.all !== 1 ? "s" : ""}
                {counts.error > 0 && (
                  <span style={{ color: "var(--system-red)" }}>{" \u00b7 "}{counts.error} error{counts.error !== 1 ? "s" : ""}</span>
                )}
                {" \u00b7 "}{counts.ok} ok
              </p>
            )}
          </div>
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Updated {updatedAgo}</span>
            <button
              onClick={refresh}
              className="focus-ring"
              aria-label="Refresh cron data"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", transition: "color 150ms var(--ease-smooth)" }}
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Tab navigation ─────────────────────────────────── */}
        <div className="flex items-center" style={{ padding: "0 var(--space-6) var(--space-3)", gap: "var(--space-1)" }}>
          {TABS.map((t) => {
            const isActive = tab === t.key;
            const TabIcon = TAB_ICONS[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="focus-ring"
                style={{
                  padding: "6px 16px",
                  fontSize: "var(--text-footnote)",
                  fontWeight: isActive ? "var(--weight-semibold)" : "var(--weight-medium)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "all 200ms var(--ease-smooth)",
                  background: isActive ? "var(--accent-fill)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <TabIcon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}>
        {loading ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                  <Skeleton style={{ width: 60, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 80, height: 14 }} />
                </div>
              ))}
            </div>
            <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--material-regular)" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: i < 5 ? "1px solid var(--separator)" : undefined, gap: "var(--space-3)" }}>
                  <Skeleton className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: "50%" }} />
                  <Skeleton style={{ width: 180, height: 14 }} />
                  <div className="ml-auto flex items-center" style={{ gap: "var(--space-3)" }}>
                    <Skeleton style={{ width: 48, height: 12 }} />
                    <Skeleton style={{ width: 64, height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* ─── OVERVIEW TAB ─────────────────────────────── */}
            {tab === "overview" && (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="summary-cards-grid">
                  <HealthCard ok={counts.ok} total={counts.all} />
                  <AttentionCard errors={errorCrons} />
                  <DeliveryCard crons={crons} />
                </div>

                {/* Categorized error banners */}
                <ErrorsBanners crons={crons} agentMap={agentMap} onCopy={copyError} copiedId={copiedId} />

                <RecentActivity crons={crons} agentMap={agentMap} />

                {/* Filter pills */}
                <div
                  ref={pillsRef}
                  role="tablist"
                  aria-label="Filter cron jobs by status"
                  onKeyDown={handlePillKeyDown}
                  className="flex items-center overflow-x-auto flex-shrink-0"
                  style={{ marginBottom: "var(--space-3)", gap: "var(--space-2)" }}
                >
                  {PILLS.map((pill) => {
                    const isActive = filter === pill.key;
                    return (
                      <button
                        key={pill.key}
                        role="tab"
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setFilter(pill.key)}
                        className="focus-ring flex items-center flex-shrink-0"
                        style={{
                          borderRadius: 20,
                          padding: "6px 14px",
                          fontSize: "var(--text-footnote)",
                          fontWeight: "var(--weight-medium)",
                          border: "none",
                          cursor: "pointer",
                          gap: "var(--space-2)",
                          transition: "all 200ms var(--ease-smooth)",
                          ...(isActive
                            ? { background: "var(--accent-fill)", color: "var(--accent)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)" }
                            : { background: "var(--fill-secondary)", color: "var(--text-primary)" }),
                        }}
                      >
                        <span className={`flex-shrink-0 rounded-full ${pill.key === "error" && counts.error > 0 ? "animate-error-pulse" : ""}`} style={{ width: 6, height: 6, background: pill.dotColor }} />
                        <span>{pill.label}</span>
                        <span style={{ fontWeight: "var(--weight-semibold)", color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>{counts[pill.key]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cron list */}
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center" style={{ height: 200, color: "var(--text-secondary)", gap: "var(--space-2)" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-2)" }}>
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: "var(--text-subheadline)", fontWeight: "var(--weight-medium)" }}>
                      {crons.length === 0 ? "No scheduled tasks yet" : "No crons match this filter"}
                    </span>
                    <span style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)", textAlign: "center", maxWidth: 360, lineHeight: "var(--leading-relaxed)" }}>
                      {crons.length === 0 ? "Cron jobs are automated tasks that run on a schedule. They will appear here once your agents have scheduled tasks configured." : "Try selecting a different status filter"}
                    </span>
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--material-regular)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
                    {filtered.map((cron, idx) => {
                      const agent = cron.agentId ? agentMap.get(cron.agentId) : null;
                      const isExpanded = expanded === cron.id;
                      const isError = cron.status === "error";
                      const isOverdue = cron.nextRun && nextRunLabel(cron.nextRun) === "overdue";

                      return (
                        <div key={cron.id}>
                          {idx > 0 && (
                            <div style={{ height: 1, background: "var(--separator)", marginLeft: "var(--space-4)", marginRight: "var(--space-4)" }} />
                          )}

                          {/* Collapsed row */}
                          <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-label={`${cron.name}, status ${cron.status}${agent ? `, agent ${agent.name}` : ""}`}
                            onClick={() => setExpanded(isExpanded ? null : cron.id)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : cron.id); } }}
                            className="flex items-center cursor-pointer hover-bg focus-ring"
                            style={{
                              minHeight: 48,
                              padding: "0 var(--space-4)",
                              background: isError ? "rgba(255,69,58,0.06)" : undefined,
                              borderLeft: `3px solid ${isError ? "var(--system-red)" : cron.status === "ok" ? "var(--system-green)" : "transparent"}`,
                            }}
                          >
                            <span className={`flex-shrink-0 rounded-full ${isError ? "animate-error-pulse" : ""}`} style={{ width: 8, height: 8, background: STATUS_DOT[cron.status] ?? "var(--text-tertiary)" }} />
                            <div className="ml-3 min-w-0 flex-1" style={{ display: "flex", flexDirection: "column" }}>
                              <span className="truncate" style={{ fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>{cron.name}</span>
                              {agent && (
                                <Link href={`/chat/${agent.id}`} onClick={(e) => e.stopPropagation()} className="md:hidden focus-ring" aria-label={`Chat with ${agent.name}`} style={{ fontSize: "var(--text-caption1)", color: "var(--system-blue)", textDecoration: "none", lineHeight: "var(--leading-snug)" }}>
                                  {agent.name}
                                </Link>
                              )}
                            </div>
                            <div className="ml-auto flex items-center flex-shrink-0" style={{ gap: "var(--space-3)" }}>
                              {agent ? (
                                <Link href={`/chat/${agent.id}`} onClick={(e) => e.stopPropagation()} className="hidden md:inline focus-ring" aria-label={`Chat with ${agent.name}`} style={{ fontSize: "var(--text-caption1)", color: "var(--system-blue)", textDecoration: "none" }}>
                                  {agent.name}
                                </Link>
                              ) : (
                                <span className="hidden md:inline" style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{"\u2014"}</span>
                              )}
                              <span className="hidden md:inline" style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>
                                {cron.scheduleDescription || cron.schedule}
                              </span>
                              <span aria-hidden="true" style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)", transition: "transform 200ms var(--ease-smooth)", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
                                &#8250;
                              </span>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="animate-slide-down" style={{ padding: "0 var(--space-4) var(--space-4) var(--space-4)", marginLeft: 3 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-1) var(--space-4)", marginTop: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                                {/* Description */}
                                {cron.description && (
                                  <>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Description</span>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{cron.description}</span>
                                  </>
                                )}

                                {/* Last run */}
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Last run</span>
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{timeAgo(cron.lastRun)}</span>

                                {/* Next run */}
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Next run</span>
                                <span style={{ fontSize: "var(--text-caption1)", color: isOverdue ? "var(--system-orange)" : "var(--text-secondary)", fontWeight: isOverdue ? "var(--weight-semibold)" : undefined }}>
                                  {nextRunLabel(cron.nextRun)}
                                </span>

                                {/* Duration */}
                                {cron.lastDurationMs != null && (
                                  <>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Duration</span>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{formatDuration(cron.lastDurationMs)}</span>
                                  </>
                                )}

                                {/* Status */}
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Status</span>
                                <span style={{ fontSize: "var(--text-caption1)", color: cron.status === "error" ? "var(--system-red)" : cron.status === "ok" ? "var(--system-green)" : "var(--text-secondary)", fontWeight: "var(--weight-medium)", textTransform: "capitalize" }}>
                                  {cron.status}
                                </span>

                                {/* Schedule */}
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Schedule</span>
                                <div>
                                  {cron.scheduleDescription && (
                                    <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{cron.scheduleDescription}</div>
                                  )}
                                  <div className="font-mono" style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginTop: cron.scheduleDescription ? 2 : 0 }}>
                                    {cron.schedule}
                                    {cron.timezone && <span style={{ marginLeft: 8 }}>({cron.timezone})</span>}
                                  </div>
                                </div>

                                {/* Delivery */}
                                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Delivery</span>
                                <DeliveryBadge cron={cron} />

                                {/* Consecutive errors */}
                                {cron.consecutiveErrors > 0 && (
                                  <>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Errors</span>
                                    <span style={{ fontSize: "var(--text-caption1)", color: "var(--system-orange)", fontWeight: "var(--weight-medium)" }}>
                                      {cron.consecutiveErrors} consecutive
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Error box */}
                              {cron.lastError && (
                                <div style={{ borderRadius: "var(--radius-sm)", background: "var(--code-bg)", border: "1px solid var(--code-border)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                                  <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                                    <pre className="font-mono" style={{ fontSize: "var(--text-caption1)", color: "var(--system-red)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, flex: 1, lineHeight: "var(--leading-relaxed)" }}>
                                      {cron.lastError}
                                    </pre>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyError(cron.id, cron.lastError!); }}
                                      className="btn-ghost focus-ring flex-shrink-0"
                                      aria-label="Copy error text"
                                      style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-medium)", display: "inline-flex", alignItems: "center", gap: 3 }}
                                    >
                                      {copiedId === cron.id ? <Check size={12} /> : <Copy size={12} />}
                                      {copiedId === cron.id ? "Copied" : "Copy"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Recent runs */}
                              <RecentRuns jobId={cron.id} />

                              {/* Actions */}
                              <div className="flex items-center" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                                {agent && (
                                  <Link
                                    href={`/chat/${agent.id}`}
                                    className="btn-ghost focus-ring"
                                    aria-label={`Chat with ${agent.name}`}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-caption1)", fontWeight: "var(--weight-medium)", textDecoration: "none", color: "var(--system-blue)" }}
                                  >
                                    Chat with {agent.name}
                                    <span aria-hidden="true" style={{ fontSize: "var(--text-caption1)" }}>{"\u2192"}</span>
                                  </Link>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ─── SCHEDULE TAB ──────────────────────────────── */}
            {tab === "schedule" && <WeeklySchedule crons={crons} />}

            {/* ─── PIPELINES TAB ─────────────────────────────── */}
            {tab === "pipelines" && (
              <PipelineGraph
                crons={crons}
                agents={agents}
                pipelines={pipelines}
                onSetupClick={() => setWizardOpen(true)}
                onEditClick={() => setWizardOpen(true)}
                onClearClick={() => {
                  fetch("/api/pipelines", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify([]),
                  }).then(() => refresh())
                }}
                onJobSelect={setSelectedPipelineJob}
                selectedJob={selectedPipelineJob}
              />
            )}
          </>
        )}
      </div>

      <PipelineWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        agents={agents}
        crons={crons}
        onSaved={refresh}
      />

      {selectedPipelineJob && (
        <PipelineDetailPanel
          jobName={selectedPipelineJob}
          crons={crons}
          agents={agents}
          pipelines={pipelines}
          onClose={() => setSelectedPipelineJob(null)}
        />
      )}

      <style>{`
        @media (max-width: 640px) {
          .summary-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
