import { useState } from 'react';
import type { ConceptoVentaLocal, ConceptoCostoLocal } from '@/data/conceptoTypes';

interface UseConceptosFormOptions {
  ventaInicial?: ConceptoVentaLocal[];
  costoInicial?: ConceptoCostoLocal[];
}

function calcTotalVenta(c: ConceptoVentaLocal): number {
  return c.monto * 1.16;
}

function calcTotalCosto(c: ConceptoCostoLocal): number {
  return c.monto + (c.aplicaIva ? c.monto * 0.16 : 0);
}

export function useConceptosForm(opciones: UseConceptosFormOptions = {}) {
  const [conceptosVenta, setConceptosVenta] = useState<ConceptoVentaLocal[]>(
    opciones.ventaInicial ?? [{ id: 1, concepto: '', proveedor: '', monto: 0, moneda: 'MXN', total: 0 }]
  );
  const [conceptosCosto, setConceptosCosto] = useState<ConceptoCostoLocal[]>(
    opciones.costoInicial ?? [{ id: 1, proveedor: '', concepto: '', monto: 0, moneda: 'MXN', aplicaIva: false, total: 0 }]
  );
  const [nextVentaId, setNextVentaId] = useState(
    (opciones.ventaInicial?.length ?? 1) + 1
  );
  const [nextCostoId, setNextCostoId] = useState(
    (opciones.costoInicial?.length ?? 1) + 1
  );

  const updateConceptoVenta = (id: number, field: keyof ConceptoVentaLocal, value: string | number | boolean) => {
    setConceptosVenta(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      // Auto-recalcular total excepto cuando se edita total directamente
      if (field !== 'total') {
        updated.total = calcTotalVenta(updated);
      }
      return updated;
    }));
  };

  const addConceptoVenta = () => {
    setConceptosVenta(prev => [...prev, { id: nextVentaId, concepto: '', proveedor: '', monto: 0, moneda: 'MXN', total: 0 }]);
    setNextVentaId(n => n + 1);
  };

  const removeConceptoVenta = (id: number) => {
    setConceptosVenta(prev => prev.filter(c => c.id !== id));
  };

  const updateConceptoCosto = (id: number, field: keyof ConceptoCostoLocal, value: string | number | boolean) => {
    setConceptosCosto(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field !== 'total') {
        updated.total = calcTotalCosto(updated);
      }
      return updated;
    }));
  };

  const addConceptoCosto = () => {
    setConceptosCosto(prev => [...prev, { id: nextCostoId, proveedor: '', concepto: '', monto: 0, moneda: 'MXN', aplicaIva: false, total: 0 }]);
    setNextCostoId(n => n + 1);
  };

  const removeConceptoCosto = (id: number) => {
    setConceptosCosto(prev => prev.filter(c => c.id !== id));
  };

  const subtotalVenta = conceptosVenta.reduce((acc, c) => acc + c.monto, 0);
  const ivaVenta = subtotalVenta * 0.16;
  const totalVentaConIva = subtotalVenta + ivaVenta;

  const totalCosto = conceptosCosto.reduce((acc, c) => acc + c.total, 0);
  const ivaCosto = conceptosCosto.reduce((acc, c) => c.aplicaIva ? acc + (c.monto * 0.16) : acc, 0);
  const totalCostoConIva = totalCosto;

  const utilidadEstimada = totalVentaConIva - totalCostoConIva;

  /** Reemplaza los conceptos de venta (útil para pre-llenado en edición) */
  const inicializarVenta = (items: ConceptoVentaLocal[]) => {
    setConceptosVenta(items);
    setNextVentaId(items.length + 1);
  };

  /** Reemplaza los conceptos de costo (útil para pre-llenado en edición) */
  const inicializarCosto = (items: ConceptoCostoLocal[]) => {
    setConceptosCosto(items);
    setNextCostoId(items.length + 1);
  };

  return {
    conceptosVenta,
    conceptosCosto,
    updateConceptoVenta,
    addConceptoVenta,
    removeConceptoVenta,
    updateConceptoCosto,
    addConceptoCosto,
    removeConceptoCosto,
    subtotalVenta,
    ivaVenta,
    totalVentaConIva,
    totalCosto,
    ivaCosto,
    totalCostoConIva,
    utilidadEstimada,
    inicializarVenta,
    inicializarCosto,
  };
}
