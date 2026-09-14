export const ROLE_LABEL: Record<string, string> = {
  owner: 'Admin',
  admin: 'Manager',
  contributor: 'Can add',
  auditor: 'Can check',
  viewer: 'Can view',
};

export function roleLabel(role?: string | null) {
  const key = String(role || '').toLowerCase();
  return ROLE_LABEL[key] || 'Can view';
}

export function roleHint(role?: string | null) {
  const key = String(role || '').toLowerCase();
  if (key === 'owner') return 'Full control, including people and delete';
  if (key === 'admin') return 'Can manage entries and people';
  if (key === 'contributor') return 'Can add and edit entries';
  if (key === 'auditor') return 'Can review, cannot change';
  return 'Can look, cannot change';
}
