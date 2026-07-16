## Diagnóstico (implementación actual vs docs FacturApi)

### Lo que hicimos bien ✅


| Área                                                                                  | Estado                  |
| ------------------------------------------------------------------------------------- | ----------------------- |
| Emitir sustituta con `related_documents: [{ relationship: "04", documents: [uuid] }]` | ✅ Correcto (v13.300.57) |
| Cancelar original con `motive: "01"` + `substitution: <facturapi_id_sustituta>`       | ✅ Correcto              |
| Duplicar factura sin `snapshot_emision` para permitir edición                         | ✅ Correcto (v13.300.55) |
| Copiar `conceptos_factura` al borrador                                                | ✅ Correcto (v13.300.53) |
| Copiar conceptos con IVA/retenciones/embarque                                         | ✅ Correcto              |
| Enlaces `sustituye_a` / `sustituida_por` en BD                                        | ✅ Correcto              |
| Banner preventivo regla SAT 2.7.1.34                                                  | ✅ Correcto (v13.300.59) |
| Toast ámbar + reintentar si SAT caído                                                 | ✅ Correcto (v13.300.60) |


### Lo que está mal o falta ❌

**1. CRÍTICO — Ignoramos `cancellation_status` del SAT.**
Según docs, `invoices.cancel(...)` puede devolver 3 estados legítimos:

- `accepted` → efectivamente cancelada.
- `pending` → **requiere aceptación del receptor** (72h para silencio positivo).
- `verifying` → SAT está validando la solicitud.

Nuestro `facturapi-cancelar/index.ts:145` marca `estado: 'Sustituida'` **de inmediato**, sin leer `cancellation_status`. Resultado: si el receptor tarda en aceptar (o rechaza), nuestra BD miente y el original ya está "sustituido" cuando en realidad sigue `valid` ante el SAT. Cuando la sustituta se timbra, esto es especialmente peligroso porque el receptor podría rechazar y quedamos con dos CFDIs vivos por la misma operación.

**2. Descargamos el acuse aunque no exista todavía.**
`descargarAcuseCancelacion(...)` en línea 139 se ejecuta siempre; si el SAT no ha emitido acuse (pending/verifying) queda `acuse_cancelacion_status: 'pending'` — pero **no existe ningún cron ni webhook que lo reintente**. El comentario del código dice "un cron posterior podrá reintentar", pero ese cron nunca se implementó.

**3. No procesamos el webhook `invoice.cancellation_status_updated`.**
FacturApi dispara este evento cada vez que el SAT actualiza el estado. Nuestro `facturapi-webhook` receiver no lo maneja (o no reconcilia el estado de la factura original). Por eso ninguna cancelación pending se actualiza sola.

**4. UX del wizard rompe el flujo.**
`DialogSustituirFactura` abre la sustituta en **otra pestaña** (`target="_blank"`) y el usuario tiene que volver manualmente y hacer clic en "Ya está timbrada". No hay verificación real de que se timbró; si el usuario miente o se equivoca, la cancelación falla porque la sustituta no tiene UUID. Peor: si cierra el modal, queda un borrador colgando sin flujo para retomarlo.

**5. Migraciones duplicadas.**
Hay 4 versiones de `duplicar_factura_para_sustitucion` en distintas migraciones. Funciona (Postgres queda con la última) pero es ruido histórico.

## Veredicto

**No es overhaul completo, es un fix crítico + refactor de UX.** El backbone (payloads a FacturApi, campos SAT, relaciones) está correcto y alineado con la doc. Lo roto es cómo **modelamos el estado asíncrono del SAT** — asumimos síncrono lo que la doc dice explícitamente que puede tardar 72h.

---

## Plan de trabajo (4 batches)

### Batch A — Estado asíncrono del SAT [crítico]

Modelar `cancellation_status` de FacturApi como columna de primera clase:

1. Migración: agregar a `facturas`:
  - `cancellation_status` (enum `none|verifying|pending|accepted|rejected|expired`, default `none`)
  - `cancelacion_solicitada_en` (timestamp — cuándo pedimos cancelar)
  - `cancelacion_vence_en` (timestamp — solicitada + 72h hábiles, para countdown)
2. En `facturapi-cancelar/index.ts`:
  - Leer `cancellation_status` de la respuesta de `invoices.cancel`.
  - Mapear a nuestro `estado`:
    - `accepted` → `Cancelada` / `Sustituida` (como hoy).
    - `pending` / `verifying` → **mantener `estado: 'Emitida'**` + poblar `cancellation_status` + `cancelacion_solicitada_en` + `cancelacion_vence_en`.
  - Descargar acuse XML **sólo si `accepted**` (evita el 404 al SAT).
3. En UI:
  - Chip nuevo "Cancelación en proceso" (ámbar) en `FacturaEstadoChip` cuando `cancellation_status ∈ (pending, verifying)`.
  - En detalle de factura, banner con countdown "El receptor tiene X horas para responder. Si no, se cancelará automáticamente."

### Batch B — Webhook y reconciliación

1. Extender `facturapi-webhook/index.ts` para procesar `invoice.cancellation_status_updated`:
  - Buscar factura por `facturapi_id`.
  - Actualizar `cancellation_status`.
  - Si el nuevo estado es `accepted`: pasar `estado` a `Cancelada`/`Sustituida` (según si tiene `sustituida_por`), descargar acuse XML, revertir proformas.
  - Si es `rejected` o `expired`: dejar `estado` en `Emitida`, limpiar `cancelacion_solicitada_en`, notificar al usuario (bitácora + toast en próxima visita).
2. Nueva edge function `facturapi-reconciliar-cancelaciones` (invocada por cron cada 6h):
  - Busca facturas con `cancellation_status IN ('pending','verifying')` con `cancelacion_solicitada_en < now() - '10 min'`.
  - Llama `invoices.retrieve(facturapi_id)` y sincroniza el estado.
  - Sirve de backup si el webhook falla o hay backlog.
3. Botón manual "Refrescar estado SAT" en detalle de factura que reutilice la misma función.

### Batch C — UX del wizard en una sola pestaña

Rediseñar `DialogSustituirFactura` para no requerir cambio de pestaña:

1. Paso 2 (borrador creado): navegar **en la misma pestaña** al detalle de la sustituta con un banner sticky "Estás editando el reemplazo de F971. [Volver al flujo ↩]".
2. Estado del wizard persistido en `sessionStorage` con `originalId` + `nuevaId` para reanudar al volver.
3. Detección automática: cuando el detalle carga la nueva factura y ésta pasa a `Emitida`, mostrar banner CTA "Listo. Ir a cancelar la original".
4. Al hacer clic, navegar de vuelta al original con el modal ya en Paso 3 pre-poblado.
5. Cambiar copy: "Cancelar original" → "Solicitar cancelación al SAT" (refleja que no es instantáneo).

### Batch D — Limpieza

1. Consolidar las 4 migraciones de `duplicar_factura_para_sustitucion` en una nota en `docs/facturapi-flujos.md` (documentar la versión vigente y por qué se re-escribió).
2. Crear `docs/facturapi-flujos.md` con diagrama del ciclo completo (emitir → sustituir → cancelar → estados asíncronos).
3. Bump `APP_VERSION` a `13.301.0` (cambio de contrato de estado).
4. Registro en `CHANGELOG.md`.

## Detalles técnicos

**Archivos principales a tocar:**

- `supabase/migrations/<new>.sql` — columnas nuevas en `facturas`.
- `supabase/functions/facturapi-cancelar/index.ts` — leer y persistir `cancellation_status`.
- `supabase/functions/facturapi-webhook/index.ts` — manejar `invoice.cancellation_status_updated`.
- `supabase/functions/facturapi-reconciliar-cancelaciones/index.ts` — nueva.
- `src/features/facturacion/components/DialogSustituirFactura.tsx` — rediseño UX.
- `src/features/facturacion/components/FacturaEstadoChip.tsx` — chip "En cancelación".
- `src/features/facturacion/components/detalle/FacturaDetalleModales.tsx` — banner countdown.
- Tests: helpers de mapping + webhook payloads.

**Qué NO vamos a tocar (ya está bien):**

- `buildFacturapiPayload` (helpers.ts) — el payload es correcto.
- RPC `duplicar_factura_para_sustitucion` — funciona bien tras los últimos fixes.
- Banner preventivo regla 2.7.1.34 en el modal de cancelar directo.
- Toast ámbar de SAT caído.

## Recomendación

Si tuviera que priorizar por dolor real:

- **Batch A es urgente**: hoy podríamos estar reportándole al usuario que canceló cuando el SAT dice "pending". Riesgo de doble facturación de la misma operación.
- **Batch B es la mitad de A**: sin webhook o cron, A queda a medias porque los estados no evolucionan solos.
- **Batch C es cosmético pero importante**: el brincar de pestaña es la causa #1 de que la gente se pierda en el flujo.
- **Batch D es limpieza pura**.

¿Le entramos a los 4 en secuencia, o hacemos sólo A+B ahora y dejamos C+D para después? Hacemos los 4 en secuencia. 