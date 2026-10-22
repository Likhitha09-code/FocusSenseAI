import { Link, useLocation } from 'react-router-dom'
import { LogOut, Menu, Moon, Play, Sun } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const titles = {
  '/app/student/dashboard': 'Dashboard',
  '/app/student/sessions': 'Study Sessions',
  '/app/student/behaviour': 'Behaviour Analysis',
  '/app/student/performance': 'Performance Analytics',
  '/app/student/recommendations': 'AI Recommendations',
  '/app/student/profile': 'Student Profile',
}

export function StudentHeader({ onMenuClick }) {
  const location = useLocation()
  const { profile, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const currentTitle = titles[location.pathname] || 'Student Portal'
  const studentName = profile?.name || 'Student'
  const initial = studentName.charAt(0).toUpperCase()
  const isSessionsPage = location.pathname === '/app/student/sessions'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Menu Trigger + Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] md:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="hidden font-mono text-[11px] font-medium text-[var(--text-muted)] sm:inline">
            Student
          </span>
          <span className="hidden text-[var(--text-muted)] sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right: Quick Action, Theme Toggle, User Profile & Sign Out */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {!isSessionsPage && (
          <Link
            to="/app/student/sessions"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)]"
          >
            <Play size={13} fill="currentColor" />
            <span>Study Session</span>
          </Link>
        )}

        {/* Dark / Light Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={theme === 'light'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 font-mono text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} className="text-[var(--status-warning)]" />
              <span className="hidden lg:inline">Light</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-[var(--accent-primary)]" />
              <span className="hidden lg:inline">Dark</span>
            </>
          )}
        </button>

        {/* User Profile Pill */}
        <Link
          to="/app/student/profile"
          className="hidden sm:flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 transition hover:border-[var(--border-strong)]"
        >
          <div className="grid size-6 place-items-center rounded-full bg-[var(--accent-primary)] font-mono text-[11px] font-bold text-[var(--accent-contrast)]">
            {initial}
          </div>
          <div className="text-left">
            <span className="block max-w-[120px] truncate text-xs font-semibold leading-tight text-[var(--text-primary)]">
              {studentName}
            </span>
            <span className="block font-mono text-[9px] leading-none text-[var(--text-secondary)] uppercase">
              Verified Student
            </span>
          </div>
        </Link>

        {/* Sign Out Action */}
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out of account"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  )
}

