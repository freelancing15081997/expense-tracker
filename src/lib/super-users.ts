function parseEmails(raw: string) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

const BUILTIN_SUPER_USER_EMAILS = [
  'pujaribadrinath@gmail.com',
  'byjanbooks@gmail.com',
];

export function superUserEmailList() {
  const extra = parseEmails(String(import.meta.env.VITE_SUPER_USER_EMAILS || ''));
  return [...new Set([...BUILTIN_SUPER_USER_EMAILS, ...extra])];
}

export function emailIsSuperUser(email?: string | null) {
  const needle = String(email || '').trim().toLowerCase();
  return Boolean(needle) && superUserEmailList().includes(needle);
}
