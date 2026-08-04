/**
 * v13.420.0 (Sentry JAVASCRIPT-REACT-4M) — Verifica que las rutas del bucket
 * `documentos` inicien con el organization_id, como exige la RLS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import {
  buildMsdsPath,
  buildCotizacionDocPath,
  buildEmbarqueDocOrgPath,
  resolverOrgIdActual,
} from '../orgPath';

const ORG = '00000000-0000-0000-0000-000000000001';

describe('orgPath', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: ORG, error: null });
  });

  it('MSDS inicia con el organization_id y carpeta msds', async () => {
    const path = await buildMsdsPath('hoja seguridad (1).pdf');
    expect(path.startsWith(`${ORG}/msds/`)).toBe(true);
    expect(path).toMatch(/\.pdf$/);
    expect(path).not.toMatch(/[()\s]/);
  });

  it('adjunto de cotización inicia con el organization_id', async () => {
    const path = await buildCotizacionDocPath('COT-0001', 'anexo.pdf');
    expect(path.startsWith(`${ORG}/cotizaciones/COT-0001/`)).toBe(true);
  });

  it('documento de embarque usa {org}/embarques/{expediente}/{doc}', async () => {
    const path = await buildEmbarqueDocOrgPath('ELIMP00012', 'BL Master', 'bl.pdf');
    expect(path.startsWith(`${ORG}/embarques/ELIMP00012/BL_Master/`)).toBe(true);
  });

  it('falla claro cuando no hay organización activa', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(resolverOrgIdActual()).rejects.toThrow(/organización activa/i);
  });
});
