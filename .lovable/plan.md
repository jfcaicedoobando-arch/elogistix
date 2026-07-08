# Fix: RangeError "Invalid time value" al capturar factura de proveedor

## Causa exacta

Sentry issue [JAVASCRIPT-REACT-29](https://elogistix.sentry.io/issues/JAVASCRIPT-REACT-29) apunta al frame:

```ts
// src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // ← lanza "Invalid time value"
}
```

Cuando Karol limpió el campo "Fecha de emisión" con la X del `DatePickerMx` (o el input quedó vacío por un blur con texto inválido), `values.emision` se puso en `""`. Luego el `handleChange` del formulario recalculó el vencimiento:

```ts
if (k === "emision" || k === "diasCredito") {
  next.vencimiento = addDays(next.emision, Number(next.diasCredito) || 0);
}
```

Con `next.emision === ""`, `new Date("T00:00:00")` es Invalid Date y `toISOString()` lanza `RangeError`. La excepción sube al render y dispara la React Error Boundary → pantalla de error.

## Cambio

Archivo único: `src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts`

Blindar `addDays` para que devuelva `""` (o el iso original) cuando la entrada no es una fecha válida `YYYY-MM-DD`:

```ts
export function addDays(iso: string, days: number): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
```

Con esto:
- Si emisión está vacía → vencimiento queda vacío (el campo se muestra en blanco, `validateFactura` ya obliga a que el total > 0 y el submit valida el resto).
- Si el usuario captura una emisión válida, todo sigue igual.
- No hay más crashes por Invalid time value en este flujo.

## Verificación

- Añadir un caso al test existente `useNuevaFacturaProveedorForm.helpers.test.ts` que verifique `addDays("", 30) === ""` y `addDays("2026-13-40", 30) === ""`.
- Correr `bunx vitest run src/features/cxp/hooks/__tests__/useNuevaFacturaProveedorForm.helpers.test.ts` y confirmar que los tests preexistentes (fecha válida) siguen pasando.

## Sentry

- Marcar el issue `JAVASCRIPT-REACT-29` como resolved con `update_issue` referenciando el fix.

## Versionado y changelog

- Bump `APP_VERSION` a `13.218.4` (patch).
- Entrada en `CHANGELOG.md` describiendo el fix y el issueId.

## Analogía

Es como una calculadora que suma días a una fecha: si el papelito de la fecha viene en blanco, la calculadora no debe explotar — debe devolver también un papelito en blanco. Ahora la calculadora primero revisa que el papelito traiga una fecha antes de sumar.
