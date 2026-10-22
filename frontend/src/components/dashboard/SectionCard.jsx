export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className = '',
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-card)] sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="pt-4">{children}</div>
    </section>
  )
}


