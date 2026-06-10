## Contexto

El reporte de auditoría `12.76.2` ya está **100% verde**: 0 violaciones de arquitectura, 0 archivos >200 líneas, 0 casts HIGH/CRITICAL.

El blob de vitest tiene **solo 2 tests rojos**, ambos en `src/lib/__tests__/architecture-baseline.test.ts`. No son regresiones de producto: son tests centinela que exigen que, cuando un archivo deja de violar la regla, se quite de la allowlist.

### Fallos

1. **PAGES_COMPONENTS_BASELINE** todavía lista:
   - `src/pages/auth/ForgotPasswordDialog.tsx`
   - `src/pages/auth/ResetPassword.tsx`

   (ya migrados a `@/services/auth` en 12.76.2)

2. **OVERSIZED_BASELINE** todavía lista:
   - `src/pages/auth/Login.tsx` (ahora 66 líneas)
   - `src/lib/mappers/genericPayloadMapper.ts` (ahora 165 líneas)

## Cambios

1. `src/lib/__tests__/architecture-baseline.test.ts` — borrar las 4 entradas obsoletas (líneas 35, 36, 42, 43).
2. `CHANGELOG.md` — agregar `[12.76.3]` documentando la limpieza.
3. `src/constants/appVersion.ts` — bump a `12.76.3`.

No hay cambios de producto ni de UI. Solo se consolidan los hallazgos ya remediados en 12.76.2.
