
## Diagnóstico

**Analogía**: imagina dos modelos de extintor en la oficina. Unos traen una etiqueta con teléfono de bomberos y QR para reportar el incidente; otros sólo dicen "fuego". Los toasts de error de la app están en ese mismo limbo: algunos traen botón **"Ver detalles"** que abre el diálogo con **Copiar reporte / Copiar JSON** (útil para mandarte el error o pegarlo a Lovable), y otros sólo muestran el texto y se desvanecen.

### Por qué pasa

Hay 3 formas de emitir un toast de error en el código y sólo UNA trae el botón de copiar:

| Patrón | Botón "Ver detalles" + copiar | Uso actual |
|---|---|---|
| `notifyError(toast, {error, method, ...})` de `appFeedback.ts` | ✅ Sí, siempre | 227 call sites |
| `toast.error("…")` directo de `sonner` | ❌ No | 81 call sites en 45 archivos |
| `toast({title, description, variant: "destructive"})` (shim legacy `useToast`) | ❌ No (salvo que pases `debug: ErrorReport`, casi nadie lo hace) | 29 call sites en 16 archivos |

El error que vio Valeria en *Costeo → Tarifas* (RLS) salió del patrón legacy en `useCosteoTarifas.ts` — por eso no tenía botón para copiar.

## Objetivo

Que el **100% de los toasts de error** muestre el botón "Ver detalles" con Copiar reporte (markdown) y Copiar JSON, sin importar desde dónde se disparen. Los toasts de éxito / warning siguen igual (no necesitan reporte).

## Cambios

### Wave 1 — Migrar `variant: "destructive"` y `toast.error(...)` a `notifyError`

Recorrer los ~60 archivos identificados y reemplazar cada toast de error por:

```ts
notifyError(toast, {
  title: "…",                  // mismo título que tenía
  description: e.message,      // misma descripción
  error: e,                    // ⬅ clave: alimenta el reporte copiable
  method: "NOMBRE_UNICO",      // para agrupar en Sentry
});
```

Reglas:
- `method` único y descriptivo (ej. `COSTEO_TARIFA_CREAR`, `TESORERIA_MOVIMIENTO_ELIMINAR`).
- Si el catch no tiene la excepción a la mano (`onError: (e) => ...`), pasarla siempre como `error`.
- Para toasts de **warning/success** no se cambia nada.

Archivos prioritarios (todos los que ya rompieron con Valeria u operaciones financieras/destructivas):

- Costeo: `useCosteoTarifas.ts`, `useCosteoAgentes.ts`, `useCosteoRutas.ts`, `useNavieraCondiciones.ts`, `useDemorasVenta.ts`
- Tesorería: `useTesoreriaCuentas.ts`, `useTesoreriaMovimientos.ts`, `PanelConciliacionMovimiento.tsx`, `TesoreriaConciliacion.tsx`, `useTesoreriaCuentasController.ts`
- Embarques: `useSegurosEmbarque.ts`, `useDemorasEmbarque.ts`, `useCierreEmbarque.ts`
- CXP / Facturación: `useNuevaFacturaProveedorForm.ts`, `useTimbrarFactura.ts`, `useRecordatorios.ts`, `CargaCfdiSection.tsx`, `DialogRegistrarPagoProveedor.tsx`, `CrearProveedorDesdeCfdiDialog.tsx`, `FacturasMasivasToolbar.tsx`, `Cxp.tsx`
- CRM: `crmToast.ts`, `QuickCreate*Popover.tsx`
- Proveedores / Clientes / Cotización: `ProveedorCsfUpdateButton.tsx`, `useEnviarCotizacionEmail.ts`, `WizardInformativa.tsx`
- Presupuesto / Comisiones / Admin: `TabCategorias.tsx`, `DialogCategoria.tsx`, `TabCaptura.tsx`, `TabVendedorasConfig.tsx`, `usePapelera.ts`, `TabExportar.tsx`, `SentryDiagnostico.tsx`, `Idempotencia.tsx`
- Auditoría: `useSnoozeHallazgo.ts`
- Catálogos: `useTiposContenedor.ts`, `usePuertos.ts`, `useNavieras.ts`

(Resto de la lista se cubre en la misma pasada; ~110 toasts total).

### Wave 2 — Guardrail

Agregar `src/__tests__/architecture/error-toasts-use-notifyError.test.ts`:

- Escanea `src/**/*.ts(x)` (excluye `__tests__`, helpers internos, `useToast.ts`, `ErrorDetailsDialog.tsx`, `sonner.tsx`).
- Falla si encuentra:
  - `toast.error(` literal
  - `variant: "destructive"`
- Whitelist vacía por diseño (con espacio para justificaciones futuras).

Esto evita que el problema vuelva a aparecer.

### Wave 3 — Metadata

- `APP_VERSION` → `13.68.3`.
- Entrada en `CHANGELOG.md` describiendo la unificación y el nuevo guardrail.

## Fuera de alcance

- No se cambian toasts de éxito ni de advertencia.
- No se modifican mensajes ni textos visibles, sólo la "etiqueta de bomberos".
- No se toca la lógica de negocio de ningún hook ni los mutations existentes (eso quedó cubierto en 13.68.0).
- No se cambia el diálogo `ErrorDetailsDialog` ni el contenido del reporte (ya está completo: versión, ruta, usuario/org, viewport, stack, contexto, `requestId`, `errorCode`, `method`).

## Verificación

1. Build y suite de tests (`vitest`) verdes, incluyendo el nuevo guardrail.
2. Disparar manualmente el flujo que falló a Valeria (Costeo → Nueva tarifa sin permisos en cuenta sin RLS) y confirmar que el toast trae "Ver detalles" → "Copiar reporte" / "Copiar JSON".
