import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Brain,
  LayoutDashboard,
  LogOut,
  UserCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/app/parent/dashboard', label: 'Student Progress', icon: LayoutDashboard },
  { to: '/app/parent/link', label: 'Link Student', icon: UserCheck },
]

export function ParentSidebar({ isOpen, onClose }) {
  const { profile, logout } = useAuth()
  const parentName = profile?.name || 'Parent'
  const initial = parentName.charAt(0).toUpperCase()

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
            <span className="font-mono text-xs font-bold tracking-widest text-[var(--text-primary)] uppercase">
              FocusSense AI
            </span>
            <span className="block font-mono text-[9px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              Parent Portal
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Parent Portal Navigation" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                  isActive
                    ? 'border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={16} className="shrink-0 transition group-hover:scale-105" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User Card & Logout */}
      <div className="border-t border-[var(--border-subtle)] p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-primary)] font-mono text-xs font-bold text-[var(--accent-contrast)]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--text-primary)]">{parentName}</p>
              <p className="truncate font-mono text-[10px] text-[var(--text-muted)]">Parent Account</p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--status-danger)]"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden md:flex md:shrink-0">{content}</div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col">{content}</div>
        </div>
      )}
    </>
  )
}

