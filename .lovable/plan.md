# Aplanar JSX con early returns para estados loading/error

## Contexto

Auditoría completa de componentes que consumen datos de Supabase (vía React Query). Muchas páginas ya usan `if (isLoading) return ...` (ej. `ProveedorDetalle`, `PortalEmbarques`, `PortalCotizaciones`, `EditarCotizacion`, `CotizacionDetalle`, `EmbarqueDetalle`, `ClienteDetalle`, `Configuracion`, `TrackingPublico`, `AuditoriaEjecutivoTab`). Quedan oportunidades donde el ternario `isLoading ? ... : empty ? ... : (...)` vive **anidado dentro del JSX** y oculta la rama principal.

No se cambia lógica de negocio ni queries — sólo estructura de render.

## Cambios propuestos

### A) Páginas con loading anidado dentro del JSX principal

En estos casos, hay chrome (PageHeader, Card, Tabs) que envuelve la rama de carga. Solución: extraer el contenido del tab/card a un subcomponente o helper `renderXxx()` con early returns internos, dejando el JSX principal plano.

1. **`src/pages/Auditoria.tsx`** (líneas 138, 249)
   - Extraer `<TabsContent value="tabla">` body a `<AuditoriaHallazgosTab data={c} ... />` con early returns para `isLoading` y `!data`.
   - Extraer `<TabsContent value="por_regla">` body a `<AuditoriaPorReglaTab data={c} />` con early return para `isLoading`.

2. **`src/pages/dashboard/Bitacora.tsx`** (línea 103)
   - Extraer body del `<CardContent>` a helper `renderBitacoraBody()` con early returns para `isLoading` y lista vacía.

3. **`src/pages/dashboard/Operaciones.tsx`** (línea 88)
   - Extraer chart body a helper `renderChart()` con early return para `isLoading`.

### B) Tarjetas dashboard con multi-rama loading/empty

Mismo patrón: helper `renderBody()` local con early returns.

4. **`src/components/auditoria/AuditoriaTendenciaChart.tsx`** (línea 31, ternario anidado loading → empty → chart)
5. **`src/components/reportes/ReportesTopChart.tsx`** (línea 34, mismo patrón)
6. **`src/components/facturacion/TabProformasPendientes.tsx`** (línea 58, loading → empty → contenido)
7. **`src/components/embarque/TabTracking.tsx`** (línea 136, loading → empty → lista)
8. **`src/components/dashboard/ProximosArribosCard.tsx`** (línea 33)
9. **`src/components/dashboard/AlertasDemoraCard.tsx`** (línea 32)
10. **`src/components/dashboard/CargasActivasClienteCard.tsx`** (línea 43)
11. **`src/components/cliente/TablaContactos.tsx`** (línea 58)

### C) No tocar

- Componentes que ya usan early returns top-level (ClienteDetalle, EmbarqueDetalle, EditarCotizacion, etc.).
- Skeletons inline de una sola expresión simple (`isLoading ? <Skeleton/> : valor` en `DashboardStatusCards`, `AdminDashboard`, `HuecoFacturacionCard`) — son legibles y reemplazarlos añade ruido sin beneficio.
- Botones con `isPending ? "Guardando..." : "Guardar"` — caso trivial de label, no justifica helper.

## Patrón estándar a aplicar

```tsx
// Antes
<CardContent>
  {isLoading ? (
    <Skeleton className="h-48" />
  ) : !data || data.length === 0 ? (
    <Empty />
  ) : (
    <Chart data={data} />
  )}
</CardContent>

// Después
function renderBody() {
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data || data.length === 0) return <Empty />;
  return <Chart data={data} />;
}
// ...
<CardContent>{renderBody()}</CardContent>
```

Para tabs/secciones grandes (caso A), extraer a un componente hermano en el mismo archivo o nuevo archivo si supera ~40 líneas, con `if (isLoading) return <Skeleton/>;` al inicio.

## Versionado y changelog

- `APP_VERSION` → `8.135.6` (patch, sin cambios funcionales).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Refactor UI: early returns para estados de carga/error, JSX más plano y legible".

## Validación

- Build TypeScript debe pasar sin cambios de tipos.
- Verificación visual rápida en `/auditoria`, `/dashboard/bitacora`, `/dashboard/operaciones`, `/reportes` y un detalle de cliente para confirmar que loading/empty/contenido siguen renderizando igual.
