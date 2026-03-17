"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  MemoryFileInfo,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryApiResponse,
  MemoryFileCategory,
  MemoryHealthSummary,
  MemoryHealthCheck,
  HealthSeverity,
  ReindexStatus,
  EditingHint,
  LibraryConfig,
  LibrarySyncResult,
  LibrarySyncSource,
} from "@/lib/types";
import {
  RefreshCw,
  Copy,
  Check,
  Download,
  BarChart3,
  FolderOpen,
  BookOpen,
  Pencil,
  Save,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  RotateCw,
  Activity,
  MessageSquare,
  ChevronDown,
  Zap,
} from "lucide-react";
import { renderMarkdown, colorizeJson } from "@/lib/sanitize";
import { generateId } from "@/lib/id";
import { timeAgo } from "@/lib/cron-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { computeEditingHints } from "@/lib/memory-hints";
import { fileHealthSeverity } from "@/lib/memory-health";
import {
  buildMemoryHealthPrompt,
  buildCheckFixPrompt,
} from "@/lib/memory-health-prompt";

/* ─── Types ──────────────────────────────────────────────────── */

type Tab = "overview" | "browser" | "guide" | "sync";
type SortKey = "date" | "name" | "size";

interface HealthChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: "overview", label: "Overview", Icon: BarChart3 },
  { key: "browser", label: "Browser", Icon: FolderOpen },
  { key: "guide", label: "Guide", Icon: BookOpen },
  { key: "sync", label: "Library Sync", Icon: RefreshCw },
];

/* ─── Helpers ────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isJsonFile(file: MemoryFileInfo): boolean {
  return file.path.endsWith(".json");
}

const CATEGORY_COLORS: Record<MemoryFileCategory, string> = {
  evergreen: "var(--system-green)",
  daily: "var(--system-blue)",
  other: "var(--text-tertiary)",
};

const CATEGORY_LABELS: Record<MemoryFileCategory, string> = {
  evergreen: "Evergreen",
  daily: "Daily",
  other: "Other",
};

/* ─── Icons ──────────────────────────────────────────────────── */

function FileIcon({ isJson }: { isJson: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: isJson ? "var(--system-blue)" : "var(--text-tertiary)", flexShrink: 0 }}
    >
      {isJson ? (
        <>
          <rect x="4" y="2" width="8" height="12" rx="1.5" />
          <path d="M6 2V1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V2" />
          <line x1="6.5" y1="6" x2="9.5" y2="6" />
          <line x1="6.5" y1="8.5" x2="9.5" y2="8.5" />
          <line x1="6.5" y1="11" x2="8" y2="11" />
        </>
      ) : (
        <>
          <path d="M4 1.5h5.5L12 4v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z" />
          <polyline points="9.5 1.5 9.5 4.5 12 4.5" />
          <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
          <line x1="5.5" y1="10" x2="10.5" y2="10" />
        </>
      )}
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-tertiary)" }}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="10 3 5 8 10 13" />
    </svg>
  );
}

/* ─── Overview: Stat Cards ───────────────────────────────────── */

function FilesCard({ stats }: { stats: MemoryStats }) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Files
      </div>
      <div
        style={{
          fontSize: "var(--text-title2)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
        }}
      >
        {stats.totalFiles}
      </div>
      <div
        style={{
          fontSize: "var(--text-caption2)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        {stats.evergreenCount} evergreen {"\u00b7"} {stats.dailyLogCount} daily
      </div>
    </div>
  );
}

function SizeCard({ stats }: { stats: MemoryStats }) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Size
      </div>
      <div
        style={{
          fontSize: "var(--text-title2)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
        }}
      >
        {formatBytes(stats.totalSizeBytes)}
      </div>
      {stats.oldestDaily && stats.newestDaily && (
        <div
          style={{
            fontSize: "var(--text-caption2)",
            color: "var(--text-tertiary)",
            marginTop: 2,
          }}
        >
          {stats.oldestDaily} to {stats.newestDaily}
        </div>
      )}
    </div>
  );
}

function IndexCard({ status }: { status: MemoryStatus }) {
  const dotColor = status.indexed ? "var(--system-green)" : "var(--text-tertiary)";
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Index
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
          }}
        >
          {status.indexed ? "Indexed" : "Not indexed"}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-caption2)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        {status.lastIndexed ? `Last: ${timeAgo(status.lastIndexed)}` : "No index data"}
        {status.embeddingProvider && ` \u00b7 ${status.embeddingProvider}`}
      </div>
    </div>
  );
}

/* ─── Overview: Memory Timeline ──────────────────────────────── */

function MemoryTimeline({ timeline }: { timeline: MemoryStats["dailyTimeline"] }) {
  const maxSize = Math.max(...timeline.map((d) => d?.sizeBytes ?? 0), 1);
  const barWidth = 10;
  const gap = 3;
  const chartWidth = timeline.length * (barWidth + gap) - gap;
  const chartHeight = 80;
  const padding = 20;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Daily Log Timeline (30 days)
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${chartWidth + 2} ${chartHeight + padding}`}
        style={{ display: "block" }}
      >
        {/* Baseline */}
        <line
          x1="0"
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="var(--separator)"
          strokeWidth="1"
        />
        {timeline.map((entry, i) => {
          const x = i * (barWidth + gap);
          if (!entry) {
            return (
              <rect
                key={i}
                x={x}
                y={chartHeight - 2}
                width={barWidth}
                height={2}
                rx={1}
                fill="var(--fill-tertiary)"
              />
            );
          }
          const h = Math.max(4, (entry.sizeBytes / maxSize) * chartHeight);
          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                rx={2}
                fill="var(--accent)"
                opacity={0.8}
              />
              <title>
                {entry.date}: {formatBytes(entry.sizeBytes)}
              </title>
            </g>
          );
        })}
        {/* Date labels: first, middle, last */}
        {[0, 14, 29].map((idx) => {
          const entry = timeline[idx];
          const x = idx * (barWidth + gap) + barWidth / 2;
          const label = entry?.date?.slice(5) ?? "";
          if (!label) {
            // Compute date from index
            const d = new Date();
            d.setDate(d.getDate() - (29 - idx));
            const fallback = d.toISOString().slice(5, 10);
            return (
              <text
                key={idx}
                x={x}
                y={chartHeight + 14}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="8"
              >
                {fallback}
              </text>
            );
          }
          return (
            <text
              key={idx}
              x={x}
              y={chartHeight + 14}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="8"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Overview: Config Panel ─────────────────────────────────── */

function ConfigPanel({ config }: { config: MemoryConfig }) {
  const { memorySearch: ms, memoryFlush: mf, configFound } = config;
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Configuration
      </div>

      {!configFound && (
        <div
          style={{
            background: "var(--fill-secondary)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Using OpenClaw defaults (no explicit memorySearch config)
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "var(--space-1) var(--space-4)",
          fontSize: "var(--text-caption1)",
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>Search</span>
        <span style={{ color: ms.enabled ? "var(--system-green)" : "var(--text-secondary)" }}>
          {ms.enabled ? "Enabled" : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Provider</span>
        <span style={{ color: "var(--text-secondary)" }}>{ms.provider ?? "None"}</span>

        <span style={{ color: "var(--text-tertiary)" }}>Model</span>
        <span className="font-mono" style={{ color: "var(--text-secondary)", fontSize: "var(--text-caption2)" }}>
          {ms.model ?? "None"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Hybrid</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.enabled
            ? `Vector ${ms.hybrid.vectorWeight} / Text ${ms.hybrid.textWeight}`
            : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Decay</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.temporalDecay.enabled
            ? `Half-life: ${ms.hybrid.temporalDecay.halfLifeDays}d`
            : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>MMR</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.mmr.enabled ? `\u03bb = ${ms.hybrid.mmr.lambda}` : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Flush</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {mf.enabled ? `Threshold: ${(mf.softThresholdTokens / 1000).toFixed(0)}k tokens` : "Disabled"}
        </span>
      </div>
    </div>
  );
}

/* ─── Guide: Decay Visualizer ────────────────────────────────── */

function DecayVisualizer({ config }: { config: MemoryConfig }) {
  const decay = config.memorySearch.hybrid.temporalDecay;
  const halfLife = decay.halfLifeDays;
  const enabled = decay.enabled;
  const chartW = 360;
  const chartH = 120;
  const padX = 40;
  const padY = 20;
  const innerW = chartW - padX;
  const innerH = chartH - padY;
  const maxDays = 180;

  // Build curve points
  const points: string[] = [];
  for (let d = 0; d <= maxDays; d += 2) {
    const score = Math.exp((-Math.LN2 / halfLife) * d) * 100;
    const x = padX + (d / maxDays) * innerW;
    const y = padY + innerH - (score / 100) * innerH;
    points.push(`${x},${y}`);
  }
  // Close area
  const areaPoints = [
    ...points,
    `${padX + innerW},${padY + innerH}`,
    `${padX},${padY + innerH}`,
  ].join(" ");
  const linePoints = points.join(" ");

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        position: "relative",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Temporal Decay Curve
        </span>
        {!enabled && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--system-orange)",
              background: "rgba(255,149,0,0.1)",
              padding: "1px 8px",
              borderRadius: 10,
              fontWeight: "var(--weight-medium)",
            }}
          >
            Disabled
          </span>
        )}
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${chartW} ${chartH}`}
        style={{ display: "block", opacity: enabled ? 1 : 0.35 }}
      >
        {/* Y-axis labels */}
        {[0, 50, 100].map((pct) => {
          const y = padY + innerH - (pct / 100) * innerH;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={padX + innerW}
                y2={y}
                stroke="var(--separator)"
                strokeWidth="0.5"
                strokeDasharray={pct === 0 ? "0" : "3,3"}
              />
              <text
                x={padX - 4}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-tertiary)"
                fontSize="8"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Half-life markers */}
        {[1, 2, 3].map((mult) => {
          const d = halfLife * mult;
          if (d > maxDays) return null;
          const x = padX + (d / maxDays) * innerW;
          return (
            <g key={mult}>
              <line
                x1={x}
                y1={padY}
                x2={x}
                y2={padY + innerH}
                stroke="var(--text-tertiary)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
              />
              <text
                x={x}
                y={chartH - 2}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="7"
              >
                {d}d
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <polygon points={areaPoints} fill="var(--accent)" opacity={0.1} />

        {/* Curve line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis labels */}
        <text x={padX} y={chartH - 2} textAnchor="start" fill="var(--text-tertiary)" fontSize="7">
          0d
        </text>
        <text x={padX + innerW} y={chartH - 2} textAnchor="end" fill="var(--text-tertiary)" fontSize="7">
          {maxDays}d
        </text>
      </svg>
    </div>
  );
}

/* ─── Guide: Hybrid Balance Bar ──────────────────────────────── */

function HybridBalanceBar({ config }: { config: MemoryConfig }) {
  const { vectorWeight, textWeight } = config.memorySearch.hybrid;
  const enabled = config.memorySearch.hybrid.enabled;
  const vPct = vectorWeight * 100;
  const tPct = textWeight * 100;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Hybrid Search Balance
        </span>
        {!enabled && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--system-orange)",
              background: "rgba(255,149,0,0.1)",
              padding: "1px 8px",
              borderRadius: 10,
              fontWeight: "var(--weight-medium)",
            }}
          >
            Disabled
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          height: 24,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          opacity: enabled ? 1 : 0.35,
        }}
      >
        <div
          style={{
            width: `${vPct}%`,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            Vector {vPct.toFixed(0)}%
          </span>
        </div>
        <div
          style={{
            width: `${tPct}%`,
            background: "var(--system-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            Text {tPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Guide: Best Practices ──────────────────────────────────── */

const BEST_PRACTICE_SECTIONS = [
  {
    title: "Writing to Memory",
    color: "var(--system-green)",
    tips: [
      { do: true, text: "Keep MEMORY.md concise -- curated facts, not running logs" },
      { do: true, text: "Use daily logs (YYYY-MM-DD.md) for ephemeral session context" },
      { do: false, text: "Don't dump raw conversation transcripts into memory files" },
      { do: true, text: "Structure entries with clear headers so search can find them" },
    ],
  },
  {
    title: "Search & Retrieval",
    color: "var(--system-blue)",
    tips: [
      { do: true, text: "Enable hybrid search -- combines semantic + keyword matching" },
      { do: true, text: "Turn on MMR (Maximal Marginal Relevance) to reduce duplicate results" },
      { do: true, text: "Configure temporal decay so stale daily logs rank lower over time" },
      { do: false, text: "Don't set half-life too short -- important context needs time to be useful" },
    ],
  },
  {
    title: "Maintenance",
    color: "var(--system-orange)",
    tips: [
      { do: true, text: "Review and prune old daily logs periodically" },
      { do: true, text: "Promote recurring patterns from daily logs into evergreen files" },
      { do: true, text: "Enable memory flush to auto-compact context before token limits" },
      { do: false, text: "Don't let MEMORY.md grow past ~200 lines -- split into topic files" },
    ],
  },
];

function BestPractices() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {BEST_PRACTICE_SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{
            background: "var(--material-regular)",
            border: "1px solid var(--separator)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
          }}
        >
          <div
            className="flex items-center"
            style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: section.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--text-primary)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {section.title}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {section.tips.map((tip, i) => (
              <div key={i} className="flex items-start" style={{ gap: "var(--space-2)" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                    marginTop: 1,
                    lineHeight: "14px",
                    background: tip.do ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)",
                    color: tip.do ? "var(--system-green)" : "var(--system-red)",
                  }}
                >
                  {tip.do ? "DO" : "DON'T"}
                </span>
                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
                  {tip.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Guide: File Reference ──────────────────────────────────── */

const FILE_REFERENCE = [
  { path: "MEMORY.md", purpose: "Long-term curated facts", decay: "Low (evergreen)" },
  { path: "memory/team-memory.md", purpose: "Shared team knowledge", decay: "Low (evergreen)" },
  { path: "memory/team-intel.json", purpose: "Structured team data", decay: "Low (evergreen)" },
  { path: "memory/YYYY-MM-DD.md", purpose: "Daily ephemeral context", decay: "High (temporal)" },
];

function FileReference() {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        File Reference
      </div>
      <div style={{ overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-caption1)",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Path
              </th>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Purpose
              </th>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Decay
              </th>
            </tr>
          </thead>
          <tbody>
            {FILE_REFERENCE.map((row) => (
              <tr key={row.path}>
                <td
                  className="font-mono"
                  style={{
                    color: "var(--text-primary)",
                    padding: "var(--space-1) var(--space-2)",
                    fontSize: "var(--text-caption2)",
                  }}
                >
                  {row.path}
                </td>
                <td
                  style={{
                    color: "var(--text-secondary)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {row.purpose}
                </td>
                <td
                  style={{
                    color: "var(--text-tertiary)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {row.decay}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Guide: Flush Section ───────────────────────────────────── */

function FlushSection({ config }: { config: MemoryConfig }) {
  const mf = config.memoryFlush;
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Memory Flush
        </span>
        <span
          style={{
            fontSize: "var(--text-caption2)",
            color: mf.enabled ? "var(--system-green)" : "var(--text-tertiary)",
            background: mf.enabled ? "rgba(52,199,89,0.1)" : "var(--fill-secondary)",
            padding: "1px 8px",
            borderRadius: 10,
            fontWeight: "var(--weight-medium)",
          }}
        >
          {mf.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <p
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          lineHeight: "var(--leading-relaxed)",
          margin: 0,
        }}
      >
        When enabled, OpenClaw compacts conversation context by flushing
        important facts to memory files when the context reaches{" "}
        <strong style={{ color: "var(--text-primary)" }}>
          {(mf.softThresholdTokens / 1000).toFixed(0)}k tokens
        </strong>
        . This prevents context window overflow while preserving key information.
      </p>
    </div>
  );
}

/* ─── Browser: Category Badge ────────────────────────────────── */

function CategoryBadge({ category }: { category: MemoryFileCategory }) {
  return (
    <span
      style={{
        fontSize: "var(--text-caption2)",
        color: CATEGORY_COLORS[category],
        background: `color-mix(in srgb, ${CATEGORY_COLORS[category]} 12%, transparent)`,
        padding: "1px 6px",
        borderRadius: 8,
        fontWeight: "var(--weight-medium)",
        flexShrink: 0,
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/* ─── Overview: Health Score Card ────────────────────────────── */

function healthScoreColor(score: number): string {
  if (score >= 80) return "var(--system-green)";
  if (score >= 60) return "var(--system-orange)";
  return "var(--system-red)";
}

function HealthHero({
  health,
  stats,
  status,
}: {
  health: MemoryHealthSummary;
  stats: MemoryStats;
  status: MemoryStatus;
}) {
  const criticals = health.checks.filter((c) => c.severity === "critical").length;
  const warnings = health.checks.filter((c) => c.severity === "warning").length;
  const color = healthScoreColor(health.score);
  const dotColor = status.indexed ? "var(--system-green)" : "var(--text-tertiary)";

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        flexWrap: "wrap",
      }}
    >
      {/* Left: Health score + severity */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
        <span
          style={{
            fontSize: 36,
            fontWeight: "var(--weight-bold)",
            color,
            lineHeight: 1,
          }}
        >
          {health.score}
        </span>
        <div>
          <div
            style={{
              fontSize: "var(--text-footnote)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            Health Score
          </div>
          <div
            style={{
              fontSize: "var(--text-caption1)",
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            {criticals > 0 && (
              <span style={{ color: "var(--system-red)" }}>
                {criticals} critical
              </span>
            )}
            {criticals > 0 && warnings > 0 && " \u00b7 "}
            {warnings > 0 && (
              <span style={{ color: "var(--system-orange)" }}>
                {warnings} warning{warnings !== 1 ? "s" : ""}
              </span>
            )}
            {criticals === 0 && warnings === 0 && "All clear"}
          </div>
        </div>
      </div>

      {/* Right: Stat pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        <span>{stats.totalFiles} files</span>
        <span style={{ color: "var(--text-tertiary)" }}>{"\u00b7"}</span>
        <span>{formatBytes(stats.totalSizeBytes)}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{"\u00b7"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }}
          />
          {status.indexed ? "Indexed" : "Not indexed"}
        </span>
      </div>
    </div>
  );
}

/* ─── Overview: Health Checks List ──────────────────────────── */

const SEVERITY_ICON_MAP: Record<
  Exclude<HealthSeverity, "ok">,
  { Icon: typeof AlertTriangle; color: string }
> = {
  critical: { Icon: AlertCircle, color: "var(--system-red)" },
  warning: { Icon: AlertTriangle, color: "var(--system-orange)" },
  info: { Icon: Info, color: "var(--text-tertiary)" },
};

function HealthChecksList({
  checks,
  onCheckAction,
  onViewFile,
  onReindex,
}: {
  checks: MemoryHealthCheck[];
  onCheckAction?: (check: MemoryHealthCheck) => void;
  onViewFile?: (relativePath: string) => void;
  onReindex?: () => void;
}) {
  if (checks.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Health Checks
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {checks.map((check) => {
          const severity = check.severity === "ok" ? "info" : check.severity;
          const { Icon, color } = SEVERITY_ICON_MAP[severity];
          const isIndexCheck = check.id === "unindexed-vector" || check.id === "stale-index";
          return (
            <div key={check.id} className="flex items-start" style={{ gap: "var(--space-2)" }}>
              <Icon size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-primary)",
                  }}
                >
                  {check.title}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-caption1)",
                    color: "var(--text-secondary)",
                    lineHeight: "var(--leading-relaxed)",
                    marginTop: 2,
                  }}
                >
                  {check.description}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {onCheckAction && (
                    <button
                      onClick={() => onCheckAction(check)}
                      className="btn-ghost focus-ring"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Zap size={10} />
                      How to fix
                    </button>
                  )}
                  {check.affectedFiles && check.affectedFiles.length > 0 && onViewFile && (
                    <button
                      onClick={() => onViewFile(check.affectedFiles![0])}
                      className="btn-ghost focus-ring"
                      style={{
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View
                    </button>
                  )}
                  {isIndexCheck && onReindex && (
                    <button
                      onClick={onReindex}
                      className="btn-ghost focus-ring"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <RotateCw size={10} />
                      Reindex now
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Overview: Stale Daily Logs Card ───────────────────────── */

function StaleDailyLogsCard({ health }: { health: MemoryHealthSummary }) {
  const logs = health.staleDailyLogs;
  if (logs.length === 0) return null;

  const totalSize = logs.reduce((s, l) => s + l.sizeBytes, 0);

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Stale Daily Logs ({logs.length})
      </div>
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-3)",
          lineHeight: "var(--leading-relaxed)",
        }}
      >
        {logs.length} daily log{logs.length !== 1 ? "s" : ""} older than 30 days ({formatBytes(totalSize)} total).
        Review for patterns worth promoting to evergreen files, then delete the rest.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {logs.slice(0, 10).map((log) => (
          <div
            key={log.relativePath}
            className="flex items-center justify-between"
            style={{
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-caption2)",
            }}
          >
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              {log.date}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {log.ageDays}d {"\u00b7"} {formatBytes(log.sizeBytes)}
            </span>
          </div>
        ))}
        {logs.length > 10 && (
          <div
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--text-tertiary)",
              padding: "var(--space-1) var(--space-2)",
            }}
          >
            +{logs.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Browser: Health Badge ─────────────────────────────────── */

const HEALTH_BADGE_COLORS: Record<HealthSeverity, string | null> = {
  critical: "var(--system-red)",
  warning: "var(--system-orange)",
  info: "var(--text-tertiary)",
  ok: null,
};

function HealthBadge({ severity }: { severity: HealthSeverity }) {
  const color = HEALTH_BADGE_COLORS[severity];
  if (!color) return null;

  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
      title={`Health: ${severity}`}
    />
  );
}

/* ─── Browser: Reindex Button ───────────────────────────────── */

function ReindexButton({
  status,
  onReindex,
}: {
  status: ReindexStatus;
  onReindex: () => void;
}) {
  if (status === "unavailable") return null;

  const isRunning = status === "running";
  const isSuccess = status === "success";

  return (
    <button
      onClick={onReindex}
      disabled={isRunning}
      className="btn-ghost focus-ring"
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--text-caption1)",
        fontWeight: "var(--weight-medium)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: isSuccess ? "var(--system-green)" : undefined,
        cursor: isRunning ? "not-allowed" : "pointer",
        opacity: isRunning ? 0.6 : 1,
      }}
    >
      <RotateCw
        size={14}
        style={{
          animation: isRunning ? "spin 1s linear infinite" : undefined,
        }}
      />
      {isRunning ? "Reindexing..." : isSuccess ? "Done" : "Reindex"}
    </button>
  );
}

/* ─── Browser: Editing Hints Panel ──────────────────────────── */

const HINT_BORDER_COLORS: Record<EditingHint["severity"], string> = {
  warning: "var(--system-orange)",
  tip: "var(--text-tertiary)",
};

function EditingHintsPanel({ hints }: { hints: EditingHint[] }) {
  if (hints.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {hints.map((hint) => (
        <div
          key={hint.id}
          style={{
            borderLeft: `3px solid ${HINT_BORDER_COLORS[hint.severity]}`,
            paddingLeft: "var(--space-3)",
            paddingTop: "var(--space-1)",
            paddingBottom: "var(--space-1)",
            fontSize: "var(--text-caption1)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {hint.text}
        </div>
      ))}
    </div>
  );
}

/* ─── Library Sync Panel ─────────────────────────────────────── */

const SYNC_SCHEDULES = [
  { label: "Nightly at 2 AM", value: "0 2 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Hourly", value: "0 * * * *" },
];

function LibrarySyncPanel({
  config,
  saving,
  syncing,
  syncResult,
  error,
  onSave,
  onSync,
}: {
  config: LibraryConfig;
  saving: boolean;
  syncing: boolean;
  syncResult: LibrarySyncResult | null;
  error: string | null;
  onSave: (config: LibraryConfig) => Promise<void>;
  onSync: () => Promise<void>;
}) {
  const [form, setForm] = useState<LibraryConfig>(config);

  const set = <K extends keyof LibraryConfig>(key: K, value: LibraryConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--text-footnote)",
    fontWeight: "var(--weight-medium)",
    color: "var(--text-secondary)",
    marginBottom: "var(--space-1)",
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg-input, var(--material-regular))",
    border: "1px solid var(--separator)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: "var(--text-footnote)",
    outline: "none",
    boxSizing: "border-box",
  };

  const fieldStyle: React.CSSProperties = { marginBottom: "var(--space-3)" };

  return (
    <div style={{ maxWidth: 580 }}>
      <div
        style={{
          fontSize: "var(--text-body)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
          marginBottom: "var(--space-4)",
        }}
      >
        Library Sync
      </div>

      {/* Enable toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <input
          id="lib-enabled"
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        <label
          htmlFor="lib-enabled"
          style={{
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-medium)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          Enable library sync
        </label>
      </div>

      {/* Source selector */}
      <div style={fieldStyle}>
        <span style={labelStyle}>Source</span>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {(["google_drive", "onedrive"] as LibrarySyncSource[]).map((src) => (
            <button
              key={src}
              onClick={() => set("source", src)}
              className="focus-ring"
              style={{
                padding: "6px 14px",
                fontSize: "var(--text-footnote)",
                fontWeight:
                  form.source === src
                    ? "var(--weight-semibold)"
                    : "var(--weight-medium)",
                border: "1px solid var(--separator)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                background:
                  form.source === src
                    ? "var(--accent-fill)"
                    : "var(--material-regular)",
                color:
                  form.source === src
                    ? "var(--accent)"
                    : "var(--text-secondary)",
              }}
            >
              {src === "google_drive" ? "Google Drive" : "OneDrive"}
            </button>
          ))}
        </div>
      </div>

      {/* Google Drive fields */}
      {form.source === "google_drive" && (
        <div style={fieldStyle}>
          <label htmlFor="lib-drive-url" style={labelStyle}>
            Drive Folder URL
          </label>
          <input
            id="lib-drive-url"
            type="text"
            value={form.folderUrl}
            onChange={(e) => set("folderUrl", e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            style={inputStyle}
          />
        </div>
      )}

      {/* OneDrive fields */}
      {form.source === "onedrive" && (
        <>
          <div style={fieldStyle}>
            <label htmlFor="lib-od-tenant" style={labelStyle}>
              Tenant ID
            </label>
            <input
              id="lib-od-tenant"
              type="text"
              value={form.onedriveTenantId}
              onChange={(e) => set("onedriveTenantId", e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="lib-od-client" style={labelStyle}>
              Client ID
            </label>
            <input
              id="lib-od-client"
              type="text"
              value={form.onedriveClientId}
              onChange={(e) => set("onedriveClientId", e.target.value)}
              placeholder="App (client) ID"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="lib-od-secret" style={labelStyle}>
              Client Secret
            </label>
            <input
              id="lib-od-secret"
              type="password"
              value={form.onedriveClientSecret}
              onChange={(e) => set("onedriveClientSecret", e.target.value)}
              placeholder="Client secret value"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="lib-od-folder" style={labelStyle}>
              Folder URL or Item ID
            </label>
            <input
              id="lib-od-folder"
              type="text"
              value={form.onedriveFolderUrl}
              onChange={(e) => set("onedriveFolderUrl", e.target.value)}
              placeholder="OneDrive folder URL or item ID"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {/* Schedule */}
      <div style={fieldStyle}>
        <label htmlFor="lib-schedule" style={labelStyle}>
          Sync Schedule
        </label>
        <select
          id="lib-schedule"
          value={form.syncSchedule}
          onChange={(e) => set("syncSchedule", e.target.value)}
          style={inputStyle}
        >
          {SYNC_SCHEDULES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginTop: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="focus-ring"
          style={{
            padding: "8px 18px",
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-medium)",
            border: "1px solid var(--separator)",
            borderRadius: "var(--radius-sm)",
            cursor: saving ? "default" : "pointer",
            background: "var(--material-regular)",
            color: saving ? "var(--text-tertiary)" : "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {saving ? (
            <>
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
              Saving…
            </>
          ) : (
            <>
              <Check size={13} />
              Save Config
            </>
          )}
        </button>

        <button
          onClick={onSync}
          disabled={syncing || !form.enabled}
          className="focus-ring"
          style={{
            padding: "8px 18px",
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-medium)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: syncing || !form.enabled ? "default" : "pointer",
            background:
              syncing || !form.enabled
                ? "var(--accent-fill)"
                : "var(--accent)",
            color:
              syncing || !form.enabled ? "var(--accent)" : "var(--bg)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {syncing ? (
            <>
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
              Syncing…
            </>
          ) : (
            <>
              <RefreshCw size={13} />
              Sync Now
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "var(--space-3)",
            padding: "10px 12px",
            background: "var(--system-red-fill, rgba(255,59,48,0.1))",
            border: "1px solid var(--system-red, #ff3b30)",
            borderRadius: "var(--radius-sm)",
            color: "var(--system-red, #ff3b30)",
            fontSize: "var(--text-footnote)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Last sync result */}
      {syncResult && (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "12px 14px",
            background: syncResult.ok
              ? "var(--system-green-fill, rgba(52,199,89,0.1))"
              : "var(--system-red-fill, rgba(255,59,48,0.1))",
            border: `1px solid ${syncResult.ok ? "var(--system-green, #34c759)" : "var(--system-red, #ff3b30)"}`,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-footnote)",
              fontWeight: "var(--weight-semibold)",
              color: syncResult.ok
                ? "var(--system-green, #34c759)"
                : "var(--system-red, #ff3b30)",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {syncResult.ok ? <Check size={13} /> : <AlertCircle size={13} />}
            {syncResult.ok ? "Sync complete" : "Sync failed"}
            {syncResult.syncedAt > 0 && (
              <span
                style={{
                  fontWeight: "var(--weight-regular)",
                  color: "var(--text-tertiary)",
                  marginLeft: 4,
                }}
              >
                {new Date(syncResult.syncedAt).toLocaleString()}
              </span>
            )}
          </div>
          {syncResult.ok && (
            <div
              style={{
                fontSize: "var(--text-caption1)",
                color: "var(--text-secondary)",
                display: "flex",
                gap: "var(--space-3)",
              }}
            >
              <span>{syncResult.total} total</span>
              <span style={{ color: "var(--system-green, #34c759)" }}>
                +{syncResult.added} added
              </span>
              <span style={{ color: "var(--system-blue, #007aff)" }}>
                ~{syncResult.updated} updated
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>
                −{syncResult.removed} removed
              </span>
            </div>
          )}
          {!syncResult.ok && syncResult.error && (
            <div
              style={{
                fontSize: "var(--text-caption1)",
                color: "var(--system-red, #ff3b30)",
              }}
            >
              {syncResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFileInfo[]>([]);
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [selected, setSelected] = useState<MemoryFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [copied, setCopied] = useState(false);
  const [mobileShowContent, setMobileShowContent] = useState(false);

  // Library sync state
  const [libConfig, setLibConfig] = useState<LibraryConfig | null>(null);
  const [libConfigLoading, setLibConfigLoading] = useState(false);
  const [libSaving, setLibSaving] = useState(false);
  const [libSyncing, setLibSyncing] = useState(false);
  const [libSyncResult, setLibSyncResult] = useState<LibrarySyncResult | null>(null);
  const [libError, setLibError] = useState<string | null>(null);

  // Health & hints state
  const [health, setHealth] = useState<MemoryHealthSummary | null>(null);
  const [reindexStatus, setReindexStatus] = useState<ReindexStatus>("idle");
  const [editingHints, setEditingHints] = useState<EditingHint[]>([]);
  const [showReindex, setShowReindex] = useState(false);

  // Editing state
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<MemoryFileInfo | null>(null);

  // AI Memory Advisor state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisStreaming, setAnalysisStreaming] = useState(false);
  const [analysisContent, setAnalysisContent] = useState("");
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatMessages, setChatMessages] = useState<HealthChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  const isEditing = editingContent !== null;
  const isDirty = editingContent !== null && editingContent !== selected?.content;

  const rootAgent = useMemo(
    () => agents.find((a) => a.reportsTo === null) || agents[0] || null,
    [agents],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/memory")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load memory files");
        return r.json();
      })
      .then((data: MemoryApiResponse | MemoryFileInfo[]) => {
        // Backward compat: handle old array response or new object response
        if (Array.isArray(data)) {
          const mapped: MemoryFileInfo[] = data.map((f) => ({
            ...f,
            relativePath: f.path.split("/").slice(-2).join("/"),
            sizeBytes: new Blob([f.content]).size,
            category: "evergreen" as const,
          }));
          setFiles(mapped);
          setConfig(null);
          setStatus(null);
          setStats(null);
          setHealth(null);
        } else {
          setFiles(data.files);
          setConfig(data.config);
          setStatus(data.status);
          setStats(data.stats);
          setHealth(data.health);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch agents for AI advisor
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => {});
  }, []);

  // Auto-select first file when switching to browser tab with no selection
  useEffect(() => {
    if (tab === "browser" && !selected && files.length > 0) {
      setSelected(files[0]);
    }
  }, [tab, selected, files]);

  /* Debounced editing hints */
  useEffect(() => {
    if (!isEditing || !selected || editingContent === null) {
      setEditingHints([]);
      return;
    }

    const timer = setTimeout(() => {
      setEditingHints(computeEditingHints(selected, editingContent, config));
    }, 500);

    return () => clearTimeout(timer);
  }, [editingContent, selected, config, isEditing]);

  /* Reset showReindex on file switch or entering edit mode */
  useEffect(() => {
    setShowReindex(false);
  }, [selected, isEditing]);

  // Load library config when sync tab is opened
  useEffect(() => {
    if (tab !== "sync" || libConfig !== null) return;
    setLibConfigLoading(true);
    fetch("/api/library/config")
      .then((r) => r.json())
      .then((data: LibraryConfig) => setLibConfig(data))
      .catch(() => setLibError("Failed to load library config"))
      .finally(() => setLibConfigLoading(false));
  }, [tab, libConfig]);

  /* Reindex handler */
  async function handleReindex() {
    setReindexStatus("running");
    try {
      const res = await fetch("/api/memory/reindex", { method: "POST" });
      const data = await res.json();
      if (res.status === 503) {
        setReindexStatus("unavailable");
      } else if (data.status === "success") {
        setReindexStatus("success");
        // Refresh data to pick up new index status
        setTimeout(() => refresh(), 1000);
      } else {
        setReindexStatus("failed");
      }
    } catch {
      setReindexStatus("failed");
    }
  }

  /* ─── AI Memory Advisor callbacks ─────────────────────────── */

  const runAnalysis = useCallback(async () => {
    if (!rootAgent || analysisStreaming || !config || !status || !stats || !health) return;
    setAnalysisOpen(true);
    setAnalysisStreaming(true);
    setAnalysisContent("");
    setChatMessages([]);

    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health);

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.content) {
                fullContent += chunk.content;
                setAnalysisContent(fullContent);
              }
            } catch {
              /* skip */
            }
          }
        }
      }
    } catch {
      setAnalysisContent(
        (prev) => prev + "\n\n[Error: Failed to connect to agent]",
      );
    } finally {
      setAnalysisStreaming(false);
    }
  }, [rootAgent, analysisStreaming, files, config, status, stats, health]);

  const sendChatMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? chatInput).trim();
      if (!text || chatStreaming || !rootAgent || !config || !status || !stats || !health) return;
      if (!overrideText) setChatInput("");

      const userMsg: HealthChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
      };
      const assistantMsgId = generateId();
      const assistantMsg: HealthChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      setChatStreaming(true);

      const prompt = buildMemoryHealthPrompt(files, config, status, stats, health);
      const allMessages = [...chatMessages, userMsg];
      const apiMessages = [
        { role: "user" as const, content: prompt },
        ...(analysisContent
          ? [{ role: "assistant" as const, content: analysisContent }]
          : []),
        ...allMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      try {
        const res = await fetch(`/api/chat/${rootAgent.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });
        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const chunk = JSON.parse(line.slice(6));
                if (chunk.content) {
                  fullContent += chunk.content;
                  const captured = fullContent;
                  setChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: captured, isStreaming: true }
                        : m,
                    ),
                  );
                }
              } catch {
                /* skip */
              }
            }
          }
        }

        const finalContent = fullContent;
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: finalContent, isStreaming: false }
              : m,
          ),
        );
      } catch {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "Error getting response. Check API connection.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } finally {
        setChatStreaming(false);
        chatTextareaRef.current?.focus();
      }
    },
    [chatInput, chatStreaming, rootAgent, chatMessages, analysisContent, files, config, status, stats, health],
  );

  const handleCheckAction = useCallback(
    (check: MemoryHealthCheck) => {
      if (!analysisOpen) setAnalysisOpen(true);
      const prompt = buildCheckFixPrompt(check, files);
      if (!analysisContent && !analysisStreaming) {
        runAnalysis();
        return;
      }
      sendChatMessage(prompt);
    },
    [analysisOpen, analysisContent, analysisStreaming, runAnalysis, sendChatMessage, files],
  );

  const handleViewFile = useCallback(
    (relativePath: string) => {
      const file = files.find((f) => f.relativePath === relativePath);
      if (file) {
        setSelected(file);
        setTab("browser");
      }
    },
    [files],
  );

  /* Content match count for search badges */
  function contentMatchCount(content: string, query: string): number {
    if (!query) return 0;
    const q = query.toLowerCase();
    const text = content.toLowerCase();
    let count = 0;
    let idx = 0;
    while ((idx = text.indexOf(q, idx)) !== -1) {
      count++;
      idx += q.length;
    }
    return count;
  }

  /* Sorted + filtered files */
  const q = search.toLowerCase();
  const sortedFiles = [...files]
    .filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.relativePath.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      // date: most recent first
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

  /* Keyboard navigation in file list */
  function handleListKeyDown(e: React.KeyboardEvent) {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]'
    );
    if (!items || items.length === 0) return;

    const currentIdx = Array.from(items).findIndex(
      (el) => el.getAttribute("aria-selected") === "true"
    );

    let nextIdx = currentIdx;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = Math.min(currentIdx + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = Math.max(currentIdx - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIdx >= 0) {
        items[currentIdx].click();
        setMobileShowContent(true);
      }
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }

    if (nextIdx !== currentIdx && nextIdx >= 0) {
      items[nextIdx].click();
      items[nextIdx].focus();
    }
  }

  /* Copy content */
  function copyContent() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /* Download content */
  function downloadContent() {
    if (!selected) return;
    const blob = new Blob([selected.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected.path.split("/").pop() || "file.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Select file and show content on mobile */
  function selectFile(file: MemoryFileInfo) {
    if (isDirty) {
      setPendingFile(file);
      return;
    }
    setEditingContent(null);
    setSaveError(null);
    setSelected(file);
    setMobileShowContent(true);
  }

  /* Discard edits and switch to pending file */
  function discardAndSwitch() {
    const file = pendingFile;
    setEditingContent(null);
    setSaveError(null);
    setPendingFile(null);
    if (file) {
      setSelected(file);
      setMobileShowContent(true);
    }
  }

  /* Enter edit mode */
  function startEditing() {
    if (!selected) return;
    setEditingContent(selected.content);
    setSaveError(null);
  }

  /* Cancel editing */
  function cancelEditing() {
    setEditingContent(null);
    setSaveError(null);
  }

  /* Save edited content */
  async function saveContent() {
    if (!selected || editingContent === null) return;

    // JSON validation for .json files
    if (isJsonFile(selected)) {
      try {
        JSON.parse(editingContent);
      } catch {
        setSaveError("Invalid JSON syntax");
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: selected.relativePath,
          content: editingContent,
          expectedLastModified: selected.lastModified,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        setSaveError(data.error || `Save failed (${res.status})`);
        return;
      }

      const data = await res.json();

      // Update local state with new content/metadata
      const updated: MemoryFileInfo = {
        ...selected,
        content: editingContent,
        lastModified: data.lastModified,
        sizeBytes: data.sizeBytes,
      };
      setFiles((prev) =>
        prev.map((f) => (f.path === selected.path ? updated : f))
      );
      setSelected(updated);
      setEditingContent(null);
      // Show reindex button if vector search is enabled
      if (config?.memorySearch.enabled) {
        setShowReindex(true);
        setReindexStatus("idle");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* When editing ends and there's a pending file, switch to it */
  useEffect(() => {
    if (!isEditing && pendingFile) {
      setSelected(pendingFile);
      setMobileShowContent(true);
      setPendingFile(null);
    }
  }, [isEditing, pendingFile]);

  /* Computed for selected file */
  const isJson = selected ? isJsonFile(selected) : false;
  const lineCount = selected ? selected.content.split("\n").length : 0;
  const words = selected ? wordCount(selected.content) : 0;
  const breadcrumb = selected?.relativePath.split("/") ?? [];

  /* Error state */
  if (error && files.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  /* ─── Search highlighting helper ─────────────────────────── */
  function highlightMatches(html: string, query: string): string {
    if (!query) return html;
    // Escape special regex characters in query
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    // Only highlight text outside of HTML tags
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag, text) => {
      if (tag) return tag;
      return text.replace(
        re,
        '<mark style="background:var(--accent);opacity:0.25;color:inherit;border-radius:2px;padding:0 1px">$1</mark>'
      );
    });
  }

  /* ─── Rendered content (for browser tab) ─────────────────── */
  let renderedContent: React.ReactNode = null;
  if (selected) {
    if (isJson) {
      try {
        const pretty = JSON.stringify(JSON.parse(selected.content), null, 2);
        const lines = pretty.split("\n");
        const colorized = colorizeJson(pretty);
        const highlighted = search ? highlightMatches(colorized, search) : colorized;
        renderedContent = (
          <div
            style={{
              background: "var(--code-bg)",
              border: "1px solid var(--code-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              overflow: "auto",
            }}
          >
            <div className="flex">
              <div
                className="flex-shrink-0 select-none"
                style={{
                  paddingRight: "var(--space-4)",
                  marginRight: "var(--space-4)",
                  borderRight: "1px solid var(--separator)",
                }}
              >
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className="font-mono text-right"
                    style={{
                      fontSize: "var(--text-caption2)",
                      lineHeight: "var(--leading-relaxed)",
                      color: "var(--text-tertiary)",
                      minWidth: "2.5ch",
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <pre
                className="font-mono flex-1"
                style={{
                  fontSize: "var(--text-footnote)",
                  lineHeight: "var(--leading-relaxed)",
                  color: "var(--code-text)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: highlighted,
                }}
              />
            </div>
          </div>
        );
      } catch {
        renderedContent = (
          <div
            style={{
              background: "var(--code-bg)",
              border: "1px solid var(--code-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
            }}
          >
            <pre
              className="font-mono"
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--system-red)",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {selected.content}
            </pre>
          </div>
        );
      }
    } else {
      const md = renderMarkdown(selected.content);
      const highlighted = search ? highlightMatches(md, search) : md;
      renderedContent = (
        <div
          style={{
            fontSize: "var(--text-subheadline)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--text-secondary)",
          }}
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-3" style="color:var(--text-secondary)">${highlighted}</p>`,
          }}
        />
      );
    }
  }

  /* Scroll to first match when opening a file from search */
  useEffect(() => {
    if (search && selected && contentRef.current) {
      const mark = contentRef.current.querySelector("mark");
      if (mark) {
        setTimeout(() => mark.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    }
  }, [selected, search]);

  return (
    <div
      className="h-full flex flex-col overflow-hidden animate-fade-in"
      style={{ background: "var(--bg)" }}
    >
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
        <div
          className="flex items-center justify-between"
          style={{ padding: "var(--space-4) var(--space-6)" }}
        >
          <div>
            <h1
              style={{
                fontSize: "var(--text-title1)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-primary)",
                letterSpacing: "-0.5px",
                lineHeight: "var(--leading-tight)",
              }}
            >
              Memory
            </h1>
            {!loading && stats && (
              <p
                style={{
                  fontSize: "var(--text-footnote)",
                  color: "var(--text-secondary)",
                  marginTop: "var(--space-1)",
                }}
              >
                {stats.totalFiles} file{stats.totalFiles !== 1 ? "s" : ""}
                {" \u00b7 "}
                {formatBytes(stats.totalSizeBytes)}
                {stats.dailyLogCount > 0 && (
                  <>
                    {" \u00b7 "}
                    {stats.dailyLogCount} daily log{stats.dailyLogCount !== 1 ? "s" : ""}
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh memory data"
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color 150ms var(--ease-smooth)",
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Tab navigation ─────────────────────────────────── */}
        <div
          className="flex items-center"
          style={{
            padding: "0 var(--space-6) var(--space-3)",
            gap: "var(--space-1)",
          }}
        >
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="focus-ring"
                style={{
                  padding: "6px 16px",
                  fontSize: "var(--text-footnote)",
                  fontWeight: isActive
                    ? "var(--weight-semibold)"
                    : "var(--weight-medium)",
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
                <t.Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div
            style={{
              padding: "var(--space-4) var(--space-6) var(--space-6)",
              overflow: "auto",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
              className="overview-cards-grid"
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--material-regular)",
                    border: "1px solid var(--separator)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-4)",
                  }}
                >
                  <Skeleton style={{ width: 60, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 80, height: 18 }} />
                </div>
              ))}
            </div>
            <div
              style={{
                background: "var(--material-regular)",
                border: "1px solid var(--separator)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
              }}
            >
              <Skeleton style={{ width: 160, height: 10, marginBottom: 16 }} />
              <Skeleton style={{ width: "100%", height: 80 }} />
            </div>
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW TAB ─────────────────────────────── */}
            {tab === "overview" && (
              <div
                className="overflow-y-auto h-full"
                style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}
              >
                {/* Health hero */}
                {health && stats && status && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <HealthHero health={health} stats={stats} status={status} />
                  </div>
                )}

                {/* Memory Advisor */}
                {rootAgent && config && status && stats && health && (
                  <div style={{
                    background: "var(--material-regular)",
                    border: "1px solid var(--separator)",
                    borderRadius: 12,
                    marginBottom: "var(--space-4)",
                    overflow: "hidden",
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: "16px 20px",
                      display: "flex", alignItems: "center", gap: 12,
                      borderBottom: analysisOpen ? "1px solid var(--separator)" : undefined,
                    }}>
                      <Activity size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          Memory Advisor
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                          AI-powered analysis of your memory system health
                        </div>
                      </div>
                      {analysisStreaming && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 12, color: "var(--accent)", fontWeight: 500,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                            animation: "pulse 1.2s infinite",
                          }} />
                          Analyzing...
                        </span>
                      )}
                      {!analysisOpen && !analysisContent && !analysisStreaming && (
                        <button
                          onClick={() => { setAnalysisOpen(true); runAnalysis(); }}
                          className="btn-ghost focus-ring"
                          style={{
                            padding: "6px 16px", borderRadius: 8,
                            fontSize: 13, fontWeight: 600,
                            background: "var(--accent)", color: "white",
                            border: "none", cursor: "pointer",
                          }}
                        >
                          Analyze
                        </button>
                      )}
                      {(analysisOpen || analysisContent) && (
                        <button
                          onClick={() => setAnalysisOpen(!analysisOpen)}
                          className="focus-ring"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                        >
                          <ChevronDown
                            size={16}
                            style={{
                              color: "var(--text-tertiary)",
                              transform: analysisOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 200ms ease",
                            }}
                          />
                        </button>
                      )}
                    </div>

                    {analysisOpen && (
                      <div>
                        {/* Loading skeleton */}
                        {analysisStreaming && !analysisContent && (
                          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                            {[180, 240, 160, 220, 140].map((w, i) => (
                              <div key={i} style={{
                                width: w, maxWidth: "100%", height: 12, borderRadius: 4,
                                background: "var(--fill-tertiary)",
                                animation: `shimmer 1.6s ease-in-out ${i * 0.15}s infinite`,
                              }} />
                            ))}
                          </div>
                        )}

                        {/* Analysis content */}
                        {analysisContent && (
                          <div
                            className="markdown-body"
                            style={{
                              padding: "16px 20px",
                              maxHeight: 520,
                              overflowY: "auto",
                              fontSize: 14,
                              lineHeight: 1.65,
                              color: "var(--text-primary)",
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
                          />
                        )}

                        {/* Suggested actions (before first analysis) */}
                        {!analysisContent && !analysisStreaming && (
                          <div style={{ padding: "12px 20px 16px" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                              Ask about
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {[
                                "What should I fix first and why?",
                                "How do I reorganize MEMORY.md?",
                                "Walk me through cleaning up old daily logs",
                                "Is my memory system set up correctly?",
                              ].map((q) => (
                                <button
                                  key={q}
                                  onClick={() => { setAnalysisOpen(true); runAnalysis(); }}
                                  className="btn-ghost focus-ring"
                                  style={{
                                    padding: "5px 12px", borderRadius: 14,
                                    fontSize: 12, fontWeight: 500,
                                    background: "var(--fill-secondary)",
                                    border: "1px solid var(--separator)",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inline chat (after analysis complete) */}
                        {analysisContent && !analysisStreaming && (
                          <>
                            <div style={{ height: 1, background: "var(--separator)" }} />

                            {/* Chat messages */}
                            {chatMessages.length > 0 && (
                              <div style={{ maxHeight: 320, overflowY: "auto", padding: "12px 20px" }}>
                                {chatMessages.map((msg) => (
                                  <div key={msg.id} style={{
                                    marginBottom: 12,
                                    display: "flex",
                                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                  }}>
                                    <div style={{
                                      maxWidth: "85%",
                                      padding: "8px 14px",
                                      borderRadius: 12,
                                      fontSize: 14,
                                      lineHeight: 1.55,
                                      ...(msg.role === "user" ? {
                                        background: "var(--accent)",
                                        color: "white",
                                      } : {
                                        background: "var(--fill-secondary)",
                                        color: "var(--text-primary)",
                                      }),
                                    }}>
                                      {msg.role === "assistant" ? (
                                        <div
                                          className="markdown-body"
                                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "...") }}
                                        />
                                      ) : (
                                        msg.content
                                      )}
                                      {msg.isStreaming && (
                                        <span style={{
                                          display: "inline-block", width: 6, height: 14,
                                          background: "var(--text-tertiary)", borderRadius: 1,
                                          marginLeft: 2, animation: "blink 1s step-end infinite",
                                        }} />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Follow-up suggestions */}
                            {chatMessages.length === 0 && (
                              <div style={{ padding: "8px 20px 4px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {[
                                  "Show me the specific changes to make",
                                  "What's the impact of not fixing this?",
                                  "Help me write the new topic files",
                                ].map((q) => (
                                  <button
                                    key={q}
                                    onClick={() => sendChatMessage(q)}
                                    className="btn-ghost focus-ring"
                                    style={{
                                      padding: "4px 10px", borderRadius: 12,
                                      fontSize: 11, fontWeight: 500,
                                      background: "var(--fill-secondary)",
                                      border: "1px solid var(--separator)",
                                      color: "var(--text-secondary)",
                                      cursor: "pointer", whiteSpace: "nowrap",
                                    }}
                                  >
                                    {q}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Chat input */}
                            <div style={{
                              display: "flex", alignItems: "flex-end", gap: 8,
                              padding: "10px 20px 16px",
                            }}>
                              <textarea
                                ref={chatTextareaRef}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendChatMessage();
                                  }
                                }}
                                placeholder="Ask a follow-up..."
                                disabled={chatStreaming}
                                rows={1}
                                style={{
                                  flex: 1, resize: "none",
                                  background: "var(--fill-tertiary)",
                                  border: "1px solid var(--separator)",
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  fontSize: 13,
                                  color: "var(--text-primary)",
                                  outline: "none",
                                  lineHeight: 1.4,
                                  fontFamily: "inherit",
                                }}
                              />
                              <button
                                onClick={() => sendChatMessage()}
                                disabled={chatStreaming || !chatInput.trim()}
                                className="btn-ghost focus-ring"
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  background: "var(--accent)",
                                  color: "white",
                                  border: "none",
                                  cursor: chatStreaming || !chatInput.trim() ? "not-allowed" : "pointer",
                                  opacity: chatStreaming || !chatInput.trim() ? 0.5 : 1,
                                }}
                              >
                                Send
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Health checks */}
                {health && health.checks.length > 0 && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <HealthChecksList
                      checks={health.checks}
                      onCheckAction={rootAgent ? handleCheckAction : undefined}
                      onViewFile={handleViewFile}
                      onReindex={handleReindex}
                    />
                  </div>
                )}

                {/* Timeline */}
                {stats && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <MemoryTimeline timeline={stats.dailyTimeline} />
                  </div>
                )}

                {/* Config */}
                {config && <ConfigPanel config={config} />}
              </div>
            )}

            {/* ─── BROWSER TAB ──────────────────────────────── */}
            {tab === "browser" && (
              <div className="flex h-full" style={{ background: "var(--bg)" }}>
                {/* File list sidebar */}
                <aside
                  className={`browser-sidebar flex-shrink-0 flex flex-col ${
                    mobileShowContent && selected ? "hidden md:flex" : "flex"
                  }`}
                  style={{
                    width: "100%",
                    background: "var(--material-regular)",
                    backdropFilter: "var(--sidebar-backdrop)",
                    WebkitBackdropFilter: "var(--sidebar-backdrop)",
                    borderRight: "1px solid var(--separator)",
                  }}
                >
                  <style>{`@media (min-width: 768px) { .browser-sidebar { width: 280px !important; min-width: 280px !important; } }`}</style>

                  {/* Search + sort */}
                  <div
                    className="browser-sidebar"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      borderBottom: "1px solid var(--separator)",
                    }}
                  >
                    <input
                      ref={searchRef}
                      type="search"
                      placeholder="Search files..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="apple-input focus-ring"
                      aria-label="Search memory files"
                      style={{
                        width: "100%",
                        height: 32,
                        fontSize: "var(--text-footnote)",
                        padding: "0 var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "var(--space-2)",
                      }}
                    />
                    <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
                      {(["date", "name", "size"] as SortKey[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSort(s)}
                          className="focus-ring"
                          style={{
                            padding: "2px 8px",
                            fontSize: "var(--text-caption2)",
                            fontWeight:
                              sort === s
                                ? "var(--weight-semibold)"
                                : "var(--weight-medium)",
                            border: "none",
                            borderRadius: 10,
                            cursor: "pointer",
                            background:
                              sort === s
                                ? "var(--accent-fill)"
                                : "var(--fill-secondary)",
                            color:
                              sort === s
                                ? "var(--accent)"
                                : "var(--text-tertiary)",
                            textTransform: "capitalize",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* File list */}
                  <div
                    ref={listRef}
                    role="listbox"
                    aria-label="Memory files"
                    onKeyDown={handleListKeyDown}
                    className="flex-1 overflow-y-auto browser-sidebar"
                  >
                    {sortedFiles.length === 0 ? (
                      <div
                        className="flex items-center justify-center"
                        style={{
                          height: 120,
                          fontSize: "var(--text-footnote)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        No files match
                      </div>
                    ) : (
                      sortedFiles.map((file) => {
                        const isActive = selected?.path === file.path;
                        const json = isJsonFile(file);
                        const matches = search ? contentMatchCount(file.content, search) : 0;
                        const nameMatch = search
                          ? file.label.toLowerCase().includes(q) || file.relativePath.toLowerCase().includes(q)
                          : true;
                        return (
                          <button
                            key={file.path}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => selectFile(file)}
                            className="w-full text-left hover-bg focus-ring"
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "var(--space-2)",
                              padding: "var(--space-3) var(--space-3)",
                              border: "none",
                              cursor: "pointer",
                              background: isActive
                                ? "var(--fill-secondary)"
                                : "transparent",
                              borderLeft: isActive
                                ? "3px solid var(--accent)"
                                : "3px solid transparent",
                            }}
                          >
                            <FileIcon isJson={json} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                                <span
                                  className="truncate"
                                  style={{
                                    fontSize: "var(--text-footnote)",
                                    fontWeight: "var(--weight-semibold)",
                                    color: "var(--text-primary)",
                                    lineHeight: "var(--leading-snug)",
                                  }}
                                >
                                  {file.label}
                                </span>
                                <CategoryBadge category={file.category} />
                                {health && (
                                  <HealthBadge
                                    severity={fileHealthSeverity(file, health.checks)}
                                  />
                                )}
                              </div>
                              <div
                                className="flex items-center justify-between"
                                style={{ marginTop: 2 }}
                              >
                                <span
                                  style={{
                                    fontSize: "var(--text-caption2)",
                                    color: "var(--text-tertiary)",
                                  }}
                                >
                                  {formatBytes(file.sizeBytes)} {"\u00b7"}{" "}
                                  {timeAgo(file.lastModified)}
                                </span>
                                {search && matches > 0 && !nameMatch && (
                                  <span
                                    style={{
                                      fontSize: "var(--text-caption2)",
                                      color: "var(--text-tertiary)",
                                      flexShrink: 0,
                                      marginLeft: "var(--space-2)",
                                    }}
                                  >
                                    {matches} match{matches !== 1 ? "es" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </aside>

                {/* Content view */}
                <main
                  className={`flex-1 flex flex-col overflow-hidden ${
                    !mobileShowContent || !selected ? "hidden md:flex" : "flex"
                  }`}
                  style={{ background: "var(--bg)" }}
                >
                  {selected ? (
                    <>
                      {/* Content header */}
                      <div
                        className="flex-shrink-0"
                        style={{
                          padding: "var(--space-3) var(--space-6)",
                          borderBottom: "1px solid var(--separator)",
                          background: "var(--material-regular)",
                          backdropFilter: "blur(20px)",
                          WebkitBackdropFilter: "blur(20px)",
                        }}
                      >
                        {/* Mobile back button */}
                        <button
                          onClick={() => setMobileShowContent(false)}
                          className="md:hidden btn-ghost focus-ring"
                          aria-label="Back to file list"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                            padding: "4px 8px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "var(--text-footnote)",
                            color: "var(--system-blue)",
                            marginBottom: "var(--space-2)",
                            marginLeft: "-8px",
                          }}
                        >
                          <BackArrow />
                          Files
                        </button>

                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            {/* Breadcrumb + category */}
                            <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                              <span
                                className="truncate"
                                style={{
                                  fontSize: "var(--text-footnote)",
                                  fontWeight: "var(--weight-semibold)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {breadcrumb.map((part, i) => (
                                  <span key={i}>
                                    {i > 0 && (
                                      <span
                                        style={{
                                          color: "var(--text-tertiary)",
                                          margin: "0 4px",
                                        }}
                                      >
                                        /
                                      </span>
                                    )}
                                    <span
                                      style={{
                                        color:
                                          i === breadcrumb.length - 1
                                            ? "var(--text-primary)"
                                            : "var(--text-tertiary)",
                                      }}
                                    >
                                      {part}
                                    </span>
                                  </span>
                                ))}
                              </span>
                              <CategoryBadge category={selected.category} />
                              {isDirty && (
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "var(--system-orange)",
                                    flexShrink: 0,
                                  }}
                                  title="Unsaved changes"
                                />
                              )}
                            </div>

                            {/* Metadata */}
                            <div
                              style={{
                                fontSize: "var(--text-caption2)",
                                color: "var(--text-tertiary)",
                                marginTop: 2,
                              }}
                            >
                              {lineCount} line{lineCount !== 1 ? "s" : ""}
                              {!isJson && (
                                <>
                                  {" "}
                                  {"\u00b7"} {words.toLocaleString()} words
                                </>
                              )}
                              {" \u00b7 "}
                              {formatBytes(selected.sizeBytes)}
                              {" \u00b7 "}
                              {timeAgo(selected.lastModified)}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div
                            className="flex items-center flex-shrink-0"
                            style={{ gap: "var(--space-2)" }}
                          >
                            {isEditing ? (
                              <>
                                <button
                                  onClick={cancelEditing}
                                  className="btn-ghost focus-ring"
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "var(--text-caption1)",
                                    fontWeight: "var(--weight-medium)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <X size={14} />
                                  Cancel
                                </button>
                                <button
                                  onClick={saveContent}
                                  disabled={saving || !isDirty}
                                  className="focus-ring"
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "var(--text-caption1)",
                                    fontWeight: "var(--weight-medium)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "var(--accent)",
                                    color: "white",
                                    border: "none",
                                    cursor: saving || !isDirty ? "not-allowed" : "pointer",
                                    opacity: saving || !isDirty ? 0.5 : 1,
                                  }}
                                >
                                  <Save size={14} />
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={copyContent}
                                  className="btn-ghost focus-ring"
                                  aria-label="Copy file content"
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "var(--text-caption1)",
                                    fontWeight: "var(--weight-medium)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  {copied ? <Check size={14} /> : <Copy size={14} />}
                                  {copied ? "Copied" : "Copy"}
                                </button>
                                <button
                                  onClick={downloadContent}
                                  className="btn-ghost focus-ring"
                                  aria-label="Download file"
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "var(--text-caption1)",
                                    fontWeight: "var(--weight-medium)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Download size={14} />
                                  Download
                                </button>
                                <button
                                  onClick={startEditing}
                                  className="btn-ghost focus-ring"
                                  aria-label="Edit file"
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "var(--text-caption1)",
                                    fontWeight: "var(--weight-medium)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                {showReindex && (
                                  <ReindexButton
                                    status={reindexStatus}
                                    onReindex={handleReindex}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Unsaved changes prompt when switching files */}
                      {pendingFile && (
                        <div
                          style={{
                            padding: "var(--space-2) var(--space-6)",
                            background: "var(--system-orange)",
                            color: "white",
                            fontSize: "var(--text-caption1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "var(--space-2)",
                          }}
                        >
                          <span>Unsaved changes</span>
                          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                            <button
                              onClick={saveContent}
                              disabled={saving}
                              style={{
                                padding: "2px 8px",
                                borderRadius: "var(--radius-sm)",
                                background: "rgba(255,255,255,0.2)",
                                color: "white",
                                border: "none",
                                fontSize: "var(--text-caption1)",
                                cursor: "pointer",
                              }}
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={discardAndSwitch}
                              style={{
                                padding: "2px 8px",
                                borderRadius: "var(--radius-sm)",
                                background: "rgba(255,255,255,0.2)",
                                color: "white",
                                border: "none",
                                fontSize: "var(--text-caption1)",
                                cursor: "pointer",
                              }}
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Scrollable content area */}
                      <div
                        ref={contentRef}
                        className="flex-1 overflow-y-auto"
                        style={{
                          padding: "var(--space-8) var(--space-10)",
                        }}
                      >
                        <div style={{ maxWidth: 760, margin: "0 auto" }}>
                          {isEditing ? (
                            <>
                              <textarea
                                value={editingContent ?? ""}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="font-mono"
                                style={{
                                  width: "100%",
                                  minHeight: 400,
                                  resize: "vertical",
                                  background: "var(--code-bg)",
                                  color: "var(--code-text)",
                                  border: "1px solid var(--code-border)",
                                  borderRadius: "var(--radius-md)",
                                  padding: "var(--space-4)",
                                  fontSize: "var(--text-footnote)",
                                  lineHeight: "var(--leading-relaxed)",
                                  outline: "none",
                                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                                }}
                              />
                              {saveError && (
                                <div
                                  style={{
                                    marginTop: "var(--space-2)",
                                    padding: "var(--space-2) var(--space-3)",
                                    borderRadius: "var(--radius-sm)",
                                    background: "var(--system-red)",
                                    color: "white",
                                    fontSize: "var(--text-caption1)",
                                  }}
                                >
                                  {saveError}
                                </div>
                              )}
                              <EditingHintsPanel hints={editingHints} />
                            </>
                          ) : (
                            renderedContent
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Empty state */
                    <div
                      className="flex flex-col items-center justify-center h-full"
                      style={{ gap: "var(--space-3)" }}
                    >
                      <FolderIcon />
                      <span
                        style={{
                          fontSize: "var(--text-subheadline)",
                          fontWeight: "var(--weight-medium)",
                          color: "var(--text-secondary)",
                          marginTop: "var(--space-2)",
                        }}
                      >
                        Select a file
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-footnote)",
                          color: "var(--text-tertiary)",
                          textAlign: "center",
                          maxWidth: 240,
                        }}
                      >
                        Choose a file from the sidebar to view its contents
                      </span>
                    </div>
                  )}
                </main>
              </div>
            )}

            {/* ─── GUIDE TAB ────────────────────────────────── */}
            {tab === "guide" && (
              <div
                className="overflow-y-auto h-full"
                style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}
              >
                {/* Best practices -- lead section */}
                <BestPractices />

                {/* Config visualizers */}
                {config && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "var(--space-3)",
                      marginTop: "var(--space-4)",
                    }}
                    className="guide-config-grid"
                  >
                    <DecayVisualizer config={config} />
                    <HybridBalanceBar config={config} />
                    <FlushSection config={config} />
                    <FileReference />
                  </div>
                )}
                {!config && (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <FileReference />
                  </div>
                )}
              </div>
            )}

            {/* ─── LIBRARY SYNC TAB ─────────────────────────── */}
            {tab === "sync" && (
              <div
                className="overflow-y-auto h-full"
                style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}
              >
                {libConfigLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <Skeleton style={{ width: 200, height: 14 }} />
                    <Skeleton style={{ width: "100%", height: 48 }} />
                    <Skeleton style={{ width: "100%", height: 48 }} />
                    <Skeleton style={{ width: 160, height: 36 }} />
                  </div>
                )}

                {!libConfigLoading && libConfig && (
                  <LibrarySyncPanel
                    config={libConfig}
                    saving={libSaving}
                    syncing={libSyncing}
                    syncResult={libSyncResult ?? libConfig.lastSync}
                    error={libError}
                    onSave={async (updated) => {
                      setLibSaving(true);
                      setLibError(null);
                      try {
                        const res = await fetch("/api/library/config", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(updated),
                        });
                        const saved = await res.json();
                        if (!res.ok) throw new Error(saved.error ?? "Save failed");
                        setLibConfig(saved);
                      } catch (e) {
                        setLibError(e instanceof Error ? e.message : "Save failed");
                      } finally {
                        setLibSaving(false);
                      }
                    }}
                    onSync={async () => {
                      setLibSyncing(true);
                      setLibError(null);
                      try {
                        const res = await fetch("/api/library/sync", { method: "POST" });
                        const result = await res.json();
                        if (!res.ok) throw new Error(result.error ?? "Sync failed");
                        setLibSyncResult(result);
                      } catch (e) {
                        setLibError(e instanceof Error ? e.message : "Sync failed");
                      } finally {
                        setLibSyncing(false);
                      }
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .overview-cards-grid {
            grid-template-columns: 1fr !important;
          }
          .guide-config-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          .overview-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
