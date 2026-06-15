## Contexto

La regla `ventas_sin_facturar` de la RPC de auditoría dispara cuando algún `conceptos_venta.estado_facturacion = 'pendiente'` en embarques Entregado/Cerrado — NO mira si existe `factura`. Como la facturación se construyó en una etapa posterior, los conceptos de embarques antiguos quedaron en `pendiente` aunque sí estén facturados. Mismo patrón en otras reglas legacy. Hay que arreglar el dato + dar al usuario una herramienta de IA para entender hallazgos caso por caso.

## Alcance

Dos entregables en paralelo:

### A) Backfill de datos legacy (migración SQL + script)

1. **Función `backfill_estado_facturacion_legacy()`** (SECURITY DEFINER, scoped por organization_id):
   - Recorre `conceptos_venta` con `estado_facturacion = 'pendiente'` cuyo `embarque_id` tenga al menos una `facturas` en estado `emitida`/`pagada`/`parcial`.
   - Marca el concepto como `facturado` y popula `factura_id` con la factura más reciente del embarque.
   - Devuelve resumen `{ embarques_afectados, conceptos_actualizados, por_organizacion[] }`.
2. **Backfill complementarios** (mismo patrón, funciones separadas):
   - `proformas.estado` → `aceptada`/`facturada` cuando existe factura ligada.
   - `embarque_huerfano`: deja como está (no se puede inventar fechas) — se cubrirá con IA + snooze.
3. **UI en `/admin/auditoria` (dueño)**: botón "Ejecutar backfill legacy" con doble confirmación tipo ELIMINAR, muestra el resumen post-ejecución. Sólo `super_admin`.
4. **Bitácora**: cada ejecución registra entrada en `bitacora_actividad`.

### B) "Explicar con IA" por hallazgo

1. **Edge function `auditoria-explicar-hallazgo`**:
   - Input: `{ embarque_id, regla, detalle }`.
   - Valida JWT + membresía a la organización del embarque.
   - Lee contexto: embarque + conceptos_venta/costo + facturas + proformas + documentos + notas (resumen compacto, no payload completo).
   - Llama Lovable AI Gateway con `google/gemini-3-flash-preview`.
   - Prompt system: "Eres analista de operaciones forwarder. Dado un hallazgo de auditoría, explica en español MX (1) qué significa, (2) posibles causas concretas incluyendo backfill/datos legacy si aplica, (3) 2-3 pasos sugeridos. Máx 180 palabras. No inventes datos."
   - Devuelve `{ explicacion, posibles_causas[], pasos_sugeridos[] }`.
2. **UI: ícono Sparkles → Popover en cada fila de `AuditoriaHallazgosTab`**:
   - Botón pequeño en la columna acciones de la tabla.
   - Popover muestra spinner mientras llama la edge function.
   - Cachea la respuesta por hash de hallazgo en `react-query` (`['auditoria-explicacion', embarque_id, regla, detalle_hash]`).
   - Markdown render simple, copiable.
3. **Manejo de errores**: 429/402 con toast claro ("Lovable AI sin créditos / límite alcanzado").

## Detalles técnicos

- Migración SQL incluye GRANT EXECUTE a `authenticated` para la función de backfill (acotada por org), y wrapper que sólo `super_admin` puede llamar (verificación `has_role`).
- Edge function: `supabase/functions/auditoria-explicar-hallazgo/index.ts`, usa `_shared/cors.ts`, `_shared/auth.ts`, `_shared/ai-gateway.ts`. No persiste — sólo proxy AI.
- Hook nuevo: `src/features/auditoria/hooks/useExplicarHallazgo.ts` (≤80 líneas).
- Componente nuevo: `src/features/auditoria/components/ExplicarHallazgoButton.tsx` (≤150 líneas).
- Wire-up en `hallazgosTablaConfig` añadiendo columna acción.

## Out of scope

- Reescribir la RPC de auditoría (la lógica actual es correcta una vez backfilled).
- Backfill de `docs_pendientes_avanzado` / fechas (requiere intervención humana — la IA ayudará a triagear).
- Persistir explicaciones IA (se cachean en cliente, no en DB).

## Versionado

- `APP_VERSION` bump + entrada en `CHANGELOG.md` raíz.
- Actualizar `mem://features/auditoria-modulos` con la nota del backfill + IA explicativa.

## Validación

1. Antes de correr backfill en prod: ejecutar SELECT de conteo (cuántos conceptos/embarques afectados).
2. Probar "Explicar con IA" sobre expediente 00062 y validar que la respuesta menciona facturas existentes + sugiere backfill.
3. Tests unitarios: hook de explicación (mock fetch), función backfill (smoke con datos seed).
