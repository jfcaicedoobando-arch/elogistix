
# Plan — Manual de uso CRM (PDF condensado-completo, 12-20 págs)

## Estructura

**Portada** (1 pág) — Título, versión 11.51.0, fecha, logo.

**Parte 1 · Vendedor** (~9 págs)
1. Visión general y navegación (sidebar, subheader, atajos N/L/O/A, Cmd+P)
2. **Mi Día** — flujo recomendado (NBA, Hoy, Esta semana, Pipeline)
3. **Leads** — crear (Popover N→L), tabla con edición inline, importar CSV, conversión a oportunidad (Sheet rápido + Más campos)
4. **Oportunidades** — lista vs Kanban, mover etapas con Undo (5s), filtros colapsables, ganar/perder
5. **Detalle de oportunidad** — Resumen / Comunicación / Trazabilidad, contacto rápido, cotizaciones
6. **Actividades** — quick-create, completar inline, posponer 1d/3d/1sem, notas en Sheet, vencidas
7. **Analítica** — embudo, conversión, pérdidas, forecast, leaderboard
8. **Atajos y trucos** — tabla de hotkeys, búsqueda global, tips de productividad

**Parte 2 · Admin** (~6 págs)
9. Roles y permisos (membresía organizacional)
10. **Configuración → Pipeline** — etapas, probabilidades, automatizaciones
11. **Configuración → Motivos de pérdida** — alta/baja
12. **Configuración → Plantillas de mensaje** — variables, contextos
13. **Importación CSV** de leads (formato, validaciones)
14. Bitácora / auditoría

**Cierre** (1 pág) — FAQ breve, soporte, changelog resumido.

## Capturas

Tomar 8-10 screenshots clave del preview en https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app:
- `/crm/mi-dia`, `/crm` (Resumen), `/crm/leads`, `/crm/oportunidades` (lista + kanban), Detalle oportunidad, `/crm/actividades`, `/crm/analitica`, `/crm/configuracion`, Quick-create popover abierto, Cmd+P palette.

Las capturas se enmarcarán con bordes finos y leyenda; sin product-shot porque agrega peso.

## Implementación técnica

- Generador: **ReportLab** (Python) — control fino de layout, tablas, badges y portada.
- Tipografía: Helvetica (built-in). Tamaños: H1 22pt, H2 16pt, body 10.5pt, caption 8.5pt.
- Paleta: Primario `#1B2B4B`, Accent `#2563EB`, gris `#64748B`, fondo cards `#F8FAFC`.
- Tamaño: US Letter, márgenes 1.8cm.
- Cada sección arranca con un mini-banner navy + título blanco para identidad visual.
- Tablas para "Atajos", "Próximos pasos", "Reglas de Next Best Actions".
- Footer con número de página y "Libre Carga CRM · v11.51.0".
- Salida: `/mnt/documents/manual-crm-libre-carga-v11.51.0.pdf`.
- QA: convertir a JPGs (`pdftoppm -r 150`) e inspeccionar cada página antes de entregar; iterar fixes si hay overflow/clipping.

## Fuera de alcance

- Traducción a inglés (es-MX único).
- Embeber video o GIFs.
- Versiones por organización (manual genérico de producto).
