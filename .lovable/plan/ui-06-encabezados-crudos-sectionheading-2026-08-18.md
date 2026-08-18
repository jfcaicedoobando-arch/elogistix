# UI-06 · Encabezados crudos → `SectionHeading`

## Objetivo
Un solo rol tipográfico para "título de sección" en toda la app. Hoy ~117 archivos escriben las clases a mano (`text-sm/base/lg font-semibold`), así que el mismo tipo de título se ve distinto entre módulos. Migramos al componente `SectionHeading` que ya existe y cerramos la puerta con un guardrail automático.

## Alcance
Se migran títulos de sección dentro del ERP (áreas privadas):

| Área | Archivos aprox. |
| --- | --- |
| cxp | 13 |
| cotizacion | 9 |
| components/shared + components/ui + layout | 19 |
| embarques | 7 |
| tesoreria | 6 |
| facturacion | 6 |
| portal / portal-agente | 7 |
| proveedor, crm, dashboard, reportes, bandejas, auditoría, costeo, operaciones, anticipos, proformas, presupuesto, admin | resto |

Quedan **fuera**:
- `features/marketing` (17 archivos): la landing pública tiene su propia escala tipográfica editorial; forzar `SectionHeading` ahí la afearía.
- Textos que solo *parecen* título: totales, valores de KPI, nombres en filas de tabla, botones. Se revisan uno por uno; si no es un encabezado de bloque, se deja igual.

## Cómo se hace
Reemplazo mecánico, sin tocar lógica de negocio:

```text
antes:  <h3 className="text-base font-semibold">Conceptos de venta</h3>
después: <SectionHeading as="h3">Conceptos de venta</SectionHeading>
```

- `text-base/text-lg font-semibold` → `variant="section"` (default).
- `text-sm font-semibold` en subtítulos densos → `variant="subsection"`.
- `text-xs font-semibold uppercase` (etiquetas de agrupación) → `variant="overline"`.
- Contadores tipo `Título (3)` → prop `count`; icono a la izquierda → prop `icon`; botón a la derecha → prop `actions`; texto de apoyo debajo → prop `description`.
- Nivel semántico: `as="h2"` cuando la página ya tiene su `h1` (`PageHeader`/`DetailHeader`), `as="h3"` si vive dentro de otra sección. Esto mejora accesibilidad y SEO en el portal.

Se trabaja por olas para revisar en bloques manejables:
1. cxp + cotizacion (los dos módulos más grandes).
2. tesoreria + facturacion + bandejas + anticipos.
3. embarques + proveedor + crm + dashboard + reportes + auditoría + costeo + operaciones + proformas + presupuesto + admin.
4. `components/shared`, `components/ui`, `components/layout`, portal y portal-agente.
5. Guardrail + limpieza.

## Detalles técnicos
- Nuevo test de arquitectura `src/__tests__/architecture/section-heading-canonical.test.ts`, calcado de `no-label-text-xs.test.ts`: detecta `<h2>/<h3>/<h4>` con `font-semibold` en `className` bajo `src/`, con lista de deuda congelada que solo puede decrecer y excepciones declaradas (`features/marketing`). Incluye la prueba de "no hay entradas obsoletas" para que la deuda no se quede vieja.
- Si algún archivo excede 200 líneas al migrar, se extrae subcomponente (Power of 10).
- Ningún componente nuevo salvo los extraídos por límite de líneas; `SectionHeading` no cambia su API.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION` (minor por ola, p. ej. 13.661.0 → 13.665.0).

## Verificación
- `bunx vitest run src/__tests__/architecture src/lib/__tests__/architecture.test.ts` en verde.
- Lint y tipos en verde.
- Revisión visual con Playwright de una pantalla representativa por ola (bandeja CxP, wizard de cotización, Tesorería, detalle de embarque, portal) comparando antes/después.
