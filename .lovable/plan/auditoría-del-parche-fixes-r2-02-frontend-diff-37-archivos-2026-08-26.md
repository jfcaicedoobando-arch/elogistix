# Auditoría del parche `fixes_r2_02_frontend.diff` (37 archivos)

Revisé cada hallazgo contra el código real y la base de datos. **La mayoría son bugs reales y vale la pena corregirlos**, pero hay 3 puntos donde el parche está mal enfocado o incompleto. Propongo aplicarlo en 3 etapas.

## Veredicto por hallazgo

Confirmados como bugs reales (verificados en código/BD):

| Hallazgo | Qué pasa hoy | Verificado |
|---|---|---|
| W-01 | `savePaso3` guarda `subtotal = totalUSD`: una cotización sólo en pesos queda con `subtotal = 0`, y el botón "Enviar" del detalle se bloquea con "sin importe" aunque la BD sí permitiría enviarla (el guard de BD sí mira los conceptos) | sí |
| W-06 | La barra del wizard muestra un solo "margen consolidado" eligiendo USD o MXN, mezclando monedas sin tipo de cambio | sí |
| W-07 | Margen sin ventas se muestra como "0.0%" (parece margen cero real) y pinta la tarjeta en advertencia | sí |
| W-10 | El desglose por cliente del dashboard no suma el estado legacy `Llegada` a `Arribo` (el otro parser sí lo hace) | sí |
| W-12 | La fecha del PDF de cotización usa el día UTC: de 18:00 a 23:59 CDMX imprime el día siguiente | sí |
| R-03 | La columna IVA de conceptos de proforma dice "Sí" en conceptos MXN exentos, aunque el cálculo los trata con tasa 0 | sí |
| R-06 | `insertEventoEmbarque` valida con Zod pero inserta el input crudo (se pierde el trim/normalización) | sí |
| N-03 | Las consultas del portal de cliente no filtran `deleted_at` en embarques y cotizaciones | sí (ya cubierto además por RLS en 13.753.0; el filtro explícito sigue siendo correcto) |
| N-04 | `PORTAL_DOCUMENTO_COLUMNS` expone `notas` (campo interno de staff) al portal | sí |
| N-05 | Importación masiva sin tope de filas/peso y con un INSERT por fila (N viajes a la BD) | sí |
| Mensajes | `LC_CANCEL_CON_CXC/CXP` se traducen hablando de "pagos de factura", pero la BD los lanza al cancelar un embarque con facturas vivas | sí |

Con reservas:

- **N-06 (bloqueo optimista)**: el riesgo es real (dos usuarios editando el mismo cliente/cotización) y las tablas sí tienen trigger de `updated_at`, así que la técnica funciona. Pero el parche lo deja a medias: dos `TODO(N-06)` (datos fiscales y notas de crédito) y en `EditarCotizacion` inyecta el `updated_at` clonando el objeto de mutación con un spread, patrón frágil y difícil de mantener.
- **Sanitización anti-fórmula de CSV**: el lugar correcto es la **exportación**, no la importación. Aplicarla al importar guarda comillas simples dentro de los datos del ERP y, en `dias_credito`, un valor como `-5` pasaría a `'-5` y la fila se rechazaría con un mensaje confuso. Recomiendo no aplicar esta parte tal cual.

## Plan de aplicación

### Etapa A — Bugs reales de bajo riesgo
- `savePaso3`: derivar `subtotal` y `moneda` de los conceptos (moneda dominante por monto) en vez de `totalUSD`; actualizar las llamadas del wizard y los tests.
- Encabezado del detalle de cotización: evaluar "sin importe" contra los conceptos, igual que hace el contenido del detalle.
- Barra de totales del wizard: dos márgenes separados (USD y MXN), sin consolidado.
- P&L por contenedor: `margenPct` pasa a `number | null` y la tabla muestra "n/a"; ajustar tests.
- Dashboard: sumar `Llegada` a `Arribo` en el desglose por cliente.
- PDF de cotización: `formatFechaDia` en lugar del recorte UTC.
- Conceptos de proforma: la celda IVA usa la tasa resuelta de la fila (`useTasaIVA` + `resolverTasaConcepto`).
- Eventos de embarque: insertar y bitacorar el objeto validado por Zod.
- Portal: filtrar `deleted_at IS NULL` en lista y detalle de embarques y en cotizaciones; quitar `notas` de las columnas de documentos y de los componentes que la leen.
- Textos de `LC_CANCEL_CON_CXC/CXP` alineados a la causa real (cancelación de embarque).

Extra que detecté y no viene en el parche: `PORTAL_COTIZACION_DETAIL_COLUMNS` también expone `notas` de la cotización (nota interna). Lo reviso en esta etapa y lo quito si la UI del portal no lo usa.

### Etapa B — Importación masiva
- Topes en `useBulkImport`: 2 MB y 1000 filas, con mensaje claro de "divide la carga".
- Inserción por lotes de 200 para clientes y proveedores, con reporte de cuántos quedaron insertados si un lote falla.
- **Sin** la sanitización anti-fórmula en importación. Si quieres cubrir ese riesgo, lo hago después en el punto correcto: al generar CSV de exportación.

### Etapa C — Bloqueo optimista (N-06)
Lo dejo para una tercera pasada, hecho completo en vez de a medias:
- Un helper único (`conflictoConcurrenciaError` + verificación de "0 filas afectadas") en `src/lib/errors`.
- Aplicado a cliente y cotización propagando el `updated_at` como parámetro normal del hook de mutación (sin clonar objetos de mutación), y con mensaje traducible `LC_CONFLICTO_CONCURRENCIA`.
- Datos fiscales y notas de crédito se incluyen sólo si su diálogo ya carga el `updated_at`; si no, se quedan fuera en lugar de dejar `TODO`s.

## Detalles técnicos

- El guard de BD `_cotizaciones_bloquear_envio_sin_importes` ya evalúa `cotizacion_totales_conceptos` (USD y MXN), así que el bloqueo actual del botón es puramente de frontend: confirma que W-01 es un falso bloqueo, no una protección.
- `clientes`, `cotizaciones` y `proveedores` tienen trigger `update_*_updated_at`, requisito del bloqueo optimista de la Etapa C.
- Cambiar `margenPct` a `number | null` toca el tipo `FilaPnlContenedor`; hay que revisar todos los consumidores (tabla por moneda, exportaciones y PDFs) para que no impriman "null".
- Derivar `moneda` en `savePaso3` afecta lo que ve el PDF y el portal; en cotizaciones mixtas se usará la moneda con mayor monto y el subtotal de esa moneda (los conceptos siguen mostrando ambas).
- Cada etapa cierra con `lint`, `tsgo`, tests afectados y bump de `APP_VERSION` + `CHANGELOG.md`.
