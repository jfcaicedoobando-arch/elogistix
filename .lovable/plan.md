# Fix CI: `PasoDatosGenerales.tsx` excede el límite de 200 líneas

## Causa raíz

Al agregar el banner `AvisoIncotermCIF` en `13.142.0`, el componente `src/features/cotizacion/components/wizard/PasoDatosGenerales.tsx` quedó en 201 líneas (CI cuenta el salto final), justo arriba del límite de Power of 10. Esto rompe dos guardas de arquitectura:

- `src/__tests__/audit-report.test.ts` → "arch baseline: 0 archivos productivos > 200 líneas"
- `src/lib/__tests__/architecture-baseline.test.ts` → mismo chequeo

Que a su vez tumban shards 1, 8, "Lint/typecheck/build" y "Coverage merge" → aggregator falla.

## Cambio

Extraer el bloque "Cierre" (acordeón con Número de embarques + Notas adicionales) a un componente propio:

- **Nuevo archivo:** `src/features/cotizacion/components/wizard/SeccionCierreCotizacion.tsx`
  - Recibe `form` (del wizard) y `complete: boolean`.
  - Contiene el `Accordion` actual (líneas ~150–197 de `PasoDatosGenerales.tsx`).
- **Editar:** `PasoDatosGenerales.tsx` para importar `SeccionCierreCotizacion` y reemplazar el bloque inline. Queda muy por debajo de 200 líneas.

No se cambia lógica ni UI: sólo se mueven nodos JSX.

## Validación

- `bunx vitest run src/__tests__/audit-report.test.ts src/lib/__tests__/architecture-baseline.test.ts` → ambos verdes.
- Smoke visual del Paso 1 del wizard (Marítimo FOB y CIF, Aéreo, Terrestre): el acordeón de Cierre se ve y funciona igual.
- Bump a `13.142.2` + entrada en `CHANGELOG.md`.
