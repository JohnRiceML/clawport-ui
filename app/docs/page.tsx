"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GettingStartedSection } from "@/components/docs/GettingStartedSection";
import { ArchitectureSection } from "@/components/docs/ArchitectureSection";
import { AgentsSection } from "@/components/docs/AgentsSection";
import { ApiReferenceSection } from "@/components/docs/ApiReferenceSection";
import { CronSystemSection } from "@/components/docs/CronSystemSection";
import { ThemingSection } from "@/components/docs/ThemingSection";
import { ComponentsSection } from "@/components/docs/ComponentsSection";
import { TroubleshootingSection } from "@/components/docs/TroubleshootingSection";
import { BestPracticesSection } from "@/components/docs/BestPracticesSection";
import { useSettings } from "@/app/settings-provider";

/* ─── Section Definitions ──────────────────────────────────────── */

interface DocSectionDef {
  id: string;
  label: string;
  emoji: string;
  description: string;
  descriptionZh: string;
  component: React.ComponentType;
}

const SECTIONS: DocSectionDef[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    emoji: "\u{1F680}",
    description: "Setup, prerequisites, env vars",
    descriptionZh: "安装设置、前置条件与环境变量",
    component: GettingStartedSection,
  },
  {
    id: "architecture",
    label: "Architecture",
    emoji: "\u{1F3D7}\u{FE0F}",
    description: "System overview, pipelines, data flows",
    descriptionZh: "系统概览、流水线与数据流",
    component: ArchitectureSection,
  },
  {
    id: "agents",
    label: "Agents",
    emoji: "\u{1F916}",
    description: "Registry, hierarchy, customization",
    descriptionZh: "注册表、层级关系与自定义",
    component: AgentsSection,
  },
  {
    id: "best-practices",
    label: "Best Practices",
    emoji: "\u{1F3AF}",
    description: "Hierarchy, memory, tools, naming",
    descriptionZh: "层级、记忆、工具与命名建议",
    component: BestPracticesSection,
  },
  {
    id: "api-reference",
    label: "API Reference",
    emoji: "\u{1F50C}",
    description: "All endpoints, request/response",
    descriptionZh: "全部接口、请求与响应说明",
    component: ApiReferenceSection,
  },
  {
    id: "cron-system",
    label: "Cron System",
    emoji: "\u{23F0}",
    description: "Schedules, monitoring, delivery",
    descriptionZh: "计划调度、监控与投递",
    component: CronSystemSection,
  },
  {
    id: "theming",
    label: "Theming",
    emoji: "\u{1F3A8}",
    description: "Themes, CSS properties, customization",
    descriptionZh: "主题、CSS 属性与样式定制",
    component: ThemingSection,
  },
  {
    id: "components",
    label: "Components",
    emoji: "\u{1F9E9}",
    description: "Component tree, props, patterns",
    descriptionZh: "组件结构、参数与模式",
    component: ComponentsSection,
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    emoji: "\u{1F527}",
    description: "Common issues and solutions",
    descriptionZh: "常见问题与处理办法",
    component: TroubleshootingSection,
  },
];

/* ─── Back Arrow ───────────────────────────────────────────────── */

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

/* ─── Component ────────────────────────────────────────────────── */

export default function DocsPage() {
  const { resolvedLocale } = useSettings();
  const docsUi =
    resolvedLocale === "zh-CN"
      ? {
          searchPlaceholder: "搜索章节...",
          searchAria: "搜索文档章节",
          sectionListAria: "文档章节列表",
          noSectionsMatch: "没有匹配的章节",
          backToSectionList: "返回章节列表",
          sections: "章节",
        }
      : {
          searchPlaceholder: "Search sections...",
          searchAria: "Search documentation sections",
          sectionListAria: "Documentation sections",
          noSectionsMatch: "No sections match",
          backToSectionList: "Back to section list",
          sections: "Sections",
        };
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [search, setSearch] = useState("");
  const [mobileShowContent, setMobileShowContent] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Hash routing: read on mount */
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActiveSection(hash);
      setMobileShowContent(true);
    }
  }, []);

  /* Hash routing: update on section change */
  const selectSection = useCallback((id: string) => {
    setActiveSection(id);
    setMobileShowContent(true);
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  /* Filtered sections by search */
  const filteredSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        description:
          resolvedLocale === "zh-CN" ? section.descriptionZh : section.description,
      })).filter(
        (s) =>
          s.label.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
      ),
    [resolvedLocale, search]
  );

  /* Keyboard navigation in section list */
  function handleListKeyDown(e: React.KeyboardEvent) {
    const items =
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
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

  /* Active section definition */
  const active = filteredSections.find((s) => s.id === activeSection)
    ?? SECTIONS.map((section) => ({
      ...section,
      description:
        resolvedLocale === "zh-CN" ? section.descriptionZh : section.description,
    })).find((s) => s.id === activeSection)
    ?? {
      ...SECTIONS[0],
      description:
        resolvedLocale === "zh-CN" ? SECTIONS[0].descriptionZh : SECTIONS[0].description,
    };
  const ActiveComponent = active.component;

  return (
    <div
      className="flex h-full animate-fade-in"
      style={{ background: "var(--bg)" }}
    >
      {/* ── Section list sidebar ─────────────────────────────── */}
      <aside
        className={`flex-shrink-0 flex flex-col ${
          mobileShowContent ? "hidden md:flex" : "flex"
        }`}
        style={{
          width: "100%",
          maxWidth: "100%",
          background: "var(--material-regular)",
          backdropFilter: "var(--sidebar-backdrop)",
          WebkitBackdropFilter: "var(--sidebar-backdrop)",
          borderRight: "1px solid var(--separator)",
        }}
      >
        <style>{`@media (min-width: 768px) { aside { width: 280px !important; min-width: 280px !important; } }`}</style>

        {/* Sidebar header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--separator)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
            }}
          >
            Docs
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input
            ref={searchRef}
            type="search"
            placeholder={docsUi.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input focus-ring"
            aria-label={docsUi.searchAria}
            style={{
              width: "100%",
              height: 32,
              fontSize: "var(--text-footnote)",
              padding: "0 var(--space-3)",
              borderRadius: "var(--radius-sm)",
            }}
          />
        </div>

        {/* Section list */}
        <div
          ref={listRef}
          role="listbox"
          aria-label={docsUi.sectionListAria}
          onKeyDown={handleListKeyDown}
          className="flex-1 overflow-y-auto"
        >
          {filteredSections.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{
                height: 120,
                fontSize: "var(--text-footnote)",
                color: "var(--text-tertiary)",
              }}
            >
              {docsUi.noSectionsMatch}
            </div>
          ) : (
            filteredSections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectSection(section.id)}
                  className="w-full text-left hover-bg focus-ring"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
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
                  <span
                    style={{
                      fontSize: "var(--text-body)",
                      lineHeight: "1",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {section.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        fontSize: "var(--text-footnote)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--text-primary)",
                        lineHeight: "var(--leading-snug)",
                      }}
                    >
                      {section.label}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-caption2)",
                        color: "var(--text-tertiary)",
                        marginTop: 2,
                      }}
                    >
                      {section.description}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Content view ─────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col overflow-hidden ${
          !mobileShowContent ? "hidden md:flex" : "flex"
        }`}
        style={{ background: "var(--bg)" }}
      >
        {/* Content header (sticky) */}
        <div
          className="flex-shrink-0"
          style={{
            padding: "var(--space-3) var(--space-6)",
            borderBottom: "1px solid var(--separator)",
            background: "var(--material-regular)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
          }}
        >
          {/* Mobile back button */}
          <button
            onClick={() => setMobileShowContent(false)}
            className="md:hidden btn-ghost focus-ring"
            aria-label={docsUi.backToSectionList}
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
            {docsUi.sections}
          </button>

          <div className="flex items-center gap-3">
            <span style={{ fontSize: "var(--text-title3)" }}>
              {active.emoji}
            </span>
            <div>
              <div
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--text-primary)",
                }}
              >
                {active.label}
              </div>
              <div
                style={{
                  fontSize: "var(--text-caption1)",
                  color: "var(--text-tertiary)",
                }}
              >
                {active.description}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: "var(--space-6) var(--space-10)",
          }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <ActiveComponent />
          </div>
        </div>
      </main>
    </div>
  );
}
