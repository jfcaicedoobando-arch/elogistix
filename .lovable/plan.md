## Ola 4 · Cerrar auditoría de tableta

Extender la auditoría 768×1024 y xl+ (1440×900) a las 3 áreas que quedaron marcadas como "fuera de alcance" en el reporte original. Mismos criterios que Olas 1-3: **0 errores de consola, `<main>` sin overflow horizontal, modales/drawers que caben, foco restaurado al cerrar.**

### Alcance

**A · Portal cliente / agente**
Rutas a auditar (headless con login del rol correspondiente si está disponible; si no, sólo lectura de estructura):
- `/portal` (dashboard cliente)
- `/portal/embarques` y `/portal/embarques/:id`
- `/portal/facturacion`
- `/agente/*` (equivalentes si existen)

Foco: layout con sidebar propio, gráficos apilados (barra stacked), tarjetas KPI, tablas de embarques del cliente.

**B · Módulo `/admin/*`**
Rutas del dueño Libre Carga:
- `/admin/tenants` (listado y detalle)
- `/admin/usuarios`
- `/admin/auditoria` y hallazgos con "Explicar con IA"
- `/admin/configuracion` si aplica

Foco: tablas densas de tenants/usuarios, modales de impersonación, drawer de hallazgos IA.

**C · Detalles y wizards adicionales**
- `/cotizaciones/:id` (detalle con conceptos, tarifas, timeline)
- `/proformas/:id`
- `/clientes/:id` (tabs: contactos, embarques, documentos, tax info)
- `/proveedores/:id`
- Wizard **Nueva Cotización** paso a paso (steps 2-N, no sólo step 1 como en spec 17)
- Wizard **Nueva Factura CxP** completo si tiene pasos

### Método

1. **Medir** con Playwright headless en 768×1024 y 1440×900:
   - `document.body.scrollWidth` vs `clientWidth`
   - `main.scrollWidth` vs `clientWidth`
   - Consola: 0 errores
   - Modales: `dialog.scrollWidth ≤ clientWidth`, `dialog.height ≤ 92vh`
   - Screenshot por ruta/viewport en `/tmp/tablet-audit-ola4/`
2. **Categorizar hallazgos** (Ola 4 report) por severidad:
   - 🔴 overflow real del `<main>` o error de consola
   - 🟡 scroll horizontal interno aceptable (tabla densa con sticky)
   - ✅ pasa
3. **Aplicar fixes por categoría**, no por instancia:
   - Header/PageHeader ya está resuelto globalmente
   - Aplicar `hidden xl:table-cell` a columnas secundarias de tablas admin/portal según patrón de Ola 2
   - Ajustar `xl:grid-cols-N` en KPIs del portal
   - Modales con overflow → revisar que usen `FormDialogShell` o equivalente con `max-h-[85vh]` y `overflow-y-auto`
4. **E2E**: 2-3 specs nuevos siguiendo patrón 13-17:
   - `18-portal-responsive.spec.ts`
   - `19-admin-responsive.spec.ts`
   - `20-detalles-wizards-responsive.spec.ts` (extiende spec 17 con wizard multi-paso completo)

### Entregables

- `.lovable/tablet-audit-report.md` con sección "Ola 4"
- Fixes de código sólo si hay hallazgos rojos (esperado bajo, la mayor parte del sistema comparte `FormDialogShell` + `DataTable` + `PageHeader` ya arreglados)
- 3 specs E2E nuevos
- `CHANGELOG.md` + bump `APP_VERSION` por cada versión aplicada

### Fuera de alcance de esta ola

- Cambios de contenido, permisos, RLS o lógica de negocio
- Rediseñar portales o admin — sólo pulir responsive
- Mobile (<768px) — la app usa cards en mobile, se auditaría en un frente aparte

### Riesgos

- El portal cliente y `/admin/*` pueden requerir sesiones con roles distintos al de `hector@lopezbenavides.com`. Si el login de prueba no tiene acceso, la auditoría de esa ruta se marcará como "no auditable con credenciales actuales" y se dejará documentado en el reporte, sin bloquear la ola.
- Los wizards multi-paso ejercitan formularios reales; el spec navegará hasta el último paso sin enviar (cancelará antes de commit) para no crear datos ruido.

### Detalles técnicos

- Helpers `assertNoOverflow()`, `assertDialogFits()` reutilizados de specs 13-17.
- `storageState` para login rápido, `chromium-internal` project.
- Screenshots sólo cuando falla o para adjuntar al reporte.
- Sin dependencias nuevas.
