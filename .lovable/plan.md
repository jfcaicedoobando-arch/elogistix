## Problema

El contador subió la CSF de un proveedor de gasto operativo. El parseo terminó OK, pero el modal solo mapea `nombre` y `rfc`. La CSF también devuelve **CP, dirección, ciudad y estado**, y para timbrar/registrar una factura CFDI 4.0 del proveedor necesitamos además el **Régimen Fiscal**. Hoy la tabla `proveedores` no tiene esas columnas, por eso no hay dónde guardarlas y el modal no las muestra.

## Alcance del fix

1. **Base de datos** — agregar a `public.proveedores` las columnas: `cp`, `direccion`, `ciudad`, `estado`, `regimen_fiscal` (todas `text`, nullable para no romper proveedores existentes). Mantener GRANTs y RLS actuales (migración solo agrega columnas).

2. **Edge function `parse-csf`** — extender el prompt y el tool schema de Gemini para que devuelva también `regimen_fiscal` (clave + descripción, p. ej. "601 - General de Ley Personas Morales"). Redesplegar.

3. **Servicio cliente `parseCsf`** — extender `CsfParsedData` con `regimen_fiscal?: string`.

4. **Controller `useNuevoProveedorController`**
   - Agregar al estado: `cp`, `direccion`, `ciudad`, `estado`, `regimen_fiscal`.
   - En `handleCsfUpload` propagar los seis campos (no solo nombre/rfc), igual que ya lo hace el controller de clientes.
   - Validación en `isStep1Valid()`: cuando la categoría es **GastoOperativo** (que siempre es Nacional), exigir `rfc`, `cp` y `regimen_fiscal` como obligatorios además de los actuales — son los mínimos del receptor/emisor en CFDI 4.0. Para logístico nacional siguen siendo opcionales (no todos timbran).

5. **`NuevoProveedorDialog`** — agregar en el paso 1, debajo del RFC, los inputs:
   - CP (input corto, 5 dígitos).
   - Régimen Fiscal (select con catálogo SAT estándar: 601, 603, 605, 606, 612, 621, 626, etc.).
   - Dirección, Ciudad, Estado (inputs, opcionales pero pre-llenados por CSF).
   Marcar con `*` los obligatorios cuando aplique. Mantener el `scrollableDialog` ya aplicado.

6. **`EditarProveedorDialog`** — espejar los nuevos campos para que un admin pueda completarlos en proveedores existentes (sin re-subir CSF). Solo agregar inputs; sin cambios de lógica.

7. **Catálogo de régimen fiscal** — nuevo archivo `src/constants/regimenFiscalSAT.ts` con la lista oficial mínima usada en CFDI 4.0 (importable también desde clientes en el futuro).

8. **Changelog + APP_VERSION** — bump a `12.76.15`, entrada en `CHANGELOG.md` describiendo el fix.

## Fuera de alcance

- No se modifica el flujo de `EditarClienteDialog` ni de timbrado en sí (ya existe en otro módulo).
- No se agregan complementos PPD/PUE en este fix.
- No se hace re-procesamiento masivo de proveedores existentes.

## Detalles técnicos

- Migración SQL (idempotente):
  ```sql
  ALTER TABLE public.proveedores
    ADD COLUMN IF NOT EXISTS cp text,
    ADD COLUMN IF NOT EXISTS direccion text,
    ADD COLUMN IF NOT EXISTS ciudad text,
    ADD COLUMN IF NOT EXISTS estado text,
    ADD COLUMN IF NOT EXISTS regimen_fiscal text;
  ```
- `parse-csf` agrega al `TOOL_SCHEMA.properties` y a `required` la clave `regimen_fiscal` y al `SYSTEM_PROMPT` la instrucción "Régimen fiscal vigente (clave + descripción)".
- El controller seguirá usando `setForm` (no RHF), así que no aplica la regla de `setValue/trigger`.
- Régimen fiscal como `<Select>` (Radix) — usar `value=""` controlado y placeholder, sin SelectItem vacío (regla del proyecto).

## Resultado esperado

Subir la CSF auto-rellena nombre, RFC, CP, régimen fiscal, dirección, ciudad y estado. El paso 1 bloquea continuar si falta cualquiera de los obligatorios para CFDI. El proveedor queda listo para registrar/timbrar facturas.
