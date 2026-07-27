# Auditoría · Acciones sin toast que se beneficiarían

**Contexto:** Ya migramos 282 archivos a `appFeedback` (v13.320.15) y hay guardrail contra Sonner directo. El wrapper canónico es `notifySuccess/Error/Info/Warning` + `useMutationWithFeedback`. Buscamos huecos donde una acción **iniciada por el usuario** no confirma resultado.

## Analogía

Es como pedir un café en la barra: el barista te lo prepara pero nunca te avisa que ya está — te quedas mirando la máquina sin saber si oprimiste bien el botón. Estos toasts son ese "aquí tienes tu café".

## Hallazgos priorizados

### 🔴 Alta prioridad — descargas CSV silenciosas (impactan reportes financieros)


| #   | Archivo                                                                                   | Acción                              | Falta                      |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| 1   | `src/features/cxc/routes/CxcAging.tsx:43-60`                                              | Botón "Exportar CSV" antigüedad CxC | Success + Warning si vacío |
| 2   | `src/features/cxp/routes/_helpers/exportarCxpCsv.ts:9-37`                                 | CSV antigüedad CxP                  | Success + Warning si vacío |
| 3   | `src/features/embarques/components/reconciliacion/ReconciliacionTresColumnas.tsx:116-129` | CSV reconciliación 3 columnas       | Success                    |


**Por qué duele:** El usuario da clic → aparece (o no) un archivo en Descargas. Si no aparece (por filtros que dejaron 0 filas), cree que la app está rota.

### 🟡 Media prioridad — mutaciones que delegan feedback a un solo consumidor


| #   | Archivo                                                                                                   | Riesgo                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 4   | `src/features/embarques/hooks/mutations/useDeleteEmbarque.ts`                                             | Hook destructivo sin toast propio; confía en `DialogEliminarEmbarque`. Un nuevo call site olvidaría el feedback. |
| 5   | `src/features/cotizacion/hooks/mutations/usePortalCotizacionMutations.ts:9-23` (`useResponderCotizacion`) | Aceptar/Rechazar cotización en portal cliente sin toast en el hook; delega al controller.                        |
| 6   | `src/features/facturacion/components/FacturasMasivasToolbar.tsx:78-84`                                    | Usa `window.confirm()` nativo en vez de `ConfirmActionDialog`. Rompe consistencia de UI destructiva.             |


### 🟢 Baja prioridad — microinteracciones inconsistentes


| #   | Archivo                                                                  | Detalle                                                                                                                |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 7   | `src/features/costeo/components/InvitarAgenteCredencialesView.tsx:23-31` | Copiar credenciales sólo cambia el icono; otros "copiar" (tracking naviera, embarque detalle) sí usan `notifySuccess`. |
| 8   | `src/features/admin/components/MigrarRolesLegacyCard.tsx:90-95`          | Botón "Refrescar vista previa" sin toast de éxito/fallo del refetch manual.                                            |


### ⚪ A verificar antes de tocar

- `**useCapturarSnapshotAuditoria**` — hoy es background al abrir la tab (silencio correcto). Confirmar que no exista un botón manual "Recalcular" que lo dispare.
- `**useRegistrarActividad**` — silencio intencional (bitácora es efecto secundario). Confirmar que ningún flujo dependa de este mutate como única señal de éxito.

## Plan de remediación (3 tandas)

### Tanda 1 · CSV silenciosos (Alta)

- Crear helper `notifyCsvExport(filename, rowCount)` en `src/lib/ui/appFeedback.ts` que:
  - Si `rowCount === 0` → `notifyWarning("Sin datos para exportar", { description: "Ajusta los filtros e inténtalo de nuevo." })` y **no descarga**.
  - Si `rowCount > 0` → genera descarga y muestra `notifySuccess("CSV descargado", { description: filename })`.
- Aplicar en los 3 sitios (#1, #2, #3).

### Tanda 2 · Hooks destructivos + portal cotización (Media)

- Migrar `useDeleteEmbarque` (#4) a `useMutationWithFeedback` con success/error por defecto; permitir override desde `DialogEliminarEmbarque` para no duplicar.
- Migrar `useResponderCotizacion` (#5) al mismo patrón — mensajes específicos por acción (`aceptar` vs `rechazar`).
- Reemplazar `window.confirm()` en `FacturasMasivasToolbar` (#6) por `ConfirmActionDialog` existente.

### Tanda 3 · Consistencia microinteracciones (Baja)

- Agregar `notifySuccess("Contraseña copiada al portapapeles")` en `InvitarAgenteCredencialesView` (#7).
- Agregar `notifySuccess("Vista previa actualizada")` / `notifyError` en el refresh manual de `MigrarRolesLegacyCard` (#8).

## Notas técnicas

- Todas las nuevas notificaciones respetan el guardrail `no-direct-sonner` (usan `@/lib/ui/appFeedback`).
- Cada tanda cierra con bump de `APP_VERSION` (patch) y entrada en `CHANGELOG.md` (regla core).
- Tanda 2 puede requerir agregar tests de integración para el override de mensajes.

## Preguntas para ti

1. ¿Ejecutamos las **3 tandas** de corrido o sólo la **Tanda 1** (impacto UX inmediato) y evaluamos?
2. ¿Quieres que revise también los ~140 servicios con `supabase.functions.invoke`/`rpc` que no auditamos en detalle (audit exhaustivo, ~1 hora más)?

Ejecutar las 3 tandas