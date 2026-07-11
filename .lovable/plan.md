# Auditoría exhaustiva de íconos — Plan

Analogía: la primera pasada arregló los "letreros duplicados del centro de la ciudad" (sidebar, auditoría, estados). Ahora vamos calle por calle en cada colonia (módulo) para asegurar que ningún cartel esté mal puesto y que la señalética sea coherente en toda la app.

## Alcance

~579 usos de `lucide-react` en producción, agrupados por módulo. Criterios:
1. **Duplicados semánticos** — mismo ícono, conceptos distintos en la misma vista.
2. **Genérico vs específico** — reemplazar `FileText`/`Circle`/`Square`/`Info` por íconos del dominio logístico cuando exista un mejor match.
3. **Consistencia de familia** — el mismo concepto usa el mismo ícono en toda la app (ej. "pagar" siempre `Banknote`, "cliente" siempre `Building2`, "documento fiscal" siempre `Receipt`).

Fuera de alcance: cambios de tamaño, color, `strokeWidth`, o migración masiva al wrapper `<Icon />` (esa migración va aparte).

## Fase 1 — Inventario y catálogo canónico (1 turno)

Spawn de un subagente `capable` con lectura de todo `src/features/**` + `src/components/**` + `src/pages/**`. Produce:

- **Inventario CSV-like**: `archivo:línea | ícono | contexto (label/aria/tooltip cercano) | módulo`.
- **Diccionario canónico propuesto** — un solo ícono por concepto recurrente:

```text
cliente (empresa)      → Building2
proveedor              → Truck
usuario (persona)      → Users / User
factura (fiscal)       → Receipt
proforma / cotización  → FileSpreadsheet / ClipboardList
documento genérico     → FileText
pago (salida)          → Banknote / ArrowRightLeft
cobro (entrada)        → HandCoins
tesorería / banco      → Landmark
embarque marítimo      → Ship
contenedor             → Container
aduana / bodega        → Warehouse
tiempo / demora        → Timer / Clock
flujo operativo        → Workflow
aprobación             → ClipboardCheck
alerta seguridad       → ShieldAlert
archivado / cerrado    → Archive
```

Entregable: `docs/icon-catalog.md` (nuevo) — lo consumimos manualmente y como referencia para futuras PRs.

## Fase 2 — Reporte por módulo (1 turno, mismo subagente)

Para cada módulo, tabla con: `Ícono actual · Contexto · Problema (duplicado/genérico/inconsistente) · Ícono sugerido · Severidad`.

Módulos a cubrir:

```text
embarques         cotizaciones    facturacion     proformas
compras           cartera         tesoreria       comisiones
crm               clientes        directorio      costeo
auditoria         reportes        profit          admin
onboarding        marketing       dashboard       shared/layout
```

Severidad:
- **Alta**: duplicado en misma vista, o rompe familia establecida.
- **Media**: genérico donde hay específico obvio.
- **Baja**: sugerencia estilística.

## Fase 3 — Aplicación en lotes (3 turnos)

Un lote por severidad, con commit + bump + CHANGELOG separado:

1. **Lote A — Severidad Alta** (bump `13.262.0`): fix duplicados y rupturas de familia.
2. **Lote B — Severidad Media** (bump `13.263.0`): genérico→específico.
3. **Lote C — Severidad Baja** (bump `13.264.0`, opcional): pulido final.

Cada lote pasa por: `bun run tsgo --noEmit` + `bun run test:fast` + baseline arquitectural (Power of 10).

## Fase 4 — Guardrail (mismo turno que Lote A)

Nuevo test arquitectural `src/__tests__/architecture/icon-canonical.test.ts` que verifique el diccionario canónico contra grep del código:
- `Receipt` sólo en contextos fiscales (facturas, CFDI).
- `Building2` sólo para clientes/empresas.
- `PiggyBank` no aparece en contextos de cobranza.

Esto previene regresiones futuras sin bloquear casos legítimos (allowlist explícita por archivo).

## Verificación final

- `bun run tsgo --noEmit` verde.
- `bun run test:fast` 4538+ tests verdes.
- Screenshot Playwright de sidebar completo, módulo Compras, Auditoría y Embarques para confirmar visual.
- Actualizar `mem://style/ui-visual-standards` con el diccionario canónico para que futuras sesiones lo respeten.

## Detalles técnicos

- **Tamaño estimado**: ~30-60 archivos tocados en total (mayoría cambios de 1 línea: `import { X } from "lucide-react"` + JSX).
- **Riesgo**: bajo. Todos los íconos existen en `lucide-react@1.24.0`. No hay cambios de comportamiento, sólo visual.
- **Rollback**: cada lote es un commit independiente, revertible aislado.
- **No tocar**: `remotion/` (video demo), `docs/`, tests que hardcodean iconos (revisar caso por caso).

## Preguntas abiertas (decidibles después de Fase 1)

- ¿Queremos unificar íconos del dashboard ejecutivo (`Profit`) con los de reportes operativos, o mantenerlos distintos como señal visual de "vista ejecutiva vs operativa"?
- ¿Aplicamos el diccionario canónico al portal de cliente (`/portal/*`) o lo tratamos como sistema visualmente separado?
