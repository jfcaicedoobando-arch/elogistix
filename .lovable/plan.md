# Limpieza completa de calidad de código

Objetivo: dejar el repo en verde para `lint`, `lint:unused` y `test` sin tocar comportamiento de producción.

## 1. Archivos huérfanos (knip)
Eliminar:
- `src/hooks/crm/leads/convertirHelpers.ts` (solo re-exporta `@/services/crm/leads`; sin consumidores).
- `src/hooks/crm/leads/leadPayload.ts` (solo re-exporta `@/lib/crm/leads/leadPayload`; sin consumidores).
- `src/pdf/components/ResumenBox.tsx` (no se importa en ningún documento PDF actual).

Verificar con `rg` antes de borrar que no haya import vivo.

## 2. Dependencia sin uso
- Quitar `@radix-ui/react-toast` de `package.json` (knip lo marca; el proyecto usa `sonner`).

## 3. Exports / tipos sin uso (20 + 10 + 1 duplicado)
- Ejecutar `bunx knip --reporter json` para obtener la lista exacta.
- Para cada símbolo:
  - Si es export interno de un barrel y nadie lo consume → eliminar el `export` (o el símbolo entero si era solo para el barrel).
  - Si es un tipo público de un dominio pero sin consumidores → eliminar.
  - Duplicado: dejar una sola fuente y borrar el re-export redundante.
- No tocar `src/components/ui/**`, `src/integrations/supabase/**`, ni catálogos (`src/data/**`) — ya están en el `ignore` de knip.

## 4. Errores de lint (`no-restricted-imports`, 21 errores)
Reemplazar imports de archivos internos por el barrel de dominio en:
- `src/contexts/auth/useAuthSession.ts`
- `src/contexts/auth/useLoginAudit.ts`
- `src/pages/crm/CrmLayout.tsx`
- `src/pages/facturacion/Facturacion.tsx`

Patrón: `@/hooks/<dominio>/archivo` → `@/hooks/<dominio>`; idem `@/services/...`.

## 5. Warnings de lint
- `exhaustive-deps` en controllers de facturación: agregar deps faltantes o memoizar con `useCallback` si la dep es estable.
- Complejidad >16 en 5 funciones (`errorDetailsExtract`, `convertirCotizacionAEmbarques`, `marcarProformaFacturada`, edge `invite-client-user`, helper de cotización):
  - Extraer ramas a helpers privados en el mismo archivo. Sin cambio de comportamiento, solo partición.
- Mantener Power of 10 (≤200 líneas por archivo nuevo, sin `any`).

## 6. Verificación final (en este orden)
1. `bun run lint` → 0 errores, 0 warnings.
2. `bun run lint:unused` → limpio.
3. `bun run audit:tests` → 0 violaciones.
4. `bunx vitest run` → 781/781 verde.

## 7. Versionado y changelog
- `src/constants/appVersion.ts`: bump a `12.16.2`.
- `CHANGELOG.md`: entrada `## [12.16.2] - 2026-05-29` con bullets:
  - Eliminados 3 archivos huérfanos y dependencia `@radix-ui/react-toast` sin uso.
  - Saneados 21 errores de `no-restricted-imports` (uso de barrels de dominio).
  - Reducida complejidad >16 en 5 funciones vía extracción de helpers.
  - Corregidos warnings de `exhaustive-deps` en controllers de facturación.

## Notas técnicas
- Refactors estructurales únicamente; cero cambio de lógica de negocio.
- Si una extracción para bajar complejidad amenaza con cambiar el contrato público de un hook/servicio, se deja documentado y se omite (preferimos no romper la API).
- Si knip reporta un export que sí es parte de la API pública del barrel pero nadie consume todavía (p. ej. hook nuevo en CRM), se anota en `knip.json` como esperado en lugar de borrar.
