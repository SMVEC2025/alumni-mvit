import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiMenu, HiX, HiLogout, HiUserCircle, HiHome, HiUsers, HiClipboardList, HiMail } from 'react-icons/hi'
import { getUser, onAuthChange, logout as authLogout } from '../lib/auth'
import { isStudentRegistered } from '../lib/studentRegistration'
import { getSupabaseWithSession } from '../lib/supabaseClient'
import MobileSidebarMenu from './MobileSidebarMenu'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/safeStorage'
import { useProtectedImageUrl } from '../hooks/useProtectedImageUrl'

const REG_STATUS_CACHE_PREFIX = 'smvec_reg_status_'

function getCachedRegistrationStatus(userId) {
  if (!userId) return null
  try {
    const raw = safeLocalStorageGet(`${REG_STATUS_CACHE_PREFIX}${userId}`)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

function setCachedRegistrationStatus(userId, registered) {
  if (!userId) return
  safeLocalStorageSet(`${REG_STATUS_CACHE_PREFIX}${userId}`, registered ? '1' : '0')
}

function Navbar() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(() => getUser())
  const [loggingOut, setLoggingOut] = useState(false)
  const [isRegisteredAlumni, setIsRegisteredAlumni] = useState(() => getCachedRegistrationStatus(getUser()?.id))
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollY = useRef(0)
  const location = useLocation()
  const resolvedProfileImageUrl = useProtectedImageUrl(profileImageUrl)

  const isActive = (path) => location.pathname === path
  const isLoginPage = location.pathname === '/login'
  const profileDisplayName = user?.name || user?.email || user?.mobile_number || 'Alumni User'

  const isStaff = user?.role === 'staff'

  const baseLinks = [
    { path: '/', label: 'Home', icon: <HiHome /> },
    { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
    { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
  ]

  const navLinks = (() => {
    if (!user) return baseLinks
    if (isStaff) {
      return [
        { path: '/', label: 'Home', icon: <HiHome /> },
        { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
        { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
      ]
    }
    const alumniEntry = isRegisteredAlumni === null
      ? null
      : {
        path: isRegisteredAlumni ? '/alumni-space' : '/register',
        label: isRegisteredAlumni ? 'My Profile' : 'Alumni Registration',
        icon: isRegisteredAlumni ? <HiUserCircle /> : <HiClipboardList />,
      }
    return [
      { path: '/', label: 'Home', icon: <HiHome /> },
      { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
      ...(alumniEntry ? [alumniEntry] : []),
      { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
    ]
  })()

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      const prev = lastScrollY.current

      setScrolled(currentY > 50)

      if (currentY < 50) {
        setNavHidden(false)
      } else if (currentY > prev) {
        setNavHidden(true)
      } else if (currentY < prev) {
        setNavHidden(false)
      }

      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Listen for auth changes
  useEffect(() => {
    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser)
    })
    return () => unsubscribe()
  }, [])

  // Check registration status
  useEffect(() => {
    if (!user || isStaff) {
      setIsRegisteredAlumni(null)
      return
    }

    let mounted = true
    const cached = getCachedRegistrationStatus(user.id)
    if (cached !== null) {
      setIsRegisteredAlumni(cached)
    } else {
      setIsRegisteredAlumni(null)
    }

    const run = async () => {
      const { registered } = await isStudentRegistered(user)
      if (!mounted) return
      const next = Boolean(registered)
      setIsRegisteredAlumni(next)
      setCachedRegistrationStatus(user.id, next)
    }
    run()

    return () => { mounted = false }
  }, [user, isStaff])

  useEffect(() => {
    if (!user) {
      setProfileImageUrl('')
      return
    }

    let mounted = true
    const loadProfileImage = async () => {
      const sessionSupabase = getSupabaseWithSession()
      if (!sessionSupabase) {
        if (mounted) setProfileImageUrl('')
        return
      }

      const { data } = await sessionSupabase
        .from('alumni_registrations')
        .select('profile_image_url')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!mounted) return
      setProfileImageUrl(data?.profile_image_url || '')
    }

    loadProfileImage()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  const handleLogout = async () => {
    await authLogout()
    setMenuOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <>
      <nav className={`navbar${scrolled && !isLoginPage ? ' navbar--scrolled' : ''}${isLoginPage ? ' navbar--login' : ''}${navHidden ? ' navbar--hidden' : ''}`}>
        <div className="containerr navbar-inner">
          <Link to="/" className="navbar-logo">
            <img
              src={scrolled && !isLoginPage ? '/img/logo/light.svg' : '/img/logo/dark.svg'}
              alt="MVIT Alumni"
              className="navbar-logo-img"
            />
          </Link>

          <button
            className="navbar-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-sidebar-menu"
          >
            {menuOpen ? <HiX /> : <HiMenu />}
          </button>

          <div className="navbar-menu navbar-menu--desktop">
            <ul className="navbar-links">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={isActive(link.path) ? 'active' : ''}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="navbar-actions">
              {user ? (
                <div className="navbar-user-menu">
                  <Link
                    to="/alumni-space"
                    className="navbar-user-avatar"
                    aria-label="Go to Alumni Space"
                  >
                    {resolvedProfileImageUrl ? (
                      <img src={resolvedProfileImageUrl} alt="Profile" />
                    ) : (
                      <HiUserCircle />
                    )}
                  </Link>

                  <div className="navbar-user-dropdown">
                    <button
                      type="button"
                      className="navbar-dropdown-item"
                      onClick={handleLogout}
                      disabled={loggingOut}
                    >
                      <HiLogout />
                      <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <Link to="/login" className="btn btn-outline">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <MobileSidebarMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        profileImageUrl={resolvedProfileImageUrl}
        profileDisplayName={profileDisplayName}
        isStaff={isStaff}
        navLinks={navLinks}
        isActive={isActive}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        profilePath={isStaff ? '/directory' : '/alumni-space'}
        logoSrc="/img/logo/dark.svg"
      />
    </>
  )
}

export default Navbar
