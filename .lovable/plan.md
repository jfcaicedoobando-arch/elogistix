# Auditoría visual mobile — Libre Carga

## Objetivo
Recorrer las rutas clave de la app en viewport móvil (375×812, iPhone-like) y reportar hallazgos visuales: overflow horizontal, tap targets <44px, texto cortado, tablas que rompen, modales sin scroll, headers que tapan contenido, contraste, sidebar/FAB superpuestos, formularios con campos apretados, etc. **Solo auditoría — no se modifica código en esta fase.** Las correcciones se planifican después según prioridad.

## Cómo se ejecuta
Lanzo 5 sub-agentes Playwright en paralelo (`acp_subagent--spawn_agent`), cada uno con sesión Supabase pre-minteada y viewport `390×844`. Cada sub-agente:

1. Restaura sesión (`LOVABLE_BROWSER_SUPABASE_SESSION_JSON`).
2. Navega su lote de rutas, espera `networkidle`, toma screenshot `viewport-only` (NUNCA `full_page`).
3. Inspecciona DOM: `document.documentElement.scrollWidth > innerWidth` (overflow-x), botones con `getBoundingClientRect()` < 44px, elementos con `position:fixed` que ocluyan el `<main>`, tablas sin scroll wrapper.
4. Devuelve JSON estructurado: `{ruta, screenshot_path, hallazgos:[{tipo, severidad, selector, descripcion}]}`.

Yo consolido los 5 reportes en un único informe markdown ordenado por severidad.

## Lotes de rutas

```text
Lote A — Marketing & Auth (público)
  /  /login  /legal/seguridad  /legal/privacidad  /legal/terminos
  /recursos/guia-puertos-mexico

Lote B — Dashboard & Operación
  /inicio  /embarques  /embarques/:id (uno de demo)
  /cotizaciones  /cotizaciones/nueva  /tracking

Lote C — Finanzas
  /facturacion  /cxc  /cxp  /tesoreria/cuentas  /tesoreria/flujo
  /profit/dashboard  /profit/estado-resultados

Lote D — Catálogos & Config
  /clientes  /clientes/:id  /proveedores  /puertos
  /configuracion  /usuarios

Lote E — Auditoría, Portal cliente, Admin
  /auditoria  /admin/auditoria  /portal/inicio  /portal/embarques
  /bandejas  /notificaciones
```

## Entregable
Informe markdown con:
- **Resumen ejecutivo** (#hallazgos por severidad).
- **Top issues bloqueantes** (overflow horizontal, tap targets críticos, contenido inaccesible).
- **Tabla por ruta** con screenshot + hallazgos.
- **Recomendaciones priorizadas** (P0/P1/P2) listas para implementar en un siguiente plan.

## Fuera de alcance
- No se modifican archivos.
- No se audita escritorio/tablet (solo mobile, como pidió el usuario).
- No se valida lógica de negocio ni accesibilidad WCAG completa (solo signals visuales rápidos).

¿Apruebas que lance los 5 sub-agentes con este recorrido?
