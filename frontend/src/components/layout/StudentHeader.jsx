import { useLocation } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

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

  const currentTitle = titles[location.pathname] || 'Student Portal'
  const studentName = profile?.name || 'Student'
  const initial = studentName.charAt(0).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#17221c]/15 bg-white px-4 sm:px-8">
      {/* Left: Mobile Menu Trigger + Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-lg p-1.5 text-[#17221c] hover:bg-[#f5f1e8] md:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[#405047] hidden sm:inline">Student</span>
          <span className="text-[#17221c]/30 hidden sm:inline">/</span>
          <h1 className="font-serif text-lg font-bold text-[#17221c]">{currentTitle}</h1>
        </div>
      </div>

      {/* Right: User Profile & Logout Action */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2.5 rounded-lg border border-[#17221c]/15 bg-[#fbf9f4] px-3 py-1.5">
          <div className="grid size-6 place-items-center rounded-full bg-[#17221c] font-mono text-[11px] font-bold text-[#f5f1e8]">
            {initial}
          </div>
          <div className="text-left">
            <span className="block font-serif text-xs font-semibold text-[#17221c] leading-tight">
              {studentName}
            </span>
            <span className="block font-mono text-[9px] text-[#4e6656] uppercase leading-none">
              Verified Student
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          aria-label="Sign out of account"
          className="flex items-center gap-1.5 rounded-lg border border-[#17221c]/20 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-[#17221c] transition hover:bg-[#17221c] hover:text-[#f5f1e8]"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  )
}
