# Auditoría visual — Módulo de Compras (1366×768)

Recorrí las 11 vistas del módulo (`Facturas`, `Por capturar`, `Por aprobar`, `Por pagar`, `Pagos`, `Notas de crédito`, `Aging`, `Reportes`, `Proveedores`, `Conciliación`, `Dashboard`) y crucé lo observado con la fuente de verdad de estilos: `src/lib/ui/estadoConfig.ts` + `src/lib/status/statusExtras.ts`.

## Diagnóstico (por qué se ve inconsistente)

**1. Semántica de color colapsada — mismo tono para conceptos distintos.**
Hoy en Compras conviven, todos con `warning` (amarillo):
`Vigente por vencer` · `Por aprobar` · `Parcialmente pagada` · `Pendiente` · `Devengada` · `En cancelación`.
Y todos con `success` (verde):
`Pagada` (en algunos lados) · `Aprobada` · `Vigente` · `Validado` · `Recibido` · `Completo`.
Un usuario que ve la fila "verde SAT ✓ + verde Vigente + verde Pagada" no puede leer qué está pasando.

**2. Chips secundarios compiten con el estado primario.**
`EstadoFacturaCxPCell` mezcla en la misma celda un badge grande (`Vigente/Vencida/…`) con hasta 5 mini-chips (`Parcial · +N d · NC · SAT ✓ · Prog. DD/MM`) sobre fondos `bg-info/10`, `bg-warning/10`, `bg-success/10`. Todos pintan y todos gritan.

**3. KPI cards del módulo usan variantes destructive/warning sin criterio único.**
En `/compras/facturas` "Vencido" es rojo, "Por vencer" es amarillo, pero en `/compras/por-aprobar` la card "Rechazadas" también es roja y "Aprobadas" verde, y en `/compras/conciliacion` "Sin facturar" es rojo suave y "Conciliadas" verde. Cada página escoge su propia paleta.

**4. Sub-encabezados y anchos inconsistentes.**
- Facturas: título + subtítulo pequeño.
- Por aprobar / Reportes: título con `<Icon>` + subtítulo.
- Proveedores: título + subtítulo largo.
- Conciliación: título muy grande sin icono.
Las cards de KPI a veces son 3, a veces 5, a veces 4, con paddings distintos (`p-4`, `p-3`, `gap-3`, `gap-4`).

## Qué voy a construir

### A. Refactor de la paleta semántica de Compras (una sola pasada, sin tocar otros módulos)

Reasigno cada estado a un **rol semántico** (no a un color arbitrario) y lo escribo en `statusExtras.ts` + `estadoConfig.ts`. Los 4 roles:

| Rol             | Uso                              | Token             | Ejemplos                       |
|-----------------|----------------------------------|-------------------|--------------------------------|
| Neutral         | Sin acción, terminal frío        | `muted`           | Borrador, Pagada, Cancelada, Cerrado |
| Info (azul)     | En curso, requiere seguimiento   | `info`            | Vigente, Emitida, En proceso, Parcial |
| Atención (ámbar)| Requiere acción del usuario      | `warning`         | Por aprobar, Por vencer, Pendiente |
| Alerta (rojo)   | Bloqueante / SLA roto            | `destructive`     | Vencida, Rechazada, Sustituida |
| Éxito (verde)   | Cerrado bien — solo terminal ✅  | `success`         | Aprobada, Validado, Completo   |

Cambios concretos:
- `Vigente` deja de ser verde → **azul info** (aún tiene saldo, no es "listo").
- `Pagada` unifica a **neutral** en todos los dominios (hoy alterna success/muted).
- `Parcial`, `Por aprobar`, `Por vencer` = amarillo consistente.
- `Aprobada` = único verde en el flujo de aprobación.

### B. Consolidar el chip secundario de `EstadoFacturaCxPCell`

- Todos los chips pasan a **una sola convención neutra** (`bg-muted text-muted-foreground border-transparent`) con un punto de color 6×6 px que indica severidad (info/warning/destructive). Así el badge primario manda y los chips acompañan.
- Reduzco de 5 a 3 chips visibles + `+N` colapsando el resto en tooltip.

### C. Componente `PageHeader` compartido para Compras

- `src/features/cxp/components/shared/ComprasPageHeader.tsx` con firma `{icon, title, subtitle, actions}` y espaciado `pb-4 border-b border-border/60`.
- Aplico en las 11 páginas.

### D. KpiRow homogéneo para Compras

- `src/features/cxp/components/shared/ComprasKpiRow.tsx` que envuelve `KpiCard` con:
  - Grid fijo `grid-cols-2 xl:grid-cols-5 gap-3`
  - Variantes limitadas a `default | info | warning | destructive` (nada de verdes en cards no-terminales).
  - `tabular-nums` en el value.
- Migración: `CxpKpiCards`, `Por-aprobar`, `Por-pagar`, `Pagos`, `Conciliación`, `Aging`.

### E. Densidad y tipografía

- Titulares uniformes: `text-2xl font-semibold` con icono `h-6 w-6 text-primary`.
- Subtítulos: `text-sm text-muted-foreground`.
- Tablas: cabeceras a `text-xs uppercase tracking-wide text-muted-foreground` (ya existe pero se aplica solo en algunas).

## Fuera de alcance

- No toco lógica de negocio (RPCs, cálculo de saldo, permisos).
- No cambio los colores de módulos fuera de `/compras/*` (Ventas, Embarques, CRM mantienen su paleta).
- No refactorizo `StatusBadge` — el registry sigue siendo la fuente de verdad, solo cambio los valores.

## Verificación

1. `bunx vitest run src/lib/__tests__` — cubre los tests de mapeo de estados.
2. `bun run lint -- --max-warnings 0`.
3. Playwright: recapturo las 11 pantallas y las comparo lado a lado con el estado actual.
4. Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

## Detalles técnicos

**Archivos a editar (12)**
- `src/lib/ui/estadoConfig.ts` — reasignación de tokens para dominio factura/factura_cxp.
- `src/lib/status/statusExtras.ts` — mismos ajustes en los extras.
- `src/features/cxp/components/EstadoFacturaCxPCell.tsx` — chips neutros con dot de color.
- `src/features/cxp/components/CxpKpiCards.tsx` — variantes vía `ComprasKpiRow`.
- `src/features/cxp/components/shared/ComprasPageHeader.tsx` (nuevo).
- `src/features/cxp/components/shared/ComprasKpiRow.tsx` (nuevo).
- Páginas `src/pages/compras/*.tsx` (7 archivos) — adoptan `ComprasPageHeader` + `ComprasKpiRow`.
- `CHANGELOG.md` + `APP_VERSION` en `src/lib/version.ts`.

**Impacto colateral controlado**
Cambiar `Vigente` a azul y `Pagada` a neutral se propaga a los mismos badges donde aparezcan fuera de Compras (ej. detalle de factura del cliente). Es coherente con la nueva regla "verde = terminal exitoso" y ya lo validé al leer el registry. Si prefieres aislarlo solo a Compras, lo hago con overrides por dominio en `statusRegistry.ts` en vez de tocar `EXTRA_STATUS_BADGES`.
