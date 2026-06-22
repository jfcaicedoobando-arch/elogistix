## Objetivo

Convertir la tabla "CxP — Por capturar" de una lista plana en una bandeja de trabajo: filtros útiles, búsqueda, ordenamiento, acción directa para capturar factura por fila y mejor jerarquía visual.

## Cambios visibles

1. **Toolbar arriba de la tabla**
   - Buscador de texto (expediente, cliente) con debounce 250ms.
   - Chips de filtro:
     - **Estatus de captura**: Todos · Sin facturas · Con facturas parciales · Con facturas
     - **Antigüedad última factura**: Todos · Sin captura · >7 días · >30 días
   - Botón "Ordenar por" (expediente, antigüedad, monto, # facturas) ↑↓.
   - Contador "N de M embarques" a la derecha.

2. **Tabla mejorada**
   - Zebra-striping + densidad cómoda (h-10).
   - Nueva columna **Avance** con `Progress` bar (facturas vs presupuestado en %, basado en `costos_presupuestados` y `monto_facturado_acum` que ya viene en `proveedor_facturas`).  
     *Nota:* la RPC actual no expone `monto_facturado`. Lo agregamos al RPC (ver sección técnica).
   - Badges contextuales:
     - "Sin captura" (gris) si `facturas_capturadas = 0`
     - "Parcial" (ámbar) si hay facturas pero `monto_facturado < costos_presupuestados`
     - "Completo" (verde) si `monto_facturado >= costos_presupuestados`
   - Columna "Última factura" muestra fecha + chip relativo ("hace 3 d", "hace 25 d" en ámbar si >7).
   - Header sticky para que se mantenga visible al hacer scroll.

3. **Acción por fila: "Capturar factura"**
   - Botón primario compacto al final de cada renglón (`<Button size="sm">`).
   - Abre el modal `DialogNuevaFacturaProveedor` ya conocido, pero con el embarque **pre-seleccionado** (vía nueva prop `initialEmbarqueAdHoc`). El bloque `VincularEmbarqueSection` arranca con ese embarque listo.
   - Acción secundaria "Ver embarque" sigue accesible vía el link del expediente (igual que hoy).

4. **Estados vacíos y carga**
   - Skeleton rows (5) en loading en vez de "Cargando…" centrado.
   - `EmptyState` reutilizable con icono `Inbox`, título "Sin embarques pendientes de captura" y CTA "Ver todos los embarques".
   - Empty filtrado: "Ningún embarque coincide con los filtros" + botón "Limpiar filtros".

5. **Cards superiores afinadas**
   - Mantener las 3 cards pero alinear tipografía, agregar icono e indicar moneda MXN explícitamente.

## Fuera de alcance

- Paginación (con `LIMIT 500` actual y filtros locales basta; lo dejamos para una iteración futura).
- Exportar a CSV.
- Nuevas columnas tipo ruta/ETA/proveedores pendientes (rechazado: "redesign completo" no fue la opción elegida).
- Cambios al modal de captura más allá de aceptar el embarque inicial.

## Detalles técnicos

**Backend (nueva migración):**
- Actualizar RPC `cxp_por_capturar` para devolver además:
  - `monto_facturado` numeric — suma de `proveedor_facturas.total` (no canceladas) del embarque.
  - `dias_desde_ultima_factura` integer.
- Mantener `SECURITY INVOKER` y `GRANT EXECUTE ... TO authenticated`.
- Migración nombrada con timestamp + uuid (formato del proyecto).

**Tipos:**
- Extender `CxpPorCapturarRow` en `src/features/bandejas/services/bandejas.ts`.
- Regenerar `supabase/types.ts` (la edición manual del file está prohibida en general, pero al cambiar el RETURNS del RPC sí se actualiza automáticamente).

**Frontend:**
- `src/features/bandejas/routes/CxpPorCapturar.tsx`: reescritura para usar nueva toolbar, ordenamiento y acción.
- `src/features/bandejas/components/CxpPorCapturarToolbar.tsx` (nuevo) — buscador, chips, sort.
- `src/features/bandejas/components/CxpPorCapturarRow.tsx` (nuevo) — renglón con badge, progress y botón.
- `src/features/bandejas/hooks/useCxpPorCapturarFilters.ts` (nuevo) — estado local: query, estatus, antigüedad, sort. Memoiza el resultado filtrado.
- `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx`: nueva prop opcional `initialEmbarqueAdHoc?: EmbarqueSeleccionado` que se pasa al hook.
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts`: aceptar `initialEmbarqueAdHoc` y semillar el estado en el primer render.

**Power of 10:**
- `CxpPorCapturar.tsx` queda <200 líneas al delegar toolbar/row a componentes.
- Cada componente nuevo es focalizado (<150 líneas).

**Tests:**
- Nuevo test puro para `useCxpPorCapturarFilters` (filtros y ordenamiento) en `__tests__/`.
- No test visual de la tabla (presentacional).

**Changelog + APP_VERSION:**
- Bump a `13.99.4`.
- Entrada en `CHANGELOG.md` raíz describiendo toolbar, filtros, ordenamiento, columna Avance, acción "Capturar factura" pre-seleccionando embarque, y campo nuevo `monto_facturado` en la RPC.

## ASCII de la fila final

```text
[Expediente] [Cliente]  [Avance ▓▓▓░░ 60%]  [Costo $]  [Facturas]  [Última fact.]  [⟶ Capturar]
```
