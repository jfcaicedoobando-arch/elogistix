# Plan: Más tests de lógica de negocio (12.98.6)

Continuación de 12.98.5. Foco: módulos **puros o casi puros** con 0% de cobertura y alto valor de negocio. Evitamos componentes React/páginas — sólo dominio y servicios.

## Módulos objetivo

| Módulo | Tipo | Líneas | Estrategia |
|---|---|---:|---|
| `src/lib/auth/translateAuthError.ts` | Puro (mapa de mensajes) | 34 | Tests directos por cada caso de error de Supabase Auth (credenciales, email no confirmado, rate-limit, etc.) + fallback. |
| `src/features/crm/domain/oportunidadFormHelpers.ts` | Puro (helpers RHF) | 32 | Casos: estado inicial vacío, hidratación desde row existente, normalización de moneda y valores numéricos. |
| `src/features/crm/domain/oportunidadPayload.ts` | Puro (mapper INSERT) | 34 | Casos: payload mínimo válido, omisión de campos opcionales nulos, conversión de probabilidad/monto. |
| `src/lib/facturacion/proyeccionCsv.ts` | Puro (CSV builder) | 38 | Casos: encabezado correcto, escape de comillas/comas en concepto, agrupación por mes, total al pie. |
| `src/features/costeo/services/tarifas.ts` | Supabase (CRUD + ranking) | 113 | Mock de `supabase` con cadena thenable (patrón `mem://technical/testing-mock-patterns`). Cubrir: listado con filtros, ranking Top 3 CN→MX (memoria `costeo-tarifas-maritimas`), CRUD de recargos hijos, manejo de `error` no-null. |

**Cobertura esperada:** +~250 líneas cubiertas (~+0.5 puntos sobre el denominador depurado de 12.98.5).

## Convenciones

- Tests bajo `__tests__/` colindante a cada módulo.
- Mock de Supabase encapsulado en `vi.mock("@/integrations/supabase/client", ...)` con cadena thenable reusable; sin tocar el cliente real.
- Sólo `describe` + `it` + `expect`. Sin `render` ni RTL (no son componentes).
- Cero `any`. Si un tipo no encaja, `// SAFE-CAST:` con justificación (regla `mem://principles/safe-cast`).

## Entregables

1. 5 archivos `*.test.ts` nuevos (uno por módulo).
2. Bump `APP_VERSION → 12.98.6`.
3. Entrada en `CHANGELOG.md` con resumen y lista de módulos cubiertos.
4. Verificación local: `bunx vitest run` sobre los 5 archivos nuevos, todos verdes.

## Fuera de alcance

- Hooks que dependen de RHF + Supabase + toasts simultáneamente (`useNuevaFacturaProveedorForm`, `useNuevoEmbarqueWizard`, `useEmbarquesPageState`) — quedan para una iteración posterior si CI lo requiere.
- Componentes presentacionales (`*.tsx` de páginas) — el plan 12.98.5 ya excluyó el ruido declarativo.
- No se tocan thresholds: los actuales (35/35/48/67) ya pasan; este plan sube el numerador como buffer hacia el ratchet (40/40).
