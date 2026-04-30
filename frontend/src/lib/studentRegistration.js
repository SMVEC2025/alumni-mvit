import { getSupabaseWithSession } from './supabaseClient'

const registrationTable = 'alumni_registrations'
const userIdColumn = 'user_id'
const emailColumn = 'email'
const phoneColumn = 'phone'

export async function isStudentRegistered(user) {
  if (!user) return { registered: false, error: 'Missing user.' }

  const supabase = getSupabaseWithSession()
  if (!supabase) {
    return { registered: false, error: 'Session not available.' }
  }

  const idCheck = await supabase
    .from(registrationTable)
    .select('id')
    .eq(userIdColumn, user.id)
    .limit(1)
    .maybeSingle()

  if (!idCheck.error && idCheck.data) {
    return { registered: true, error: null }
  }

  if (user.email) {
    const emailCheck = await supabase
      .from(registrationTable)
      .select('id')
      .eq(emailColumn, user.email)
      .limit(1)
      .maybeSingle()

    if (!emailCheck.error && emailCheck.data) {
      return { registered: true, error: null }
    }
  }

  if (user.mobile_number) {
    const mobileCheck = await supabase
      .from(registrationTable)
      .select('id')
      .eq(phoneColumn, user.mobile_number)
      .limit(1)
      .maybeSingle()

    if (!mobileCheck.error && mobileCheck.data) {
      return { registered: true, error: null }
    }
  }

  return { registered: false, error: idCheck.error?.message || null }
}
