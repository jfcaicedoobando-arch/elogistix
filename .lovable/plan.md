

## Plan: Corregir validación Paso 3 → Paso 4

### Cambio único en `src/pages/NuevaCotizacion.tsx` (líneas 343-362)

Reemplazar la validación actual que rechaza conceptos con descripción vacía por un filtro que los ignora, y usar solo los válidos al guardar:

```tsx
} else if (currentStep === 3) {
  const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion && c.descripcion.trim() !== '');
  const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion && c.descripcion.trim() !== '');
  
  if (conceptosUSDValidos.length === 0 && conceptosMXNValidos.length === 0) {
    toast({ title: "Agrega al menos un concepto de venta", variant: "destructive" });
    return;
  }
  
  try {
    if (cotizacionId) {
      await updateCotizacion.mutateAsync({
        id: cotizacionId,
        data: {
          conceptos_venta: [...conceptosUSDValidos, ...conceptosMXNValidos],
          subtotal: totalUSD,
        },
      });
    }
    setCurrentStep(4);
  } catch (err: any) {
    toast({ title: "Error al guardar conceptos de venta", description: err.message, variant: "destructive" });
  }
}
```

### Changelog — entrada v4.11.1

