import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export const FACTURA_ID = '11111111-1111-1111-1111-111111111111';
export const contacts = [
  { id: 'recent', organization_id: 'org-a', deleted_at: null, cliente_id: 'cliente-a', email: 'reciente@example.test', created_at: '2026-10-02' },
  { id: 'empty', organization_id: 'org-a', deleted_at: null, cliente_id: 'cliente-a', email: null, created_at: '2026-01-01' },
  { id: 'first', organization_id: 'org-a', deleted_at: null, cliente_id: 'cliente-a', email: 'anterior@example.test', created_at: '2026-02-01' },
  { id: 'foreign', organization_id: 'org-b', deleted_at: null, cliente_id: 'cliente-b', email: 'ajeno@example.test', created_at: '2026-01-01' },
];
type Row = Record<string, unknown>;

export function fakeClient(options: { contacts?: Row[]; factura?: Row | null; contactError?: boolean } = {}) {
  const writes = vi.fn(() => { throw new Error('La consulta no puede escribir'); });
  const from = vi.fn((table: string) => {
    let rows: Row[] = table === 'facturas'
      ? (options.factura === null ? [] : [options.factura ?? { id: FACTURA_ID, organization_id: 'org-a', cliente_id: 'cliente-a' }])
      : table === 'clientes' ? [{ id: 'cliente-a', organization_id: 'org-a', deleted_at: null, email: 'principal@example.test' }]
      : options.contacts ?? contacts;
    const error = table === 'contactos_cliente' && options.contactError ? new Error('lectura fallida') : null;
    const result = () => ({ data: rows, error });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return query; }),
      is: vi.fn((field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return query; }),
      not: vi.fn((field: string) => { rows = rows.filter(row => row[field] !== null); return query; }),
      order: vi.fn((field: string, { ascending }: { ascending: boolean }) => {
        rows = [...rows].sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (ascending ? 1 : -1));
        return query;
      }),
      limit: vi.fn((limit: number) => { rows = rows.slice(0, limit); return query; }),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error })),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      insert: writes, update: writes, delete: writes,
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, writes };
}
