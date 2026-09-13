# Ronda de auditoría: 10 correcciones mínimas

Una sola tanda, sin features nuevas. Abajo lo que cambia por hallazgo y las decisiones que asumo.

## 1. Cancelados ya no se cuentan como Arribo (P1)
En los tres cálculos de tablero (dirección, resumen y operaciones) un expediente **Cancelado** con fecha de llegada pasada se convertía en "Arribo" y seguía apareciendo en conteos y alertas. Se agrega la rama explícita que conserva "Cancelado" antes de deducir el estado por fechas. No se toca ningún dato del expediente ELIMP00353.

## 2. Un expediente enviado a la papelera ya no se puede abrir (P1)
Hoy, con el enlace directo, ELIMP00293 (eliminado) abre su ficha completa. Se exige "no eliminado" en los dos caminos de lectura (la función de servidor y la consulta directa) y la pantalla responde "no encontrado".

## 3. Expediente duplicado deja de fallar con error genérico (P1)
Hay dos expedientes vivos con el folio ELIMP00006. Al abrir por folio se ignoran los eliminados y, si aún quedan varios, se muestra un mensaje claro en español: "Hay más de un expediente con ese folio. Ábrelo desde el listado." (código de dominio `LC_EXPEDIENTE_AMBIGUO`).

## 4. Selector de periodo en Operaciones (P1/P2) — decisión: se retira
El selector "Este mes / Últimos 3 meses / Año" no filtraba nada: la pantalla mostraba siempre los mismos números. Bajo YAGNI se **quita el selector** en lugar de construir el filtrado en el servidor. Si más adelante se quiere el filtro real, se abre como tarea propia.

## 5. Contenedores (TEU) contaba expedientes (P1)
Mostraba "3 / 150" cuando los 3 expedientes activos tienen 5 contenedores. Ahora se cuentan los contenedores realmente registrados y se convierte a TEU con la regla explícita:

- 20 pies = 1 TEU
- 40 y 45 pies = 2 TEU
- contenedor sin tipo identificable = 1 TEU
- expediente activo sin contenedores registrados = 0

La tarjeta pasa a decir "Contenedores (TEU)" con el total en TEU y el conteo físico en el detalle.

## 6. El detalle de cotización se queda obsoleto entre pestañas (P2)
Una pestaña vieja seguía mostrando "Aceptada" y el botón "Crear embarque" cuando la cotización ya estaba "En operación" y con expediente creado. Cambios: el detalle se vuelve a consultar al regresar el foco a la pestaña, y el botón de conversión se oculta cuando la cotización ya tiene expediente.

## 7. Tarjetas de Operaciones recortadas en 1280x720 (P2)
Cinco tarjetas en una fila cortaban textos ("Contenedore...", "Utilidad US..."). Se ajusta la rejilla para que envuelvan antes de truncar y el texto completo queda disponible al pasar el cursor. Mismo contenido.

## 8. Encabezado de Cotizaciones trunca el título (P2)
Las acciones compiten por la misma línea. Se permite que las acciones bajen de línea antes de recortar el título y su contador.

## 9. Pestañas del detalle de expediente sin señal de scroll (P2)
Con 11 pestañas (Facturación, Conciliación, Utilidad, Cierre entre ellas) las últimas quedaban fuera de vista. Se agrega degradado y flechas de desplazamiento; no se quita ninguna pestaña.

## 10. Captura de factura recibida: fallar cerrado (P2)
Si la consulta de "costos ya facturados" falla, hoy se pre-marcan todos los costos y se generan vínculos duplicados. Ahora no se pre-marca nada, se muestra un aviso con botón de reintento y la captura queda sin vínculos hasta que la consulta funcione.

## Detalle técnico

- **Base de datos**: una sola migración `CREATE OR REPLACE` para `dashboard_details_datos`, `dashboard_summary_datos`, `operaciones_stats` y `get_embarque_full`. Se preservan firma, `STABLE`, `SECURITY DEFINER`, `SET search_path`, `org_scope()` y grants. `operaciones_stats` agrega un CTE `contenedores_por_embarque` sobre `embarque_contenedores` (izquierda) con `teu` derivado de `tipos_contenedor.nombre`/`embarque_contenedores.tipo`; `contenedores`/`totalContenedores` pasan a `sum(teu)`. Espejos canónicos en `supabase/schema/**` sincronizados 1:1 + guard SQL registrado en `supabase/tests/_guards_manifest.txt`.
- **Front**: `detalle.ts` (filtro `deleted_at`, resolución de folio, `LC_EXPEDIENTE_AMBIGUO` en `lcCodeMessages`), `useOperacionesData.ts` + `useOperacionesPageController.ts` + `Operaciones.tsx` (sin periodo, KPI grid), `PageHeader.tsx` (wrap de acciones), barra de tabs del detalle de embarque, detalle de cotización (`refetchOnWindowFocus` puntual + gate por `embarque_id`), `usePrefillVinculosEntrante.ts` (fail-closed con estado de error y reintento).
- **Pruebas enfocadas nuevas**: regresión SQL de `Cancelado` en los tres cálculos; `detalle.test.ts` (eliminado → null, folio ambiguo → error); TEU con expediente multi-contenedor; periodo eliminado del `queryKey`; gate de conversión con embarque vinculado; `PageHeader` sin truncado prematuro; prefill fail-closed.
- **Cierre**: bump `APP_VERSION`, entrada en `CHANGELOG.md`, `db:release-manifest:update` + `audit:manifest`, `audit:replay-mirror`, `db:baseline:check`, typecheck y lint focalizado. CI/RLS/E2E completos quedan para GitHub Actions. Sin publicar.
