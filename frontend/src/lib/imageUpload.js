import { getSessionToken } from './auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const R2_IMAGES_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/r2-images` : ''
const REQUEST_TIMEOUT_MS = 20000

export async function uploadAlumniImage(file, kind = 'profile') {
  if (!file) {
    throw new Error('Image file is required.')
  }

  if (!R2_IMAGES_FN_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Image upload service is not configured.')
  }

  if (kind !== 'profile' && kind !== 'cover') {
    throw new Error('Unsupported image type.')
  }

  const sessionToken = getSessionToken()
  if (!sessionToken) {
    throw new Error('Session expired. Please login again.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  formData.append('session_token', sessionToken)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(R2_IMAGES_FN_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload?.error || 'Image upload failed.')
    }

    const publicUrl = payload?.publicUrl
    if (!publicUrl) {
      throw new Error('Image uploaded, but public URL was not returned.')
    }

    return {
      publicUrl,
      key: payload?.key || '',
    }
  } catch (error) {
    const rawMessage = String(error?.message || '').toLowerCase()
    const isAbortError =
      error?.name === 'AbortError' ||
      rawMessage.includes('aborted') ||
      rawMessage.includes('abort')

    if (isAbortError) {
      throw new Error('Upload timed out. Please check your internet connection and try again.')
    }

    throw error instanceof Error ? error : new Error('Image upload failed.')
  } finally {
    clearTimeout(timeoutId)
  }
}
