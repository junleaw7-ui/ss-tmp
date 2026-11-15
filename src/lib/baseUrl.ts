export function getBaseUrl(): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? '');
  return base.replace(/\/+$/, '');
}
