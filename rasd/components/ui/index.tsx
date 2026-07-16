// UI primitives. Thin wrappers over app/styles/primitives.css (@layer ui).
import Icon, { type IconName } from "./Icon";

export { default as Icon } from "./Icon";
export type { IconName } from "./Icon";

export type Tone = "ok" | "warn" | "danger" | "crit" | "info" | "neutral";
const tone = (t?: Tone) => (t && t !== "neutral" ? { "data-tone": t } : {});

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <header className="u-page-head">
      <div>
        <h1 className="u-page-title">{title}</h1>
        {sub && <p className="u-page-sub">{sub}</p>}
      </div>
      {actions && <div className="u-page-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, icon, count, children }: { title: string; icon?: IconName; count?: number | string; children: React.ReactNode }) {
  return (
    <section className="u-section">
      <div className="u-section-head">
        <h2 className="u-section-title">
          {icon && <Icon name={icon} size={18} />}
          {title}
        </h2>
        {count != null && <span className="u-section-count">{count}</span>}
        <span className="u-section-rule" />
      </div>
      {children}
    </section>
  );
}

export function Card({ t, interactive, className = "", children, ...rest }: { t?: Tone; interactive?: boolean; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`u-card ${interactive ? "u-card-i" : ""} ${className}`} {...tone(t)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="u-card-head">
      <h3 className="u-card-title">{title}</h3>
      {right}
    </div>
  );
}

export function Callout({ label, icon, t, children, footer }: { label: string; icon?: IconName; t?: Tone; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="u-callout" {...tone(t)}>
      <div className="u-callout-label">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </div>
      <p className="u-callout-body">{children}</p>
      {footer}
    </div>
  );
}

export function Stat({ label, value, meta, t, icon }: { label: string; value: React.ReactNode; meta?: string; t?: Tone; icon?: IconName }) {
  return (
    <div className="u-stat" {...tone(t)}>
      <div className="u-stat-l">
        {icon && <Icon name={icon} size={12} />}
        {label}
      </div>
      <div className="u-stat-v">{value}</div>
      {meta && <div className="u-stat-m">{meta}</div>}
    </div>
  );
}

export function Badge({ t, dot, children }: { t?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className="u-badge" {...tone(t)}>
      {dot && <span className="u-badge-dot" />}
      {children}
    </span>
  );
}

export function Button({ variant, children, ...rest }: { variant?: "primary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="u-btn" {...(variant === "primary" ? { "data-variant": "primary" } : {})} {...rest}>
      {children}
    </button>
  );
}

export function Meter({ value, t }: { value: number; t?: Tone }) {
  return (
    <div className="u-meter" {...tone(t)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="u-meter-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Grid({ cols = "auto", children, style }: { cols?: "auto" | "2"; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="u-grid" data-cols={cols} style={style}>{children}</div>;
}

export function Row({ icon, iconTone, title, meta, right }: { icon?: IconName; iconTone?: Tone; title: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="u-row">
      {icon && (
        <span style={{ color: iconTone && iconTone !== "neutral" ? `var(--${iconTone})` : "var(--muted)", marginTop: 2 }}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <div className="u-row-main">
        <div className="u-row-t">{title}</div>
        {meta && <div className="u-row-m">{meta}</div>}
      </div>
      {right}
    </div>
  );
}
