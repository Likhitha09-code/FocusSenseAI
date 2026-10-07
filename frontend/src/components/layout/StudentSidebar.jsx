import { NavLink } from 'react-router-dom'
import {
  Activity,
  Brain,
  Clock,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/app/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/student/sessions', label: 'Study Sessions', icon: Clock },
  { to: '/app/student/behaviour', label: 'Behaviour', icon: Activity },
  { to: '/app/student/performance', label: 'Performance', icon: TrendingUp },
  { to: '/app/student/recommendations', label: 'Recommendations', icon: Sparkles },
  { to: '/app/student/profile', label: 'Profile', icon: User },
]

export function StudentSidebar({ isOpen, onClose }) {
  const content = (
    <aside className="flex h-full w-64 flex-col border-r border-[#17221c]/15 bg-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[#17221c]/10 px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-full bg-[#d7e65a]">
            <Brain size={18} strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#17221c] uppercase">
              FocusSense AI
            </span>
            <span className="block font-mono text-[9px] font-semibold text-[#4e6656] uppercase">
              Student Portal
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded p-1 text-[#17221c]/60 hover:bg-[#f5f1e8] hover:text-[#17221c] md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-3 py-4" aria-label="Student Navigation">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app/student/dashboard'}
            onClick={() => onClose && onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-mono text-xs font-medium transition ${
                isActive
                  ? 'bg-[#17221c] text-[#f5f1e8] shadow-xs'
                  : 'text-[#405047] hover:bg-[#f5f1e8] hover:text-[#17221c]'
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer Meta */}
      <div className="border-t border-[#17221c]/10 p-4">
        <div className="rounded-lg bg-[#f5f1e8] p-3 text-[11px] text-[#405047]">
          <span className="font-mono text-[10px] font-bold text-[#4e6656] uppercase">
            Platform Status
          </span>
          <p className="mt-0.5 font-medium">Telemetry & ML modules in preparation</p>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop Sidebar (persistent) */}
      <div className="hidden md:flex md:flex-shrink-0">{content}</div>

      {/* Mobile Drawer (modal overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#17221c]/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-64 flex-1 flex-col">{content}</div>
        </div>
      )}
    </>
  )
}

