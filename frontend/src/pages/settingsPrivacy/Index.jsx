import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiShieldCheck,
  HiDownload,
  HiSupport,
  HiEye,
  HiKey,
  HiLogout,
  HiClock,
  HiMail,
  HiDocumentText,
  HiExclamationCircle,
  HiDesktopComputer,
  HiDeviceMobile,
} from 'react-icons/hi'
import { useSnackbar } from 'notistack'
import { changePassword, listSessions, logout, logoutAllDevices, revokeSession, verifySession } from '../../lib/auth'
import { getSupabaseWithSession, isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

const ALUMNI_CELL_EMAIL = 'alumni@smvec.ac.in'

function SettingsPrivacy() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const profileName = useMemo(() => {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    return fullName || user?.mobile_number || 'Alumni SMVEC'
  }, [profile, user])

  const hasProfile = Boolean(profile?.id)
  const showEmailSupported = !profile || Object.prototype.hasOwnProperty.call(profile, 'show_email')
  const showPhone = Boolean(profile?.show_phone)
  const showEmail = profile?.show_email !== false
  const currentSession = sessions.find((session) => session.is_current) || null
  const otherSessions = sessions.filter((session) => !session.is_current)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const verifiedUser = await verifySession()
      if (!mounted) return

      if (!verifiedUser) {
        navigate('/login', { replace: true })
        return
      }

      setUser(verifiedUser)

      if (!isSupabaseConfigured || !supabase || verifiedUser.role === 'staff') {
        setLoading(false)
        return
      }

      const sessionSupabase = getSupabaseWithSession()
      if (!sessionSupabase) {
        setLoading(false)
        return
      }

      const { data, error } = await sessionSupabase
        .from('alumni_registrations')
        .select('*')
        .eq('user_id', verifiedUser.id)
        .maybeSingle()

      if (!mounted) return
      if (error) {
        enqueueSnackbar(error.message || 'Unable to load settings.', { variant: 'error' })
      }
      setProfile(data || null)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [enqueueSnackbar, navigate])

  useEffect(() => {
    let mounted = true

    const loadSessions = async () => {
      try {
        const data = await listSessions()
        if (!mounted) return
        setSessions(Array.isArray(data?.sessions) ? data.sessions : [])
      } catch (error) {
        if (mounted) {
          enqueueSnackbar(error.message || 'Unable to load active devices.', { variant: 'error' })
        }
      } finally {
        if (mounted) setSessionsLoading(false)
      }
    }

    loadSessions()
    return () => { mounted = false }
  }, [enqueueSnackbar])

  const updateVisibility = async (field, value) => {
    if (!profile?.id) return

    if (field === 'show_email' && !showEmailSupported) {
      enqueueSnackbar('Email visibility needs the latest Supabase SQL migration.', { variant: 'error' })
      return
    }

    setSaving(true)
    const sessionSupabase = getSupabaseWithSession()
    if (!sessionSupabase) {
      enqueueSnackbar('Session expired. Please login again.', { variant: 'error' })
      setSaving(false)
      return
    }

    const { data, error } = await sessionSupabase
      .from('alumni_registrations')
      .update({ [field]: value })
      .eq('id', profile.id)
      .select('*')
      .maybeSingle()

    setSaving(false)
    if (error) {
      enqueueSnackbar(error.message || 'Could not update visibility.', { variant: 'error' })
      return
    }

    setProfile(data || { ...profile, [field]: value })
    enqueueSnackbar('Privacy preference updated.', { variant: 'success' })
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (passwordForm.newPassword.length < 8) {
      enqueueSnackbar('New password must be at least 8 characters.', { variant: 'error' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      enqueueSnackbar('Passwords do not match.', { variant: 'error' })
      return
    }

    setSaving(true)
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      enqueueSnackbar('Password updated successfully.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to update password.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoutCurrent = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleLogoutAll = async () => {
    setSaving(true)
    try {
      await logoutAllDevices()
      navigate('/login', { replace: true })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to logout all devices.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    setSaving(true)
    try {
      const data = await revokeSession(sessionId)
      if (data?.revoked_current) {
        navigate('/login', { replace: true })
        return
      }
      setSessions((prev) => prev.filter((session) => session.id !== sessionId))
      enqueueSnackbar('Device logged out successfully.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to logout selected device.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const downloadProfileData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user,
      alumni_profile: profile,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mvit-alumni-profile-${profile?.id || user?.id || 'data'}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const supportMail = (subject, body) => {
    const params = new URLSearchParams({
      subject,
      body: `${body}\n\nName: ${profileName}\nMobile: ${user?.mobile_number || ''}\nProfile ID: ${profile?.id || 'Not registered'}`,
    })
    window.location.href = `mailto:${ALUMNI_CELL_EMAIL}?${params.toString()}`
  }

  if (loading) {
    return (
      <div className="settings-page page-content">
        <div className="settings-shell">
          <div className="settings-loading">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page page-content">
      <div className="settings-shell">
        <div className="settings-grid">
          <aside className="settings-sidebar">
            <a href="#profile-visibility"><HiEye /> Profile Visibility</a>
            <a href="#account-security"><HiShieldCheck /> Account Security</a>
            <a href="#data-profile"><HiDownload /> Data & Profile</a>
            <a href="#help-support"><HiSupport /> Help & Support</a>
          </aside>

          <main className="settings-main">
            <section id="profile-visibility" className="settings-panel">
              <div className="settings-panel-heading">
                <span><HiEye /></span>
                <div>
                  <h2>Profile Visibility</h2>
                  <p>Choose what contact information appears to registered alumni and staff.</p>
                </div>
              </div>

              {!hasProfile && user?.role !== 'staff' && (
                <div className="settings-note">
                  Complete alumni registration to control profile visibility.
                </div>
              )}

              <SettingToggle
                title="Show phone number"
                description="Allow approved directory viewers to see your phone number."
                checked={showPhone}
                disabled={!hasProfile || saving}
                onChange={(next) => updateVisibility('show_phone', next)}
              />
              <SettingToggle
                title="Show email"
                description="Allow approved directory viewers to see your email address."
                checked={showEmail}
                disabled={!hasProfile || saving || !showEmailSupported}
                onChange={(next) => updateVisibility('show_email', next)}
              />
            </section>

            <section id="account-security" className="settings-panel">
              <div className="settings-panel-heading">
                <span><HiShieldCheck /></span>
                <div>
                  <h2>Account Security</h2>
                  <p>Update your password and control active sessions.</p>
                </div>
              </div>

              <form className="settings-password-form" onSubmit={handlePasswordSubmit}>
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    placeholder={user?.has_password ? 'Enter current password' : 'Optional if password was not set'}
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    placeholder="Re-enter new password"
                  />
                </label>
                <button type="submit" disabled={saving}>
                  <HiKey /> Change password
                </button>
              </form>

              <div className="settings-action-list">
                <div className="settings-session-info">
                  <HiClock />
                  <span>
                    <strong>Session timeout info</strong>
                    <small>You are automatically logged out after 30 minutes of inactivity. Backend sessions expire after 30 days.</small>
                  </span>
                </div>
              </div>

              <div className="settings-devices">
                <div className="settings-devices-header">
                  <strong>Logged in devices</strong>
                  <small>Select a device and sign it out individually.</small>
                </div>

                {sessionsLoading ? (
                  <div className="settings-note">Loading active devices...</div>
                ) : (
                  <>
                    {currentSession && (
                      <SessionCard
                        session={currentSession}
                        isCurrent
                        disabled={saving}
                        onLogout={() => handleRevokeSession(currentSession.id)}
                      />
                    )}
                    {otherSessions.length > 0 ? (
                      otherSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          disabled={saving}
                          onLogout={() => handleRevokeSession(session.id)}
                        />
                      ))
                    ) : (
                      <div className="settings-note settings-note--soft">
                        No other active devices found.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="settings-action-list">
                <button type="button" onClick={handleLogoutCurrent} disabled={saving}>
                  <HiLogout />
                  <span>
                    <strong>Logout from current device</strong>
                    <small>End only this browser session immediately.</small>
                  </span>
                </button>
                <button type="button" onClick={handleLogoutAll} disabled={saving}>
                  <HiLogout />
                  <span>
                    <strong>Logout from all devices</strong>
                    <small>End every active MVIT Alumni session at once.</small>
                  </span>
                </button>
              </div>
            </section>

            <section id="data-profile" className="settings-panel">
              <div className="settings-panel-heading">
                <span><HiDownload /></span>
                <div>
                  <h2>Data & Profile</h2>
                  <p>Export your profile data or ask the alumni cell to correct official details.</p>
                </div>
              </div>

              <div className="settings-action-list">
                <button type="button" onClick={downloadProfileData} disabled={!user}>
                  <HiDownload />
                  <span>
                    <strong>Download my profile data</strong>
                    <small>Export account and alumni profile data as JSON.</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => supportMail('Profile correction request', 'Please review and correct the following profile details:')}
                >
                  <HiDocumentText />
                  <span>
                    <strong>Request profile correction</strong>
                    <small>Send a pre-filled request to the alumni cell.</small>
                  </span>
                </button>
              </div>
            </section>

            <section id="help-support" className="settings-panel">
              <div className="settings-panel-heading">
                <span><HiSupport /></span>
                <div>
                  <h2>Help & Support</h2>
                  <p>Get help with incorrect records, official contact, and policy documents.</p>
                </div>
              </div>

              <div className="settings-action-list">
                <button
                  type="button"
                  onClick={() => supportMail('Incorrect alumni information report', 'I found incorrect information in the alumni directory:')}
                >
                  <HiExclamationCircle />
                  <span>
                    <strong>Report incorrect information</strong>
                    <small>Notify the team about a wrong or outdated profile.</small>
                  </span>
                </button>
                <a href={`mailto:${ALUMNI_CELL_EMAIL}`}>
                  <HiMail />
                  <span>
                    <strong>Contact alumni cell</strong>
                    <small>{ALUMNI_CELL_EMAIL}</small>
                  </span>
                </a>
              </div>

              <div className="settings-docs">
                <article>
                  <h3>Privacy policy</h3>
                  <p>MVIT Alumni uses your profile information to maintain the alumni directory, enable verified community access, and support official alumni communication.</p>
                  <p>Contact details are shown based on your visibility preferences and directory access rules.</p>
                </article>
                <article>
                  <h3>Terms of use</h3>
                  <p>Use the directory respectfully, keep your profile accurate, and do not misuse alumni contact information for spam, scraping, or unrelated solicitation.</p>
                  <p>Staff may moderate records to protect data quality and community trust.</p>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function SettingToggle({ title, description, checked, disabled, onChange }) {
  return (
    <div className="settings-toggle-row">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        className={`settings-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  )
}

function SessionCard({ session, isCurrent = false, disabled, onLogout }) {
  const isMobile = /iphone|ipad|android/i.test(String(session?.platform || ''))
  const Icon = isMobile ? HiDeviceMobile : HiDesktopComputer
  const lastSeenLabel = formatSessionTime(session?.last_seen_at || session?.created_at)
  const createdLabel = formatSessionTime(session?.created_at)

  return (
    <div className={`settings-session-card${isCurrent ? ' is-current' : ''}`}>
      <div className="settings-session-icon">
        <Icon />
      </div>
      <div className="settings-session-copy">
        <div className="settings-session-title-row">
          <strong>{session?.device_name || 'Unknown device'}</strong>
          {isCurrent && <span>Current device</span>}
        </div>
        <small>{session?.browser || 'Browser'} · {session?.platform || 'Device'}</small>
        <small>Last active {lastSeenLabel}</small>
        <small>Signed in {createdLabel}</small>
      </div>
      <button type="button" onClick={onLogout} disabled={disabled}>
        Logout
      </button>
    </div>
  )
}

function formatSessionTime(value) {
  if (!value) return 'recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default SettingsPrivacy
