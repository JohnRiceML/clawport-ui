"use client"
import { useEffect, useState, useRef, use, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Upload, X } from "lucide-react"
import type { Agent, CronJob } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ErrorState"
import { AgentAvatar } from "@/components/AgentAvatar"
import { useSettings } from "@/app/settings-provider"

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const TOOL_ICONS: Record<string, string> = {
  web_search: "\uD83D\uDD0D",
  read: "\uD83D\uDCC1",
  write: "\u270F\uFE0F",
  exec: "\uD83D\uDCBB",
  web_fetch: "\uD83C\uDF10",
  message: "\uD83D\uDD14",
  tts: "\uD83D\uDCAC",
  edit: "\u2702\uFE0F",
  sessions_spawn: "\uD83D\uDD04",
  memory_search: "\uD83E\udDE0",
}

function StatusDot({ status }: { status: CronJob["status"] }) {
  return (
    <span
      className={status === "error" ? "animate-error-pulse" : ""}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        flexShrink: 0,
        background:
          status === "ok"
            ? "var(--system-green)"
            : status === "error"
              ? "var(--system-red)"
              : "var(--text-tertiary)",
      }}
    />
  )
}

function SoulViewer({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [content])

  return (
    <div
      style={{
        background: "var(--bg)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <pre
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption1)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          padding: "var(--space-4)",
          color: "var(--text-secondary)",
          margin: 0,
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        {content}
      </pre>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderTop: "1px solid var(--separator)",
        }}
      >
        <button
          onClick={handleCopy}
          className="focus-ring"
          aria-label="Copy SOUL.md content"
          style={{
            background: "var(--fill-tertiary)",
            color: "var(--text-secondary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-1) var(--space-3)",
            fontSize: "var(--text-caption2)",
            fontWeight: "var(--weight-medium)",
            cursor: "pointer",
            transition: "all 150ms var(--ease-spring)",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="focus-ring"
      aria-label={label}
      style={{
        background: "var(--fill-tertiary)",
        color: "var(--text-secondary)",
        border: "none",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1) var(--space-2)",
        fontSize: "var(--text-caption2)",
        fontWeight: "var(--weight-medium)",
        cursor: "pointer",
        transition: "all 150ms var(--ease-spring)",
        flexShrink: 0,
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

/* ──────────────────────────────────────────────
   Card wrapper with consistent styling
   ────────────────────────────────────────────── */
function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────
   Loading skeleton for the detail page
   ────────────────────────────────────────────── */
function DetailSkeleton() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{
          background: "var(--material-regular)",
          borderBottom: "1px solid var(--separator)",
        }}
      >
        <Skeleton width={80} height={16} />
        <Skeleton width={100} height={36} style={{ borderRadius: "var(--radius-md)" }} />
      </div>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {/* Hero skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton
            width={64}
            height={64}
            style={{ borderRadius: 16 }}
          />
          <div className="flex flex-col gap-2">
            <Skeleton width={140} height={22} />
            <Skeleton width={200} height={14} />
          </div>
        </div>
        {/* Card skeletons */}
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            height={120}
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Agent Detail Page
   ────────────────────────────────────────────── */
export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { settings, setAgentOverride, clearAgentOverride } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [crons, setCrons] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch("/api/agents").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch agents")
        return r.json()
      }),
      fetch("/api/crons").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch crons")
        return r.json()
      }),
    ])
      .then(([agents, cronData]) => {
        const cronList: CronJob[] = Array.isArray(cronData) ? cronData : cronData.crons ?? []
        setAllAgents(agents)
        setAgent(agents.find((a: Agent) => a.id === id) || null)
        setCrons(cronList.filter((cr: CronJob) => cr.agentId === id))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleImageUpload(file: File) {
    try {
      const dataUrl = await resizeImage(file, 200)
      setAgentOverride(id, { profileImage: dataUrl })
    } catch {
      // silently fail
    }
  }

  if (loading) return <DetailSkeleton />
  if (error) return <ErrorState message={error} onRetry={loadData} />
  if (!agent) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ background: "var(--bg)" }}
      >
        <div
          style={{
            fontSize: "var(--text-headline)",
            color: "var(--text-secondary)",
          }}
        >
          Agent not found
        </div>
        <Link
          href="/"
          className="focus-ring"
          style={{
            color: "var(--system-blue)",
            fontSize: "var(--text-body)",
          }}
        >
          &larr; Back to Map
        </Link>
      </div>
    )
  }

  const parent = agent.reportsTo
    ? allAgents.find((a) => a.id === agent.reportsTo)
    : null
  const children = agent.directReports
    .map((cid) => allAgents.find((a) => a.id === cid))
    .filter(Boolean) as Agent[]

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "var(--material-regular)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid var(--separator)",
        }}
      >
        {/* Color strip */}
        <div style={{ height: 3, background: agent.color }} />

        <div
          className="flex items-center justify-between"
          style={{ padding: "var(--space-3) var(--space-6)" }}
        >
          <Link
            href="/"
            className="focus-ring"
            style={{
              color: "var(--system-blue)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-medium)",
              textDecoration: "none",
            }}
          >
            &larr; Back to Map
          </Link>
          <button
            onClick={() => router.push(`/chat/${agent.id}`)}
            className="focus-ring"
            aria-label={`Open chat with ${agent.name}`}
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2) var(--space-5)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              cursor: "pointer",
              transition: "all 150ms var(--ease-spring)",
            }}
          >
            Open Chat &rarr;
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {/* ── Hero section ── */}
        <div className="flex items-start gap-4">
          <div style={{ position: "relative", flexShrink: 0 }}>
            <AgentAvatar agent={agent} size={64} borderRadius={16} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: "var(--space-2)",
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload profile image"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--fill-tertiary)",
                  color: "var(--text-tertiary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "var(--text-caption2)",
                  fontWeight: "var(--weight-medium)",
                }}
              >
                <Upload size={10} />
                Photo
              </button>
              {settings.agentOverrides[agent.id]?.profileImage && (
                <button
                  onClick={() => setAgentOverride(agent.id, { profileImage: undefined })}
                  title="Remove photo"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--fill-tertiary)",
                    color: "var(--text-tertiary)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file)
                e.target.value = ""
              }}
            />
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-title1)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "-0.5px",
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {agent.name}
            </h1>
            <p
              style={{
                fontSize: "var(--text-subheadline)",
                color: "var(--text-secondary)",
                margin: "2px 0 0",
              }}
            >
              {agent.title}
            </p>
            {agent.model && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: "var(--space-1)",
                  fontSize: "var(--text-caption2)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-tertiary)",
                  background: "var(--fill-secondary)",
                  padding: "1px 8px",
                  borderRadius: 6,
                }}
              >
                {agent.model.split("/").pop()}
              </span>
            )}
            {/* Color swatch */}
            <div
              style={{
                display: "inline-block",
                marginTop: "var(--space-2)",
                width: 40,
                height: 3,
                borderRadius: 2,
                background: agent.color,
              }}
            />
          </div>
        </div>

        {/* ── About card ── */}
        <Card>
          <div className="section-header" style={{ marginBottom: "var(--space-3)" }}>
            About
          </div>
          <p
            style={{
              fontSize: "var(--text-body)",
              lineHeight: 1.65,
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            {agent.description}
          </p>
        </Card>

        {/* ── Two-column: Tools + Hierarchy ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Tools card */}
          <Card>
            <div className="section-header" style={{ marginBottom: "var(--space-3)" }}>
              Tools
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.tools.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--fill-secondary)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: "var(--text-caption1)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {TOOL_ICONS[t] && (
                    <span style={{ fontSize: "var(--text-caption2)" }}>
                      {TOOL_ICONS[t]}
                    </span>
                  )}
                  {t}
                </span>
              ))}
            </div>
          </Card>

          {/* Hierarchy card */}
          <Card>
            <div className="section-header" style={{ marginBottom: "var(--space-3)" }}>
              Hierarchy
            </div>
            {parent && (
              <div style={{ marginBottom: "var(--space-3)" }}>
                <div
                  style={{
                    fontSize: "var(--text-caption2)",
                    color: "var(--text-tertiary)",
                    marginBottom: 2,
                  }}
                >
                  Reports to
                </div>
                <Link
                  href={`/agents/${parent.id}`}
                  className="focus-ring"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--weight-medium)",
                    color: "var(--system-blue)",
                    textDecoration: "none",
                  }}
                >
                  <span>{parent.emoji}</span>
                  <span>{parent.name}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>&rarr;</span>
                </Link>
              </div>
            )}
            {children.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "var(--text-caption2)",
                    color: "var(--text-tertiary)",
                    marginBottom: 2,
                  }}
                >
                  Direct reports ({children.length})
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {children.map((c) => (
                    <Link
                      key={c.id}
                      href={`/agents/${c.id}`}
                      className="focus-ring"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--weight-medium)",
                        color: "var(--system-blue)",
                        textDecoration: "none",
                        padding: "2px 0",
                      }}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.name}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>&rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!parent && children.length === 0 && (
              <div
                style={{
                  fontSize: "var(--text-footnote)",
                  color: "var(--text-tertiary)",
                }}
              >
                No hierarchy connections
              </div>
            )}
          </Card>
        </div>

        {/* ── SOUL.md card ── */}
        {agent.soul && (
          <Card>
            <div className="section-header" style={{ marginBottom: "var(--space-3)" }}>
              SOUL.md
            </div>
            <SoulViewer content={agent.soul} />
          </Card>
        )}

        {/* ── Crons card ── */}
        <Card>
          <div
            className="section-header"
            style={{
              marginBottom: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Scheduled {crons.length > 0 && `(${crons.length})`}</span>
          </div>
          {crons.length === 0 ? (
            <div
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--text-tertiary)",
              }}
            >
              No scheduled jobs associated with this agent
            </div>
          ) : (
            <div
              style={{
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid var(--separator)",
              }}
            >
              {crons.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    minHeight: 44,
                    padding: "0 var(--space-3)",
                    borderTop: idx > 0 ? "1px solid var(--separator)" : undefined,
                    background:
                      c.status === "error" ? "rgba(255,69,58,0.06)" : undefined,
                  }}
                >
                  <StatusDot status={c.status} />
                  <span
                    style={{
                      fontSize: "var(--text-body)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--weight-medium)",
                      color: "var(--text-primary)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-caption1)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                      flexShrink: 0,
                    }}
                  >
                    {c.schedule}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-caption2)",
                      fontWeight: "var(--weight-medium)",
                      padding: "2px 8px",
                      borderRadius: 20,
                      flexShrink: 0,
                      background:
                        c.status === "ok"
                          ? "rgba(48,209,88,0.1)"
                          : c.status === "error"
                            ? "rgba(255,69,58,0.1)"
                            : "rgba(120,120,128,0.1)",
                      color:
                        c.status === "ok"
                          ? "var(--system-green)"
                          : c.status === "error"
                            ? "var(--system-red)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          {crons.length > 0 && (
            <div style={{ textAlign: "right", marginTop: "var(--space-3)" }}>
              <Link
                href="/crons"
                className="focus-ring"
                style={{
                  fontSize: "var(--text-footnote)",
                  color: "var(--system-blue)",
                  textDecoration: "none",
                  fontWeight: "var(--weight-medium)",
                }}
              >
                View all crons &rarr;
              </Link>
            </div>
          )}
        </Card>

        {/* ── Voice card ── */}
        <Card>
          <div className="section-header" style={{ marginBottom: "var(--space-3)" }}>
            Voice
          </div>
          {agent.voiceId ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: "var(--text-caption1)",
                  fontWeight: "var(--weight-medium)",
                  background: "rgba(191,90,242,0.1)",
                  color: "var(--system-purple)",
                  border: "1px solid rgba(191,90,242,0.2)",
                  flexShrink: 0,
                }}
              >
                ElevenLabs
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption2)",
                  color: "var(--text-tertiary)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {agent.voiceId}
              </span>
              <CopyButton text={agent.voiceId} label="Copy voice ID" />
            </div>
          ) : (
            <div
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--text-tertiary)",
              }}
            >
              No voice configured
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
