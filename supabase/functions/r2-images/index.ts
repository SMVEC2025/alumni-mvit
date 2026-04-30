import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.922.0'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const r2AccountId = Deno.env.get('R2_ACCOUNT_ID')
    const r2AccessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const r2SecretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const r2Bucket = Deno.env.get('R2_BUCKET')
    const r2PublicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL')

    if (!supabaseUrl || !serviceKey) {
      return jsonError('Supabase function secrets are missing.', 500)
    }

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket || !r2PublicBaseUrl) {
      return jsonError('R2 upload secrets are missing.', 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    })

    const formData = await req.formData()
    const rawKind = String(formData.get('kind') || 'profile').toLowerCase()
    const kind = rawKind === 'cover' ? 'cover' : rawKind === 'profile' ? 'profile' : ''
    if (!kind) {
      return jsonError('Invalid upload kind.', 400)
    }

    const sessionToken = String(formData.get('session_token') || '').trim()
    if (!sessionToken) {
      return jsonError('Session token is required.', 401)
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return jsonError('Image file is required.', 400)
    }

    if (!ALLOWED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
      return jsonError('Only JPG, PNG, and WEBP images are allowed.', 400)
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError('Image must be 3MB or less.', 400)
    }

    const session = await getSession(supabase, sessionToken)
    if (!session) {
      return jsonError('Invalid or expired session.', 401)
    }

    const folder = kind === 'cover' ? 'covers' : 'profile'
    const objectKey = `${session.userId}/${folder}/current`
    const body = new Uint8Array(await file.arrayBuffer())

    await s3.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: objectKey,
      Body: body,
      ContentType: file.type,
      CacheControl: 'public, max-age=60, must-revalidate',
    }))

    const publicBase = String(r2PublicBaseUrl).replace(/\/+$/, '')
    const publicUrl = `${publicBase}/${objectKey}`

    return jsonOk({
      key: objectKey,
      publicUrl,
      kind,
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Internal server error.', 500)
  }
})

async function getSession(
  supabase: ReturnType<typeof createClient>,
  sessionToken: string,
) {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('id', sessionToken)
    .maybeSingle()

  if (error || !session) return null

  const expiresAt = new Date(String(session.expires_at))
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    await supabase.from('sessions').delete().eq('id', sessionToken)
    return null
  }

  return { userId: String(session.user_id) }
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
