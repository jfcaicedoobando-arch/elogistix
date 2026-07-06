## Objetivo (continuación Fase 2)

Cerrar los bloques restantes del barrido: portal cliente (cards de dashboard + `EmbarqueCard`), costeo (migrar `onRowClick`→`getRowHref` donde navega a URL), y la regla arquitectónica final. Sin tocar columnas visibles ni lógica.

## Bloques a ejecutar

### Bloque 1 — Portal cliente: cards y list-items
Aplicar el helper `useDrilldownRow` (creado en 13.201.0) para dejar la card/fila entera navegable sin `<Link>` inline:

- `src/features/portal/components/EmbarqueCard.tsx` — envolver el contenido en `<article {...useDrilldownRow(...)}>` en vez de `<Link>` externo.
- `src/features/portal/components/dashboard/PortalEmbarquesRecientesCard.tsx` — cada fila usa `useDrilldownRow`. El header "Ver todos" se mantiene como botón-link (fuera de la lista).
- `src/features/portal/components/dashboard/PortalProximosArribosCard.tsx` — igual: filas navegables, header con botón "Ver todos".
- `src/features/portal/components/dashboard/PortalEstadoEmbarquesCard.tsx` — filas navegables (los dos `<Link>` de línea 29 y 45).

### Bloque 2 — Costeo
- `CosteoRutasTable`: `onRowClick={(f) => navigate(...)}` → `getRowHref={(f) => `/costeo/tarifas?ruta=${f.ruta.id}`}`. Elimina el `useNavigate` si queda sin uso.
- `CosteoTarifasTable`, `CosteoAgentesTable`, `CosteoDemorasVenta`, `CosteoNavieras`: verificar que ninguno abra edit dialog via link inline; si el row-click abre modal se conserva `onRowClick`.

### Bloque 3 — Auditoría
- `HallazgosTabla`, `HallazgoTabla`: si navegan a detalle, migrar a `getRowHref`; si abren dialog, mantener `onRowClick`. Confirmar ausencia de `<Link>` en celdas.

### Bloque 4 — Admin
- `AdminOrganizacionesColumns`, `usuariosColumns`, `portalUsuariosColumns`: quitar cualquier `<Link>` en celda (usar row-click ya presente o menú de acciones).
- Tablas sin detalle (`TabPlanes`, `DiagnosticoColumns`, `Papelera`, `Idempotencia`): mantener sólo menú de acciones, sin Links inline.

### Bloque 5 — Regla arquitectónica (Fase 3)
Nuevo test `src/__tests__/architecture/tables-no-inline-links.test.ts`:
- Escanea `src/**/*columns.tsx` / `*Columns.tsx` y falla si contienen `from "react-router-dom"` con símbolo `Link` importado.
- Allowlist vacía; excepciones deben añadirse explícitamente.

### Bloque 6 — Versionado
- Bump `APP_VERSION` a `13.202.0`.
- Entrada `CHANGELOG.md` resumiendo bloques 1–5.

## Detalles técnicos

- Cards del portal: reemplazar `<Link to={x}>...</Link>` por `<article {...useDrilldownRow({ href: x, ariaLabel })}>...</article>`. El `ChevronRight` decorativo se mantiene con `aria-hidden`.
- Los botones "Ver todos" del header de cada card **no** son celdas — se conservan como `<Button asChild><Link>`.
- Cuando una tabla ya tiene `onRowClick` con `navigate(...)`, se migra a `getRowHref` (habilita Ctrl+click y accesibilidad). Si `onRowClick` abre modal, se conserva.

## Fuera de alcance

- Marketing, legal, layouts, headers, breadcrumbs, botones de acción (`<Button asChild><Link>`).
- Rediseño visual, cambios de columnas, filtros, paginación, lógica.

## Orden de ejecución

1. Bloque 1 (portal) — 4 archivos.
2. Bloque 2 (costeo) — verificar y migrar `CosteoRutasTable`.
3. Bloques 3–4 (auditoría + admin) — verificaciones puntuales.
4. Bloque 5 (test arquitectónico).
5. Bloque 6 (version + changelog).
