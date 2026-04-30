import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOBILE_PATTERN = /^\d{10}$/
const PASSWORD_PLACEHOLDER = '__OTP_ONLY__'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      return jsonError('Supabase function secrets are missing.', 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const body = await req.json()
    const action = body?.action

    if (!action) {
      return jsonError('Action is required.', 400)
    }

    if (action === 'check-mobile-status') {
      const mobile = normalizeMobile(body.mobile_number)
      const role = await detectRole(supabase, mobile)
      const user = await getUserByMobile(supabase, mobile)

      if (user && user.role !== role) {
        await updateUserRole(supabase, user.id, role)
      }

      return jsonOk({
        mobile_number: mobile,
        role,
        is_staff: role === 'staff',
        user_exists: Boolean(user),
        has_password: hasPassword(user),
      })
    }

    if (action === 'otp-login') {
      const mobile = normalizeMobile(body.mobile_number)
      const role = await detectRole(supabase, mobile)
      const user = await ensureUser(supabase, mobile, role)
      const session = await createSession(supabase, user.id)

      return jsonOk({
        session_token: session.id,
        user: toPublicUser(user),
      })
    }

    if (action === 'set-password' || action === 'signup') {
      const mobile = normalizeMobile(body.mobile_number)
      const password = String(body.password || '')

      if (password.length < 8) {
        return jsonError('Password must be at least 8 characters.', 400)
      }

      const role = await detectRole(supabase, mobile)
      let user = await ensureUser(supabase, mobile, role)

      const hash = await hashPassword(supabase, password)
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: hash,
          role,
        })
        .eq('id', user.id)
        .select('id, mobile_number, role, password_hash')
        .single()

      if (updateError || !updated) {
        return jsonError(updateError?.message || 'Failed to save password.', 500)
      }

      user = updated
      const session = await createSession(supabase, user.id)

      return jsonOk({
        session_token: session.id,
        user: toPublicUser(user),
      })
    }

    if (action === 'login') {
      const mobile = normalizeMobile(body.mobile_number)
      const password = String(body.password || '')

      if (!password) {
        return jsonError('Password is required.', 400)
      }

      const role = await detectRole(supabase, mobile)
      const user = await getUserByMobile(supabase, mobile)

      if (!user || !hasPassword(user) || !user.password_hash) {
        return jsonError('Password is not set for this mobile number. Use OTP login.', 401)
      }

      const isValid = await verifyPassword(supabase, password, user.password_hash)
      if (!isValid) {
        return jsonError('Invalid login credentials.', 401)
      }

      if (user.role !== role) {
        await updateUserRole(supabase, user.id, role)
        user.role = role
      }

      const session = await createSession(supabase, user.id)
      return jsonOk({
        session_token: session.id,
        user: toPublicUser(user),
      })
    }

    if (action === 'verify-session') {
      const sessionToken = String(body.session_token || '')
      if (!sessionToken) {
        return jsonError('Session token is required.', 400)
      }

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, user_id, expires_at')
        .eq('id', sessionToken)
        .maybeSingle()

      if (sessionError || !session) {
        return jsonError('Invalid session.', 401)
      }

      if (new Date(session.expires_at) < new Date()) {
        await supabase.from('sessions').delete().eq('id', sessionToken)
        return jsonError('Session expired.', 401)
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, mobile_number, role, password_hash')
        .eq('id', session.user_id)
        .maybeSingle()

      if (userError || !user) {
        return jsonError('User not found.', 401)
      }

      const role = await detectRole(supabase, user.mobile_number)
      if (user.role !== role) {
        await updateUserRole(supabase, user.id, role)
        user.role = role
      }

      return jsonOk({ user: toPublicUser(user) })
    }

    if (action === 'logout') {
      const sessionToken = String(body.session_token || '')
      if (sessionToken) {
        await supabase.from('sessions').delete().eq('id', sessionToken)
      }
      return jsonOk({ success: true })
    }

    if (action === 'check-user') {
      const mobile = normalizeMobile(body.mobile_number)
      const user = await getUserByMobile(supabase, mobile)
      return jsonOk({
        exists: Boolean(user),
        has_password: hasPassword(user),
      })
    }

    return jsonError('Unknown action.', 400)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Internal server error.', 500)
  }
})

function normalizeMobile(value: unknown) {
  const mobile = String(value || '').replace(/\D/g, '').slice(0, 10)
  if (!MOBILE_PATTERN.test(mobile)) {
    throw new Error('Enter a valid 10-digit mobile number.')
  }
  return mobile
}

function hasPassword(user: Record<string, unknown> | null) {
  if (!user) return false
  const hash = String(user.password_hash || '').trim()
  if (!hash || hash === PASSWORD_PLACEHOLDER) return false
  return true
}

function toPublicUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    mobile_number: user.mobile_number,
    role: user.role,
    has_password: hasPassword(user),
  }
}

async function detectRole(supabase: ReturnType<typeof createClient>, mobile: string) {
  const { data } = await supabase
    .from('faculty_data')
    .select('mobile_number')
    .eq('mobile_number', mobile)
    .maybeSingle()

  return data ? 'staff' : 'alumni'
}

async function getUserByMobile(supabase: ReturnType<typeof createClient>, mobile: string) {
  const fallback = await supabase
    .from('users')
    .select('id, mobile_number, role, password_hash')
    .eq('mobile_number', mobile)
    .maybeSingle()

  if (fallback.error) {
    throw new Error(fallback.error.message)
  }

  return fallback.data
}

async function ensureUser(supabase: ReturnType<typeof createClient>, mobile: string, role: string) {
  const existing = await getUserByMobile(supabase, mobile)
  if (existing) {
    if (existing.role !== role) {
      await updateUserRole(supabase, existing.id as string, role)
      existing.role = role
    }
    return existing
  }

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({
      mobile_number: mobile,
      role,
      password_hash: PASSWORD_PLACEHOLDER,
    })
    .select('id, mobile_number, role, password_hash')
    .single()

  if (createError || !created) {
    throw new Error(createError?.message || 'Failed to create user.')
  }

  return created
}

async function updateUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role: string,
) {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)

  if (error) {
    throw new Error(error.message)
  }
}

async function createSession(supabase: ReturnType<typeof createClient>, userId: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create session.')
  }

  return data
}

async function hashPassword(supabase: ReturnType<typeof createClient>, rawPassword: string) {
  const { data, error } = await supabase.rpc('hash_password', {
    raw_password: rawPassword,
  })

  if (error || !data) {
    throw new Error(error?.message || 'Failed to hash password.')
  }

  return data
}

async function verifyPassword(
  supabase: ReturnType<typeof createClient>,
  rawPassword: string,
  hashedPassword: string,
) {
  const { data, error } = await supabase.rpc('verify_password', {
    raw_password: rawPassword,
    hashed_password: hashedPassword,
  })

  if (error) {
    throw new Error(error.message)
  }

  return Boolean(data)
}

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
