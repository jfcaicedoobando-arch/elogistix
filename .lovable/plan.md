## Objetivo
Verificar que las pantallas y modales clave de Libre Carga se vean completos y usables en laptops Full HD (1920×1080 con barra de Windows + chrome de navegador → viewport efectivo ~1920×937). Detectar cortes, scroll faltante, modales que exceden viewport, tablas con overflow horizontal, sidebars que comen ancho, y similares.

## Enfoque
Lanzar varios subagentes **read-only en paralelo** que naveguen la app vía `browser--view_preview` con viewport fijo 1920×937, ejecuten flujos críticos, tomen screenshots y reporten hallazgos con archivo:línea sugerido para fix. Yo consolido los reportes en un solo informe accionable.

Cada subagente recibe:
- Credenciales/contexto de sesión (el usuario ya está logueado en el preview)
- Viewport obligatorio: 1920×937
- Checklist de qué validar (modal cortado, scroll interno, footer visible, overflow horizontal, sidebar/topbar)
- Instrucción de adjuntar screenshot por hallazgo

## Subagentes propuestos (5 en paralelo)

1. **Auditor Operaciones**
   - Rutas: `/`, `/embarques`, detalle de embarque, wizard nuevo embarque (todos los pasos), `/operaciones`
   - Foco: tablas anchas, timeline, modales de edición de embarque, wizard

2. **Auditor Catálogos (Clientes y Proveedores)**
   - Rutas: `/clientes`, detalle de cliente, modal nuevo/editar cliente, `/proveedores`, detalle, modal nuevo/editar proveedor (incluido el caso reportado hoy)
   - Foco: modales de alta/edición, sección de contactos, sección de documentos

3. **Auditor Financiero**
   - Rutas: `/cotizaciones`, wizard de cotización, `/facturacion`, `/tesoreria`, modales de cobros/pagos, liquidaciones
   - Foco: tablas con muchas columnas (montos, divisas), modales de conceptos

4. **Auditor Configuración y Usuarios**
   - Rutas: `/configuracion`, `/usuarios`, modal nuevo usuario, `/seguridad`, gestión de roles, puertos, tarifas
   - Foco: formularios largos, listados paginados

5. **Auditor Portal Cliente y Auth**
   - Rutas: `/login`, `/portal-cliente` (si aplica), `/cambio-password`, dashboards de cliente
   - Foco: layout responsivo, hero, gráficos stacked

## Criterios de hallazgo
Cada item reportado debe incluir:
- Ruta + acción para reproducir
- Captura
- Tipo: `modal-cortado` | `overflow-horizontal` | `scroll-faltante` | `footer-oculto` | `texto-truncado` | `sidebar-tapando` | `otro`
- Severidad: alta (bloquea uso) / media (incómodo) / baja (cosmético)
- Archivo y línea sugeridos para el fix (si el subagente puede inferirlo del código)

## Entregable
Un informe único en chat con tabla agrupada por severidad. **No se hacen fixes en este turno** — al final pregunto al usuario cuáles atacamos primero (todos los de severidad alta, una pantalla específica, etc.).

## Notas
- Solo lectura: ningún subagente modifica datos. Se evitarán acciones destructivas (eliminar, guardar cambios reales) salvo abrir modales y cerrarlos.
- Si el browser falla al iniciar para algún subagente, ese subagente reporta "no disponible" y continúa con análisis estático del código de sus rutas.
- No se actualizará `APP_VERSION` ni `CHANGELOG.md` (auditoría, no cambio de código).