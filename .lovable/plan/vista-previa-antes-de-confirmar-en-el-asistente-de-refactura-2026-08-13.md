# Vista previa "antes de confirmar" en el asistente de refacturación

Objetivo: antes de confirmar cada etapa del asistente, el usuario ve un resumen claro de **qué se cancela**, **qué se crea**, **a quién se reasigna el pago** y **cómo queda el saldo** de la factura original y de la nueva.

## Cómo se verá

En cada paso del asistente aparece una tarjeta "Vista previa del resultado" justo arriba del botón de confirmación, con tres bloques:

1. **Se cancela** — REP (folio + UUID) y/o factura original (folio, total, moneda).
2. **Se crea / se modifica** — nueva factura (receptor, RFC, total, moneda) y nuevo REP.
3. **Saldos después de confirmar** — tabla comparativa antes → después:

```text
                        Antes        Después
Factura original    0.00 MXN     12,500.00 MXN   (queda cancelada)
Factura nueva            —            0.00 MXN   (pago aplicado)
Pago aplicado a     FA-1023          FA-1044
```

Si algo bloquea el paso (REP vivo, moneda distinta, receptor sin RFC), la vista previa lo muestra como advertencia en rojo y el botón de confirmar sigue deshabilitado (reutiliza las reglas ya existentes de `refacturacionPasos.ts` y del semáforo fiscal).

La simulación es de sólo lectura: no escribe nada en la base.

## Detalles técnicos

**Base de datos** (nueva migración, RPC de sólo lectura):

- `public.refacturacion_simular_paso(p_caso_id uuid, p_paso int) returns jsonb`
  - `STABLE`, `SECURITY DEFINER`, `set search_path = public`, `REVOKE ALL ... FROM PUBLIC, anon` (regla H6) y `GRANT EXECUTE TO authenticated`.
  - Valida tenant con el mismo patrón del caso (`organization_id` del caso vs. `org_activa`) y reutiliza `public._assert_refacturador(...)` sólo como lectura permitida a roles contables/admin.
  - Devuelve por paso: acciones `cancelar` / `crear` / `reasignar`, y saldos calculados con `public.saldo_factura(...)` para la factura original y la nueva (antes/después simulado, sin escribir).
  - Incluye `bloqueos: text[]` con códigos `LC_REFACT_*` ya definidos, para que la UI muestre el mensaje amigable con `lcCodeMessages.refacturacion.ts`.

**Frontend**:

- `src/features/facturacion/services/refacturacionSimulacion.ts` — wrapper de la RPC + tipos (`SimulacionPaso`, `SimulacionSaldo`).
- `src/features/facturacion/hooks/useRefacturacionSimulacion.ts` — `useQuery` con key `["refact-sim", casoId, paso]`, `enabled` cuando hay caso, refetch al cambiar de paso y tras cada confirmación.
- `src/features/facturacion/components/refacturacion/RefacturacionPreviewPaso.tsx` (≤200 líneas) — tarjeta con los tres bloques; usa tokens semánticos del design system y `formatMoneda`/`es-MX`.
- Sub-componente `RefacturacionPreviewSaldos.tsx` para la tabla antes/después (mantiene los archivos bajo el límite Power of 10).
- Integración en los pasos existentes (`PasoCancelarRep`, `PasoFacturaNueva`, `PasoCancelarOriginal`, paso de reasignación y cierre) pasando `casoId` y `paso`.

**Pruebas**:

- `refacturacionSimulacion.test.ts` — mapeo de la respuesta de la RPC a los bloques de UI y a los saldos antes/después.
- Caso con `bloqueos` no vacío: la vista previa marca advertencia y no habilita confirmar.

**Cierre**: bump `APP_VERSION` a `13.589.0` y entrada en `CHANGELOG.md`.
