import { describe, it, expect, vi } from 'vitest';
import { extractFacturaPath, getFacturaSignedUrl } from '../facturas';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    storage: {
      from: vi.fn().mockReturnThis(),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'http://signed' }, error: null }),
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('storage/facturas', () => {
  it('extractFacturaPath limpia URLs publicas', () => {
    const full = 'https://host/storage/v1/object/public/facturas/mi/factura.pdf';
    expect(extractFacturaPath(full)).toBe('mi/factura.pdf');
  });

  it('getFacturaSignedUrl solicita URL firmada', async () => {
    const url = await getFacturaSignedUrl('mi/factura.pdf');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('facturas');
    expect(url).toBe('http://signed');
  });
});
