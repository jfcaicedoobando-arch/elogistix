## Lote C — FIX-17 (factura manual cuadrada) + FIX-18 (NaN en costos)

Continúa la fase 4 con dos correcciones de integridad numérica.

### FIX-17 · Factura manual: totales al centavo y validación estricta

Archivo: `src/features/facturacion/services/facturaManual.ts`.

- Calcular subtotal e IVA usando `subtotalLinea` + `sumarMontos` de `lib/financial/financialUtils.ts` en vez de `+=` sobre float con redondeo global. El total del encabezado debe ser exactamente Σ de líneas ya redondeadas.
- Validar por concepto (antes del insert): `Number.isFinite(cantidad) && cantidad > 0` y `Number.isFinite(precio_unitario) && precio_unitario >= 0`; si falla, `throw new Error("Concepto #N …")` mencionando el campo (`cantidad`/`precio_unitario`) y valor recibido.
- Folio borrador con entropía: `BORRADOR-${Date.now().toString(36)}-${crypto.randomUUID().slice(0,6)}` para evitar colisión bajo carga.
- Total de cada renglón en `conceptos_factura` = `subtotalLinea(cantidad, precio_unitario)` (idéntico al del encabezado).
- Rollback: mantener el `delete` actual; si falla, degradar `estado` a `"Error"` (nuevo valor tolerado por UI existente — validar que no rompa `estado` enum; si es enum estricto, dejar `Borrador` + agregar `notas` explicativas y bloquear timbrado vía nota — decisión durante implementación).

Tests nuevos en `src/features/facturacion/services/__tests__/facturaManual.test.ts`:
- 5 conceptos con montos "difíciles" (0.1, 33.333, 1/3…) → `insertPayload.total === Σ renglones.total`.
- concepto con `cantidad = NaN` → rechazo con mensaje que menciona "cantidad".
- concepto con `precio_unitario = Infinity` → rechazo.
- folio contiene UUID (regex `/BORRADOR-[0-9a-z]+-[0-9a-f]{6}/`).

### FIX-18 · NaN en inputs de costo/venta/cantidad

Archivo: `src/features/cotizacion/components/TablaCostosLocal.tsx`.

- Encapsular el parseo en helper local `parseInputNumero(raw): number` que devuelve `0` cuando el resultado no es finito (cubre `""`, `"."`, `"1.2.3"`, etc.).
- Aplicar el helper a los tres `onChange` de `cantidad`, `costo_unitario`, `precio_venta` (líneas 122, 133, 142).
- No modificar visual/UX.

Test nuevo en `src/features/cotizacion/components/__tests__/TablaCostosLocal.test.tsx` (crear si no existe) o test unitario del helper extraído:
- inputs `""`, `"."`, `"1.2.3"`, `"abc"` → `0`.
- input `"12.34"` → `12.34`.

No se toca la RPC `actualizar_cotizacion_costos` en esta fase (el `COALESCE` server-side queda para un Lote posterior; ya evitamos el NaN en el cliente que era el vector real reportado).

### Cierre

- `CHANGELOG.md`: entrada bajo `## [13.303.48]` con bullets Lote C (FIX-17, FIX-18).
- `src/constants/appVersion.ts`: bump a `13.303.48`.
- Correr `bunx vitest run` sobre los archivos tocados para verificar verde.

### Fuera de alcance

- FIX-19 (trigger IVA en BD): entra en Lote D siguiente.
- Migración a RPC transaccional de factura manual: se documenta pero se posterga (requiere diseño de schema `estado='Error'` o similar).
