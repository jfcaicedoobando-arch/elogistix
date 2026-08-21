# Auditoría visual UI/UX — solo reporte

Recorrido visual de las 12 rutas core en 1440px y 768px, modo claro. Sin cambios de código: la entrega es un documento de hallazgos priorizados con capturas.

## Qué se audita

Rutas core: `/inicio`, `/embarques`, `/cotizaciones`, `/proformas`, `/facturacion`, `/compras`, `/cxp`, `/cartera`, `/tesoreria`, `/clientes`, `/proveedores`, `/crm/pipeline`.

Categorías (según tu checklist):

1. Consistencia visual — paleta, tipografía, iconografía, radios/sombras/divisores, estados vacíos.
2. Layout y espaciado — alineación de rejilla, tokens de spacing, overflow horizontal, capas (z-index).
3. Componentes — botones, inputs, tablas, navegación, modales, selectores de fecha y dropdowns.
4. Micro-interacciones — hover, skeletons vs spinners, estados deshabilitados, transiciones.
5. Bugs visuales — truncado, assets, scrollbars dobles, salto de contenido al cargar.
6. Accesibilidad visual — contraste, anillos de foco, tamaño de áreas táctiles.

## Cómo se ejecuta

1. **Barrido de código** (ya iniciado): búsqueda de desvíos del design system — colores fuera de token, tamaños de texto arbitrarios, `<table>` crudas, modales sin `FormDialogShell`/tokens de ancho, `style={{}}` estático, `h-screen` en vez de `h-dvh`, botones de ícono sin `aria-label`, estados vacíos ad-hoc.
2. **Recorrido con navegador**: sesión autenticada, captura de cada ruta en 1440×900 y 768×1024; se registran errores de consola y se mide overflow horizontal de `<main>` y del documento por ruta.
3. **Inspección de detalle**: capturas de elemento (encabezados, barras de filtros, encabezados de tabla, fila con hover, paginación, estado vacío) para comparar el mismo componente entre módulos.
4. **Contraste y foco**: verificación de pares texto/fondo sospechosos y recorrido con teclado (Tab) en una ruta representativa para confirmar anillos de foco visibles.

## Entrega

`docs/auditoria/visual-uiux-2026-08-21.md` con:

- Resumen ejecutivo: conteo por severidad (Critical / Major / Minor).
- Tabla de hallazgos, cada uno con: Ubicación (módulo/página/componente), Severidad, Categoría, Problema, Esperado, Evidencia (nombre de captura).
- Orden de prioridad: bugs visuales críticos → inconsistencia de componentes → estados faltantes → espaciado/alineación → animación.
- Sección final "Plan de remediación sugerido" agrupando los hallazgos en olas, para aprobar en un turno posterior.

Capturas en `docs/auditoria/visual-uiux-2026-08-21/` (una por ruta y viewport, más las de detalle referenciadas).

## Notas técnicas

- Playwright headless, `locale=es-MX`, esperando `networkidle` y el heading de cada página antes de capturar; animaciones deshabilitadas para evitar diffs por ruido.
- No se tocan `src/`, migraciones, `APP_VERSION` ni `CHANGELOG.md` en esta entrega (es auditoría, no cambio funcional).
- Los hallazgos que ya cubren las suites existentes (`e2e/specs/27-visual-regression`, `scripts/visual-audit/`) se marcan como "cubierto por regresión" para no duplicar trabajo.
- Fuera de alcance por tu indicación: modo oscuro, viewports 1024/375, rutas de admin/portales/costeo/presupuesto, y cualquier verificación de datos o reglas de negocio.
