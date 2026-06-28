## 3ª pasada de auditoría visual (1920×1080)

Capturar screenshots frescos en Full HD de las rutas clave **después** de los lotes A y B, y reportar únicamente hallazgos nuevos o residuales. Sin cambios de código en esta fase — primero ver, luego decidir.

### Alcance

12 rutas, todas a 1920×1080:

1. `/` (Inicio)
2. `/embarques` (lista, validar altura tras pageSize=50)
3. `/embarques/:id` (detalle, tabs reordenados)
4. `/cotizaciones` (validar altura tras pageSize=50)
5. `/clientes` (validar `max-w-sm` del buscador)
6. `/facturacion` (validar tabs underline + `space-y-6`)
7. `/cxp` (comparación con Facturación)
8. `/bandejas/facturacion-por-emitir`
9. `/bandejas/cartera`
10. `/auditoria`
11. `/usuarios`
12. `/configuracion`

### Proceso

1. **Subagente A — Captura**: Playwright headless, viewport 1280×1800 (lo más cercano a 1920×1080 que permite la herramienta sin full_page). Login con sesión inyectada, navegar a cada ruta, esperar red ociosa, screenshot completo del viewport. Guardar en `/tmp/browser/audit3/screenshots/`.

2. **Subagente B — Análisis**: Revisar las 12 imágenes con criterio de Auditor Senior UI/UX. Reportar sólo hallazgos **nuevos** (no repetidos de las pasadas 1 y 2). Clasificar por severidad (Crítico / Alto / Medio / Bajo) con: ruta, descripción, evidencia visual (coordenadas), causa probable, fix sugerido.

3. **Reporte consolidado**: Te entrego la lista en chat. Tú decides qué corregir y en qué orden antes de pasar a build mode.

### Criterios de evaluación

- Jerarquía visual y consistencia de headers
- Alineación, spacing y ritmo vertical (`space-y-6`)
- Densidad de información y uso de scroll
- Estados de tabs/buttons/badges
- Contraste WCAG AA
- Comportamiento de tablas (anchos de columna, paginación visible)
- Tokens semánticos (sin colores hardcodeados visibles)

### Fuera de alcance

- Cambios de código (esto es sólo descubrimiento).
- A11y (focus rings, teclado, aria) — eso sería una auditoría separada.
- Mobile.
- Lógica de negocio.

### Entregable

Lista priorizada de hallazgos nuevos con propuesta de remediación, lista para aprobar el siguiente lote de fixes.
