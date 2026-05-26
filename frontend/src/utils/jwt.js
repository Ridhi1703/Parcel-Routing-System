// Minimal JWT decode (payload only, no verification — server validates)
export function jwtDecode(token) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(payload))
}
