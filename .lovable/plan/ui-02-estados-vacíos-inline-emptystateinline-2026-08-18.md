# UI-02 · Estados vacíos inline → EmptyStateInline

## Qué encontré

- `EmptyStateInline` (`src/components/empty/EmptyStateInline.tsx`) ya es el destino canónico y lo usan 102 archivos. Su API hoy es: `icon`, `message`, `hint`, `loading`, `className`. No soporta CTA.
- Barriendo el ERP por bloques "No hay… / Aún no… / Sin resultados" pintados a mano encontré **~21 archivos con estado vacío inline real** (div/p centrado con `text-muted-foreground` y padding propio: py-4, py-6, py-8 conviviendo en el mismo feature). El resto de las coincidencias del inventario original ya pasan por primitivos correctos (`EmptyState` de página, `emptyMessage` de `DataTable`, `DetailTableEmptyRow`, alerts, tooltips y `title=` de botones), y no deben tocarse.

Archivos objetivo por módulo:

```text
cotizacion (3)   ProductoServicioSelect, SugerenciasTarifaResultados, BuscadorProspectos
tesoreria (1)    TesoreriaCuentas
cxp (1)          ConciliacionPagoCell
crm (2)          NextBestActionsCard, Analitica
costeo (2)       BuscarTarifaDialog, CosteoBuscar
catalogos (1)    NavieraSelect
admin (2)        NuevaOrganizacionDialog, AdminDemoLeads
proveedor (1)    ProveedorComparativoCard
portal (1)       PortalFacturaPagosCard
proformas (1)    ProformaBitacoraCard
facturacion (1)  PagoFormFields
anticipos (1)    RegistrarAnticipoPagoFields
configuracion (1) wizard/PasoProbar
reportes (1)     ReportesTopChart
dashboard (1)    ArribosCardTooltips
shared (1)       dialogs/DocumentPreviewDialog
```

## Cómo lo voy a hacer

1. **Extender la API mínima del componente** (sin romper usos actuales): añadir `action?: { label, onClick, to? }` opcional que renderiza un `Button` `variant="outline"` `size="sm"` debajo del hint, y `density?: "compact" | "default"` para el caso de dropdowns/celdas donde `py-8` es demasiado. Tests unitarios del nuevo comportamiento.
2. **Barrido por módulo** (un lote por feature, no todo de golpe), decidiendo en cada caso:
   - icono acorde a la entidad de la lista (Receipt, Ship, Building2, Landmark, etc.),
   - `message` corto en español MX,
   - `hint` sólo cuando aporta el siguiente paso,
   - `action` cuando existe un destino claro ("Dar de alta producto", "Crear cuenta en Tesorería"). Los textos que hoy incrustan enlaces en prosa pasan a `hint` + `action`.
   - En dropdowns de selects (`NavieraSelect`, `ProductoServicioSelect`, `BuscadorProspectos`, `NuevaOrganizacionDialog`) uso `density="compact"` para no inflar el popover.
3. **Guardrail** nuevo `src/__tests__/architecture/empty-state-inline-canonical.test.ts`, siguiendo el patrón de `section-heading-canonical.test.ts`: prohíbe en `src/features/**` y `src/components/shared/**` bloques centrados con texto "No hay/Aún no/Sin resultados" fuera de los primitivos permitidos, con lista de deuda congelada que sólo puede decrecer (excluye `features/marketing`, páginas legales, PDFs y tests).
4. **QA visual ligero** con Playwright autenticado sobre 4 pantallas representativas (Tesorería → Cuentas, CRM → Analítica, Costeo → Buscar, wizard de Cotización con catálogo vacío) para confirmar espaciado y que no se rompe ningún layout de card.
5. `bunx tsgo --noEmit` + suites de arquitectura + `CHANGELOG.md` y `APP_VERSION` (13.662.0).

## Notas técnicas

- No toco `EmptyState` (página completa) ni los `emptyMessage` de `DataTable`/`DetailTable`: son otro rol y ya están unificados.
- Ningún cambio de lógica de negocio, queries ni condiciones de carga; sólo la capa de presentación del estado vacío.
- Si algún bloque hoy mezcla estado vacío con estado de error, se separa usando `ErrorStateInline` (ya existe) en vez de forzarlo al vacío.
