# Plan · Automatizar Serie y Fecha de emisión en Nueva factura manual

## Contexto (verificado)

Analogía: el modal actualmente es como un formulario de banco donde te dejan escribir la fecha del cheque y el número de folio a mano — cosas que la caja debería llenar sola. Confirmé en el código:

- `src/features/facturacion/components/FacturaManualDatosFiscales.tsx` muestra dos campos editables: `Serie` (input libre uppercase, 5 chars) y `Fecha emisión` (`DatePickerMx`).
- `src/features/facturacion/hooks/useFacturaManualForm.ts` inicializa `serie: "A"` y `fechaEmision: todayLocalISO()` y los envía como parte del payload al backend.

Riesgos que esto genera hoy:
- **Fecha editable** → el SAT exige timbrar dentro de 72 h de `fecha_emision`. Si el usuario adelanta o atrasa la fecha, el PAC rechaza el timbre.
- **Serie a mano** → contamina la numeración fiscal (ya arreglamos folios contaminados en v13.301.58). Cualquier texto rompe la serie oficial por moneda.

## Reglas de negocio a aplicar

- **Fecha de emisión** = siempre hoy en zona local MX (`todayLocalISO()`), calculada en el momento del submit (no al abrir el modal, para que si el usuario deja el modal abierto y pasa medianoche siga siendo válido).
- **Serie** = derivada de la moneda:
  - `USD` → `SF43718`
  - `EUR` → `SF46410`
  - `MXN` → `A` (default actual — mantengo el valor existente para no romper facturación en curso).

## Cambios

### 1. `FacturaManualDatosFiscales.tsx`
- Quitar los dos bloques `<div>` de "Serie" y "Fecha emisión".
- La grid pasa de 8 a 6 campos (sigue viéndose bien en 2×3 / 4×2).
- No se elimina `serie` / `fechaEmision` del tipo `DatosFiscalesValue` — se siguen calculando en el hook.

### 2. `useFacturaManualForm.ts`
- Añadir helper `serieForMoneda(m: MonedaManual): string` con el mapeo de arriba.
- En `updateFiscal`, cuando el patch incluya `moneda`, actualizar también `serie` con el mapeo.
- En `buildInput()`, sobrescribir `fechaEmision: todayLocalISO()` justo antes de enviar (recalcula al momento del submit).
- Ajustar `useFaltantesTimbrar` para quitar `!fiscal.fechaEmision` (siempre estará seteada) y `puedeGuardar` para no depender de esa condición.

### 3. Tests
- Añadir un test en `src/features/facturacion/hooks/__tests__/useFacturaManualForm.test.ts` (crear si no existe) que verifique:
  - Al cambiar `moneda` a USD/EUR, `serie` se actualiza al valor correspondiente.
  - `buildInput()` siempre devuelve `fechaEmision === todayLocalISO()`.

### 4. Versionado
- Bump `APP_VERSION` a `13.315.4`.
- Entrada en `CHANGELOG.md` explicando la automatización y por qué (SAT 72 h + integridad de series).

## Fuera de alcance

- No cambio la lógica del backend / RPC — sigue aceptando `serie` y `fechaEmision` en el payload; sólo los llenamos automáticamente en el cliente. Cambiar el contrato del RPC es mayor riesgo y no lo pediste.
- No toco otros modales de facturación (Sustitución, NC, etc.).
