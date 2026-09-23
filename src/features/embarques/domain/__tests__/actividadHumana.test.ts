import { describe, expect, it } from 'vitest';
import {
  detallesLegibles,
  esValorTecnico,
  etiquetaEvento,
  humanizarClave,
} from '@/features/embarques/domain/actividadHumana';

const UUID = '5837e08f-2aca-4646-9c27-1c4e7d6323ea';

describe('actividadHumana (P2-2)', () => {
  it('traduce los eventos habituales a español', () => {
    expect(etiquetaEvento('factura.borrador_generado')).toBe('Se generó un borrador de factura');
    expect(etiquetaEvento('cambio_financiero_facturas')).toBe('Cambio financiero en facturas');
    expect(etiquetaEvento('tarifa_decision_aplicada')).toBe('Se aplicó la decisión de tarifa');
  });

  it('un evento desconocido cae a un texto legible, nunca snake_case', () => {
    expect(etiquetaEvento('evento.inventado_por_backend')).toBe('Evento inventado por backend');
    expect(humanizarClave('otra_clave_nueva')).toBe('Otra clave nueva');
    expect(etiquetaEvento('')).toBe('Actividad registrada');
    expect(etiquetaEvento(null)).toBe('Actividad registrada');
  });

  it('los UUID, ids y objetos se consideran técnicos', () => {
    expect(esValorTecnico('serie_id', UUID)).toBe(true);
    expect(esValorTecnico('embarque_ids', [UUID])).toBe(true);
    expect(esValorTecnico('payload', { a: 1 })).toBe(true);
    expect(esValorTecnico('motivo', 'Cliente solicitó cambio')).toBe(false);
  });

  it('la lectura principal no incluye UUID ni JSON crudo', () => {
    const pares = detallesLegibles({
      serie_id: UUID,
      embarque_ids: [UUID, UUID],
      motivo: 'Ajuste de tarifa',
      dias_excedidos: 3,
      sinEventos: false,
      anidado: { x: 1 },
    });
    const texto = pares.map(([k, v]) => `${k}: ${v}`).join(' · ');
    expect(texto).not.toContain(UUID);
    expect(texto).not.toContain('{');
    expect(texto).toContain('Motivo: Ajuste de tarifa');
    expect(texto).toContain('Días excedidos: 3');
    expect(texto).toContain('Sin eventos en timeline: No');
  });
});
