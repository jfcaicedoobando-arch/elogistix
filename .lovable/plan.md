## Objetivo
CI falla en el baseline arquitectónico (Power of 10, regla ≤200 líneas). Dos archivos rebasan el límite tras el rediseño del modal de envío:

- `src/components/shared/emails/EnviarDocumentoDialog.tsx` — 225 líneas (25 extras)
- `src/hooks/emails/useEnvioDocumentoForm.ts` — 208 líneas (8 extras)

Ambos están fuera de la allowlist y disparan `architecture-baseline` + `audit-report`.

## Analogía
Los dos archivos crecieron pasados de "página" que permite el reglamento del edificio. Vamos a mover un mueble a otro cuarto para que cada archivo vuelva a caber en su cuarto sin cambiar lo que hace.

## Cambios

### 1. Extraer chips helpers del modal → nuevo archivo
Crear `src/components/shared/emails/useEnvioChips.ts` con:
- `paraChips` / `ccChips` memos
- `handleParaAdd/Remove`, `handleCcAdd/Remove`
- Firma: `useEnvioChips(form) => { paraChips, ccChips, handleParaAdd, handleParaRemove, handleCcAdd, handleCcRemove }`

`EnviarDocumentoDialog.tsx` sólo hace `const chips = useEnvioChips(form)` y pasa los handlers a `EmailChipsField`. Cae de ~225 a ~150 líneas.

### 2. Compactar `useEnvioDocumentoForm.ts` (208 → ≤200)
Alternativas ligeras (sin cambio funcional):
- Extraer la lógica de precarga inicial (`useEffect` de reset) a un helper interno `initEnvioForm` en `src/hooks/emails/envioDocumentoInit.ts` (~40 líneas), o
- Consolidar comentarios extensos y unir returns/derivaciones que quedaron verbosas.

Prefiero el primero: helper `computeInitialPrecarga(contactos, ccInicial, destInicial, userEmail)` que retorna `{ precargaCc, precargaDest, seleccionadosPre }`. El hook queda en ~170 líneas.

### 3. Versionado
- Bump `APP_VERSION` a `13.300.19` (patch: refactor de tamaño, sin cambios de comportamiento).
- Entrada en `CHANGELOG.md`: "Refactor: split de `EnviarDocumentoDialog` y `useEnvioDocumentoForm` para cumplir Power of 10 (≤200 líneas)."

## Validación
- `bun run lint`
- `bunx vitest run src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts src/components/shared/emails src/hooks/emails`
- Sanity check: contar líneas de los 3 archivos resultantes ≤200.

## Fuera de alcance
- No se toca el diseño del modal, ni la API pública del hook, ni tests existentes de comportamiento.
