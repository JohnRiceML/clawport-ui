"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/app/settings-provider";
import type {
  MemoryFileInfo,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryApiResponse,
  MemoryFileCategory,
} from "@/lib/types";
import {
  RefreshCw,
  Copy,
  Check,
  Download,
  BarChart3,
  FolderOpen,
  BookOpen,
} from "lucide-react";
import { renderMarkdown, colorizeJson } from "@/lib/sanitize";
import { timeAgo } from "@/lib/cron-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";

/* ─── Types ──────────────────────────────────────────────────── */

type Tab = "overview" | "browser" | "guide";
type SortKey = "date" | "name" | "size";

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: "overview", label: "概览", Icon: BarChart3 },
  { key: "browser", label: "浏览", Icon: FolderOpen },
  { key: "guide", label: "指南", Icon: BookOpen },
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
  evergreen: "常驻",
  daily: "每日",
  other: "其他",
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
        文件
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
        {stats.evergreenCount} 常驻 {"\u00b7"} {stats.dailyLogCount} 每日
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
        大小
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
          {stats.oldestDaily} 至 {stats.newestDaily}
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
        索引
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
          {status.indexed ? "已索引" : "未索引"}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-caption2)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        {status.lastIndexed ? `最近：${timeAgo(status.lastIndexed, 'zh-CN')}` : "暂无索引数据"}
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
        每日日志时间线（30 天）
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
        配置
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
          使用 OpenClaw 默认值（未显式配置 memorySearch）
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
        <span style={{ color: "var(--text-tertiary)" }}>搜索</span>
        <span style={{ color: ms.enabled ? "var(--system-green)" : "var(--text-secondary)" }}>
          {ms.enabled ? "启用" : "禁用"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>提供方</span>
        <span style={{ color: "var(--text-secondary)" }}>{ms.provider ?? "无"}</span>

        <span style={{ color: "var(--text-tertiary)" }}>模型</span>
        <span className="font-mono" style={{ color: "var(--text-secondary)", fontSize: "var(--text-caption2)" }}>
          {ms.model ?? "无"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>混合检索</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.enabled
            ? `向量 ${ms.hybrid.vectorWeight} / 文本 ${ms.hybrid.textWeight}`
            : "禁用"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>衰减</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.temporalDecay.enabled
            ? `半衰期：${ms.hybrid.temporalDecay.halfLifeDays} 天`
            : "禁用"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>MMR</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.mmr.enabled ? `\u03bb = ${ms.hybrid.mmr.lambda}` : "禁用"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>刷写</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {mf.enabled ? `阈值：${(mf.softThresholdTokens / 1000).toFixed(0)}k tokens` : "禁用"}
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
          时间衰减曲线
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
            已禁用
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
          混合检索权重
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
            已禁用
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
            向量 {vPct.toFixed(0)}%
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
            文本 {tPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Guide: Best Practices ──────────────────────────────────── */

const BEST_PRACTICE_SECTIONS = [
  {
    title: "写入记忆",
    color: "var(--system-green)",
    tips: [
      { do: true, text: "保持 MEMORY.md 精简，放整理后的事实，不要写流水日志" },
      { do: true, text: "临时会话上下文写入每日日志（YYYY-MM-DD.md）" },
      { do: false, text: "不要把原始对话全文直接塞进记忆文件" },
      { do: true, text: "条目使用清晰标题结构，便于搜索命中" },
    ],
  },
  {
    title: "搜索与召回",
    color: "var(--system-blue)",
    tips: [
      { do: true, text: "启用混合检索，结合语义匹配与关键词匹配" },
      { do: true, text: "开启 MMR（最大边际相关性）以减少重复结果" },
      { do: true, text: "配置时间衰减，让过期的每日日志逐步降权" },
      { do: false, text: "半衰期不要设得太短，关键上下文需要保留时间" },
    ],
  },
  {
    title: "维护",
    color: "var(--system-orange)",
    tips: [
      { do: true, text: "定期复盘并清理过期的每日日志" },
      { do: true, text: "把重复出现的模式从每日日志沉淀到常驻文件" },
      { do: true, text: "开启 memory flush，在 token 上限前自动压缩上下文" },
      { do: false, text: "不要让 MEMORY.md 超过约 200 行，按主题拆分文件" },
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
                  {tip.do ? "建议" : "避免"}
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
  { path: "MEMORY.md", purpose: "长期整理后的事实", decay: "低（常驻）" },
  { path: "memory/team-memory.md", purpose: "团队共享知识", decay: "低（常驻）" },
  { path: "memory/team-intel.json", purpose: "结构化团队数据", decay: "低（常驻）" },
  { path: "memory/YYYY-MM-DD.md", purpose: "每日临时上下文", decay: "高（时效）" },
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
        文件参考
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
                路径
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
                用途
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
                衰减
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
          记忆刷写（Memory Flush）
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
          {mf.enabled ? "启用" : "禁用"}
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
        启用后，OpenClaw 会在上下文达到{" "}
        <strong style={{ color: "var(--text-primary)" }}>
          {(mf.softThresholdTokens / 1000).toFixed(0)}k tokens
        </strong>
        时把重要事实刷写到记忆文件中，从而压缩上下文，避免窗口溢出并保留关键信息。
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

/* ─── Main Component ─────────────────────────────────────────── */

export default function MemoryPage() {
  const { t } = useSettings();
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

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/memory")
      .then((r) => {
        if (!r.ok) throw new Error("加载记忆文件失败");
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
        } else {
          setFiles(data.files);
          setConfig(data.config);
          setStatus(data.status);
          setStats(data.stats);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "未知错误");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-select first file when switching to browser tab with no selection
  useEffect(() => {
    if (tab === "browser" && !selected && files.length > 0) {
      setSelected(files[0]);
    }
  }, [tab, selected, files]);

  /* Sorted + filtered files */
  const sortedFiles = [...files]
    .filter(
      (f) =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.relativePath.toLowerCase().includes(search.toLowerCase())
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
    a.download = selected.path.split("/").pop() || "文件.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Select file and show content on mobile */
  function selectFile(file: MemoryFileInfo) {
    setSelected(file);
    setMobileShowContent(true);
  }

  /* Computed for selected file */
  const isJson = selected ? isJsonFile(selected) : false;
  const lineCount = selected ? selected.content.split("\n").length : 0;
  const words = selected ? wordCount(selected.content) : 0;
  const breadcrumb = selected?.relativePath.split("/") ?? [];

  /* Error state */
  if (error && files.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  /* ─── Rendered content (for browser tab) ─────────────────── */
  let renderedContent: React.ReactNode = null;
  if (selected) {
    if (isJson) {
      try {
        const pretty = JSON.stringify(JSON.parse(selected.content), null, 2);
        const lines = pretty.split("\n");
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
                  __html: colorizeJson(pretty),
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
      renderedContent = (
        <div
          style={{
            fontSize: "var(--text-subheadline)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--text-secondary)",
          }}
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-3" style="color:var(--text-secondary)">${renderMarkdown(selected.content)}</p>`,
          }}
        />
      );
    }
  }

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
              {t("memory.title")}
            </h1>
            {!loading && stats && (
              <p
                style={{
                  fontSize: "var(--text-footnote)",
                  color: "var(--text-secondary)",
                  marginTop: "var(--space-1)",
                }}
              >
                {t("memory.filesCount", { count: stats.totalFiles })}
                {" \u00b7 "}
                {formatBytes(stats.totalSizeBytes)}
                {stats.dailyLogCount > 0 && (
                  <>
                    {" \u00b7 "}
                    {t("memory.dailyLogsCount", { count: stats.dailyLogCount })}
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="刷新记忆数据"
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
          {TABS.map((tabOption) => {
            const isActive = tab === tabOption.key;
            return (
              <button
                key={tabOption.key}
                onClick={() => setTab(tabOption.key)}
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
                <tabOption.Icon size={14} />
                {tabOption.key === "overview"
                  ? t("memory.tab.overview")
                  : tabOption.key === "browser"
                    ? t("memory.tab.browser")
                    : t("memory.tab.guide")}
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
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
            >
              {[1, 2, 3].map((i) => (
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
                {/* Stat cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "var(--space-3)",
                    marginBottom: "var(--space-4)",
                  }}
                  className="overview-cards-grid"
                >
                  <FilesCard stats={stats!} />
                  <SizeCard stats={stats!} />
                  <IndexCard status={status!} />
                </div>

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
                      placeholder={t("memory.searchFiles")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="apple-input focus-ring"
                      aria-label={t("memory.searchFiles")}
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
                          {s === "date" ? "日期" : s === "name" ? "名称" : "大小"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* File list */}
                  <div
                    ref={listRef}
                    role="listbox"
                    aria-label="记忆文件"
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
                        {t("memory.noFilesMatch")}
                      </div>
                    ) : (
                      sortedFiles.map((file) => {
                        const isActive = selected?.path === file.path;
                        const json = isJsonFile(file);
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
                              </div>
                              <div
                                style={{
                                  fontSize: "var(--text-caption2)",
                                  color: "var(--text-tertiary)",
                                  marginTop: 2,
                                }}
                              >
                                {formatBytes(file.sizeBytes)} {"\u00b7"}{" "}
                                {timeAgo(file.lastModified)}
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
                          aria-label="返回文件列表"
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
                          {t("memory.filesLabel")}
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
                            </div>

                            {/* Metadata */}
                            <div
                              style={{
                                fontSize: "var(--text-caption2)",
                                color: "var(--text-tertiary)",
                                marginTop: 2,
                              }}
                            >
                              {lineCount} 行
                              {!isJson && (
                                <>
                                  {" \u00b7 "}
                                  {words.toLocaleString()} 字
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
                            <button
                              onClick={copyContent}
                              className="btn-ghost focus-ring"
                              aria-label="复制文件内容"
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
                              {copied ? t("memory.copied") : t("memory.copy")}
                            </button>
                            <button
                              onClick={downloadContent}
                              className="btn-ghost focus-ring"
                              aria-label="下载文件"
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
                              {t("memory.download")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Scrollable content area */}
                      <div
                        className="flex-1 overflow-y-auto"
                        style={{
                          padding: "var(--space-8) var(--space-10)",
                        }}
                      >
                        <div style={{ maxWidth: 760, margin: "0 auto" }}>
                          {renderedContent}
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
                        选择一个文件
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-footnote)",
                          color: "var(--text-tertiary)",
                          textAlign: "center",
                          maxWidth: 240,
                        }}
                        >
                        从左侧列表选择文件以查看内容
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
      `}</style>
    </div>
  );
}
