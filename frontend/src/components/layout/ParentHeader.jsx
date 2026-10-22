import { useLocation } from 'react-router-dom'
import { Menu, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const titles = {
  '/app/parent/dashboard': 'Student Progress',
  '/app/parent/link': 'Link Student',
}

export function ParentHeader({ onMenuClick }) {
  const location = useLocation()
  const { profile } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const currentTitle = titles[location.pathname] || 'Parent Portal'
  const parentName = profile?.name || 'Parent'
  const initial = parentName.charAt(0).toUpperCase()

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
            Parent
          </span>
          <span className="hidden text-[var(--text-muted)] sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 font-mono text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          {theme === 'dark' ? (
            <Sun size={14} className="text-[var(--status-warning)]" />
          ) : (
            <Moon size={14} className="text-[var(--accent-primary)]" />
          )}
          <span className="hidden text-[11px] font-mono capitalize sm:inline">{theme}</span>
        </button>

        <div
          title={`Signed in as ${parentName}`}
          className="grid size-8 place-items-center rounded-lg bg-[var(--accent-primary)] font-mono text-xs font-bold text-[var(--accent-contrast)] shadow-xs"
        >
          {initial}
        </div>
      </div>
    </header>
  )
}

