import { Link } from 'react-router-dom'

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  actionLabel,
  actionLink,
  onAction,
}) {
  const label = actionText || actionLabel

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)]/60 px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-2xs">
          <Icon size={20} strokeWidth={2} />
        </div>
      )}
      <h4 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h4>
      {description && (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      )}
      {label && actionLink && (
        <Link
          to={actionLink}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-semibold text-[var(--accent-contrast)] uppercase transition hover:bg-[var(--accent-hover)]"
        >
          {label}
        </Link>
      )}
      {label && !actionLink && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-semibold text-[var(--accent-contrast)] uppercase transition hover:bg-[var(--accent-hover)]"
        >
          {label}
        </button>
      )}
    </div>
  )
}


