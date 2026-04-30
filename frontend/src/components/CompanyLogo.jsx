import { useEffect, useMemo, useState } from 'react'
import { getCompanyLogoEntry } from '../lib/companyLogo'

function CompanyLogo({ company, className = '', fallback = null, alt }) {
  const [loadError, setLoadError] = useState(false)
  const companyEntry = useMemo(() => getCompanyLogoEntry(company), [company])
  const logoUrl = companyEntry?.logoUrl || ''

  useEffect(() => {
    setLoadError(false)
  }, [logoUrl])

  if (!logoUrl || loadError) return fallback

  return (
    <img
      src={logoUrl}
      alt={alt || `${companyEntry?.label || company || 'Company'} logo`}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setLoadError(true)}
    />
  )
}

export default CompanyLogo

