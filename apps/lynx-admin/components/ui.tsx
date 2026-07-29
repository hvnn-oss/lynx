import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || description || action) && (
        <header className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function LoadingState({ label = "불러오는 중입니다." }) {
  return (
    <div className="state-message">
      <span className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-message state-error">
      <strong>정보를 불러오지 못했습니다.</strong>
      <p>{message}</p>
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="state-message">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function Definition({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="definition">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
