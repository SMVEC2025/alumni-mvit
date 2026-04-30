const DIRECTORY_SELECT =
  'id, first_name, last_name, email, phone, show_phone, department, degree, year_of_completion, company, designation, work_experiences, city, state, profile_image_url, cover_image_url, linkedin_url, is_disabled'

function escapeLike(value) {
  return String(value || '').replace(/[%_]/g, '\\$&')
}

function buildFlexiblePattern(value) {
  const compact = String(value || '').trim().replace(/\s+/g, ' ')
  if (!compact) return ''
  const escaped = escapeLike(compact)
  const tokens = escaped
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length <= 1) return `%${escaped}%`
  return `%${tokens.join('%')}%`
}

function buildIlikeOr(field, values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => `${field}.ilike.${buildFlexiblePattern(value)}`)
}

function buildWorkExperienceCompanyOr(values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => !value.includes(','))
    .map((value) => `work_experiences.cs.${JSON.stringify([{ company: value }])}`)
}

function applyDirectoryFilters(query, params) {
  const {
    user,
    filters,
    search,
    staffVisibilityFilter,
    departmentTerm,
    cityTerms = [],
    companyTerms = [],
  } = params

  if (user?.role !== 'staff') {
    query = query.eq('is_disabled', false)
  } else if (staffVisibilityFilter === 'disabled') {
    query = query.eq('is_disabled', true)
  }

  if (filters.dept) {
    query = query.ilike('department', departmentTerm || filters.dept)
  }

  if (filters.year) {
    query = query.eq('year_of_completion', Number(filters.year))
  }

  if (filters.city && cityTerms.length > 0) {
    query = query.or(buildIlikeOr('city', cityTerms).join(','))
  }

  if (filters.company && companyTerms.length > 0) {
    const companyFilters = [
      ...buildIlikeOr('company', companyTerms),
      ...buildWorkExperienceCompanyOr(companyTerms),
    ]
    query = query.or(companyFilters.join(','))
  }

  const trimmedSearch = String(search || '').trim()
  if (trimmedSearch) {
    const searchFilters = [
      ...buildIlikeOr('first_name', [trimmedSearch]),
      ...buildIlikeOr('last_name', [trimmedSearch]),
      ...buildIlikeOr('email', [trimmedSearch]),
      ...buildIlikeOr('company', [trimmedSearch]),
      ...buildIlikeOr('designation', [trimmedSearch]),
      ...buildIlikeOr('city', [trimmedSearch]),
    ]
    query = query.or(searchFilters.join(','))
  }

  return query
}

function applyDirectorySort(query, sortBy) {
  if (sortBy === 'name') {
    return query.order('first_name', { ascending: true }).order('last_name', { ascending: true })
  }

  if (sortBy === 'company') {
    return query.order('company', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  }

  return query.order('created_at', { ascending: false }).order('id', { ascending: false })
}

export async function fetchDirectoryPage({
  supabase,
  user,
  page = 1,
  limit = 50,
  filters,
  search,
  sortBy,
  staffVisibilityFilter,
  departmentTerm,
  cityTerms,
  companyTerms,
}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.max(Number(limit) || 50, 1)
  const from = (safePage - 1) * safeLimit
  const to = from + safeLimit - 1

  let query = supabase
    .from('alumni_registrations')
    .select(DIRECTORY_SELECT, { count: 'exact' })

  query = applyDirectoryFilters(query, {
    user,
    filters,
    search,
    staffVisibilityFilter,
    departmentTerm,
    cityTerms,
    companyTerms,
  })
  query = applyDirectorySort(query, sortBy).range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  const rows = data ?? []
  return {
    rows,
    total: count ?? rows.length,
    page: safePage,
    limit: safeLimit,
    hasMore: from + rows.length < (count ?? 0),
  }
}

export async function fetchDirectoryFilterMetadata({ supabase, user }) {
  let query = supabase
    .from('alumni_registrations')
    .select('department, year_of_completion')
    .limit(5000)

  if (user?.role !== 'staff') {
    query = query.eq('is_disabled', false)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
