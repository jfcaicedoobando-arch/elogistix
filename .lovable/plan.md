## Contexto

Todas las descargas de PDF/XML desde el detalle de factura (factura, nota de crédito y REP/complemento de pago) pasan por la edge function `supabase/functions/facturapi-descargar/index.ts`, que arma el `Content-Disposition` y determina el nombre final. Hoy queda así:

- Factura: `LibreCarga_F971.pdf`
- Nota de crédito: `LibreCarga_NC-NCA10.pdf`
- REP: `LibreCarga_REP-A5.pdf`

Problemas: no se distingue si es factura o NC/REP a simple vista, no incluye cliente ni fecha, y el prefijo de la org repite algo obvio para quien descarga desde su propia cuenta.

## Nuevo esquema de nombres

```text
{Tipo}_{FolioSerie}_{Cliente}_{Fecha}.{ext}
```

Ejemplos:
- `Factura_F971_ClienteAcme_2026-07-21.pdf`
- `NotaCredito_NC-A10_ClienteAcme_2026-07-21.xml`
- `REP_A5_ClienteAcme_2026-07-21.pdf`

Reglas:
- `Tipo`: `Factura`, `NotaCredito` o `REP`.
- `FolioSerie`: preferir `numero` (folio interno consolidado) si existe; si no, `serie+folio_fiscal`. Fallback `SF` (sin folio).
- `Cliente`: `cliente_nombre` slugificado (misma normalización que `slugifyOrg`: sin acentos, `[^a-zA-Z0-9]→_`, máx 40 chars). Si viene vacío, se omite ese segmento.
- `Fecha`: `fecha_emision` (o `acuse_cancelacion_fecha` para NC/REP sólo si `fecha_emision` no existe) en `YYYY-MM-DD` UTC.
- Se elimina el prefijo `{orgSlug}_` del nombre visible — la organización queda implícita porque el usuario descarga desde su propia sesión. (Se conserva `slugifyOrg` porque otras edge functions siguen usándolo.)

## Cambios técnicos

1. **`supabase/functions/facturapi-descargar/index.ts`**
   - Ampliar el `select` de cada `resolveFrom*` para traer `cliente_nombre`, `fecha_emision` y `numero` cuando aplique (para `pagos_factura` se hará un join ligero contra `facturas` vía el `factura_id` que ya se lee, para heredar cliente/fecha del CFDI padre; para NC lo mismo si `factura_notas_credito` no los tiene directamente).
   - Cada `resolveFrom*` devolverá además `cliente`, `fecha` y `tipo` (`Factura` | `NotaCredito` | `REP`).
   - Nueva helper local `buildFilename({ tipo, folioSerie, cliente, fecha, ext })` que aplica slugify a `cliente` y concatena solo los segmentos no vacíos separados por `_`.
   - Reemplazar la línea `const filename = ${orgSlug}_${target.data.filename}.${ext}` por el resultado del builder.

2. **Tests** — actualizar `src/features/facturacion/services/__tests__/descargarCfdiFacturapi.test.ts` y `src/features/facturacion/hooks/__tests__/useDescargarCfdi.test.tsx` si mockean el `Content-Disposition`; agregar un test unitario nuevo para `buildFilename` (edge function → mover el helper a `_shared/facturaFilename.ts` para testearlo desde el sandbox sin Deno). Cubrir: cliente vacío, folio vacío, caracteres con acentos, fecha nula.

3. **Versionado**
   - `APP_VERSION` → `13.303.91`.
   - Entrada en `CHANGELOG.md` root con analogía.

## Fuera de alcance

- Descarga de XML de facturas **de proveedor** (módulo CxP) — usa otra ruta y otro naming; no se toca en este cambio.
- Envío por email (usa `slugifyOrg` con otro propósito) — no se modifica.

## Verificación

- Desde `/facturacion/{id}`: descargar PDF y XML de una factura timbrada, de una nota de crédito y de un REP; confirmar los nombres siguen el nuevo patrón.
- Cliente con acentos y espacios: verificar que se convierten a `_` sin acentos.
- Factura sin `cliente_nombre` (edge case): que el nombre no tenga doble guion bajo consecutivo.
- Correr `bunx vitest run` sobre los archivos de tests tocados.

## Analogía (para el resumen final)

Antes el archivo descargado se llamaba como si guardaras todas las fotos del celular con el nombre "Foto.jpg": tenías que abrirlas para saber qué era. Ahora cada archivo dice de un vistazo *qué tipo* de documento es, *de quién* y *de cuándo*.
