## Siguiente ola de fixes tableta (Grupos A, D, E)

Ya cerramos P0 de headers/KPIs/chips. Continúo con lo que quedó marcado 🟡 y con detalle+modales.

### Grupo A · Tablas densas con scroll horizontal (P1)

Rutas afectadas: `/embarques`, `/proformas`, `/clientes`, `/proveedores`, `/cxp`, `/profit/proyeccion`.

Estrategia (sin tocar lógica ni queries):
- **Ocultar columnas secundarias en tableta** con `hidden xl:table-cell` para las columnas que no son críticas para escanear la lista. Ejemplos:
  - `/embarques`: ocultar `Modo` y `Origen` en `<xl`; dejar `Expediente`, `BL Master`, `Contenedores`, `Cliente`, `Estado`.
  - `/proformas`: ocultar `Operador` y `Fecha` en `<xl`; dejar `#`, `Expediente`, `Cliente`, `Estado`, `Monto`, acciones.
  - `/cxp`: ocultar `Folio Prov.` en `<xl` (queda como tooltip / detalle).
  - `/clientes`: ocultar `RFC` en `<md`, `Contacto` en `<xl`.
  - `/proveedores`: ocultar `Origen` en `<xl` (el badge queda dentro del tipo).
- **`min-w/max-w` en columnas de texto largo** (Cliente, Proveedor) + `line-clamp-1` con `title` tooltip nativo.
- **Encabezados numéricos y de fecha** con `whitespace-nowrap` (evita el envuelto "Días\nvencido").
- **Padding de celda** reducido a `md:px-2` (tabla más compacta sin cambiar densidad global).

### Grupo D · Header consistente

- Auditar rutas que aún renderizan su propio `<h1>` en vez de `PageHeader` (si las hay) — al ser plan mode no puedo confirmar todavía, pero `/profit/proyeccion` no muestra "Título + descripción" bajo `PageHeader`.
- Homologar y aprovechar el `lg:flex-row` que ya aplicamos globalmente.

### Grupo E · Detalles y modales (auditoría faltante)

Capturar 1 detalle representativo por dominio + los modales/wizards clave a 768×1024:
- Detalle: `/embarques/:id`, `/cotizaciones/:id`, `/proformas/:id`, `/clientes/:id`.
- Modales: **Nuevo Cliente**, **Nuevo Proveedor**, **Nueva Cotización (wizard)**, **Nueva Factura Manual**, **Capturar Factura CxP**.

Checklist por modal:
- `FormDialogShell` con `max-h-[85vh]`, footer sticky, stepper compacto.
- Selects con labels legibles (sin "Todos…" truncado).
- Botones de acción no salen del contenedor.
- Sin scroll horizontal interno.

Si un modal no usa `FormDialogShell` y falla en tableta, lo migro (patrón ya estándar en el proyecto).

### Método

1. Extender `/tmp/tablet-audit/capture.py` para navegar a un detalle y abrir un modal por ruta.
2. Capturar → revisar → aplicar fixes por columnas ocultas / dialog shell.
3. Re-capturar y comparar.
4. Verificación: `bun run lint` limpio; sin cambios de tests.
5. Bump `APP_VERSION` a `13.172.5` + entrada en `CHANGELOG.md`.

### Fuera de alcance

- Rediseño de tablas o cambio de librería.
- Lógica de datos, hooks, RLS.
- Portal cliente/agente y `/admin/*`.

### Entregable

- Actualizar `.lovable/tablet-audit-report.md` con la sección "Ola 2 · tablas + modales".
- Screenshots antes/después en `/tmp/tablet-audit/shots/`.
- Resumen de columnas ocultadas por ruta y modales migrados.
