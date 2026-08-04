import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('storage/index', () => {
  beforeEach(() => {
    mockSupabase.storage.from.mockClear();
    mockSupabase.storage.upload.mockClear();
    mockSupabase.storage.upload.mockResolvedValue({ data: { path: 'test' }, error: null });
  });


  it('uploadFile sube archivo al bucket correcto', async () => {
    const file = new File([''], 'test.txt');
    await uploadFile('path/to/file', file);
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('documentos');
    expect(mockSupabase.storage.upload).toHaveBeenCalledWith('path/to/file', file, expect.any(Object));
  });

  it('uploadFile lanza error si la subida falla', async () => {
    mockSupabase.storage.upload.mockResolvedValueOnce({ data: null, error: new Error('Upload Failed') });
    const file = new File([''], 'test.txt');
    await expect(uploadFile('path', file)).rejects.toThrow('Upload Failed');
  });

  it('uploadFile traduce el error de RLS a es-MX', async () => {
    mockSupabase.storage.upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });
    const file = new File([''], 'test.txt');
    await expect(uploadFile('path', file)).rejects.toThrow(/No tienes permisos/i);
  });
});

