# Limpieza de código no utilizado

Auditoría realizada con `knip` + verificación manual con `rg`. Propongo retirarlo en 3 olas, de menor a mayor riesgo, para mantener cada commit revisable y sin romper la app.

## Resumen ejecutivo

- **37** archivos marcados sin uso (la mayoría son falsos positivos: edge functions y barriles).
- **2** edge functions realmente huérfanas.
- **1** dependencia npm sin uso real (`next-themes`) + varias Radix UI sin uso.
- **~50** exports nombrados y **~90** tipos exportados que ya no se importan.
- **1** export duplicado (`changelog` en `changelogData.ts`).

---

## Ola 1 — Bajo riesgo (recomendado aplicar siempre)

Archivos y assets claramente muertos:

- `src/App.css` — no se importa en ningún componente (se usa Tailwind).
- `scripts/audit-power10.ts` — script suelto sin uso (si se quiere conservar, dejarlo en `/scripts` con README; confirmar).
- `src/components/admin/TabPlataforma.tsx` — cero referencias.
- `src/components/operaciones/OperacionesWidgets.tsx` — cero referencias.
- `src/hooks/embarque/useProfitMaps.ts` — cero referencias.
- `src/hooks/embarque/useEmbarqueQueries.ts` — duplica `useEmbarques.ts` y no se importa.

Edge functions huérfanas (ningún cliente las invoca):
- `supabase/functions/jsoncargo-bol-lookup/`
- `supabase/functions/jsoncargo-track-batch/`

Dependencias npm sin uso:
- `next-themes` (no usamos un ThemeProvider de next-themes).
- `@tailwindcss/typography` (devDep no referenciada en `tailwind.config.ts`).
- Radix sin uso real: `@radix-ui/react-aspect-ratio`, `react-context-menu`, `react-hover-card`, `react-menubar`, `react-navigation-menu`, `react-scroll-area`, `react-slider`, `react-toggle`.
  - Antes de borrar cada paquete verifico que no quede usado por un componente shadcn vivo.

Duplicado:
- `src/content/changelogData.ts`: `changelog` se exporta dos veces — consolidar a un único export.

## Ola 2 — Riesgo medio (barriles `index.ts` sin consumidores)

Archivos barril que no se importan en ningún lado (cada módulo importa rutas profundas directas):

```
src/hooks/admin/index.ts
src/hooks/catalogos/index.ts
src/hooks/cliente/index.ts
src/hooks/configuracion/index.ts
src/hooks/cotizacion/index.ts
src/hooks/dashboard/index.ts
src/hooks/embarque/index.ts
src/hooks/facturacion/index.ts
src/hooks/operaciones/index.ts
src/hooks/portal/index.ts
src/hooks/proveedor/index.ts
src/hooks/reportes/index.ts
src/hooks/shared/index.ts
src/hooks/usuario/index.ts
src/lib/financial/index.ts
src/lib/ui/index.ts
```

Acción: eliminarlos. Riesgo: bajo; quedó verificado con `rg`. Si en algún caso se prefiere mantener barril como convención, lo dejamos y queda solo como recordatorio.

## Ola 3 — Limpieza fina de exports y tipos (opcional)

- Retirar exports nombrados sin consumidores en archivos vivos (no borrar archivos, solo el `export` sobrante o convertir a no-exportado). Ejemplos representativos:
  - UI shadcn: `AlertDialogPortal`, `AvatarImage`, `badgeVariants`, `CardFooter`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DropdownMenu*` (Radio/Sub/Shortcut/Portal/Group), `Select*` (Group/Label/Separator/Scroll), `Sheet*` (Close/Description/Overlay/Portal), `Sidebar*` (Action/Label/Input/Inset/Menu*Sub/Rail/Separator), `TableCaption`, `ToastAction`, `CommandShortcut`, `CommandSeparator`.
    - **Nota:** muchos de estos vienen del scaffolding shadcn estándar; si se prefiere conservar para futuras pantallas, omitimos esta sección.
  - Dominio: `ESTADOS_INACTIVOS`, `TIPOS_CARGA` (wizardConstants y SeccionMercanciaWrapper), `DOCS_OBLIGATORIOS`, `DOCS_NACIONAL`, `DOCS_EXTRANJERO`, `EMPTY_PROVEEDOR_FORM`, `COTIZACION_FORM_DEFAULTS` (duplicado), `PAGE_SIZE` (useChangelogController), `PORTAL_EMBARQUE_PROGRESS_STEPS`, `useClientes` (cliente/useClientes.ts), `useEmbarques/useEmbarqueDocumentos/useEmbarqueNotas/useEmbarqueFacturas` (duplicados en useEmbarques.ts y useEmbarqueQueries.ts), `useTrackingLinks`, `useDeleteTrackingLink`, `useCapturarSnapshotAuditoria`, `useConfiguracionGlobal/useConfigGlobalValue`, `useConfigCategoria`, `useUpdateConfiguracionOrg`, `useActividadReciente`, `DEFAULT_PAGE_SIZE`, `reducer` (use-toast), `Constants` (types.ts auto-gen — no tocar), `FIELD_LABELS`, `roleLabels`, `kpiSolidClasses`, `reglaLabel`, `formatValidationMessage`, `ALLOWED_MIME_TYPES`, `stepDatosGeneralesSchema`, `extractFacturaPath`, `getFacturaSignedUrl`, `getFileUrl`, `APP_ROLES`, `CONTACTO_COLUMNS`, `CLIENTE_LIST_COLUMNS`, `CLIENTE_DETAIL_COLUMNS`, `COTIZACION_LIST_COLUMNS`, `COTIZACION_ACEPTADA_COLUMNS`, `generarFolioCotizacion`, `fetchDiasCreditoCliente`, `fetchProfitPorEmbarque`, `loadChangelogV8`, `extractPrefix`, `getCarriersForPrefix`, `PREFIX_TO_CARRIERS`, `jsoncargoDateToYmd`.
  - Tipos exportados (~92) que ya nadie importa: revisión por archivo y conversión a tipo local (sin `export`). Mantener tipos que sean parte de la API pública aunque no se importen aún si forman parte de un contrato claro (criterio caso por caso).

Esta ola es muy mecánica pero amplia; se puede ejecutar en una sola pasada o saltarse si se considera ruido para el git history.

## Detalles técnicos

- Validaciones que correré tras cada ola: `bunx tsc --noEmit` + arrancar dev server + smoke en `/`, `/embarques`, `/cotizaciones`, `/facturacion`, `/clientes`, `/admin`.
- Conservar `src/integrations/supabase/types.ts` intacto (auto-generado).
- Conservar `src/integrations/supabase/client.ts` intacto.
- No tocar `supabase/config.toml` salvo para retirar bloques específicos de las edge functions eliminadas (si los tienen).
- Tras la limpieza: bumpear `APP_VERSION` a **8.155.2** (patch — solo limpieza, sin cambio funcional) y agregar entrada en `Changelog.tsx` + `changelogData.ts` + `v8/chunks/0.ts`.

## ¿Qué olas quieres que ejecute?

Sugerencia: **Ola 1 + Ola 2** (impacto alto, riesgo bajo) y dejar **Ola 3** como follow-up si te interesa el detalle fino. Confírmame antes de borrar deps Radix por si planeas usar alguna (p. ej. `react-scroll-area`).
