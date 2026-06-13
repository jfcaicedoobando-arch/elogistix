# Auditoría Arquitectónica — Estado: CERRADA

El plan original de auditoría arquitectónica complementaria está **completado** (versiones 12.95.x). Resumen ejecutivo:

| Paso | Descripción | Estado | Versión |
| ---- | ----------- | ------ | ------- |
| 1    | Regla explícita para `src/lib/` (ADR + test) | ✅ | 12.95.x |
| 2    | Mover `lib/crm/` → `features/crm/domain/` | ✅ | 12.95.x |
| 3    | Controllers para `Cxp.tsx`, `Papelera.tsx`, `Idempotencia.tsx` | ✅ | 12.95.x |
| 4    | Romper acoplamiento `tesoreria → facturas/cxp` | ✅ | 12.95.x |
| 5    | Patrón `*.helpers.ts` en 10 god hooks (150-200L) | ✅ | 12.95.11-15 |
| 6    | Convención `queries/`+`mutations/` documentada selectiva | ✅ | 12.95.16 |
| 7    | `lib/financial/embarqueKpis` → `features/embarques/domain/` | ✅ | 12.95.16 |
| 8    | Reclasificar `PortSelect`, `NavieraSelect`, `ProfitBadge`, `useSidebarAlerts` + eliminar re-export muerto | ✅ | 12.95.17 |
| 10   | Consolidar `src/types/cotizacion*.ts` → `src/types/cotizacion/` con barrel | ✅ | 12.95.18 |
| 9    | Migrar CRM completo (137 archivos) a `src/features/crm/` | ✅ | 12.95.19 |

## Diferidos (opcionales, fuera de plan original)

- **`lib/facturacion/`** y **`lib/operaciones/`** → al feature/servicio dueño. Requieren rediseño de ownership; no son `mv` triviales.
- **`lib/financial/profitUtils.ts`** → `features/profit/` o equivalente cuando se cree esa feature.
- **`lib/domain/{cotizacion,proforma,estadoResultados,proyeccionFacturacion}`** → al feature correspondiente una vez completada la migración folder-style de cada dominio.

## Garantías estructurales activas

- `bun run audit:arch` → 0 oversized, 0 imports directos a Supabase desde hooks/components.
- `src/lib/__tests__/architecture.test.ts` → 7 reglas de jerarquía Pages→Hooks→Services→Lib + features/*/domain + features/*/services.
- ESLint `no-restricted-imports` → red de seguridad en CI.

Próximas iteraciones de arquitectura: abrir un plan nuevo cuando aparezcan hallazgos nuevos en `audit:all`.
