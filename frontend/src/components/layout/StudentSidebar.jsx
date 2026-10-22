import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  Brain,
  Clock,
  LayoutDashboard,
  LogOut,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/app/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/student/sessions', label: 'Study Sessions', icon: Clock },
  { to: '/app/student/behaviour', label: 'Behaviour', icon: Activity },
  { to: '/app/student/performance', label: 'Performance', icon: TrendingUp },
  { to: '/app/student/recommendations', label: 'Recommendations', icon: Sparkles },
  { to: '/app/student/profile', label: 'Profile', icon: User },
]

export function StudentSidebar({ isOpen, onClose }) {
  const { profile, logout } = useAuth()
  const studentName = profile?.name || 'Student'
  const studentDept = profile?.department || 'Student Workspace'
  const initial = studentName.charAt(0).toUpperCase()

  useEffect(() => {
    if (!isOpen || !onClose) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const content = (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-5">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Brain size={18} strokeWidth={2.2} />
          </div>
          <div>
            <span className="block text-sm font-bold tracking-tight text-[var(--text-primary)]">
              FocusSense AI
            </span>
            <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-secondary)] uppercase">
              Study Analytics
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-2 px-3 font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Navigation
        </div>
        <nav className="space-y-1" aria-label="Student Navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app/student/dashboard'}
              onClick={() => onClose && onClose()}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={16}
                    strokeWidth={2}
                    className={
                      isActive
                        ? 'text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                    }
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Account & Workspace Summary */}
      <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--accent-primary)] font-mono text-xs font-bold text-[var(--accent-contrast)]">
                {initial}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                  {studentName}
                </span>
                <span className="block truncate font-mono text-[10px] text-[var(--text-secondary)]">
                  {studentDept}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out of account"
              title="Sign Out"
              className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop Sidebar (persistent) */}
      <div className="hidden md:flex md:shrink-0">{content}</div>

      {/* Mobile Drawer (modal overlay) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Student navigation menu"
        >
          <div
            className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-64 flex-1 flex-col">{content}</div>
        </div>
      )}
    </>
  )
}


