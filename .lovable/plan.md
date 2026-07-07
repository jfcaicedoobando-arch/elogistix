
# Auditoría Facturación & Compras — Ola 2: Compras (densidad y acciones)

Continuamos con la ola que más dolor le quita al contable: reducir ruido visual en las tablas de Compras y devolverles espacio útil.

Analogía: hoy cada renglón trae un botón grande con la misma leyenda; es como si cada expediente tuviera un post-it que dice "abrir" — mejor que la manija esté en el fólder y ya. Además, ordenamos las columnas por prioridad de uso, no por historia.

## Alcance

1. **`/compras/por-capturar` — quitar ruido de la columna Acción**
   - Reemplazar el botón textual `[📄 Capturar factura]` de cada fila por un ícono `+` (48 px, tooltip "Capturar factura", `aria-label` accesible).
   - Toda la fila se vuelve clickeable (abre el mismo drawer). Cursor pointer y hover sutil.
   - El espacio recuperado se usa para separar "Presupuesto" y "Facturado" en dos columnas alineadas a la derecha con `tabular-nums`, en vez del `MXN 0.00 / MXN 6,844.80` que envuelve hoy.
   - Sticky header al hacer scroll (para no perder el contexto en listas de 158+).

2. **`/compras/facturas` — tabla con densidad configurable**
   - Preset por defecto (más limpio): Folio, Proveedor, Vencimiento, Días, Total, Saldo, Estatus, Acción.
   - Columnas opcionales (visibles con el botón "Filtros" → nueva sección "Columnas"): Folio Prov., Emisión, Prog. Pago, Pagado, Aprobación, Moneda.
   - La preferencia se guarda por usuario/tenant en `browserStorage` (llave `cxp-facturas-columns`).
   - Sticky header y `min-width` por columna para evitar el corte silencioso de "Aprobación".
   - Botón `Reporte PDF` movido al menú "Más" (⋯) para reducir botones primarios visibles.

3. **`/compras/conciliacion` — ajustar overflow**
   - Añadir `min-width` a columnas críticas y `title` en badges truncados ("Sin facturar", "Parcial", "Conciliada") para que al hover se lea completo.
   - Header sticky para tablas largas.

## Fuera de alcance de esta ola
- Cambios en lógica de negocio o cálculos.
- Renombrar rutas.
- Tocar el Dashboard de Compras (queda para Ola 3 junto con Facturación).

## Detalle técnico

- Nuevo componente reutilizable `ColumnVisibilityMenu` alimentado por TanStack Table `columnVisibility` (API nativa v8). Se monta dentro del popover `Filtros` existente.
- Persistencia con el wrapper permitido `@/lib/browserStorage` (memory core: prohibido `localStorage` directo).
- Sticky header: clase utilitaria en el `<TableHead>` base — no romper la variante "striped" del estándar de tablas.
- Ícono `+` con `<Button size="icon" variant="ghost">` y `<Tooltip>`; row-click delega en el mismo handler (usar `e.stopPropagation()` en el botón para respetar la memoria `technical/event-propagation-standards`).
- Añadir tests de:
  - `useCxpFacturasColumns` (visibility persistence: default + toggle + reload).
  - Snapshot mínimo del preset default en `Cxp` para atrapar regresiones de headers.

## Archivos a tocar (estimado)

- `src/features/cxp/routes/Cxp.tsx`
- `src/features/cxp/components/cxpColumns.tsx`
- `src/features/cxp/components/ColumnVisibilityMenu.tsx` (nuevo)
- `src/features/cxp/hooks/useCxpFacturasColumns.ts` (nuevo)
- `src/features/bandejas/routes/_sections/cxpPorPagarColumns.tsx` (no aplica, es otra vista) — no se toca.
- `src/features/cxp/routes/_sections/CxpPorCapturar*.tsx` (ícono + row click + columnas).
- `src/features/cxp/routes/ComprasConciliacion.tsx` (min-width + tooltips en badges).
- `src/components/shared/DataTable/*` — sticky header opt-in (`stickyHeader?: boolean`).
- Tests correspondientes.
- `APP_VERSION` → `13.213.31` y entrada en `CHANGELOG.md`.

## Riesgos y mitigación
- Riesgo: cambiar el botón por ícono confunde a usuarios acostumbrados. Mitigación: tooltip claro + fila clickeable + mantener la misma acción destino.
- Riesgo: preferencia de columnas por usuario podría "esconder" info en soporte. Mitigación: opción "Restablecer columnas" en el menú.
- Riesgo: sticky header con tablas ya scrolleables horizontalmente puede verse raro. Mitigación: sólo sticky en vertical (`top-0`), no interfiere con scroll X.

## Validación
- Screenshots antes/después de las 3 pantallas en FHD.
- `bun run lint --max-warnings 0` y tests unitarios de la ola.

¿Ejecuto esta Ola 2 completa? Si prefieres partirla por pantalla (empezar solo con `/compras/por-capturar` para validar el nuevo patrón antes de aplicarlo a Facturas), dímelo y lo hago así.
