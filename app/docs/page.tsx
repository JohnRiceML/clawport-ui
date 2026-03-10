"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface DocSectionDef {
  id: string
  label: string
  emoji: string
  description: string
  intro: string
  highlights: string[]
  steps?: string[]
  code?: string
}

const SECTIONS: DocSectionDef[] = [
  {
    id: "quick-start",
    label: "快速开始",
    emoji: "🚀",
    description: "安装、环境变量与首次启动",
    intro:
      "先确认 OpenClaw 网关可用，再启动 ClawPort UI。首次进入建议先跑一遍设置向导，确认智能体注册表和连接状态都正常。",
    highlights: [
      "Node.js 建议 22+",
      "确保 OPENCLAW_BIN、OPENCLAW_GATEWAY_TOKEN、WORKSPACE_PATH 已配置",
      "网关未连通时，优先检查端口与 token 是否一致",
    ],
    steps: [
      "安装依赖并启动开发服务",
      "打开设置页，确认语言、品牌和操作员信息",
      "在聊天页确认可正常与智能体往返消息",
    ],
  },
  {
    id: "architecture",
    label: "架构概览",
    emoji: "🏗️",
    description: "前端路由、数据流与 API 分层",
    intro:
      "页面层负责状态与交互，API 路由负责与 openclaw CLI / gateway 通讯。聊天和看板任务都走流式返回，前端增量渲染。",
    highlights: [
      "app/ 下按路由组织页面与 API",
      "lib/ 下集中放置业务工具与状态存储",
      "components/ 下实现页面可复用 UI 模块",
    ],
    steps: [
      "优先复用现有组件，避免新建平行版本",
      "页面新增状态前先评估是否可下沉到 lib/",
      "改动 API 协议时同时更新前端解析逻辑",
    ],
  },
  {
    id: "agents",
    label: "智能体体系",
    emoji: "🤖",
    description: "注册表、层级关系与显示规则",
    intro:
      "智能体来源于 agents.json（或自动发现）。UI 会按 reportsTo 与 directReports 渲染层级，并在地图、网格、聊天中复用同一份资料。",
    highlights: [
      "根节点建议唯一，便于地图与团队分组",
      "reportsTo 和 directReports 要保持互相一致",
      "可在设置中覆盖 emoji 与头像，便于辨识",
    ],
    steps: [
      "先确保 agents.json 可被正确读取",
      "再检查每个智能体的 title / description 是否完整",
      "最后验证层级关系在地图与详情面板中一致",
    ],
  },
  {
    id: "chat",
    label: "聊天与流式回复",
    emoji: "💬",
    description: "会话存储、附件与斜杠命令",
    intro:
      "聊天页支持文本、图片、文件附件和流式回复。会话历史保存在本地，支持斜杠命令快速查看智能体信息与计划任务。",
    highlights: [
      "回车发送，Shift+回车换行",
      "支持拖拽与粘贴图片附件",
      "可用 /help 查看所有命令",
    ],
    steps: [
      "先选择智能体再开始会话",
      "发送失败时先检查网关连通性",
      "如需清空上下文可直接使用 /clear",
    ],
  },
  {
    id: "kanban",
    label: "看板工作流",
    emoji: "🧩",
    description: "工单状态流转与智能体执行",
    intro:
      "看板用于把任务分配给智能体并追踪执行。系统会将符合条件的工单自动推进到执行流程，失败后可在详情面板里重试。",
    highlights: [
      "状态列：积压、待处理、进行中、待评审、已完成",
      "支持按智能体筛选与拖拽改状态",
      "详情面板内置工单对话，便于追问执行结果",
    ],
    steps: [
      "创建工单并指定负责人",
      "观察执行状态与回传结果",
      "评审后再推进到已完成",
    ],
  },
  {
    id: "cron",
    label: "定时任务监控",
    emoji: "⏰",
    description: "任务健康、运行记录与投递状态",
    intro:
      "定时任务页聚合了任务健康度、最近运行、执行时长与错误信息，便于快速定位失败任务和投递异常。",
    highlights: [
      "支持按状态筛选任务",
      "支持查看下一次运行与是否逾期",
      "支持复制错误信息便于排障",
    ],
    steps: [
      "先看错误数量与逾期任务",
      "再进入任务详情核对最近运行日志",
      "必要时到聊天页直接追问对应智能体",
    ],
  },
  {
    id: "memory",
    label: "记忆与知识库",
    emoji: "🧠",
    description: "文件浏览、索引状态与检索策略",
    intro:
      "记忆页用于检查工作区文件、索引覆盖率和检索配置，帮助你判断智能体是否能稳定命中需要的上下文。",
    highlights: [
      "支持按名称、日期、大小排序",
      "支持预览、复制与下载文件",
      "可快速查看索引是否正常更新",
    ],
    steps: [
      "优先补齐关键 MEMORY.md 与团队记忆文件",
      "定期检查索引时间是否滞后",
      "大文件建议拆分，提升检索命中率",
    ],
  },
  {
    id: "api",
    label: "接口说明",
    emoji: "🔌",
    description: "常用端点与调试建议",
    intro:
      "前端通过 app/api 下的路由统一调用后端能力。若出现异常，先在浏览器网络面板看响应，再到服务端日志定位。",
    highlights: [
      "聊天、看板任务使用流式返回",
      "列表类接口通常支持增量刷新",
      "401/403 通常与 token 或权限配置有关",
    ],
  },
  {
    id: "troubleshooting",
    label: "排查手册",
    emoji: "🛠️",
    description: "常见问题与处理顺序",
    intro:
      "遇到问题时先看连接与配置，再看日志与接口响应。按固定顺序排查可以明显减少来回试错。",
    highlights: [
      "页面空白：先看构建错误与控制台报错",
      "消息失败：先看网关端口、token、代理",
      "工单卡住：先看 workState 与失败原因",
    ],
    steps: [
      "确认 openclaw gateway 进程是否在线",
      "确认前端环境变量和本地配置一致",
      "复现一次并抓取对应 API 请求/响应",
    ],
  },
]

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
  )
}

function DocContent({ section }: { section: DocSectionDef }) {
  return (
    <article>
      <h2
        style={{
          fontSize: "var(--text-title2)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          margin: 0,
        }}
      >
        {section.label}
      </h2>
      <p
        style={{
          margin: "var(--space-3) 0 var(--space-4)",
          fontSize: "var(--text-subheadline)",
          color: "var(--text-secondary)",
          lineHeight: "var(--leading-relaxed)",
        }}
      >
        {section.intro}
      </p>

      <h3
        style={{
          margin: "var(--space-6) 0 var(--space-2)",
          fontSize: "var(--text-body)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
        }}
      >
        关键要点
      </h3>
      <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
        {section.highlights.map((item) => (
          <li
            key={item}
            style={{
              marginBottom: "var(--space-2)",
              fontSize: "var(--text-subheadline)",
              color: "var(--text-secondary)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {item}
          </li>
        ))}
      </ul>

      {section.steps && section.steps.length > 0 && (
        <>
          <h3
            style={{
              margin: "var(--space-6) 0 var(--space-2)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
            }}
          >
            建议步骤
          </h3>
          <ol style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
            {section.steps.map((item) => (
              <li
                key={item}
                style={{
                  marginBottom: "var(--space-2)",
                  fontSize: "var(--text-subheadline)",
                  color: "var(--text-secondary)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {item}
              </li>
            ))}
          </ol>
        </>
      )}

      {section.code && (
        <>
          <h3
            style={{
              margin: "var(--space-6) 0 var(--space-2)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
            }}
          >
            示例
          </h3>
          <pre
            style={{
              margin: 0,
              padding: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: "var(--code-bg)",
              border: "1px solid var(--code-border)",
              color: "var(--code-text)",
              fontSize: "var(--text-footnote)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {section.code}
          </pre>
        </>
      )}
    </article>
  )
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [search, setSearch] = useState("")
  const [mobileShowContent, setMobileShowContent] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const hash = window.location.hash.replace("#", "")
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActiveSection(hash)
      setMobileShowContent(true)
    }
  }, [])

  const selectSection = useCallback((id: string) => {
    setActiveSection(id)
    setMobileShowContent(true)
    window.history.replaceState(null, "", `#${id}`)
  }, [])

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS.filter((s) => {
      const text = [s.label, s.description, s.intro, ...s.highlights, ...(s.steps ?? [])].join(" ").toLowerCase()
      return text.includes(q)
    })
  }, [search])

  function handleListKeyDown(e: React.KeyboardEvent) {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    if (!items || items.length === 0) return

    const currentIdx = Array.from(items).findIndex((el) => el.getAttribute("aria-selected") === "true")
    let nextIdx = currentIdx

    if (e.key === "ArrowDown") {
      e.preventDefault()
      nextIdx = Math.min(currentIdx + 1, items.length - 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      nextIdx = Math.max(currentIdx - 1, 0)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (currentIdx >= 0) items[currentIdx].click()
      return
    } else if (e.key === "Escape") {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }

    if (nextIdx !== currentIdx && nextIdx >= 0) {
      items[nextIdx].click()
      items[nextIdx].focus()
    }
  }

  const active = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0]

  return (
    <div className="flex h-full animate-fade-in" style={{ background: "var(--bg)" }}>
      <aside
        className={`flex-shrink-0 flex flex-col ${mobileShowContent ? "hidden md:flex" : "flex"}`}
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

        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--separator)" }}
        >
          <span style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
            文档
          </span>
        </div>

        <div style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input
            ref={searchRef}
            type="search"
            placeholder="搜索文档章节..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input focus-ring"
            aria-label="搜索文档章节"
            style={{
              width: "100%",
              height: 32,
              fontSize: "var(--text-footnote)",
              padding: "0 var(--space-3)",
              borderRadius: "var(--radius-sm)",
            }}
          />
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label="文档章节列表"
          onKeyDown={handleListKeyDown}
          className="flex-1 overflow-y-auto"
        >
          {filteredSections.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 120, fontSize: "var(--text-footnote)", color: "var(--text-tertiary)" }}
            >
              没有匹配的章节
            </div>
          ) : (
            filteredSections.map((section) => {
              const isActive = activeSection === section.id
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
                    background: isActive ? "var(--fill-secondary)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: "var(--text-body)", lineHeight: "1", flexShrink: 0, marginTop: 1 }}>
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
                    <div style={{ fontSize: "var(--text-caption2)", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {section.description}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <main
        className={`flex-1 flex flex-col overflow-hidden ${!mobileShowContent ? "hidden md:flex" : "flex"}`}
        style={{ background: "var(--bg)" }}
      >
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
          <button
            onClick={() => setMobileShowContent(false)}
            className="md:hidden btn-ghost focus-ring"
            aria-label="返回章节列表"
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
            章节
          </button>

          <div className="flex items-center gap-3">
            <span style={{ fontSize: "var(--text-title3)" }}>{active.emoji}</span>
            <div>
              <div style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                {active.label}
              </div>
              <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>
                {active.description}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-6) var(--space-10)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <DocContent section={active} />
          </div>
        </div>
      </main>
    </div>
  )
}
