
# Ola 6 — Cierre de homologación de layout

Objetivo: dejar **todas** las rutas de nivel superior con el mismo contenedor (`PageContainer` = `mx-auto max-w-screen-2xl p-4 sm:p-6 space-y-6`) para que el padding, el ancho máximo y el ritmo vertical sean idénticos en toda la app. Con esto se cierra el plan de homologación arrancado en la Ola 1.

## Alcance

Solo layout de páginas (contenedor + `PageHeader` cuando falte). No se toca lógica de negocio, tablas, formularios ni estilos internos de tarjetas. Rutas de wizards multi-paso (`NuevoEmbarque`, `NuevaCotizacion`, `EditarCotizacion`, `EditarEmbarque`) quedan **fuera** — ya usan `WizardShell` con su propio contenedor.

### Lote A — Admin (7 rutas, alta prioridad)
Todas tienen `PageHeader` pero envuelven en `<div className="p-6 space-y-6">` custom.
- `admin/routes/AdminAuditoriaPlataforma.tsx`
- `admin/routes/AdminConfiguracion.tsx`
- `admin/routes/AdminDashboard.tsx`
- `admin/routes/AdminOrganizaciones.tsx`
- `admin/routes/AdminOrgDetalle.tsx` (falta `PageHeader` — agregarlo)
- `admin/routes/Diagnostico.tsx`
- `admin/routes/Idempotencia.tsx`
- `admin/routes/Papelera.tsx`
- `admin/routes/SentryDiagnostico.tsx`
- `admin/routes/admin-org/Configuracion.tsx`
- `admin/routes/admin-org/Usuarios.tsx`

### Lote B — Portal Cliente y Portal Agente (9 rutas)
Usan `max-w-7xl`/paddings propios. Se estandarizan a `PageContainer` conservando la card de branding del portal.
- `portal/routes/PortalDashboard.tsx`
- `portal/routes/PortalCotizaciones.tsx`
- `portal/routes/PortalCotizacionDetalle.tsx`
- `portal/routes/PortalEmbarques.tsx`
- `portal/routes/PortalEmbarqueDetalle.tsx`
- `portal/routes/PortalFacturas.tsx`
- `portal/routes/PortalFacturaDetalle.tsx`
- `portal/routes/PortalPerfil.tsx`
- `portal-agente/routes/AgenteInicio.tsx`
- `portal-agente/routes/AgenteTarifas.tsx`
- `portal-agente/routes/AgenteGarantias.tsx`
- `portal-agente/routes/AgenteEmbarques.tsx`
- `portal-agente/routes/AgentePerfil.tsx`

### Lote C — Detalles (7 rutas)
Páginas de detalle con paddings inconsistentes.
- `cliente/routes/ClienteDetalle.tsx`
- `cotizacion/routes/CotizacionDetalle.tsx`
- `cotizacion/routes/CotizacionInformativaDetalle.tsx`
- `cotizacion/routes/NuevaCotizacionInformativa.tsx`
- `embarques/routes/EmbarqueDetalle.tsx`
- `facturacion/routes/FacturaDetalle.tsx`
- `proveedor/routes/ProveedorDetalle.tsx`
- `crm/routes/OportunidadDetalle.tsx`

### Lote D — CRM y varios (3 rutas)
- `crm/routes/CrmLayout.tsx` (outlet layout — solo alinear padding)
- `comisiones/routes/Comisiones.tsx`
- `onboarding/routes/Onboarding.tsx`

### Fuera de alcance (documentado, no se toca)
- **Wizards**: `NuevoEmbarque`, `EditarEmbarque`, `NuevaCotizacion`, `EditarCotizacion` — usan `WizardShell`.
- **Auth/Marketing/Legal**: `Login`, `ResetPassword`, `NotFound`, `TrackingPublico`, `Unsubscribe`, `Landing`, `HomeRoute`, `Guia*`, `LogoPreview`, `Privacidad`, `Terminos`, `Seguridad` — tienen layouts propios (hero, público) intencionalmente distintos.
- **Sub-componentes** listados por el grep (`*Columns.tsx`, `*Cells.tsx`, `*Toolbar.tsx`, `CrmSubheader`, `FinanceHeader`, `OportunidadDetalleContent`) — no son rutas, no aplican.

## Cambios técnicos por archivo

Patrón único de migración:

```tsx
// antes
return (
  <div className="p-6 space-y-6">
    <PageHeader ... />
    ...
  </div>
);

// después
return (
  <PageContainer>
    <PageHeader ... />
    ...
  </PageContainer>
);
```

Casos especiales:
- Portales con card de bienvenida ancho completo: mantener la card fuera; envolver el resto en `PageContainer`.
- `AdminOrgDetalle.tsx`: introducir `PageHeader` con nombre de organización + tabs slot.
- `CrmLayout.tsx` (layout outlet): solo cambiar wrapper externo; los hijos ya migrados en Ola 4.

## Validación
- `bun run lint` y `tsgo` en verde.
- Test de arquitectura nuevo: `page-container-usage.test.ts` — verifica que toda ruta `src/features/**/routes/*.tsx` que renderiza `PageHeader` importe `PageContainer` (con lista blanca para Auth/Marketing/Legal/Wizards).
- Screenshot rápido con Playwright de 3 rutas representativas (admin dashboard, portal cliente, cliente detalle) a 1280×1800 para confirmar padding uniforme.
- Bump versión a `13.156.0` + entrada en `CHANGELOG.md`.

## Entregable
~30 archivos tocados (imports + wrapper), 1 test de arquitectura, 1 entrada de changelog, 1 bump de versión. Con esto queda cerrado el plan de homologación de design language.
