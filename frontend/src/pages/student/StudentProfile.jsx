import { BookOpen, Calendar, CheckCircle2, Hash, Mail, Shield, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { SectionCard } from '../../components/dashboard/SectionCard'

export function StudentProfile() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
              Application Identity
            </span>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
              Student Profile
            </h2>
            <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
              Your verified educational and authentication profile attributes. Application identity is
              securely bound to Supabase Auth.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={15} />
            <span>Profile Verified</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal & Academic Details */}
        <SectionCard
          title="Academic Information"
          subtitle="Enrolled curriculum and cohort"
          icon={User}
        >
          <dl className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="flex items-center gap-2 font-mono text-[#4e6656] uppercase">
                <User size={14} />
                <span>Full Name</span>
              </dt>
              <dd className="font-serif text-sm font-semibold text-[#17221c]">
                {profile?.name || 'Not provided'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="flex items-center gap-2 font-mono text-[#4e6656] uppercase">
                <Mail size={14} />
                <span>Registered Email</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[#17221c]">
                {profile?.email || 'Authenticated via token'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="flex items-center gap-2 font-mono text-[#4e6656] uppercase">
                <BookOpen size={14} />
                <span>Department / Branch</span>
              </dt>
              <dd className="font-medium text-[#17221c]">
                {profile?.department || 'Not specified'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="flex items-center gap-2 font-mono text-[#4e6656] uppercase">
                <Calendar size={14} />
                <span>Academic Year</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[#17221c]">
                {profile?.academic_year ? `Year ${profile.academic_year}` : 'Not specified'}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 font-mono text-[#4e6656] uppercase">
                <Calendar size={14} />
                <span>Current Semester</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[#17221c]">
                {profile?.semester ? `Semester ${profile.semester}` : 'Not specified'}
              </dd>
            </div>
          </dl>
        </SectionCard>

        {/* Security & Database Metadata */}
        <SectionCard
          title="Security & System Identifiers"
          subtitle="Cryptographic and database identity mappings"
          icon={Shield}
        >
          <dl className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="font-mono text-[#4e6656] uppercase">Application Role</dt>
              <dd className="rounded-md bg-[#17221c] px-2.5 py-0.5 font-mono text-xs font-bold text-[#f5f1e8] uppercase">
                {profile?.role || 'student'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
              <dt className="flex items-center gap-1.5 font-mono text-[#4e6656] uppercase">
                <Hash size={14} />
                <span>Student Database ID</span>
              </dt>
              <dd className="font-mono text-[11px] text-[#17221c] break-all">
                {profile?.student_id || 'Not assigned'}
              </dd>
            </div>

            <div className="border-b border-[#17221c]/10 pb-3">
              <dt className="font-mono text-[#4e6656] uppercase">Supabase Auth UUID</dt>
              <dd className="mt-1 font-mono text-[11px] text-[#405047] break-all">
                {profile?.auth_user_id || 'Unknown'}
              </dd>
            </div>

            <div className="rounded-lg bg-[#f5f1e8] p-3 text-[11px] text-[#405047] leading-relaxed">
              <strong>Identity Guarantee:</strong> Your access permissions and database profile are
              strictly mapped to this cryptographic Supabase Auth UUID. Role claims cannot be modified
              from the client browser.
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  )
}

