# Guía del Sistema de Diseño — Libre Carga

Fuente única de verdad para construir pantallas nuevas sin romper la coherencia
visual del ERP. Si algo no está aquí, **no se inventa**: se agrega a esta guía y
al token correspondiente.

Referencias de archivo:

| Tema | Archivo |
| --- | --- |
| Colores, radios, sombras (variables CSS) | `src/index.css` |
| Escala tipográfica, colores Tailwind, breakpoints | `tailwind.config.ts` |
| Controles de formulario (alto, borde, foco) | `src/components/ui/field.tokens.ts` |
| Densidad y hover de tablas | `src/components/shared/dataTable/tableTokens.ts` |
| Tamaños de modal / sheets | `src/components/shared/utils/dialogTokens.ts` |
| Colores para gráficas (recharts) | `src/lib/chartTokens.ts` |
| Colores de PDF | `src/pdf/theme/tokens.ts` |

---

## 1. Reglas no negociables

1. **Nunca** hardcodear color: prohibido `text-white`, `bg-black`, `bg-[#1B2B4B]`,
   `hsl(...)` inline. Siempre tokens semánticos (`bg-primary`, `text-muted-foreground`).
2. **Nunca** `style={{ ... }}` estático — usar clases Tailwind (ver
   `docs/adr` y la regla de ESLint correspondiente).
3. Los valores de spacing/tamaño salen de la escala de Tailwind
   (`p-4`, `gap-3`), no de literales arbitrarios (`p-[13px]`).
4. Tablas: siempre `<DataTable />` o `<DetailTable />`; prohibido importar
   `@/components/ui/table` fuera de la allowlist de `eslint.config.js`.
5. Modales tipo formulario: siempre `FormDialogShell` + `FormDialogSection`
   (+ `FormDialogStepper` si es wizard).
6. Todo esto está protegido por pruebas de arquitectura en
   `src/__tests__/architecture/` (`no-raw-color-values`, `no-legacy-color-literals`,
   `no-raw-table`, `table-patterns`, `tables-no-inline-links`, …). Si el CI falla
   ahí, la solución es usar el token, **no** relajar la prueba.

---

## 2. Color

Definidos como HSL en `src/index.css` (bloques `:root` y `.dark`) y expuestos
como colores Tailwind en `tailwind.config.ts`.

### Base semántica

| Token | Uso | Claro |
| --- | --- | --- |
| `background` / `foreground` | Lienzo de la app y texto principal | `210 30% 99%` / `220 40% 12%` |
| `primary` | Marca, botón principal, totales | `216 47% 20%` |
| `accent` | Acción secundaria destacada, enlaces | `221 83% 53%` |
| `muted` / `muted-foreground` | Fondos suaves, texto de apoyo | `210 33% 95%` / `215 18% 42%` |
| `card`, `popover`, `border`, `input`, `ring` | Superficies y bordes | — |
| `destructive` | Errores, eliminación | `0 84% 60%` |
| `success` / `warning` / `info` | Estados de resultado | `142 71% 45%` / `38 92% 50%` / `221 83% 53%` |
| `selection` | Fila resaltada (buscador global, command palette) | — |

### Escalas de dominio

- `kpi-*` (`info`, `success`, `accent`, `warning`, `secondary`, `danger`, cada una
  con variante `soft`) → tarjetas de KPI del dashboard.
- `state-*` (`llegada`, `en-proceso`, `cerrado`, `arribo`, `aduana`, `eir`,
  `operacion`) → estados operativos de embarques.
- `mode-*` (`aereo`, `multimodal`) → modo de transporte.
- `aging-1..5` → escala de antigüedad de cartera/saldos.

Uso: `bg-state-aduana/10 text-state-aduana`, `bg-kpi-success-soft`.

### Radios y sombras

`--radius: 0.5rem` (`rounded-md`), `--radius-sm: 0.375rem` (`rounded-sm`),
`--radius-lg: 0.75rem` (`rounded-xl`).
Sombras: `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-sticky-top`
(barras sticky de wizard/footer móvil).

### Gráficas y PDF

Recharts no entiende clases: usar `CHART.*` y `CHART_SERIES` de
`src/lib/chartTokens.ts`. Los PDFs usan `src/pdf/theme/tokens.ts`.

---

## 3. Tipografía

Fuente única: **Inter** (`font-sans`). `font-emoji` sólo para emoji.
Un escalón por rol — no se mezclan `text-lg`/`text-xl` ad-hoc en encabezados.

| Clase | Rol | Tamaño |
| --- | --- | --- |
| `text-display` | H1, título de página (`PageHeader`, `DetailHeader`) | clamp 22 → 28 px, bold |
| `text-section` | H2, título de bloque (`SectionHeading`) | 16 px / 600 |
| `text-subsection` | H3 anidado dentro de una sección | 14 px / 600 |
| `text-card-title` | Título de tarjeta (`CardTitle`) | 16 px / 600 |
| `text-table-head` | Encabezado de columna | 11 px / 600 |
| `text-body` | Cuerpo por defecto | 14 px |
| `text-body-sm` | Cuerpo denso (celdas, listas compactas) | 13 px |
| `text-label` | Micro-copy, chips, footnotes | 11 px |
| `text-2xs` / `text-3xs` | Badges y chips mínimos | 10 px / 9 px |
| `text-kpi` | Cifra grande de KPI | clamp 18 → 24 px |

Reglas:

- Un solo `h1` por pantalla, siempre vía `PageHeader`/`DetailHeader`.
- Prohibido `text-[11px]`, `text-[10px]` y similares: existe un escalón para eso.
- Cifras siempre con `tabular-nums` para que las columnas de dinero se alineen.
- Montos y fechas se formatean con los helpers de `src/lib/formatters` (es-MX,
  DD/MM/YYYY), nunca a mano.

---

## 4. Layout de página

```tsx
<PageContainer>            {/* mx-auto, p-4 sm:p-6, space-y-6, max-w-screen-2xl */}
  <PageHeader title="Embarques" description="…" actions={<Button …/>} />
  {/* contenido */}
</PageContainer>
```

- `width="wide"` (`max-w-[1720px]`) sólo para listados densos: Facturación,
  Cobranza, CxP.
- `noSpacing` cuando la página maneja su propio ritmo vertical.
- Breakpoint `short:` (`max-height: 800px`) para compactar en laptops de 720p;
  ya está aplicado en `PageContainer` y `PageHeader`.

---

## 5. Tablas

Dos presets de densidad, sin excepciones (`tableTokens.ts`):

| Preset | Valor interno | Cuándo |
| --- | --- | --- |
| `TABLE_DENSITY.listado` | `comfortable` (filas ~40 px) | Listados de página completa |
| `TABLE_DENSITY.embebida` | `compact` (filas ~32 px) | Tablas dentro de card, tab, diálogo, dashboard, drilldown |

```tsx
<DataTable density={TABLE_DENSITY.listado} columns={columns} data={rows} />
```

- Nunca pasar el literal `density="compact"` (lo bloquea `table-patterns.test.ts`).
- Hover: token único `ROW_HOVER` (`hover:bg-primary/5`); `ROW_HOVER_NONE` para
  filas no interactivas.
- Encabezados con `text-table-head` (lo aplica el propio componente).
- Paginación: **siempre** `PaginationControls` (muestra rango + total,
  "1–20 de 134"). Prohibido reimplementar botones Anterior/Siguiente.
- Estado vacío: componente compartido `EmptyState`.
- Sin enlaces `<a>` inline en celdas (regla `tables-no-inline-links`): usar el
  patrón de navegación por fila.
- Menús de acción en filas: `e.stopPropagation()` para no disparar el click de fila.
- Guía extendida de columnas y sort: `docs/tables.md` y
  `docs/datatable-columndef-guide.md`.

---

## 6. Formularios

Todos los controles comparten tokens de `field.tokens.ts`:

- Alto canónico `FIELD_HEIGHT_CLASS` = `h-11 md:h-10` (44 px táctil en móvil).
  **No** sobreescribir con `h-9`.
- Superficie `FIELD_SURFACE_CLASS`: `border-input`, `rounded-md`, `bg-background`,
  `shadow-sm`.
- Foco: `FIELD_STATE_CLASS` (inputs), `FIELD_STATE_RADIX_CLASS` (SelectTrigger),
  `FIELD_STATE_WITHIN_CLASS` (contenedores con input adentro),
  `FIELD_FOCUS_RING_COMPACT_CLASS` (checkbox, radio, switch).
- Error inline: `FIELD_ERROR_CLASS` (`text-xs text-destructive`).
- Etiquetas: componente `<Label>` sin clases extra (no `text-xs text-muted-foreground`).
- Fechas: siempre `DatePickerMx`. Selects de Radix nunca con `value=""` (usar
  `"todos"`).

### Modales tipo formulario

```tsx
<FormDialogShell open={open} onOpenChange={…} icon={FilePlus2}
  title="Nueva factura manual" description="…" size="3xl" footer={footer}>
  <FormDialogSection title="Identificación" description="…">
    {/* campos: grid de 2 columnas automático */}
  </FormDialogSection>
  <FormDialogSection flat title="Notas internas">…</FormDialogSection>
</FormDialogShell>
```

- `FormDialogSection` da subtítulo + grid responsivo (1 col móvil / 2 col desktop);
  `flat` cuando el hijo maneja su propio layout; `cols={1}` para bloques angostos.
- Nada de tarjetas con borde o fondos grises dentro del modal: las secciones son planas.
- Tamaños (`dialogTokens.ts`): `sm` confirmaciones · `md` 1–pocos campos ·
  `lg` formularios cortos · `xl` medianos · `2xl` largos · `3xl` con tabla o
  preview · `4xl` wizards con tabla anidada. Contenido largo: `scrollableDialog`.
- Sheets laterales: `mobileFilterSheet` (filtros móviles), `formSheet` (panel form).

---

## 7. Botones (`src/components/ui/button.tsx`)

Base común: `rounded-md`, `text-sm font-medium`, `transition-colors duration-150`,
`active:scale-[0.98]`, anillo de foco `ring-ring/40` (igual que los campos).

| Variante | Cuándo usarla |
| --- | --- |
| `default` | Acción principal de la pantalla o del modal (una sola por vista) |
| `secondary` | Acción alterna del mismo flujo (p. ej. "Guardar borrador") |
| `outline` | Acciones neutras: Cancelar, filtros, exportar |
| `ghost` | Acciones dentro de tablas, toolbars e íconos |
| `link` | Navegación en línea dentro de texto |
| `accent` | CTA destacado sobre superficies de marca |
| `destructive` | Eliminar / cancelar documentos (siempre con confirmación) |

Tamaños: `default` (h-11/h-10), `sm` (h-10/h-9, tablas y toolbars), `lg` (CTA),
`icon` (cuadrado, requiere `aria-label`).

Otras reglas:

- Mutaciones en curso: usar la prop `loading` (spinner + disabled automáticos);
  no reimplementar el `Loader2`.
- `asChild` para envolver `<Link>`; en ese caso el spinner no se inyecta.
- Íconos de `lucide-react`, tamaño heredado (`[&_svg]:size-4`), a la izquierda del texto.
- Eliminaciones destructivas: doble confirmación con la palabra `ELIMINAR`
  (ver `mem://features/data-safety-confirmations`).

---

## 8. Badges (`src/components/ui/badge.tsx`)

Variantes: `default`, `secondary`, `outline`, `neutral`, `success`, `warning`,
`info`, `destructive`. Tamaños: `default`, `sm`, `xs`.

Semántica acordada: `success` = completado/pagado · `warning` = requiere atención
· `info` = en proceso · `destructive` = cancelado/error · `neutral` = sin estado.
Nunca componer un badge a mano con `bg-*/15 text-*`.

---

## 9. Checklist para una pantalla nueva

- [ ] `PageContainer` + `PageHeader` (un solo `h1`).
- [ ] Encabezados con `text-section` / `text-subsection` vía `SectionHeading`.
- [ ] Listados con `DataTable` + `TABLE_DENSITY.listado` + `PaginationControls` + `EmptyState`.
- [ ] Formularios con tokens de campo, `Label` estándar y `DatePickerMx`.
- [ ] Modales con `FormDialogShell` / `FormDialogSection` y `size` adecuado.
- [ ] Una sola acción `default`; el resto `outline` / `ghost`.
- [ ] Cero colores, px o `style` literales; textos en español mexicano.
- [ ] Verificado a 1280×720 y en modo oscuro.
- [ ] `bun run lint` y las pruebas de arquitectura en verde.
