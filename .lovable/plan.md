## Objetivo

Hoy la **factura emitida** es una página (`src/features/facturacion/routes/FacturaDetalle.tsx`) con ~8 tarjetas apiladas verticalmente (Receptor, Resumen, Timbrado, Conceptos, Pagos, Notas de crédito, Bitácora), mientras que la **factura recibida** vive dentro de un modal (`DialogDetallePagosProveedor.tsx`) con encabezado, KPIs y secciones propias. Son dos lenguajes visuales distintos para el mismo tipo de documento.

Vamos a unificar ambos en un layout estilo Odoo: encabezado con stepper de estado, cinta de KPIs, cuerpo con pestañas y una columna derecha con la bitácora siempre visible.

## Qué se construye

### 1. Shell compartido de documento financiero
Nuevos componentes en `src/components/shared/documento/`:
- `DocumentoLayout` — rejilla de 2 columnas (contenido + riel de bitácora, colapsable en móvil).
- `DocumentoStatusStepper` — pasos del ciclo de vida, con el paso actual marcado y estados terminales (Cancelada / Sustituida) en tono destructivo.
- `DocumentoKpiStrip` — Total, Saldo, Pagado, Vencimiento, en tipografía tabular.
- `DocumentoTabs` — pestañas sincronizadas con la URL (`?tab=`) para deep-links.

El stepper toma la definición de pasos de un mapa por dominio (emitida: Borrador → Por timbrar → Emitida → Pagada; recibida: Borrador → Vigente → Aprobada → Pagada), ubicado en `src/lib/domain/documentoEstados.ts` con pruebas unitarias.

### 2. Factura emitida — reorganización
`FacturaDetalleBody` deja de apilar tarjetas y pasa a pestañas:
- **Conceptos** — tabla de conceptos + totales (bloque dominante, como Odoo).
- **Cliente y fiscal** — receptor, emisor, UUID, serie, uso CFDI, forma/método de pago.
- **Cobros** — pagos, REP y saldo.
- **Notas de crédito** — sección existente.
- Riel derecho: bitácora + banners (`ClaimPendingBanner`, `SustitutaCanceladaBanner`).

El encabezado conserva `DetailHeader` y suma stepper y cinta de KPIs; las acciones se agrupan en un botón primario contextual + menú "Más" (patrón Odoo/QBO) en lugar de una fila larga de botones.

### 3. Factura recibida — de modal a página
- Nueva ruta `/compras/facturas/:id` con `FacturaProveedorDetalle.tsx`, registrada en `appRoutes.tsx` con los mismos permisos que el módulo de compras.
- Reutiliza el mismo shell y las secciones ya existentes (`InfoFacturaSection`, `ConceptosFacturaSection`, `AnticiposAplicadosSection`, `PagosTable`, `NotasCreditoSection`, `HistorialFacturaSection`) repartidas en pestañas: Conceptos · Proveedor y fiscal · Pagos y anticipos · Notas de crédito, con historial en el riel.
- La `StatusActionBar` actual se adapta al encabezado compartido.
- Los listados de compras navegan a la ruta; el modal queda como envoltorio delgado sólo mientras se migran los puntos de entrada, y se elimina al final para no dejar dos fuentes de verdad.

### 4. Design language
Sin colores crudos: sólo tokens semánticos y `StatusBadge`. Tipografía monoespaciada tabular para folios e importes, títulos de sección en el estilo ya usado (`text-xs font-bold uppercase tracking-wide text-primary`), densidad consistente con el detalle de embarque y proforma.

## Detalles técnicos

- Todos los archivos nuevos ≤200 líneas (Power of 10); las secciones grandes se dividen en subcomponentes.
- Sin cambios de lógica de negocio ni de base de datos: sólo presentación y ruteo. Hooks y servicios actuales se reutilizan tal cual.
- Pruebas: unitarias para `documentoEstados.ts` (pasos y estados terminales) y render de las pestañas con deep-link por URL en ambos detalles.
- `CHANGELOG.md` + `APP_VERSION` → `13.349.0`.

## Verificación

Captura visual con Playwright (FullHD) de ambos detalles antes y después, `bunx tsgo --noEmit`, lint y suite de pruebas.
