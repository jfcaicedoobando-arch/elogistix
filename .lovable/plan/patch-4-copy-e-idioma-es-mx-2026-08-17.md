# Patch 4 — Copy e idioma (es-MX)

Aplicar los 6 arreglos de texto del parche subido. Verifiqué en el código que ninguno de los cambios está aplicado todavía y que los dos helpers que el parche reutiliza (`useDocumentTitle`, `pluralizar`) ya existen.

## Alcance

Solo texto visible y etiquetas de accesibilidad. No se cambian ids lógicos (`mis-deals`, `value="pnl"`, `data-testid`), rutas, columnas de datos ni encabezados de CSV.

### 1. Anglicismos visibles
- Sidebar: "Plataforma de Forwarders" → "Plataforma para agentes de carga".
- CRM: chip "Mis deals" → "Mis oportunidades" (id `mis-deals` intacto).
- Wizard de cotización: paso 2 "Costos & P&L" → "Costos y utilidad"; paso 3 "Cotización Cliente" → "Cotización del cliente"; banner "Pre-llenado desde Costos y utilidad."
- Facturación: "Cockpit fiscal" → "Panel fiscal".
- Reportes: "Revenue total USD" → "Venta total USD", "Profit total USD" → "Utilidad total USD", "Top N por Profit" → "Top N por utilidad", columna "Profit USD" → "Utilidad USD", tarjeta móvil "Utilidad: USD 0.00".
- PDF de rentabilidad: "Profit total" → "Utilidad total".
- Detalle de embarque: pestaña "P&L" → "Utilidad".

### 2. Typos y accesibilidad
- Tarjeta de tarifa: se quita el sufijo condicional que producía "Usar esta tarifa esta" / "Elegir esta esta".
- `dialog.tsx` y `sheet.tsx`: sr-only "Close" → "Cerrar".

### 3. Título del navegador por ruta
Aplicar `useDocumentTitle` en 6 rutas que no lo tienen: /dashboard ("Panel"), /configuracion ("Configuración"), /auditoria ("Auditoría operativa"), /bitacora ("Bitácora"), /agente ("Portal agente"), /agente/perfil ("Mi perfil").

### 4. Copy geográfico hardcodeado
- /costeo/rutas: "Pares puerto China → puerto México…" → "Pares de rutas marítimas disponibles para tarifar."
- /costeo/tarifas: "Matriz CN → MX…" → "Matriz de tarifas por agente, naviera, ruta y contenedor. Moneda base: USD."

### 5. Pluralización "(s)"
Usar `pluralizar()` en el portal de estado de cuenta (facturas con saldo / vencidas) y en Presupuesto vs Real (gastos sin tipo de cambio), con concordancia verbal.

### 6. Breadcrumbs con slug crudo
Agregar a `SEGMENT_LABELS`: Conciliación, Estado de cuenta, Pagos, Pagos programados.

## Notas técnicas

- Se omiten los residuales que el propio parche declara fuera de alcance ("Profit USD" en /operaciones y en CSV, "P&L por contenedor", otros "(s)" no listados) para no alterar encabezados de exportación.
- Sin migraciones ni cambios de lógica. Tests existentes no asertan estos textos; se corre la suite para confirmar.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` a 13.634.0.
