# Estado: auditoría de íconos completada

Sí. Se cerró el inventario exhaustivo en 3 fases y ~52 cambios aplicados. No hay pendientes.

## Cobertura por fase

**Fase 1 (v13.261.0)** — 15 cambios en navegación y configuración
- `sidebarItems.ts`, `auditoriaConfig.ts`, `estadoConfig.ts`

**Fase 2 (v13.262.0 – 13.264.0)** — ~30 cambios en entidades de negocio
- Cotización → `ClipboardList` (GlobalSearch, CRM, Portal)
- Proforma → `FileSpreadsheet` (listados, dialogs, steppers)
- Factura/CFDI → `Receipt` (finanzas, portal, configuración)
- Embarque → `Ship` (bandejas, wizard, tarjetas)
- Cliente → `Building2` (listado principal)
- Pago/egreso → `Banknote` (CxP, compras, comisiones)
- Cobranza → `HandCoins` (acción registrar pago)
- Proveedor → `Truck` (dialogs CFDI)
- Contacto individual → `User` (dialogs)

**Fase 3 (v13.265.0, cierre)** — 2 hallazgos finales
- `InfoFacturaSection` XML → `FileCode2`
- `ComprasNotasCredito` KPI MXN → `Banknote`

## Verificación final del subagente fase 3

Revisó los ~325 archivos con imports de `lucide-react` no cubiertos previamente. Módulos confirmados limpios:

- `components/layout/**`, `components/shared/**`, `components/ui/**`
- `features/admin/**`, `features/auth/**`, `features/crm/**`
- `features/costeo/**`, `features/dashboard*/**`, `features/marketing/**`
- `features/operaciones/**`, `features/proveedor/**`, `features/reportes/**`
- `features/tesoreria/**`, `features/legal/**`, `features/onboarding/**`
- `features/presupuesto/**`, `features/profit/**`, `features/catalogos/**`
- `lib/ui/**`

## Diccionario canónico vigente

| Dominio | Ícono |
|---|---|
| Embarque | `Ship` |
| Bulto/mercancía | `Package` |
| Cotización | `ClipboardList` |
| Proforma | `FileSpreadsheet` |
| Factura/CFDI | `Receipt` |
| XML técnico | `FileCode2` |
| Cliente/empresa | `Building2` |
| Persona / Colectivo | `User` / `Users` |
| Proveedor/transportista | `Truck` |
| Pago/egreso | `Banknote` |
| Cartera por cobrar | `Wallet` |
| Cobranza (registrar pago) | `HandCoins` |
| USD/moneda extranjera | `Coins` |
| Auditoría/checklist | `ClipboardCheck` |
| Comparativos | `GitCompare` |
| Tiempo/plazo | `Timer` |
| Recurrente | `RefreshCw` |
| Archivar | `Archive` |
| OK/aprobado | `CheckCircle2` |
| Seguridad | `ShieldCheck` |

## Recomendación

No hay siguiente fase. Para mantener la consistencia a futuro, el próximo paso opcional sería agregar una regla ESLint que restrinja íconos ambiguos (`DollarSign`, `Wallet` fuera de cartera, `Package` fuera de bultos) — lo dejamos como propuesta separada si te interesa.

## Detalles técnicos

- Tests: 4538/4538 pasando tras cada fase.
- Versión actual: `13.265.0`.
- No quedan archivos con imports de `lucide-react` sin revisar.
