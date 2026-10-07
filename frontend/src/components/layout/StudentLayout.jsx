import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { StudentSidebar } from './StudentSidebar'
import { StudentHeader } from './StudentHeader'

export function StudentLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f1e8] text-[#17221c]">
      {/* Sidebar (Desktop + Mobile Drawer) */}
      <StudentSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudentHeader onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

