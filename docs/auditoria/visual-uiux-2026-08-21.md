# Auditoría visual UI/UX — 2026-08-21

**Alcance:** sólo apariencia, consistencia visual e interacción. No se revisó lógica de negocio.
**Método:** recorrido automatizado con Playwright (usuario interno real) sobre 14 rutas core, en
dos viewports (1440×900 escritorio, 768×1024 tableta), más inspección de estilos computados
(color, contraste, tipografía, tamaños táctiles, jerarquía de encabezados) y revisión del código
de los componentes implicados.

**Evidencia:** `docs/auditoria/visual-uiux-2026-08-21/` (28 capturas de ruta + 2 capturas de detalle).
**Este turno no incluye cambios de código.** Al final va el plan de remediación propuesto.

---

## Resumen ejecutivo

| Severidad | Hallazgos |
|---|---|
| Crítico (texto invisible / ruta rota) | 2 |
| Alto (contraste AA, accesibilidad) | 3 |
| Medio (consistencia tipográfica, jerarquía, componentes base) | 5 |
| Bajo (pulido, iconografía, scroll) | 4 |

El hallazgo **V-01 es la raíz de una familia de bugs visuales**: `cn()` usa `tailwind-merge` sin
extender el tema, por lo que las utilidades tipográficas propias del proyecto (`text-body`,
`text-body-sm`, `text-label`, `text-display`) se interpretan como *color de texto* y **borran
silenciosamente el color de la variante** del componente. Es la causa del texto invisible en CxP.

---

## Crítico

### V-01 · Texto invisible en el filtro "Origen" de CxP (contraste 1.24:1)

- **Dónde:** `/compras/facturas` → barra de filtros, chip activo `Todos` / `Nacional` / `Extranjero`.
  `src/features/cxp/components/CxpFiltros.tsx:105-112`.
- **Evidencia:** `detalle-cxp-chip-todos.png`. Estilo computado: `color: rgb(20,29,46)` sobre
  `background: rgb(27,46,75)` → **1.24:1** (AA exige 4.5:1). El texto es prácticamente ilegible.
- **Causa raíz:** el botón se renderiza con `variant="default"` (`bg-primary text-primary-foreground`)
  y `className="… text-body-sm"`. `cn()` (`src/lib/utils/cn.ts:1-6`) llama a `twMerge` sin
  configuración; `tailwind-merge` no conoce `text-body-sm` como tamaño de fuente y la clasifica
  como color, así que **elimina `text-primary-foreground`**. El resultado hereda `--foreground`
  (casi negro) sobre fondo primario. Se verificó en el DOM: la lista final de clases del botón ya
  no contiene `text-primary-foreground`.
- **Impacto ampliado:** hay ~19 combinaciones equivalentes en el repo (Badge/Button con variante de
  color + utilidad `text-body*` en `className`), p. ej.
  `src/features/embarques/components/secciones/BloqueVinculacion.tsx:63,129` (`variant="success"`),
  `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx:162` y
  `GrupoConceptosContenedor.tsx:69` (`variant="warning"`),
  `src/features/embarques/components/proforma/PasoConfirmacionProforma.tsx:48`.
  Todas pierden su color de texto en silencio.
- **Fix propuesto:** configurar `extendTailwindMerge` en `cn.ts` declarando
  `classGroups: { 'font-size': [{ text: ['display','heading','body','body-sm','body-lg','label'] }] }`.
  Un solo cambio corrige toda la familia, y añadir un test que valide que
  `cn("text-primary-foreground","text-body-sm")` conserva ambas clases evita la regresión.

### V-02 · Ruta `/crm/pipeline` devuelve "Página no encontrada"

- **Dónde:** navegación CRM. En `src/routes/crmRoutes.tsx` existen `index` (Resumen ejecutivo),
  `leads`, `oportunidades` y `analitica`; **no existe `pipeline`**.
- **Evidencia:** `12-crm-pipeline-desktop.png` / `-tablet.png` (pantalla 404).
  El Kanban real vive en `/crm/oportunidades` (`13-crm-oportunidades-*.png`, H1 "Oportunidades").
- **Impacto:** cualquier enlace, marcador o documentación que apunte a `/crm/pipeline` cae en 404.
- **Fix propuesto:** redirección `pipeline → oportunidades` (patrón ya usado en
  `src/routes/RedirectPreserveSearch.tsx`) y revisión de los enlaces que la mencionan.

---

## Alto

### V-03 · Badges de estado por debajo de AA

Contrastes medidos sobre los badges de estado en listados:

| Badge | Ratio | AA (4.5:1) |
|---|---|---|
| Rechazada | 3.78:1 | falla |
| EIR | 2.79:1 | falla |
| Arribo | 2.42:1 | falla |
| Entradas | 2.59:1 | falla |

Los tonos de estado usan fondos claros con texto de intensidad media. **Fix:** subir el escalón de
texto de los tonos semánticos (`--success-foreground`, `--warning-foreground`, `--info-foreground`)
en `src/index.css` y validarlos una sola vez desde `StatusBadge`, que ya centraliza los tonos.

### V-04 · Botones de ícono sin nombre accesible (48 casos en tableta)

En 768px el sidebar se colapsa a íconos y las tablas muestran acciones sólo con ícono. Se
detectaron **48 controles sin `aria-label` ni texto visible**, concentrados en el sidebar colapsado
y en las columnas de acciones. Un lector de pantalla los anuncia como "botón".
**Fix:** `aria-label` en los disparadores de ícono (y `Hint` para el tooltip visual, que ya es el
patrón del proyecto).

### V-05 · Áreas táctiles menores a 36px en tablas

Los botones de acción de fila miden menos de 36×36 px; en tableta (uso con dedo) quedan por debajo
del mínimo cómodo. **Fix:** `min-h-9 min-w-9` en los `size="icon"` dentro de `DataTable`.

---

## Medio

### V-06 · Densidad tipográfica inconsistente entre módulos

Tamaño de fuente de celdas (`tbody td`) medido:

| Ruta | `td` | `th` |
|---|---|---|
| `/inicio` | **13px** | 14px |
| `/cotizaciones` | 14px | 14px |
| `/embarques` | 14px | 14px |

En `/inicio` conviven 578 nodos a 13px contra 158 a 14px: los widgets del dashboard usan
`text-body-sm` donde el resto de la app usa `text-body`. Se percibe como "otra app".
**Fix:** fijar `text-body` como base de celda y reservar `text-body-sm` para el modo compacto de
`DataTable`.

### V-07 · Saltos de jerarquía de encabezados (H1 → H3)

En `/inicio`, `/compras` y `/tesoreria` se salta de `h1` a `h3` sin `h2` intermedio. Afecta el
esquema de navegación por encabezados. **Fix:** usar `SectionHeading` con el nivel correcto
(ya soporta el nivel semántico) en lugar de elegir tamaño visual.

### V-08 · Tablas crudas fuera de `DataTable`

Tres archivos de features siguen con `<table>` a mano, así que no heredan zebra, alto de fila, hover
ni los estados `DataTableBodyEmpty` / `DataTableBodySkeleton`:
`src/features/presupuesto/components/TabVsReal.tsx`, `src/features/presupuesto/components/TabCaptura.tsx`
y `src/features/profit/components/EstadoResultadosTable.tsx`.
**Fix:** migrar a `DataTable` o, si el layout tipo estado de resultados lo justifica, darles su propio
skeleton y estado vacío explícitos.

### V-09 · Páginas de detalle sin `PageHeader`

~19 páginas de negocio de nivel superior no usan `PageHeader`/`SectionHeading`, por lo que su título,
altura de encabezado y acciones no coinciden con el resto: `ClienteDetalle`, `EmbarqueDetalle`,
`EditarEmbarque`, `NuevoEmbarque`, `CotizacionDetalle`, `CotizacionInformativaDetalle`,
`EditarCotizacion`, `NuevaCotizacion`, `FacturaDetalle`, `FacturaProveedorDetalle`, `ProformaDetalle`,
`ProveedorDetalle`, `LeadDetalle`, `OportunidadDetalle`, `EstadoCuentaInterno`, `TesoreriaFlujo`.
Las públicas (login, 404, legal, marketing, onboarding) quedan fuera del hallazgo: no llevan header de
página por diseño. El portal usa `PortalPageShell` como patrón paralelo — decidir si se homologa.

### V-10 · Diálogo de formulario sin `FormDialogShell`

`src/features/marketing/components/DemoAccessDialog.tsx` es el único modal con formulario que no usa
`FormDialogShell`, así que su padding, secciones y footer no coinciden con los otros 96 modales.


---

## Bajo

### V-11 · Dobles barras de desplazamiento
`/inicio` tiene 4 contenedores con scroll propio anidados dentro del scroll de página; en tableta
aparecen dos barras simultáneas. **Fix:** dejar un único contenedor con scroll por vista.

### V-12 · Tamaños de ícono mezclados
El estándar es 16×16 (`[&_svg]:size-4` en `Button`), pero en tablas principales hay íconos de
14×14 y 12×12 sueltos. **Fix:** normalizar a `size-4` / `size-3.5` documentados.

### V-13 · `h-screen` en lugar de `h-dvh`
`src/features/marketing/routes/HomeRoute.tsx:20` y `:38` son los únicos usos de `h-screen` literal
(el resto de la app usa `min-h-screen`); en móvil deja un recorte por la barra del navegador.

### V-14 · Estilo inline estático
`src/features/marketing/components/sections/LandingHero.tsx:15-22` fija `backgroundImage` /
`backgroundSize` por `style={{}}` sin ningún valor dinámico; debe ser una clase. El resto de los
`style={{}}` del repo son dinámicos (virtualización, barras de progreso, gráficas) y son correctos.

---

## Lo que sí está bien (no tocar)

- **Colores:** el barrido de utilidades literales (`text-white`, `bg-[#…]`, `emerald-*`, `amber-*`,
  `slate-N`) devuelve **0 ocurrencias en `src/features/`**; la única está en `components/ui/alert-dialog.tsx`
  (componente base shadcn). Los tokens semánticos están bien aplicados.
- **Tamaños de texto arbitrarios:** 0 ocurrencias de `text-[Npx]` fuera de `src/pdf/`.
- **Anchos de modal:** 0 `DialogContent` con `max-w-*` literal; todos usan `dialogTokens`.
- **Foco de teclado:** anillo visible y consistente (`outline: 2px solid` + ring `rgb(36,99,235)`).
  Evidencia: `detalle-foco-teclado-cotizaciones.png`.
- **Hover de filas:** `hover:bg-primary/5` con `transition-colors 150ms` y zebra `even:bg-muted/45`,
  homogéneo en tablas migradas a `DataTable`.
- **Sin overflow horizontal:** las 14 rutas miden 0 px de desbordamiento en `main` y en el documento,
  en ambos viewports.
- **Tipografía:** "Inter" es la única familia en uso; no hay fuentes intrusas.


---

## Plan de remediación propuesto (por impacto/esfuerzo)

1. **V-01** — configurar `extendTailwindMerge` en `cn.ts` + test de regresión. Corrige el texto
   invisible de CxP y ~19 badges/botones más de un tirón. *(esfuerzo bajo, impacto crítico)*
2. **V-02** — redirección `/crm/pipeline` → `/crm/oportunidades`. *(muy bajo)*
3. **V-03** — subir el contraste de los tonos de estado en `index.css` vía `StatusBadge`. *(bajo)*
4. **V-04 + V-05** — `aria-label` y `min-h-9 min-w-9` en acciones de ícono. *(medio)*
5. **V-06 + V-07** — homologar densidad de `/inicio` y niveles de encabezado. *(medio)*
6. **V-08 + V-09 + V-10** — migrar las 3 tablas crudas, poner `PageHeader` en las páginas de detalle y
   `FormDialogShell` en `DemoAccessDialog`. *(alto)*
7. **V-11 a V-14** — pulido final (scroll, íconos, `h-dvh`, estilo inline del landing). *(bajo)*

