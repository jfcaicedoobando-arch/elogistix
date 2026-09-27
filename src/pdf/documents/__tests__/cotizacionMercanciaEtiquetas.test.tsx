import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeCotizacionRow } from '@/test/fixtures/cotizacionFactory';
import { buildMercancia } from '@/generators/cotizacion/datosGenerales';
import { SeccionDatosYMercancia } from '../cotizacionSections';

const descripcion = 'Refacciones de válvulas y sensores para línea de producción en Apodaca.\nSeis cajas sobre dos tarimas.';
describe('campos de mercancía independientes en PDF', () => {
  it.each(['', '   ', undefined])('sector vacío %s no toma prestada la descripción', sector_economico => {
    const c = makeCotizacionRow({ sector_economico, descripcion_mercancia: descripcion });
    expect(buildMercancia(c)).toContainEqual(['Sector Económico', '—']);
    expect(buildMercancia(c).some(([k, v]) => k === 'Sector Económico' && v === descripcion)).toBe(false);
  });

  it('sector, mercancía y descripción adicional conservan sus etiquetas y aparecen una sola vez', () => {
    const c = makeCotizacionRow({ sector_economico: 'Manufactura', descripcion_mercancia: descripcion, descripcion_adicional: 'Entrega final en Parque Industrial Apodaca.' });
    expect(buildMercancia(c)).toContainEqual(['Sector Económico', 'Manufactura']);
    const { container } = render(<SeccionDatosYMercancia c={c} />);
    expect(screen.getByText('Descripción de la mercancía')).toBeInTheDocument();
    expect(screen.getByText('Descripción Adicional')).toBeInTheDocument();
    expect(container.textContent?.split(descripcion)).toHaveLength(2);
    expect(container.textContent).toContain('Manufactura');
    expect(container.textContent).toContain('Parque Industrial Apodaca');
  });

  it('omite el bloque vacío sin inventar mercancía a partir del sector', () => {
    render(<SeccionDatosYMercancia c={makeCotizacionRow({ sector_economico: 'Manufactura', descripcion_mercancia: '   ' })} />);
    expect(screen.queryByText('Descripción de la mercancía')).not.toBeInTheDocument();
    expect(screen.getByText('Manufactura')).toBeInTheDocument();
  });

  it('conserva párrafos largos separados y el orden íntegro del contenido', () => {
    const parrafos = Array.from({ length: 8 }, (_, i) => `Partida ${i + 1}: refacciones industriales embaladas para entrega en Apodaca, Nuevo León.`);
    render(<SeccionDatosYMercancia c={makeCotizacionRow({ descripcion_mercancia: parrafos.join('\r\n\r\n'), sector_economico: 'Manufactura' })} />);
    const nodos = parrafos.map(p => screen.getByText(p));
    expect(new Set(nodos).size).toBe(parrafos.length);
    expect(nodos.map(n => n.textContent)).toEqual(parrafos);
    expect(screen.getAllByText('Descripción de la mercancía')).toHaveLength(1);
  });
});
