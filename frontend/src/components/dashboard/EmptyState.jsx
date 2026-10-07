import { Link } from 'react-router-dom'

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  actionLink,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#17221c]/20 bg-[#fbf9f4]/60 px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-[#f5f1e8] text-[#4e6656]">
          <Icon size={20} strokeWidth={2} />
        </div>
      )}
      <h4 className="font-serif text-base font-semibold text-[#17221c]">{title}</h4>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[#405047]">
          {description}
        </p>
      )}
      {actionText && actionLink && (
        <Link
          to={actionLink}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#17221c] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32]"
        >
          {actionText}
        </Link>
      )}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#17221c] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32]"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

