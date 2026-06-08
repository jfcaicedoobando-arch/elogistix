## Objetivo
Endurecer `src/lib/csv/parseCsv.ts` para que la importación tolere encabezados con caracteres ocultos (BOM intermedio, zero-width, NBSP, controles), columnas vacías por comas sobrantes, duplicados, y permita traducir alias menores de forma segura sin romper consumidores.

## Diagnóstico
- `normalizeHeader` ya hace NFD + trim + lowercase, pero NO elimina:
  - Zero-width: `\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF` interno.
  - NBSP `\u00A0` (queda como caracter no `\s` en algunas runtimes legacy → mejor sustituirlo a espacio antes del `\s+` collapse).
  - Caracteres de control `\u0000-\u001F`, `\u007F`.
- `parseCsv` ya hace `if (!h) return` para encabezados vacíos, pero **no deduplica** colisiones (dos columnas que normalizan al mismo header se pisan silenciosamente).
- No existe forma de mapear variaciones menores ("e-mail" vs "correo", "tel" vs "telefono") sin tocar cada importador.

## Cambios

### 1. `src/lib/csv/parseCsv.ts`
- **`normalizeHeader(raw)`**:
  - Antes del `trim()`: `replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")` para zero-width.
  - `replace(/\u00A0/g, " ")` para que NBSP colapse junto a `\s+`.
  - `replace(/[\x00-\x1F\x7F]/g, "")` para controles.
  - Mantener el resto del pipeline (NFD, lowercase, `_`, alfanumérico).
- **`parseCsv(input, options?)`**: agregar parámetro opcional `options?: { headerAliases?: Record<string, string> }`.
  - El alias se aplica DESPUÉS de `normalizeHeader` y antes de armar el objeto fila.
  - Las claves del mapa también se normalizan al cargar (defensivo).
- **Deduplicación defensiva** de headers: si tras normalizar/aliasear hay duplicados, suffijar `_2`, `_3`, … en orden de aparición, y emitir `console.warn` listando los duplicados (no falla la importación).
- **Columnas vacías**: cuando `h === ""` después de la sanitización, continuar saltándola (ya implementado) y registrar `console.warn` UNA vez con el conteo de columnas vacías detectadas.
- Mantener firma `parseCsv(input)` retrocompatible (options opcional).

### 2. Tests — `src/lib/csv/__tests__/parseCsv.test.ts`
Añadir:
- `normalizeHeader` con BOM intermedio (`"Razón\uFEFF Social"` → `"razon_social"`).
- `normalizeHeader` con zero-width (`"nombre\u200B"` → `"nombre"`).
- `normalizeHeader` con NBSP (`"Días\u00A0Crédito"` → `"dias_credito"`).
- `normalizeHeader` con tab/control (`"rfc\t"` → `"rfc"`).
- `parseCsv` con encabezado que tiene una coma extra al inicio/final (`",nombre,rfc,"`) → no rompe, headers válidos = `["nombre","rfc"]`, filas mapean correctamente.
- `parseCsv` con headers duplicados (`"nombre,Nombre"`) → segundo se vuelve `nombre_2`.
- `parseCsv` con `headerAliases`: `{ correo: "email", tel: "telefono" }` reescribe los headers en el resultado.

### 3. Versionado
- `src/constants/appVersion.ts` → `12.61.5`.
- `CHANGELOG.md`: entrada `## [12.61.5] - 2026-06-08`.

## Notas técnicas
- Sin cambios a la firma pública obligatoria; `options` es opcional, los importadores existentes (`importSchemaCliente`, `importSchemaProveedor`, `leadsCsv`) siguen funcionando sin tocarlos.
- Los `console.warn` ayudan a diagnosticar archivos sucios sin bloquear al usuario operativo.
