import type { BooksRole } from './types';

export type BooksAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'post'
  | 'reverse'
  | 'void'
  | 'close_period'
  | 'manage_settings';

const MATRIX: Record<BooksRole, BooksAction[]> = {
  owner: ['view', 'create', 'edit', 'post', 'reverse', 'void', 'close_period', 'manage_settings'],
  admin: ['view', 'create', 'edit', 'post', 'reverse', 'void', 'close_period', 'manage_settings'],
  contributor: ['view', 'create', 'edit', 'post', 'reverse', 'void'],
  auditor: ['view'],
  viewer: ['view'],
};

export function can(role: BooksRole | null | undefined, action: BooksAction): boolean {
  if (!role) return false;
  return MATRIX[role].includes(action);
}

export function assertCan(role: BooksRole | null | undefined, action: BooksAction): void {
  if (!can(role, action)) throw new Error('You do not have permission for this action');
}
