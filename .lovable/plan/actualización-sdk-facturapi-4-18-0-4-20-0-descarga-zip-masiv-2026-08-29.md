# Actualización SDK FacturApi 4.18.0 → 4.20.0 + descarga ZIP masiva

Revisión del GitHub de FacturApi (https://github.com/facturapi) el 2026-08-29.

## Hallazgos relevantes

- **SDK Node**: tenemos pineado `npm:facturapi@4.18.0` en `supabase/functions/_shared/facturapiClient.ts`. El más reciente es **4.20.0** (2026-08-24).
  - `4.19.0` (ago-03): métodos de borradores de retenciones.
  - `4.20.0` (ago-24): **métodos de descarga ZIP** (varios PDF/XML en un solo archivo) + fix de tipado (cuentas de impuestos como arreglos).
  - Versiones intermedias que ya tenemos con 4.18: metadatos de error de API expuestos, headers personalizados, recibos multi-factura, constantes de Carta Porte.
- **Documentación** (facturapi-docs, activo hasta ago-27):
  - Nueva sección sobre **status 202** (timbrado asíncrono).
  - **Complemento de Leyendas Fiscales** documentado.
  - **Rescue CFDI** (recuperación de CFDI emitidos fuera de FacturApi).
  - Nuevos ítems en el catálogo de percepciones.

## Trabajo propuesto

1. **Bump del SDK a 4.20.0** en `_shared/facturapiClient.ts` (import estático — mantener el patrón actual que evita el bug de constraints de Deno Edge). Verificar que los 6 edge functions sigan pasando el guardrail `facturapi-multi-tenant.test.ts`.
2. **Descarga ZIP masiva de facturas** (nuevo): en el módulo de Facturación, botón "Descargar ZIP" para selección múltiple o rango de fechas → nueva edge function `facturapi-descargar-zip` que use los métodos ZIP del SDK 4.20.0 (multi-tenant vía `facturapiAuth.ts`). Reduce clics al entregar paquetes de PDF/XML al contador.
3. **Smoke test en Sandbox**: timbrar, cancelar, descargar ZIP con la org de pruebas antes de dar por cerrado.
4. Changelog + bump `APP_VERSION`.

## Fuera de alcance (queda documentado para futuro)

- Leyendas Fiscales y Rescue CFDI: sin necesidad actual en Libre Carga; anotar en `docs/facturapi-go-live.md` como capacidades disponibles del PAC.
- Borradores de retenciones: no emitimos retenciones hoy.

## Detalles técnicos

- Archivos: `supabase/functions/_shared/facturapiClient.ts`, nuevo `supabase/functions/facturapi-descargar-zip/index.ts`, UI en `src/features/facturacion/`, `supabase/config.toml` (verify_jwt true), `CHANGELOG.md`, `src/constants/appVersion.ts`.
- La nueva edge function debe resolver la key por org (regla multi-tenant), nunca `FACTURAPI_KEY` global, y nunca fetch directo a facturapi.io (guardrail SDK-only).
- Revocar EXECUTE a `anon` si se crean RPCs (regla FIX-45).
