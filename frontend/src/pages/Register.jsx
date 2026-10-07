import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Brain, CheckCircle2, Lock, Mail, User, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Register() {
  const navigate = useNavigate()
  const { registerStudent, registerParent, error: authError } = useAuth()

  const [role, setRole] = useState('student') // 'student' | 'parent'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Student specific fields
  const [department, setDepartment] = useState('')
  const [semester, setSemester] = useState('1')
  const [academicYear, setAcademicYear] = useState('1')

  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessNotice(null)

    if (!name.trim()) {
      setLocalError('Please enter your full name.')
      return
    }

    if (!email.trim() || !password) {
      setLocalError('Please enter a valid email and password.')
      return
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (role === 'student') {
        const res = await registerStudent({
          email: email.trim(),
          password,
          name: name.trim(),
          department: department.trim() || null,
          semester: semester ? parseInt(semester, 10) : null,
          academic_year: academicYear ? parseInt(academicYear, 10) : null,
        })

        if (res.confirmationRequired) {
          setSuccessNotice(res.message)
        } else {
          navigate('/app')
        }
      } else {
        const res = await registerParent({
          email: email.trim(),
          password,
          name: name.trim(),
        })

        if (res.confirmationRequired) {
          setSuccessNotice(res.message)
        } else {
          navigate('/app')
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Registration failed. Please check your information.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-12 text-[#17221c]">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#d7e65a]">
              <Brain size={21} strokeWidth={2.5} />
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.18em] uppercase">
              FocusSense AI
            </span>
          </Link>
          <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight">Create an Account</h1>
          <p className="mt-2 text-sm text-[#405047]">
            Register as a Student or Parent to begin personalized study analytics.
          </p>
        </div>

        {/* Success Confirmation Notice */}
        {successNotice && (
          <div className="mb-6 rounded-xl border border-[#4e6656]/30 bg-[#f0f5ee] p-6 text-sm text-[#17221c] shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 text-[#4e6656]" />
              <div>
                <h3 className="font-semibold">Email Verification Notice</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#405047]">{successNotice}</p>
                <div className="mt-4">
                  <Link
                    to="/login"
                    className="inline-block rounded bg-[#17221c] px-4 py-2 font-mono text-xs font-semibold text-[#f5f1e8] uppercase"
                  >
                    Proceed to Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {(localError || authError) && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
            {localError || authError}
          </div>
        )}

        {!successNotice && (
          <div className="rounded-xl border border-[#17221c]/20 bg-white p-8 shadow-sm">
            {/* Role Selection Tabs */}
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-[#f5f1e8] p-1.5">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex items-center justify-center gap-2 rounded-md py-2 font-mono text-xs font-bold uppercase transition ${
                  role === 'student'
                    ? 'bg-white text-[#17221c] shadow-sm'
                    : 'text-[#17221c]/60 hover:text-[#17221c]'
                }`}
              >
                <BookOpen size={15} />
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={`flex items-center justify-center gap-2 rounded-md py-2 font-mono text-xs font-bold uppercase transition ${
                  role === 'parent'
                    ? 'bg-white text-[#17221c] shadow-sm'
                    : 'text-[#17221c]/60 hover:text-[#17221c]'
                }`}
              >
                <Users size={15} />
                Parent
              </button>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                >
                  Full Name
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. Alex Morgan' : 'e.g. Eleanor Morgan'}
                    className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                  />
                  <User
                    size={16}
                    className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                >
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                  />
                  <Mail
                    size={16}
                    className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                  />
                </div>
              </div>

              {/* Student Specific Fields */}
              {role === 'student' && (
                <div className="space-y-4 border-y border-[#17221c]/10 py-4">
                  <div>
                    <label
                      htmlFor="department"
                      className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                    >
                      Department / Branch
                    </label>
                    <input
                      id="department"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="mt-1.5 w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="academic-year"
                        className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                      >
                        Academic Year
                      </label>
                      <select
                        id="academic-year"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                      >
                        <option value="1">Year 1</option>
                        <option value="2">Year 2</option>
                        <option value="3">Year 3</option>
                        <option value="4">Year 4</option>
                        <option value="5">Year 5</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="semester"
                        className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                      >
                        Semester
                      </label>
                      <select
                        id="semester"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
                          <option key={sem} value={sem}>
                            Semester {sem}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                  >
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="reg-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                    />
                    <Lock
                      size={16}
                      className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block font-mono text-xs font-bold tracking-wider text-[#4e6656] uppercase"
                  >
                    Confirm Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full rounded-lg border border-[#17221c]/20 bg-[#fbf9f4] px-3.5 py-2.5 pl-10 text-sm text-[#17221c] outline-none transition focus:border-[#17221c] focus:bg-white"
                    />
                    <Lock
                      size={16}
                      className="pointer-events-none absolute top-3 left-3 text-[#17221c]/40"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#17221c] py-2.5 font-mono text-xs font-bold tracking-wider text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32] disabled:opacity-50"
              >
                {submitting ? 'Provisioning Profile...' : `Register as ${role}`}
              </button>
            </form>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-[#405047]">
          <span>Already registered? </span>
          <Link
            to="/login"
            className="font-semibold text-[#17221c] underline underline-offset-2 hover:text-[#4e6656]"
          >
            Sign in here
          </Link>
        </div>
      </div>
    </main>
  )
}

