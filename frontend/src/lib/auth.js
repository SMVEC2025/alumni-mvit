import axios from 'axios'
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
} from './safeStorage'

const OTP_API_URL = 'https://agribackend.vercel.app/api/send-otp'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const EDGE_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/auth-handler` : ''

const SESSION_TOKEN_KEY = 'smvec_session_token'
const USER_KEY = 'smvec_user'
const VERIFIED_AT_KEY = 'smvec_session_verified_at'
const VERIFY_RETRY_COUNT = 1
const VERIFY_RETRY_DELAY_MS = 250
const EDGE_FN_TIMEOUT_MS = 10000
const VERIFY_CACHE_TTL_MS = 45000

const listeners = new Set()
let _memoryUser = null

class AuthApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

function notifyListeners(user) {
  listeners.forEach((fn) => fn(user))
}

export function normalizeMobile(input = '') {
  return String(input).replace(/\D/g, '').slice(0, 10)
}

export function onAuthChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function saveSession(sessionToken, user) {
  safeLocalStorageSet(SESSION_TOKEN_KEY, sessionToken)
  safeLocalStorageSet(USER_KEY, JSON.stringify(user))
  safeLocalStorageSet(VERIFIED_AT_KEY, String(Date.now()))
  _memoryUser = user
  notifyListeners(user)
}

function clearSession() {
  safeLocalStorageRemove(SESSION_TOKEN_KEY)
  safeLocalStorageRemove(USER_KEY)
  safeLocalStorageRemove(VERIFIED_AT_KEY)
  _memoryUser = null
  notifyListeners(null)
}

export function getSessionToken() {
  return safeLocalStorageGet(SESSION_TOKEN_KEY)
}

export function getUser() {
  try {
    const raw = safeLocalStorageGet(USER_KEY)
    if (!raw) return _memoryUser
    const parsed = JSON.parse(raw)
    _memoryUser = parsed
    return parsed
  } catch {
    return _memoryUser
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callEdgeFn(body) {
  if (!EDGE_FN_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase edge function is not configured.')
  }

  let res
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EDGE_FN_TIMEOUT_MS)
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    const rawMessage = String(error?.message || '').toLowerCase()
    const isAbortError =
      error?.name === 'AbortError' ||
      rawMessage.includes('aborted') ||
      rawMessage.includes('abort')

    const message = isAbortError
      ? 'Request timed out. Please check your internet connection and try again.'
      : 'Unable to connect right now. Please check your internet connection and try again.'

    throw new AuthApiError(message, 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AuthApiError(data?.error || 'Request failed', res.status)
  }

  return data
}

function extractOtp(responseData) {
  const directMatch = String(responseData ?? '').match(/\b\d{6}\b/)
  if (directMatch?.[0]) return directMatch[0]

  const candidates = [
    responseData?.otp,
    responseData?.OTP,
    responseData?.data?.otp,
    responseData?.data?.OTP,
    responseData?.message,
  ]

  for (const value of candidates) {
    const digits = String(value ?? '').match(/\d{6}/)
    if (digits?.[0]) return digits[0]
  }

  if (responseData && typeof responseData === 'object') {
    for (const [key, value] of Object.entries(responseData)) {
      if (!String(key).toLowerCase().includes('otp')) continue
      const keyMatch = String(value ?? '').match(/\b\d{6}\b/)
      if (keyMatch?.[0]) return keyMatch[0]
    }
  }

  throw new Error('OTP not returned by API.')
}

export async function sendOtp(mobileNumber) {
  const cleaned = normalizeMobile(mobileNumber)
  if (!/^\d{10}$/.test(cleaned)) {
    throw new Error('Enter a valid 10-digit mobile number.')
  }

  const response = await axios.post(OTP_API_URL, {
    mobile_number: cleaned,
  })

  return {
    otp: extractOtp(response.data),
    raw: response.data,
  }
}

export async function checkMobileStatus(mobileNumber) {
  const cleaned = normalizeMobile(mobileNumber)
  return callEdgeFn({
    action: 'check-mobile-status',
    mobile_number: cleaned,
  })
}

export async function login(mobileNumber, password) {
  const cleaned = normalizeMobile(mobileNumber)
  const data = await callEdgeFn({
    action: 'login',
    mobile_number: cleaned,
    password,
  })
  saveSession(data.session_token, data.user)
  return data
}

export async function otpLogin(mobileNumber) {
  const cleaned = normalizeMobile(mobileNumber)
  const data = await callEdgeFn({
    action: 'otp-login',
    mobile_number: cleaned,
  })
  saveSession(data.session_token, data.user)
  return data
}

export async function setPassword(mobileNumber, password) {
  const cleaned = normalizeMobile(mobileNumber)
  const data = await callEdgeFn({
    action: 'set-password',
    mobile_number: cleaned,
    password,
  })
  saveSession(data.session_token, data.user)
  return data
}

let _verifyPromise = null
let _verifyToken = null

export async function verifySession() {
  const token = getSessionToken()
  if (!token) return null
  const cachedUser = getUser()

  const verifiedAt = Number(safeLocalStorageGet(VERIFIED_AT_KEY) || 0)
  if (
    cachedUser &&
    Number.isFinite(verifiedAt) &&
    Date.now() - verifiedAt < VERIFY_CACHE_TTL_MS
  ) {
    return cachedUser
  }

  // Deduplicate concurrent calls for the same session token.
  if (_verifyPromise && _verifyToken === token) return _verifyPromise
  _verifyToken = token

  _verifyPromise = (async () => {
    let attempts = 0

    while (attempts <= VERIFY_RETRY_COUNT) {
      try {
        const data = await callEdgeFn({
          action: 'verify-session',
          session_token: token,
        })
        safeLocalStorageSet(USER_KEY, JSON.stringify(data.user))
        safeLocalStorageSet(VERIFIED_AT_KEY, String(Date.now()))
        _memoryUser = data.user
        return data.user
      } catch (error) {
        const isAuthFailure =
          error instanceof AuthApiError &&
          (error.status === 401 || error.status === 403)

        // Retry once before invalidating session to avoid race conditions
        // right after login or brief backend lag.
        if (isAuthFailure && getSessionToken() === token && attempts < VERIFY_RETRY_COUNT) {
          attempts += 1
          await delay(VERIFY_RETRY_DELAY_MS)
          continue
        }

        // Clear only for confirmed auth failures on the current token.
        if (isAuthFailure && getSessionToken() === token) {
          clearSession()
          return null
        }

        // Keep current local session data on transient errors.
        return getUser()
      }
    }

    return getUser()
  })()
    .finally(() => {
      if (_verifyToken === token) {
        _verifyPromise = null
        _verifyToken = null
      }
    })

  return _verifyPromise
}

export async function logout() {
  const token = getSessionToken()
  clearSession()

  if (token) {
    // Revoke backend session in background so UI logout stays instant.
    void callEdgeFn({ action: 'logout', session_token: token }).catch(() => {
      // Ignore background revoke failures; local logout already completed.
    })
  }
}
