## Revisión del fix de cancelación motivo 01

Revisé los archivos tocados en el turno anterior. **No hay bugs bloqueantes**; el flujo queda correcto de punta a punta:

- `DialogCancelarFactura.tsx` (154 líneas) manda `sustituidaPorFacturaId` (id interno) al hook cuando motivo=01, no un UUID crudo.
- El hook `useCancelarFactura` ya soporta ese parámetro y lo reenvía a la edge `facturapi-cancelar` (verificado líneas 28-67 del hook).
- La edge resuelve `facturapi_id` desde `sustituida_por_factura_id` (verificado líneas 71-84 de `index.ts`) y arma `substitution` en el query string → el error "Substitution invoice is required" queda resuelto.
- `sustitutasDeFactura.ts` filtra por `sustituye_a = facturaId` y `SelectorSustituta` sólo muestra las que tienen `estado === "Emitida"` y `uuid_fiscal`, así que es imposible elegir un borrador o la propia factura.
- `FacturaDetalleModales.tsx` cablea `onAbrirSustituir` cerrando cancelar y abriendo el wizard.

### Observaciones menores (no bugs, mejoras opcionales)

1. **Doble `onOpenChange(false)` al abrir el wizard** — el dialog cierra en `abrirWizard()` y el padre vuelve a cerrar en el handler. Es idempotente, no rompe nada.
2. **`motivo` default = "02"** — el usuario debe cambiar manualmente a "01". Si el flujo esperado tras timbrar una sustituta es cancelar con motivo 01, podría preseleccionarse "01" cuando existan sustitutas timbradas. No es un bug del fix actual, es UX.
3. **`staleTime: 5_000`** en `sustitutasQ` es razonable; si el usuario timbra una sustituta y regresa rápido, la lista se refresca al reabrir el modal (cachea sólo 5s).
4. **Falta test unitario** para `DialogCancelarFactura` (mencionado en el plan `.lovable/plan.md` pero no se creó). No bloquea funcionalidad pero deja el fix sin cobertura de regresión.

### Recomendación

Cerrar el turno tal cual **o** agregar (en un turno de build separado) el test `DialogCancelarFactura.test.tsx` con dos casos:
- Sin sustitutas timbradas → botón "Confirmar" deshabilitado + CTA visible.
- Con sustituta timbrada seleccionada → `mutate` recibe `sustituidaPorFacturaId`.

¿Quieres que agregue ese test ahora, o lo dejamos así?