const DEFAULT_EMPTY_STATUS = 'No study data yet'

export function SummaryCard({
  icon: Icon,
  title,
  value,
  status,
  description,
  badgeColor = 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
}) {
  const hasValue = value !== null && value !== undefined
  const trimmedStatus = typeof status === 'string' ? status.trim() : ''
  const populatedStatus =
    trimmedStatus && trimmedStatus !== DEFAULT_EMPTY_STATUS ? trimmedStatus : null
  const emptyStatus = trimmedStatus || DEFAULT_EMPTY_STATUS

  return (
    <div className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] transition hover:border-[var(--border-strong)]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
            {title}
          </span>
          {Icon && (
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
        </div>

        <div className="mt-3">
          {hasValue ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums sm:text-3xl">
                {value}
              </div>
              {populatedStatus && (
                <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-primary)] uppercase">
                  {populatedStatus}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold text-[var(--text-muted)] tabular-nums">—</span>
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${badgeColor}`}
              >
                {emptyStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {description && (
        <p className="mt-3.5 border-t border-[var(--border-subtle)] pt-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      )}
    </div>
  )
}


