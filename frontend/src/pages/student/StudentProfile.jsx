import { useState, useEffect } from 'react'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Hash,
  Mail,
  Shield,
  User,
  Users,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { getStudentParentLinks, removeParentLink, updateParentConsent } from '../../lib/api'

export function StudentProfile() {
  const { profile } = useAuth()
  const [links, setLinks] = useState([])
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [linksError, setLinksError] = useState(null)
  const [updatingLinkId, setUpdatingLinkId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)
  const [copiedId, setCopiedId] = useState(false)

  const fetchLinks = async () => {
    setLoadingLinks(true)
    setLinksError(null)
    try {
      const data = await getStudentParentLinks()
      setLinks(data || [])
    } catch (err) {
      setLinksError(
        err.response?.data?.detail ||
          'Failed to load linked parent accounts. Please verify network connectivity.'
      )
    } finally {
      setLoadingLinks(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  const handleUpdateConsent = async (linkId, newStatus) => {
    if (!linkId) {
      setActionFeedback({ type: 'error', message: 'Invalid parent link identifier.' })
      return
    }
    setUpdatingLinkId(linkId)
    setActionFeedback(null)
    try {
      const updated = await updateParentConsent(linkId, newStatus)
      setLinks((prev) =>
        prev.map((l) =>
          (l.link_id || l.id) === linkId ? { ...l, consent_status: updated.consent_status } : l
        )
      )
      const actionLabel =
        newStatus === 'active'
          ? 'approved'
          : newStatus === 'rejected'
          ? 'rejected'
          : 'revoked'
      setActionFeedback({
        type: 'success',
        message: `Parent request ${actionLabel}. Access permissions applied immediately.`,
      })
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update parent consent status.',
      })
    } finally {
      setUpdatingLinkId(null)
    }
  }

  const handleRemoveLink = async (linkId) => {
    if (!linkId) {
      setActionFeedback({ type: 'error', message: 'Invalid parent link identifier.' })
      return
    }
    if (!window.confirm('Are you sure you want to completely remove this parent connection?')) return
    setUpdatingLinkId(linkId)
    setActionFeedback(null)
    try {
      await removeParentLink(linkId)
      setLinks((prev) => prev.filter((l) => (l.link_id || l.id) !== linkId))
      setActionFeedback({
        type: 'success',
        message: 'Parent link removed successfully.',
      })
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to remove parent link.',
      })
    } finally {
      setUpdatingLinkId(null)
    }
  }

  const handleCopyStudentId = () => {
    if (profile?.student_id) {
      navigator.clipboard.writeText(profile.student_id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              Application Identity
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Student Profile
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Your verified educational and authentication profile attributes. Application identity is
              securely bound to Supabase Auth.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
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
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="flex items-center gap-2 font-mono text-[var(--text-secondary)] uppercase">
                <User size={14} />
                <span>Full Name</span>
              </dt>
              <dd className="text-sm font-semibold text-[var(--text-primary)]">
                {profile?.name || 'Not provided'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="flex items-center gap-2 font-mono text-[var(--text-secondary)] uppercase">
                <Mail size={14} />
                <span>Registered Email</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[var(--text-primary)]">
                {profile?.email || 'Authenticated via token'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="flex items-center gap-2 font-mono text-[var(--text-secondary)] uppercase">
                <BookOpen size={14} />
                <span>Department / Branch</span>
              </dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {profile?.department || 'Not specified'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="flex items-center gap-2 font-mono text-[var(--text-secondary)] uppercase">
                <Calendar size={14} />
                <span>Academic Year</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[var(--text-primary)]">
                {profile?.academic_year ? `Year ${profile.academic_year}` : 'Not specified'}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 font-mono text-[var(--text-secondary)] uppercase">
                <Calendar size={14} />
                <span>Current Semester</span>
              </dt>
              <dd className="font-mono text-xs font-medium text-[var(--text-primary)]">
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
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="font-mono text-[var(--text-secondary)] uppercase">Application Role</dt>
              <dd className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent-primary)] uppercase">
                {profile?.role || 'student'}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <dt className="flex items-center gap-1.5 font-mono text-[var(--text-secondary)] uppercase">
                <Hash size={14} />
                <span>Student Database ID</span>
              </dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--text-primary)] break-all">
                  {profile?.student_id || 'Not assigned'}
                </span>
                {profile?.student_id && (
                  <button
                    onClick={handleCopyStudentId}
                    title="Copy Student ID"
                    className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors"
                  >
                    {copiedId ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                )}
              </dd>
            </div>

            <div className="border-b border-[var(--border-subtle)] pb-3">
              <dt className="font-mono text-[var(--text-secondary)] uppercase">Supabase Auth UUID</dt>
              <dd className="mt-1 font-mono text-[11px] text-[var(--text-secondary)] break-all">
                {profile?.auth_user_id || 'Unknown'}
              </dd>
            </div>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[11px] text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">Identity Guarantee:</strong> Your access
              permissions and database profile are strictly mapped to this cryptographic Supabase Auth
              UUID. Role claims cannot be modified from the client browser.
            </div>
          </dl>
        </SectionCard>
      </div>

      {/* Parent Access & Consent Management Section */}
      <SectionCard
        title="Parent Access & Consent Management"
        subtitle="Manage parental view permissions and grant or revoke access to your study metrics"
        icon={Users}
        action={
          <button
            onClick={fetchLinks}
            disabled={loadingLinks}
            className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)] hover:underline disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingLinks ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Parents can request to link to your account to view your aggregate study session hours and
            focus trends. To invite a parent, share your <strong>Student ID</strong> (
            <span className="font-mono text-[11px] text-[var(--text-primary)] font-medium">
              {profile?.student_id || 'Not assigned'}
            </span>
            ). A parent will <strong>never</strong> be able to view your progress until you explicitly
            grant active consent below.
          </p>

          {actionFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                actionFeedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              <span>{actionFeedback.message}</span>
            </div>
          )}

          {linksError && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{linksError}</span>
            </div>
          )}

          {loadingLinks ? (
            <div className="flex items-center justify-center p-8 text-xs text-[var(--text-secondary)]">
              <RefreshCw size={18} className="animate-spin mr-2 text-[var(--accent-primary)]" />
              Loading parent link records...
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center">
              <Users size={32} className="mx-auto text-[var(--text-secondary)] opacity-50 mb-2" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                No Linked Parent Accounts
              </h4>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                No parents have requested access to your profile yet. When a parent inputs your Student ID
                in their portal, their link request will appear here for your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const linkId = link.link_id || link.id
                const isPending = link.consent_status === 'pending'
                const isActive = link.consent_status === 'active'
                const isRevoked = link.consent_status === 'revoked'
                const isRejected = link.consent_status === 'rejected'
                const isUpdating = updatingLinkId === linkId

                return (
                  <div
                    key={linkId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {link.parent_name || link.display_name || 'Parent Account'}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            Active Consent
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <Clock size={11} />
                            Pending Review
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            <XCircle size={11} />
                            Consent Revoked
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            <XCircle size={11} />
                            Request Rejected
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                        {link.parent_email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} />
                            {link.parent_email}
                          </span>
                        )}
                        {link.created_at && (
                          <span className="text-[11px] font-mono">
                            Requested {new Date(link.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateConsent(linkId, 'active')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} />
                            Approve Access
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateConsent(linkId, 'rejected')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-red-500 border border-[var(--border-subtle)] transition-colors disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            Reject
                          </button>
                        </>
                      )}

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => handleUpdateConsent(linkId, 'revoked')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors disabled:opacity-50"
                        >
                          <ShieldAlert size={13} />
                          Revoke Access
                        </button>
                      )}

                      {(isRevoked || isRejected) && (
                        <button
                          type="button"
                          onClick={() => handleUpdateConsent(linkId, 'active')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} />
                          Re-grant Consent
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveLink(linkId)}
                        disabled={isUpdating}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors disabled:opacity-50"
                        title="Delete connection"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
