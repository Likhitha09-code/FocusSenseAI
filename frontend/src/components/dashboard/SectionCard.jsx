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
      className={`rounded-xl border border-[#17221c]/15 bg-white p-6 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="grid size-7 place-items-center rounded-md bg-[#f5f1e8] text-[#4e6656]">
              <Icon size={15} strokeWidth={2.2} />
            </div>
          )}
          <div>
            <h3 className="font-serif text-base font-bold text-[#17221c]">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#405047]">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>

      <div className="pt-4">{children}</div>
    </section>
  )
}

