

## Plan: Corregir pre-llenado Paso 2 → Paso 3

### Cambios

**1. `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`**
- Quitar `onCostosChange` de la interfaz `Props` (línea 34)
- Quitar el `useEffect` que llama `onCostosChange` (líneas 58-60)
- Cambiar import de `useMemo, useEffect` a solo `useMemo` (línea 1)

**2. `src/pages/NuevaCotizacion.tsx`**
- Línea 538: quitar `onCostosChange={(costos) => setCostosInternos(costos)}` del componente
- Eliminar el `useEffect` de pre-llenado (líneas 180-213) — ya no se necesita
- En `handleSiguiente` cuando `currentStep === 2` (líneas 320-342): después del `await upsertCostos`, ejecutar el pre-llenado directamente antes de `setCurrentStep(3)`:

```tsx
} else if (currentStep === 2) {
  try {
    if (costosInternos.length > 0 && cotizacionId) {
      // ... upsert costos (sin cambio)
      await upsertCostos.mutateAsync({ cotizacionId, costos });
    }
    // Pre-llenar Paso 3 directamente
    if (!costosPreLlenados && costosInternos.length > 0) {
      const usdFromCostos = costosInternos
        .filter(c => c.moneda === 'USD' && c.concepto.trim())
        .map(c => {
          const tieneIva = CONCEPTOS_CON_IVA_USD.includes(c.concepto);
          return { descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad, precio_unitario: c.precio_venta, moneda: 'USD' as const, aplica_iva: tieneIva, total: c.cantidad * c.precio_venta * (tieneIva ? 1.16 : 1) };
        });
      const mxnFromCostos = costosInternos
        .filter(c => c.moneda === 'MXN' && c.concepto.trim())
        .map(c => ({ descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad, precio_unitario: c.precio_venta, moneda: 'MXN' as const, aplica_iva: true, total: c.cantidad * c.precio_venta * 1.16 }));
      if (usdFromCostos.length > 0) setConceptosUSD(usdFromCostos);
      if (mxnFromCostos.length > 0) setConceptosMXN(mxnFromCostos);
      setCostosPreLlenados(true);
    }
    setCurrentStep(3);
  } catch (err: any) {
    toast({ title: "Error al guardar costos", description: err.message, variant: "destructive" });
  }
}
```

**3. `src/pages/Changelog.tsx`** — entrada v4.11.2

