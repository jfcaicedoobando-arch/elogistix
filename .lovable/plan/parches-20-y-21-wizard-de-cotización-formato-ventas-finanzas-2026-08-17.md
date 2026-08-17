# Parches 20 y 21 — Wizard de cotización + formato ventas/finanzas

Dos parches del lote 2. Los probé en seco contra el código actual: el 21 aplica casi limpio, el 20 tiene varios choques porque parte del trabajo ya existe en el proyecto (por ejemplo `campoParaErrorPaso1` ya vive en `scrollToErrorSection.ts`) y porque refactorizamos archivos por la regla de 200 líneas.

## Qué se gana

**Parche 20 — Wizard de cotización (VF-09, VF-10, VF-16, VF-18, VF-19, VB-34)**
- Validación inline real en el Paso 1: al fallar el guardado, los campos que rechaza el esquema (Modo, Tipo, Incoterm, Descripción, Origen, Destino, Cliente) se marcan en rojo y se limpian al corregir.
- Controles con error se dibujan con borde/anillo rojo (`aria-invalid`) en los tokens de campo compartidos.
- Checklist lateral del Paso 1 muestra "Falta: Cliente, Tarifa".
- Asterisco en "Validez de la propuesta" (sí bloquea en marítimo); Sector Económico se queda sin asterisco porque no bloquea.
- KPI del listado se renombra a "Total cotizaciones (30 días)" y se aclara que no depende de los filtros.
- El subtexto rojo "Vencida" sólo aparece en estados donde es accionable (Enviada/Aceptada), ya no en "En operación".

**Parche 21 — Formato en ventas y finanzas**
- Copy en mayúscula tipo oración en menú lateral (Panel admin, Comparador top 3, Navieras (condiciones)).
- Números alineados (`tabular-nums`) en columnas y gráficas de cotizaciones, compras, facturación y Kanban CRM.
- Ajustes de proyección de cierre y etiquetas de meses.

## Cómo lo aplico

1. Aplicar el parche 21 con resolución manual del único choque (`proyeccionFacturacion/meses.ts`).
2. Aplicar el parche 20 hunk por hunk; en los choques (Destinatario, Datos generales, Paso1ProgressSidebar, usePaso1Handlers) reescribo el cambio a mano sobre el código actual y **omito** lo que ya está implementado, sin duplicar helpers.
3. Mantener la regla de 200 líneas por archivo: si algún archivo se pasa, extraigo subcomponente/helper hermano.
4. Verificar: `tsgo` (tipos), lint, pruebas de `cotizacion` y `facturacion`, y auditorías de arquitectura.
5. Revisar visualmente el Paso 1 del wizard y el listado de cotizaciones en el preview.
6. Subir `APP_VERSION` a **13.643.0** y registrar la entrada en `CHANGELOG.md`.

## Notas técnicas

- Archivos tocados (aprox. 20): `src/components/ui/field.tokens.ts`, `src/components/layout/sidebarItems.ts`, secciones y columnas de `src/features/cotizacion/**`, `src/features/cxp/routes/Compras*`, `src/features/facturacion/**`, `src/features/crm/components/kanban/ColumnaEtapa.tsx`.
- Los parches traen pruebas nuevas (`handlePaso1Crm.test.ts`, `useCotizacionWizardSteps.test.tsx`, `proyeccionFacturacion.test.ts`); las conservo y ajusto si el código final difiere del que asumía el parche.
- No hay cambios de base de datos ni de lógica de negocio: sólo presentación, validación inline y copy.
