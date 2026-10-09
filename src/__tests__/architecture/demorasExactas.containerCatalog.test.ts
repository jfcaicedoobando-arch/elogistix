/** Guarda estática: esta corrección del catálogo no debe crear equivalencias comerciales en el tabulador. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(resolve(import.meta.dirname, '../../../supabase/schema/embarques/calcular_costo_demoras.sql'), 'utf8');

describe('demoras conserva tabulador por UUID exacto', () => {
  it('busca los tramos por condición y tipo exactos, sin normalizar GP a Dry', () => {
    expect(sql).toMatch(/WHERE naviera_condicion_id = p_naviera_condicion_id\s+AND tipo_contenedor_id = p_tipo_contenedor_id/);
    expect(sql).not.toMatch(/idsEquivalentes|20GP|20DRY|20DV/);
  });
});
