import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiCheckCircle, HiExclamationCircle } from 'react-icons/hi'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'
import { logout, verifySession } from '../../lib/auth'
import './Index.css'

const initialForm = {
  employee_id: '',
  name: '',
  mobile_number: '',
}

function FacultyRegistration() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [accessChecking, setAccessChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkAccess = async () => {
      const user = await verifySession()
      if (!mounted) return

      if (user?.role === 'alumni') {
        navigate('/', { replace: true })
        return
      }

      setAccessChecking(false)
    }

    checkAccess()
    return () => { mounted = false }
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setError('')
    setSuccess('')

    if (name === 'mobile_number') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10)
      setForm((prev) => ({ ...prev, mobile_number: digitsOnly }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    if (!form.employee_id.trim()) return 'Employee ID is required.'
    if (!form.name.trim()) return 'Name is required.'
    if (!/^\d{10}$/.test(form.mobile_number)) return 'Enter a valid 10-digit mobile number.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured.')
      return
    }

    setSubmitting(true)

    const payload = {
      employee_id: form.employee_id.trim(),
      name: form.name.trim(),
      mobile_number: form.mobile_number,
    }

    const { error: insertError } = await supabase
      .from('faculty_data')
      .insert(payload)

    setSubmitting(false)

    if (insertError) {
      if (insertError.code === '23505') {
        const details = String(insertError.details || '').toLowerCase()
        if (details.includes('mobile_number')) {
          setError('This mobile number is already registered in faculty data.')
          return
        }
        if (details.includes('employee_id')) {
          setError('This employee ID is already registered in faculty data.')
          return
        }
        setError('This faculty record already exists.')
        return
      }

      setError(insertError.message)
      return
    }

    setSuccess('Faculty registration saved successfully. Redirecting to login...')
    setForm(initialForm)
    await logout()
    navigate('/login', { replace: true })
  }

  if (accessChecking) {
    return null
  }

  return (
    <div className="faculty-registration-page page-content">
      <div className="faculty-registration-shell">
        <div className="faculty-registration-header">

          <h1>Faculty Registration</h1>
        </div>

        <div className="faculty-registration-card">
          {error && (
            <div className="faculty-alert faculty-alert--error">
              <HiExclamationCircle />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="faculty-alert faculty-alert--success">
              <HiCheckCircle />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="faculty-form">
            <div className="faculty-form-group">
              <label htmlFor="employee_id">Employee ID</label>
              <input
                id="employee_id"
                name="employee_id"
                value={form.employee_id}
                onChange={handleChange}
                placeholder="25006"
                required
              />
            </div>

            <div className="faculty-form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Faculty full name"
                required
              />
            </div>

            <div className="faculty-form-group">
              <label htmlFor="mobile_number">Mobile Number</label>
              <input
                id="mobile_number"
                name="mobile_number"
                value={form.mobile_number}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                required
              />
            </div>

            <button type="submit" disabled={submitting} className="faculty-submit-btn">
              {submitting ? 'Saving...' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default FacultyRegistration
