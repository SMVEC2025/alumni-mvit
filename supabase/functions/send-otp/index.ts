import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const OTP_API_URL = 'https://application.smvec.ac.in/custom/service/v4_1_custom/rest.php'
const MOBILE_PATTERN = /^\d{10}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonError('Method not allowed.', 405)
    }

    const body = await req.json().catch(() => ({}))
    const mobile = normalizeMobile(body?.mobile_number)

    const apiUser = Deno.env.get('API_USER')
    const apiKey = Deno.env.get('API_KEY')
    if (!apiUser || !apiKey) {
      return jsonError('OTP provider credentials are missing.', 500)
    }

    const data = new URLSearchParams({
      method: 'send_otp',
      input_type: 'JSON',
      response_type: 'JSON',
      rest_data: JSON.stringify({
        mobile_number: mobile,
        user: apiUser,
        key: apiKey,
      }),
    })

    let providerRes: Response
    try {
      providerRes = await fetch(OTP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      })
    } catch {
      return jsonError('Failed to reach OTP provider.', 502)
    }

    const responseText = await providerRes.text()
    let providerData: unknown = {}
    if (responseText) {
      try {
        providerData = JSON.parse(responseText)
      } catch {
        providerData = { message: responseText }
      }
    }

    if (!providerRes.ok) {
      const fallback = 'OTP provider rejected the request.'
      let message = fallback
      if (providerData && typeof providerData === 'object') {
        const payload = providerData as Record<string, unknown>
        message = String(payload.error || payload.message || fallback)
      }
      return jsonError(message, 502)
    }

    const otp = extractOtp(providerData)
    return jsonOk({
      otp,
      raw: providerData,
    })
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

function extractOtp(responseData: unknown) {
  const directMatch = String(responseData ?? '').match(/\b\d{6}\b/)
  if (directMatch?.[0]) return directMatch[0]

  const payload =
    responseData && typeof responseData === 'object'
      ? (responseData as Record<string, unknown>)
      : {}
  const nestedData =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null

  const candidates = [
    payload.otp,
    payload.OTP,
    nestedData?.otp,
    nestedData?.OTP,
    payload.message,
  ]

  for (const value of candidates) {
    const digits = String(value ?? '').match(/\d{6}/)
    if (digits?.[0]) return digits[0]
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!String(key).toLowerCase().includes('otp')) continue
    const keyMatch = String(value ?? '').match(/\b\d{6}\b/)
    if (keyMatch?.[0]) return keyMatch[0]
  }

  throw new Error('OTP not returned by provider.')
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
