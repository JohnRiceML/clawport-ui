import type { ReactNode, CSSProperties } from "react";

/* ─── Headings ─────────────────────────────────────────────────── */

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "var(--text-title2)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-primary)",
        lineHeight: "var(--leading-snug)",
        marginTop: "var(--space-10)",
        marginBottom: "var(--space-4)",
      }}
    >
      {children}
    </h2>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "var(--text-body)",
        fontWeight: "var(--weight-semibold)",
        color: "var(--text-primary)",
        lineHeight: "var(--leading-snug)",
        marginTop: "var(--space-8)",
        marginBottom: "var(--space-3)",
      }}
    >
      {children}
    </h3>
  );
}

/* ─── Text ─────────────────────────────────────────────────────── */

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: "var(--text-subheadline)",
        lineHeight: "var(--leading-relaxed)",
        color: "var(--text-secondary)",
        marginBottom: "var(--space-4)",
      }}
    >
      {children}
    </p>
  );
}

/* ─── Code ─────────────────────────────────────────────────────── */

export function CodeBlock({
  children,
  title,
}: {
  children: string;
  title?: string;
}) {
  return (
    <div
      style={{
        background: "var(--code-bg)",
        border: "1px solid var(--code-border)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-4)",
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderBottom: "1px solid var(--code-border)",
            fontSize: "var(--text-caption1)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {title}
        </div>
      )}
      <pre
        style={{
          padding: "var(--space-4)",
          margin: 0,
          fontSize: "var(--text-footnote)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--code-text)",
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre-wrap",
          overflowX: "auto",
        }}
      >
        {children}
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        background: "var(--code-bg)",
        border: "1px solid var(--code-border)",
        borderRadius: "4px",
        padding: "1px 6px",
        fontSize: "0.9em",
        fontFamily: "var(--font-mono)",
        color: "var(--code-text)",
      }}
    >
      {children}
    </code>
  );
}

/* ─── Cards & Panels ───────────────────────────────────────────── */

export function InfoCard({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4) var(--space-5)",
        marginBottom: "var(--space-4)",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: "var(--text-subheadline)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
            marginBottom: "var(--space-3)",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── Tables ───────────────────────────────────────────────────── */

export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        marginBottom: "var(--space-4)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-footnote)",
          lineHeight: "var(--leading-normal)",
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "var(--space-2) var(--space-3)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--text-primary)",
                  background: "var(--material-thin)",
                  borderBottom: "1px solid var(--separator)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    color: "var(--text-secondary)",
                    borderBottom:
                      ri < rows.length - 1
                        ? "1px solid var(--separator)"
                        : undefined,
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Lists ────────────────────────────────────────────────────── */

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul
      style={{
        marginBottom: "var(--space-4)",
        paddingLeft: "var(--space-5)",
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontSize: "var(--text-subheadline)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--text-secondary)",
            marginBottom: "var(--space-1)",
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items }: { items: ReactNode[] }) {
  return (
    <ol
      style={{
        marginBottom: "var(--space-4)",
        paddingLeft: "var(--space-5)",
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontSize: "var(--text-subheadline)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--text-secondary)",
            marginBottom: "var(--space-1)",
          }}
        >
          {item}
        </li>
      ))}
    </ol>
  );
}

/* ─── Callout ──────────────────────────────────────────────────── */

const CALLOUT_COLORS: Record<string, string> = {
  tip: "var(--system-green)",
  warning: "var(--system-orange)",
  note: "var(--system-blue)",
  error: "var(--system-red)",
};

const CALLOUT_LABELS: Record<string, string> = {
  tip: "提示",
  warning: "警告",
  note: "说明",
  error: "错误",
};

export function Callout({
  type = "note",
  children,
}: {
  type?: "tip" | "warning" | "note" | "error";
  children: ReactNode;
}) {
  const color = CALLOUT_COLORS[type] ?? "var(--system-blue)";
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: "var(--material-thin)",
        borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
        padding: "var(--space-3) var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          fontWeight: "var(--weight-semibold)",
          color,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "var(--space-1)",
        }}
      >
        {CALLOUT_LABELS[type] ?? "说明"}
      </div>
      <div
        style={{
          fontSize: "var(--text-footnote)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--text-secondary)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
