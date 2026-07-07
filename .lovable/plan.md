
## Objetivo

Que toda factura timbrada muestre **Expediente**, **BL Master** y **BL House** del embarque, tanto en el **XML del SAT** (dentro de la descripción de cada concepto) como en un **bloque destacado** en el PDF de FacturAPI. Aplica a facturas nuevas; las ya timbradas no se re‑emiten.

## Analogía rápida

Piensa en la factura como un sobre postal:
- El **XML SAT** es la etiqueta oficial que Hacienda revisa — ahí metemos el Exp/BL como parte de cada renglón para que quede impreso legalmente.
- El **PDF de FacturAPI** es el sobre bonito — ahí ponemos un sello grande con "Referencias" para que el cliente lo vea de un golpe.

## Cambios

### 1. Backend — `supabase/functions/facturapi-emitir/`

**a) `index.ts`** — al cargar la factura, también leer del embarque vinculado (`facturas.embarque_id → embarques`) los campos `expediente`, `bl_master`, `bl_house`. Si la factura no está atada a un embarque específico, hacer fallback a `facturas.expediente` y `facturas.referencia_bl` (ya existen en la tabla).

Construir un objeto `referencias`:
```
{ expediente: "ELIMP00195", bl_master: "COSU...", bl_house: "HL2504XYZ" }
```
Pasarlo al `FacturaContext`.

**b) `helpers.ts`** — dos cambios en `buildFacturapiPayload`:

- **Prefijo por concepto (va al XML SAT):** anteponer a `c.descripcion` un encabezado compacto:
  `"[Exp. {expediente} · BL/M: {master} · BL/H: {house}] {descripcion_original}"`.
  Solo se agregan las partes que existan (si no hay `bl_master`, se omite). Un solo helper puro `formatDescripcionConReferencias(descripcion, referencias)` con pruebas unitarias.

- **Bloque "Referencias" en el PDF:** setear `payload.pdf_custom_section` con HTML corto tipo:
  ```
  <h4>Referencias del embarque</h4>
  <ul><li>Expediente: ELIMP00195</li><li>BL Master: ...</li><li>BL House: ...</li></ul>
  ```
  (FacturAPI acepta HTML sanitizado en ese campo y lo imprime al pie del PDF.)

**c) `helpers_test.ts`** — casos: solo expediente, expediente+master, los tres, ninguno (no rompe), y descripciones muy largas (validar que no exceda el límite de 1000 char del SAT — si excede, truncar la parte original con `…`).

### 2. Feature flag y retrocompatibilidad

Nada de migración: los campos ya existen en BD. Se activa automáticamente en la próxima emisión. Notas de credito y REP (`facturapi-emitir-nota-credito`, `facturapi-emitir-rep`) reciben el mismo tratamiento para consistencia (mismo helper compartido).

### 3. Frontend — pequeño ajuste UX

- En `DialogTimbrarFactura.tsx`: mostrar una vista previa de cómo se verá el primer concepto con el prefijo, para que la vendedora confirme antes de timbrar.
- Editable: si el usuario no quiere el prefijo en un concepto específico (raro), puede quitarlo manualmente en la descripción antes de timbrar. Comportamiento por defecto = prefijado.

### 4. Tests

- `helpers_test.ts` (Deno) — helper de formato de descripción y armado de `pdf_custom_section`.
- `src/features/facturacion/__tests__/referencias-embarque.test.ts` (Vitest) — el hidratador que jala expediente/BLs desde el embarque.

### 5. Changelog + versión

- Bump `APP_VERSION` a `13.208.0`.
- Entrada en `CHANGELOG.md` bajo `## [13.208.0]`.

## Archivos afectados (estimado)

```text
supabase/functions/facturapi-emitir/index.ts                  (mod)
supabase/functions/facturapi-emitir/helpers.ts                (mod)
supabase/functions/facturapi-emitir/helpers_test.ts           (mod)
supabase/functions/facturapi-emitir-nota-credito/…            (mod, mismo helper)
supabase/functions/facturapi-emitir-rep/…                     (mod, mismo helper)
src/features/facturacion/components/DialogTimbrarFactura.tsx  (mod, preview)
src/features/facturacion/__tests__/referencias-embarque.test.ts (nuevo)
src/constants/appVersion.ts                                   (bump)
CHANGELOG.md                                                  (entrada)
```

## Detalles técnicos

- **Límite SAT**: el campo `Descripcion` en CFDI 4.0 admite hasta 1000 caracteres. El helper trunca la descripción original si el prefijo + texto supera 990 chars (deja margen).
- **Sanitización**: `pdf_custom_section` va con HTML mínimo (h4/ul/li) sin atributos, para evitar que FacturAPI lo rechace.
- **Cuando no hay embarque**: si la factura es "manual sin embarque" (poco común), se usa lo que haya en `facturas.expediente` / `facturas.referencia_bl`; si ambos son null, no se agrega prefijo ni bloque — la factura sale como hoy.

## Fuera de alcance

- Re‑emitir facturas ya timbradas (implicaría cancelación + sustitución; se puede hacer caso por caso a mano).
- Addenda XML personalizada por cliente (opción C descartada — no la pidieron).
