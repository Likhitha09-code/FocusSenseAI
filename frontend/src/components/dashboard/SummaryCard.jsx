export function SummaryCard({
  icon: Icon,
  title,
  value,
  status = 'No study data yet',
  description,
  badgeColor = 'bg-[#17221c]/5 text-[#405047]',
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#17221c]/15 bg-white p-5 shadow-xs transition hover:border-[#17221c]/30">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold tracking-wider text-[#4e6656] uppercase">
            {title}
          </span>
          {Icon && (
            <div className="grid size-8 place-items-center rounded-lg bg-[#f5f1e8] text-[#17221c]">
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
        </div>

        <div className="mt-3">
          {value !== null && value !== undefined ? (
            <div className="font-serif text-3xl font-bold text-[#17221c]">{value}</div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-semibold text-[#17221c]/40">—</span>
              <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ${badgeColor}`}>
                {status}
              </span>
            </div>
          )}
        </div>
      </div>

      {description && (
        <p className="mt-3 border-t border-[#17221c]/10 pt-2.5 text-xs text-[#405047] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}

