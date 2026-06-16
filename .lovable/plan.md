# Pack C — Sugerir Tarifa Top 3 inline en el wizard

Objetivo: cuando el usuario captura ruta + tipo de contenedor en el Paso 1 (modo Marítimo) y todavía no ha vinculado tarifa, el wizard muestra **proactivamente las 3 mejores tarifas vigentes** en cards compactas, sin necesidad de abrir el modal "Buscar tarifa". Un clic en "Elegir" la vincula con la lógica existente.

## Alcance funcional

### C1 — Sugerencias inline
- Cuando `modo === "Marítimo"` y hay `origen` + `destino` + `tipoContenedor` resueltos a IDs del catálogo y `tarifaId` está vacío → render automático de hasta 3 cards Top con la misma `TarifaResultCard` que usa el modal.
- Heading: `"Tarifas sugeridas para esta ruta"` + contador `"3 vigentes"`.
- Botón secundario `"Ver todas / cambiar filtros"` abre el `BuscarTarifaDialog` existente (con `initial` precargado), por si el usuario quiere ajustar fecha u otra combinación.

### C2 — Estados auxiliares
- **Resolviendo IDs**: si origen/destino vienen como texto libre (PortSelect guarda `"Shanghai, China (CNSHA)"`), resolver buscando en `usePuertos()` por coincidencia de nombre (mismo patrón que ya usa `TarifaVinculadaPanel` para `tipoContenedor`).
- **Sin coincidencia** (origen/destino libres o no en catálogo): mensaje suave `"Selecciona puertos del catálogo para ver sugerencias."` con el botón "Buscar tarifa" actual como fallback.
- **Sin resultados vigentes**: mensaje informativo `"No hay tarifas vigentes para esta combinación. Cotiza manualmente o captura una en Tarifas marítimas."`.
- **Loading**: skeleton de 3 cards.

### C3 — Cambio de combinación
- Si el usuario cambia origen/destino/tipo después de vincular, mostrar inline `"La combinación cambió — ¿re-sugerir tarifas?"` con botón que limpia el vínculo y re-dispara la sugerencia (no rompe el override automáticamente; sólo quita el binding de tarifa, los campos manuales se conservan).

### C4 — Telemetría
- Registrar evento `tarifa_sugerida_aplicada` en `bitacora_actividad` cuando el usuario elige una sugerencia inline (vs abrir el modal), para medir adopción del Top 3 proactivo. Campos: `tarifa_id`, `ranking` (1/2/3), `cotizacion_id` o `borrador=true`.

## Fuera de alcance
- Re-ranking por preferencias del cliente (último naviera usado, etc.) — el algoritmo Top 3 actual ya prioriza precio + tránsito + carta garantía; no se toca.
- Sugerencias para modos no marítimos.
- Notificación push cuando aparezca una tarifa mejor después de vincular.

## Detalles técnicos

### Archivos nuevos
- `src/features/cotizacion/components/seccionRuta/SugerenciasTarifaInline.tsx` (~150 líneas) — componente que:
  - Consume `useFormContext<CotizacionFormValues>` para `origen`, `destino`, `tipoContenedor`, `tarifaId`.
  - Consume `usePuertos()` y `useTiposContenedor()` para resolver IDs.
  - Consume `useTopTarifas({ puertoOrigenId, puertoDestinoId, tipoContenedorId, fecha: hoy })`.
  - Renderiza 3 `TarifaResultCard` con `onElegir` que aplica la tarifa (misma función `aplicarTarifa` que vive en `TarifaVinculadaPanel`, extraída a un helper compartido).
- `src/features/cotizacion/components/seccionRuta/aplicarTarifa.ts` — helper puro `aplicarTarifaAlForm(setValue, trigger, row, opts)` extraído de `TarifaVinculadaPanel`.
- `src/features/cotizacion/components/seccionRuta/__tests__/SugerenciasTarifaInline.test.tsx` — 3 casos: resuelve IDs por nombre, render Top 3, mensaje "sin coincidencia".

### Archivos a tocar
- `src/features/cotizacion/components/TarifaVinculadaPanel.tsx` — sustituir el bloque `!tarifaId` actual por `<SugerenciasTarifaInline />`; usar el helper compartido `aplicarTarifaAlForm`.
- `src/lib/services/bitacora.ts` (o equivalente existente) — añadir helper `logTarifaSugeridaAplicada({ tarifaId, ranking, cotizacionId? })`.

### Sin migración
La RPC `top_tarifas` ya existe y se consume vía `fetchTopTarifas` / `useTopTarifas`. No hay cambios en BD.

### Versionado
- Bump `APP_VERSION` a `13.31.0`.
- Entrada en `CHANGELOG.md` bajo `## [13.31.0] - 2026-06-16`.

## Tests
- Unit: 3 casos en `SugerenciasTarifaInline.test.tsx` (mock de `useTopTarifas`, `usePuertos`, `useTiposContenedor`).
- Smoke manual: nueva cotización marítima → seleccionar Shanghai/Manzanillo/40HC en Paso 1 → ver 3 cards bajo "Tarifa" → click "Elegir #2" → verifica que campos se autollenan y badge "Heredado de tarifa" aparece.

## Pregunta de decisión
Cuando el usuario YA tiene una tarifa vinculada y cambia origen/destino/tipo, ¿qué hacemos?
- **A.** Mantener la tarifa vinculada y mostrar warning amarillo "Combinación cambió" con botón manual "Re-sugerir". **Recomendado** (no pisar trabajo del usuario).
- **B.** Auto-desvincular y volver a mostrar las sugerencias inline inmediatamente.
