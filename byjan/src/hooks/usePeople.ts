import { useMemo } from 'react';
import { contactsApi } from '../api';
import type { Person } from '../api/types';
import { useQuery } from './useApi';

/** People you share books with, keyed by initials (from GET /v1/contacts, cached). */
export function usePeople() {
  const { data } = useQuery(contactsApi.list, [], 'contacts');
  return useMemo(() => {
    const map: Record<string, Person> = {};
    (data ?? []).forEach(p => { map[p.initials] = p; });
    const name = (i: string) => map[i]?.name ?? i;
    const short = (i: string) => (i === 'AK' ? 'You' : map[i]?.short ?? map[i]?.name.split(' ')[0] ?? i);
    const vpa = (i: string) => map[i]?.upiId ?? '';
    return { list: data ?? [], map, name, short, vpa };
  }, [data]);
}
