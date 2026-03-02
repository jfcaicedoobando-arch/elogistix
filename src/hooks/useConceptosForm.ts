import { useState } from 'react';
import type { ConceptoVentaLocal, ConceptoCostoLocal } from '@/data/conceptoTypes';

interface UseConceptosFormOptions {
  ventaInicial?: ConceptoVentaLocal[];
  costoInicial?: ConceptoCostoLocal[];
}

export function useConceptosForm(opciones: UseConceptosFormOptions = {}) {
  const [conceptosVenta, setConceptosVenta] = useState<ConceptoVentaLocal[]>(
    opciones.ventaInicial ?? [{ id: 1, concepto: '', cantidad: 1, precioUnitario: 0, moneda: 'MXN' }]
  );
  const [conceptosCosto, setConceptosCosto] = useState<ConceptoCostoLocal[]>(
    opciones.costoInicial ?? [{ id: 1, proveedorId: '', concepto: '', monto: 0, moneda: 'MXN' }]
  );
  const [nextVentaId, setNextVentaId] = useState(
    (opciones.ventaInicial?.length ?? 1) + 1
  );
  const [nextCostoId, setNextCostoId] = useState(
    (opciones.costoInicial?.length ?? 1) + 1
  );

  const updateConceptoVenta = (id: number, field: keyof ConceptoVentaLocal, value: string | number) => {
    setConceptosVenta(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addConceptoVenta = () => {
    setConceptosVenta(prev => [...prev, { id: nextVentaId, concepto: '', cantidad: 1, precioUnitario: 0, moneda: 'MXN' }]);
    setNextVentaId(n => n + 1);
  };

  const removeConceptoVenta = (id: number) => {
    setConceptosVenta(prev => prev.filter(c => c.id !== id));
  };

  const updateConceptoCosto = (id: number, field: keyof ConceptoCostoLocal, value: string | number) => {
    setConceptosCosto(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addConceptoCosto = () => {
    setConceptosCosto(prev => [...prev, { id: nextCostoId, proveedorId: '', concepto: '', monto: 0, moneda: 'MXN' }]);
    setNextCostoId(n => n + 1);
  };

  const removeConceptoCosto = (id: number) => {
    setConceptosCosto(prev => prev.filter(c => c.id !== id));
  };

  const subtotalVenta = conceptosVenta.reduce((acc, c) => acc + (c.cantidad * c.precioUnitario), 0);
  const totalCosto = conceptosCosto.reduce((acc, c) => acc + c.monto, 0);
  const utilidadEstimada = subtotalVenta - totalCosto;

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
    totalCosto,
    utilidadEstimada,
    inicializarVenta,
    inicializarCosto,
  };
}
