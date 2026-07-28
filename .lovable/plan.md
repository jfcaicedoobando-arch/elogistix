
# Diagnóstico previo — reporte E2E vs código actual

**Reporte base:** `bugs-e2e-live-2026-07-28.md` corrido contra v13.320.4.
**HEAD actual:** v13.320.31 (14 releases posteriores).
**Alcance de esta verificación:** los 6 críticos y checkeos puntuales de las 13 altas. Para las 44 medias/bajas asumo estado del reporte (verificarlas 1×1 tomaría otra ronda dedicada).

⚠️ Esto es sólo un plan de diagnóstico — **no se toca código**. En el siguiente turno decides qué olas ejecutar.

---

## Analogía rápida

Piensa el reporte como una radiografía tomada hace 14 días. Antes de operar, verifico qué "fracturas" ya sanaron solas (fixes de otros turnos) para no re-operar sobre hueso ya soldado.

## Resultado por bug crítico

| ID | Estado real en HEAD | Evidencia |
|---|---|---|
| **B-001** RLS soft delete bloquea borrar | 🟡 **Probablemente resuelto (verificar en staging)** | Migración `20260712224629` + `20260721193856` re-establecen `WITH CHECK (true)` sobre las 29 políticas `Hide soft deleted%`. Con eso, un UPDATE que ponga `deleted_at = now()` ya no debería violar la política RESTRICTIVE. **Confirmar empíricamente** con un `UPDATE` como `authenticated` en staging antes de descartar. |
| **B-002** REP pendiente esconde "Registrar pago" | 🔴 **Abierto** | `FacturaDetalleActionsBar.tsx:52-60` sigue dando prioridad a `Timbrar REP` sobre `Registrar pago`; "Registrar pago" no está en `buildSecondary`. Sin cambios. |
| **B-003** Recargar wizard duplica cotización | 🔴 **Abierto** | `useCotizacionDraftAutosave.ts` — `StoredDraft` no incluye `cotizacionId`; el autosave se desactiva a partir de paso 2 pero nada rehidrata el ID al recargar. |
| **B-004** Menú "+ Nuevo" CRM muerto | 🔴 **Abierto** | `QuickAddMenu.tsx` sigue con `<Popover><PopoverAnchor asChild><DropdownMenu>...` — mismo antipatrón exacto. |
| **B-005** Guardar embarque con TC vacío | 🟢 **Ya resuelto** | `embarqueToDb.ts` ahora usa helper `tcOrNull(raw)` que retorna `null` si no es finito o ≤0. Ola de "exchange rate check constraint" (v13.320.18). |
| **B-060** Anticipo no aplicable (`metodo_pago` NULL) | 🔴 **Abierto** | La RPC `aplicar_anticipo_a_factura` en `20260719033659` sigue insertando `v_ant.metodo_pago` sin `COALESCE`, y el diálogo `RegistrarAnticipoDialog` sigue sin capturar método. Cero re-definiciones de la RPC posteriores. |

**Resumen críticos:** 1 verde (B-005), 1 amarillo (B-001, requiere validación en staging), 4 rojos confirmados abiertos (B-002, B-003, B-004, B-060).

## Muestreo de altas (spot-checks)

No verifiqué las 13 una por una; sí las que tenían fixes recientes en el changelog:

- **B-016** (`duplicar_cotizacion` sin `precio_venta`) — no hay migración posterior tocándolo → **probablemente abierto**.
- **B-018** (P&L usa subtotal en vez de total con IVA) — última definición sigue en `20260722132715` → **probablemente abierto**.
- **B-007** (NC CxC sin IVA en `useNotaCreditoDraft`) — sin cambios recientes → **probablemente abierto**.
- Resto (B-006, B-008…B-014, B-017) no muestreados en este pase.

## Recomendación

**Ola 1 mínima real (5 fixes en vez de 6):**
1. B-002 · `FacturaDetalleActionsBar` — mostrar "Registrar pago" siempre que `saldo > 0`, coexistiendo con "Timbrar REP".
2. B-003 · Incluir `cotizacionId` en `StoredDraft` y restaurarlo tras recarga.
3. B-004 · Rediseñar `QuickAddMenu` (anclar Popover al botón o abrir Dialogs desde los items).
4. B-060 · Dos-en-uno: `COALESCE(v_ant.metodo_pago, 'Transferencia')` en la RPC + campo "Método de pago" en `RegistrarAnticipoDialog`.
5. B-001 · **Validar en staging** que el fix de julio realmente destrabó soft delete. Si aún falla, migrar las 29 políticas a `FOR SELECT`.

B-005 sale del scope: ya está.

## Detalles técnicos

- La rutina `20260721193856` sólo relaja `WITH CHECK` de las RESTRICTIVE — no cambia `FOR ALL` a `FOR SELECT`. Si Postgres evalúa RESTRICTIVE.USING contra la fila post-UPDATE (comportamiento observado por el agente T3), el fix es insuficiente y hay que pasar a `FOR SELECT` como sugiere el reporte.
- B-060 tiene 2 puntos de falla independientes; arreglar sólo la RPC dejaría anticipos históricos NULL sin captura de método (aplicable pero opaco). Arreglar sólo el diálogo no repara los anticipos ya creados con NULL. Hay que hacer los dos.
- B-003 se puede resolver de dos formas: (a) persistir `cotizacionId` en el draft, (b) no insertar la cotización hasta el guardado final. (a) es menos invasivo.

## Siguiente paso sugerido

Aprueba este diagnóstico y en el siguiente turno propongo el plan de implementación de la **Ola 1** (5 fixes arriba). O dime si prefieres que primero muestree con detalle las 13 altas y las 28 medias antes de ejecutar cualquier fix.
