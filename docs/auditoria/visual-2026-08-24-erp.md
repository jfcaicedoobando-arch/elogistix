# Auditoría visual UI/UX — ERP autenticado — 2026-08-24 (v13.734.0)

Alcance: **sólo look & feel**. Sesión inyectada (`hector@lopezbenavides.com`, Administrador).
Método: capturas Playwright de 18 rutas del ERP en **1440 px** y **375 px**
(`/inicio`, `/embarques`, `/operaciones`, `/cotizaciones`, `/proformas`, `/facturacion`,
`/compras` + 3 bandejas, `/compras/proveedores`, `/cobranza`, `/cobranza/aging`,
`/tesoreria`, `/crm/oportunidades`, `/crm/leads`, `/reportes`, `/configuracion`, `/clientes`)
+ modal `Nuevo cliente` y estado de foco por teclado.

Resultado global: **0 overflow horizontal de documento** en ambos anchos, **0 hex arbitrarios**,
modales ya homologados con `FormDialogShell`. Los problemas son de **truncamiento de datos y
contención horizontal**, no de estructura.

Evidencia: `/tmp/browser/audit_erp/screenshots/` (`d_*` = 1440, `m_*` = 375, `x_*` = interacción).

---

## 1 · Bugs visuales críticos / mayores

| # | Ubicación | Sev | Cat | Issue | Esperado |
|---|---|---|---|---|---|
| E-1 | `/tesoreria` — tarjetas KPI (1440 **y** 375) | **Critical** | Bug | Los importes se cortan con elipsis: “MXN 943,405.…”, “MXN 6,930,90…”, “MXN 5,402,84…”, “MXN 1,528,05…”. En un ERP financiero un saldo truncado es inutilizable y no hay tooltip con el valor completo. | Notación compacta (`MXN 943.4K`) con el valor exacto en `Hint`/tooltip, o tarjeta que crezca; nunca elipsis sobre dinero. |
| E-2 | `/inicio` (375) — tarjeta “Arribos este mes” | Major | Layout | El tile “Ya llegaron / 27” queda **cortado por el borde derecho** de la tarjeta (grid de 2 columnas sin `min-w-0` en móvil). | Apilar en 1 columna <640 px. |
| E-3 | `/tesoreria` “Flujo esperado 30 días por moneda”, `/embarques` (col. ESTADO), `/crm/oportunidades` (col. “Ganada”) | Major | Layout | Contenido **cortado a ras del contenedor** sin indicio de scroll: la última columna de la tabla y la última columna del Kanban aparecen partidas a la mitad. | Contenedor con scroll horizontal visible + máscara/degradado o sombra de borde que indique “hay más”. |
| E-4 | `/tesoreria` (375) — gráfica “Flujo de caja proyectado” | Major | Bug | Eje X y leyenda cortados (“Saldo” partido); la gráfica desborda su tarjeta en móvil. | Gráfica responsiva con contenedor scrollable o menos buckets en móvil. |
| E-5 | `/crm/*` (375) — barra de sub-tabs | Major | Layout | Los tabs (“Mi día / Resumen / Leads / …”) se cortan: “Leads” queda partido y no hay scroll horizontal ni menú; el botón “Nuevo” se le encima visualmente. | Tab bar con scroll horizontal (`overflow-x-auto` + snap) o `Select` de sección en móvil. |
| E-6 | `/crm/oportunidades` (375) — columnas Kanban vacías | Minor | Layout | La columna “Prospección” sin tarjetas ocupa ~900 px de alto con el estado vacío centrado a media pantalla. | Alto mínimo acotado (`min-h-40`) para columnas vacías. |
| E-7 | `/embarques` (375) — cabecera | Minor | Layout | Las acciones colapsan a un botón “…” alineado a la derecha con una banda vacía debajo del subtítulo (≈40 px de aire muerto). | `PageHeader` móvil sin la fila vacía; acciones en la misma línea del título. |

## 2 · Inconsistencia de componentes

| # | Ubicación | Sev | Cat | Issue | Esperado |
|---|---|---|---|---|---|
| E-8 | `/configuracion` (tabs con icono, fondo pill) vs `/crm/*` (tabs con icono arriba, subrayado) vs `/crm` Kanban/Tabla (pill pequeño) | Major | Consistency | **Tres patrones de tabs** distintos en la misma app. | Un solo componente `Tabs` con dos variantes documentadas (sección vs. vista). |
| E-9 | `/configuracion` “Guardar Cambios” y modal `Nuevo cliente` “Siguiente” | Minor | Component | Botón deshabilitado en **gris sólido** (parece habilitado/secundario) mientras otros deshabilitados usan opacidad. | Un solo criterio: `disabled:opacity-50` con el color de la variante. |
| E-10 | Tarjetas KPI: `/tesoreria` (icono en tile + label arriba) vs `/cobranza/aging` (label chico + monto, sin icono) vs `/inicio` (stepper) | Minor | Consistency | Tres anatomías de “tarjeta de métrica”. | Un `StatCard` compartido con slots opcionales (icono, delta, subtítulo). |
| E-11 | Estados vacíos: Kanban CRM (icono maletín + “Sin oportunidades”) vs tablas (`EmptyStateInline` con CTA) | Minor | Consistency | El vacío del Kanban no ofrece CTA ni comparte tono. | Usar `EmptyStateInline` también en columnas Kanban. |

## 3 · Estados faltantes / interacción

| # | Ubicación | Sev | Cat | Issue | Esperado |
|---|---|---|---|---|---|
| E-12 | `/embarques` (1440 y 375) | Major | Interaction | Con el conteo ya en “0 embarques”, el cuerpo de la tabla se queda con **5 filas skeleton indefinidamente** (nunca cae al estado vacío). Es un desajuste entre `isLoading` y `count`. | Al terminar la carga mostrar `EmptyStateInline`; nunca skeleton persistente. |
| E-13 | `/embarques` (375) | Minor | Interaction | La paginación móvil muestra “Página 1 de 1” sin el “· 0 de 0” que sí aparece en desktop. | Misma información en ambos anchos. |
| E-14 | Textos truncados en tablas (`Top 5 deudores`, cards de Kanban, breadcrumb móvil “I… > C… > Oportu…”) | Minor | Bug | Elipsis **sin tooltip**: no hay forma de leer el nombre completo. | `Hint` con el texto completo en toda celda truncada. |

## 4 · Accesibilidad visual

| # | Ubicación | Sev | Cat | Issue | Esperado |
|---|---|---|---|---|---|
| E-15 | `/inicio` (375) — stepper de estados | Major | A11y | Etiquetas recortadas a “Confirm…”, “En Trán…”, “En Adu…”: la etiqueta pierde significado y no hay texto accesible alterno. | Nombre completo en 2 líneas o `aria-label` + `Hint` con el estado completo. |
| E-16 | Chip “TC DOF 16.9018 · 21/8/2026” en `/tesoreria` | Minor | A11y | Azul claro sobre fondo claro, `text-label` muy tenue: contraste por debajo de AA. | Token `text-primary` sobre `bg-primary/10` verificado a 4.5:1. |
| E-17 | Foco por teclado | Minor | A11y | Tras 4 `Tab` en `/cotizaciones` no se observa anillo de foco visible en los primeros controles de la cabecera. | `focus-visible:ring-2 ring-ring ring-offset-2` en todos los interactivos. |

---

## Notas fuera de alcance (no son look & feel)
- `pageerror` recurrente **“Incorrect locale information provided”** en todas las rutas y
  respuestas **403** en dos peticiones de `/embarques`/`/inicio`; el formateo `es-MX` funciona
  al probarlo aislado, así que apunta a datos/permisos, no a estilos. Se reporta sólo como pista.

## Pendiente
Detalle de embarque (tabs), wizard de embarque paso a paso, dark mode y drawers de
conciliación: requieren recorridos con datos, no capturas estáticas.
