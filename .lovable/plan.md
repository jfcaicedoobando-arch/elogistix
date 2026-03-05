

## Plan: Guardado progresivo por paso en el wizard de cotización

### Resumen

Actualmente todo se guarda al final (Paso 4). Se modificará para guardar en cada paso, creando la cotización en Paso 1 y actualizándola progresivamente.

### Cambios

**Archivo 1: `src/hooks/useCotizaciones.ts`** — Agregar `useUpdateCotizacion`

Nuevo hook `useUpdateCotizacion` que recibe `{ id, data }` y hace `UPDATE` en la tabla `cotizaciones`. Invalida queries al completar.

```ts
export function useUpdateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCotizacionInput> }) => {
      const updatePayload: any = { ...data };
      if (data.conceptos_venta) updatePayload.conceptos_venta = data.conceptos_venta as unknown as Json;
      if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = data.dimensiones_lcl as unknown as Json;
      if (data.dimensiones_aereas) updatePayload.dimensiones_aereas = data.dimensiones_aereas as unknown as Json;
      // Cast enums
      if (data.modo) updatePayload.modo = data.modo as any;
      if (data.tipo) updatePayload.tipo = data.tipo as any;
      if (data.incoterm) updatePayload.incoterm = data.incoterm as any;
      if (data.moneda) updatePayload.moneda = data.moneda as any;
      const { error } = await supabase.from('cotizaciones').update(updatePayload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['cotizaciones', vars.id] });
    },
  });
}
```

**Archivo 2: `src/pages/NuevaCotizacion.tsx`** — Guardado progresivo

1. **Nuevo estado**: `const [cotizacionId, setCotizacionId] = useState<string | null>(null)`

2. **Importar** `useUpdateCotizacion` y instanciarlo.

3. **Reemplazar el onClick del botón "Siguiente"** (línea ~637) con una función `handleSiguiente` que:

   - **Paso 1 → 2**: Valida cliente/prospecto. Si no hay `cotizacionId`, llama `crearCotizacion.mutateAsync(...)` con todos los datos del paso 1 y guarda el id. Si ya hay `cotizacionId`, llama `updateCotizacion.mutateAsync({ id: cotizacionId, data: {...} })`. En error: toast y no avanza.

   - **Paso 2 → 3**: Si `costosInternos.length > 0`, llama `upsertCostos.mutateAsync({ cotizacionId, costos })`. Avanza y ejecuta pre-llenado. En error: toast y no avanza.

   - **Paso 3 → 4**: Llama `updateCotizacion.mutateAsync({ id: cotizacionId, data: { conceptos_venta: [...conceptosUSD, ...conceptosMXN], subtotal: totalUSD } })`. En error: toast y no avanza.

4. **Reemplazar `handleGuardar`** (Paso 4): Solo actualiza estado a `'Borrador'`, registra bitácora, toast de éxito y navega a `/cotizaciones/${cotizacionId}`.

5. **Mover la lógica de cálculo de peso/volumen/piezas y subida de MSDS** al handler del Paso 1 (ya que se necesitan para el INSERT/UPDATE).

6. **Disabled del botón**: agregar `updateCotizacion.isPending` a la condición.

**Archivo 3: `src/pages/Changelog.tsx`** — entrada v4.11.0

```
version: "4.11.0"
title: "Guardado progresivo por paso en wizard de cotización"
description: "El wizard ahora guarda en la base de datos en cada paso..."
```

### Flujo resultante

```text
Paso 1 → click "Siguiente" → INSERT cotización (o UPDATE si ya existe) → Paso 2
Paso 2 → click "Siguiente" → UPSERT cotizacion_costos → Paso 3
Paso 3 → click "Siguiente" → UPDATE conceptos_venta + subtotal → Paso 4
Paso 4 → click "Guardar" → UPDATE estado='Borrador' + bitácora → navegar
```

