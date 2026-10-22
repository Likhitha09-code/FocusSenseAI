import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { StudentSidebar } from './StudentSidebar'
import { StudentHeader } from './StudentHeader'

export function StudentLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Sidebar (Desktop + Mobile Drawer) */}
      <StudentSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <StudentHeader onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}


