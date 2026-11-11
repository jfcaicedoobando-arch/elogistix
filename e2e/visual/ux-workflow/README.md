# Fixture local UI/UX de workflow

Sirve componentes reales de la rama actual con datos sintéticos: ruta `Facturacion`
(incluido su encabezado y botón), `FacturasMasivasToolbar` con una factura seleccionada,
`EmbarquesSortIndicator` y `EmbarquesAlertasPanel`. Los controles de ordenar, filtrar,
expandir alertas y selección sólo cambian estado local. La confirmación de reenvío es
el diálogo real, con efecto simulado. El botón de nueva factura abre un diálogo ficticio.

No carga `.env`, `public/`, bootstrap de aplicación, cliente Supabase ni SDK Sentry.
Los hooks, consultas, dashboard, bandejas y diálogos fiscales se reemplazan en la
configuración de este fixture, sin modificar `src`. El build rechaza dependencias
de backend. La política CSP bloquea conexiones y formularios; fetch/XHR/WebSocket/
sendBeacon también lanzan error. Sólo se permiten activos estáticos de la vista local.

Desde la raíz del repositorio:

```sh
node node_modules/vite/bin/vite.js build --config e2e/visual/ux-workflow/vite.config.ts
node node_modules/vite/bin/vite.js preview --config e2e/visual/ux-workflow/vite.config.ts
```

URL: `http://127.0.0.1:8097/`. Opcionales: `?theme=dark`, `?fontPercent=150`.
Usar preview del build, no el servidor de desarrollo: así no se inyectan HMR ni
clientes de desarrollo que intenten abrir conexiones. Puerto fijo 8097.

Verificar 390 px y escritorio: título y botón Facturación, barra de acciones, modal
de reenvío, orden móvil, expansión/contracción de alertas. Esto valida presentación
e interacciones locales, no consultas reales, permisos de producción, envío de correo,
descarga de archivos ni emisión fiscal. No reproduce sidebar ni todos los datos de ERP.
El build queda en `test-results/ux-workflow-fixture`, ignorado por Git.
