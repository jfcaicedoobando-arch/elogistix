# Auditoría Palette de todo el ERP (con subagentes)

Objetivo: aplicar el prompt Palette adaptado (pulir UX/accesibilidad, sin features nuevas) a los 36 módulos del ERP, repartido entre subagentes en paralelo.

## Fase 1 — Auditoría (solo lectura, subagentes en paralelo)

Seis subagentes, cada uno con un grupo de módulos:

1. Ventas: crm, cotizacion, proformas, facturacion, cobranza, cxc
2. Compras y dinero: compras, cxp, anticipos-proveedor, tesoreria, comisiones, presupuesto, profit
3. Operación: embarques, operaciones, expediente, costeo, bandejas, catalogos
4. Portales: portal, portal-agente, cliente, proveedor, onboarding, auth, legal, marketing
5. Gestión: admin, configuracion, auditoria, dashboard, dashboardEjecutivo, reportes, notificaciones, search, dev
6. Compartidos: src/components (shared, ui, layout)

Cada subagente busca, con archivo y línea:
- Botones de solo ícono sin nombre (aria-label), incluidos los que no usan size="icon"
- Campos de formulario sin etiqueta asociada
- Clics en div/span sin teclado
- Colores fijos en vez de tokens del diseño
- Textos en inglés o mensajes de error técnicos visibles al usuario
- Estados vacíos, de carga y de error ausentes en tablas
- Encabezados saltados, varios main, h-screen

Entrega: lista por severidad (Crítico / Advertencia / Info) con archivo:línea y la corrección sugerida.

## Fase 2 — Reporte para ti

Te muestro un resumen agrupado por módulo y severidad, en lenguaje sencillo, y eliges qué corregir (sugerido: primero los críticos).

## Fase 3 — Correcciones (después de tu visto bueno)

- Cambios pequeños, sin tocar lógica de negocio, importes, mocks ni base de datos.
- Respetar ≤200 líneas por archivo, tokens del design system, español de México.
- Por módulo: typecheck y pruebas solo de los archivos tocados.
- Registrar aprendizajes en `.Jules/palette.md`.
- Sin cambiar versión ni changelog; CI/RLS completos quedan para GitHub Actions.

## Detalles técnicos

- Subagentes de exploración en modo lectura (Fase 1), lanzados en paralelo.
- Las ediciones de la Fase 3 las hago yo, por lotes de módulo.
