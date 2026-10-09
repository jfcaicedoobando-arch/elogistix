import { describe, expect, it } from 'vitest';
import { claveIdentidadCatalogo, claveCanonicaTipoContenedor, dedupeTiposContenedor, idsEquivalentesDeTipo, resolverIdCanonicoTipo } from '../tiposContenedorCanonico';
import { resolverTipoId } from '@/features/cotizacion/components/seccionRuta/resolverCatalogos';
import type { TipoContenedor } from '@/features/catalogos/services/catalogosTypes';

const tipo = (id: string, code: string, name: string, created_at = '2026-01-01'): TipoContenedor => ({ id, code, name, created_at, activo: true });
const rows = [
  tipo('gp', '20GP', "20' GP"),
  tipo('dry', '20DRY', "20' Dry (Standard)"),
  tipo('dv', '20DV', "20' Dry (Standard)", '2026-02-01'),
  tipo('st', '20ST', '20 Estándar', '2026-03-01'),
  tipo('hc', '40HC', "40' High Cube"),
];

describe('catálogo contenedor: GP separado de Dry', () => {
  it('conserva DRY/DV/ST como duplicados e independiza GP', () => {
    const catalogo = dedupeTiposContenedor(rows);
    expect(catalogo).toHaveLength(3);
    expect(idsEquivalentesDeTipo(catalogo, 'dry')).toEqual(['dry', 'dv', 'st']);
    expect(idsEquivalentesDeTipo(catalogo, 'gp')).toEqual(['gp']);
    expect(resolverIdCanonicoTipo(catalogo, 'dv')).toBe('dry');
    expect(resolverIdCanonicoTipo(catalogo, 'gp')).toBe('gp');
  });

  it('resuelve el nombre Dry exacto ofrecido por el wizard al UUID de Dry', () => {
    const catalogo = dedupeTiposContenedor(rows);
    expect(resolverTipoId("20' Dry (Standard)", catalogo)).toBe('dry');
    expect(resolverTipoId("20' GP", catalogo)).toBe('gp');
  });

  it('no confunde GP con Dry aunque cambie el orden o gane el UUID GP', () => {
    const empate = [tipo('000-gp', '20GP', "20' GP"), tipo('zzz-dry', '20DRY', "20' Dry (Standard)")];
    expect(dedupeTiposContenedor(empate)).toEqual(dedupeTiposContenedor([...empate].reverse()));
    expect(idsEquivalentesDeTipo(dedupeTiposContenedor(empate), '000-gp')).toEqual(['000-gp']);
    expect(claveIdentidadCatalogo(empate[0])).not.toBe(claveIdentidadCatalogo(empate[1]));
    expect(claveCanonicaTipoContenedor(empate[0])).toBe(claveCanonicaTipoContenedor(empate[1]));
  });

  it('conserva tamaño, High Cube y fallback desconocido', () => {
    expect(claveCanonicaTipoContenedor(tipo('hc', '40HC', "40' High Cube"))).toBe('40|hc');
    expect(resolverTipoId("40' High Cube", dedupeTiposContenedor(rows))).toBe('hc');
    expect(resolverIdCanonicoTipo(dedupeTiposContenedor(rows), 'legacy-no-disponible')).toBe('legacy-no-disponible');
    expect(claveCanonicaTipoContenedor(tipo('gp40', '40GP', "40' GP"))).not.toBe(claveCanonicaTipoContenedor(rows[0]));
  });
});
