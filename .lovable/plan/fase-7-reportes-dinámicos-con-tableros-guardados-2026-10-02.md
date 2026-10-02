# Fase 7 — Reportes dinámicos con tableros guardados

## Qué vas a ver
- Una pantalla nueva **CRM → Reportes** con tableros guardados. Cada tablero es una página con tarjetas (reportes) que se acomodan en cuadrícula.
- El **super admin** crea tableros y reportes; **todos los usuarios del CRM de la empresa los ven** (solo lectura).
- Cada reporte se arma eligiendo:
  - **Objeto:** Empresas, Oportunidades, Actividades o Solicitudes a Pricing.
  - **Medida:** conteo de registros (y en Oportunidades también suma de monto estimado en USD).
  - **Agrupación:** según el objeto (etapa, vendedor, fuente, estado, complejidad, puntaje A/B/C, mes de creación, etc.).
  - **Filtro:** opcional (rango de fechas de creación, etapa, vendedor).
  - **Gráfica:** barras, línea, pastel, número grande o tabla de datos.
- Los datos se calculan al momento de abrir el tablero: siempre reflejan la información vigente.

## Ejemplos de lo que podrás armar
- «Oportunidades por etapa» (barras), «Monto por vendedor» (barras), «Empresas por puntaje» (pastel).
- «Actividades por semana» (línea), «Solicitudes a Pricing por estado» (número + tabla).

## Cómo funciona
- Cada empresa tiene sus propios tableros; nadie ve los de otra empresa.
- El super admin edita; el resto solo consulta.
- Los reportes respetan los permisos de cada quien: un vendedor ve los mismos datos que vería en las listas del CRM.

## Detalles técnicos
- Tablas nuevas: `crm_tableros` (nombre, orden) y `crm_reportes` (tablero_id, nombre, objeto, medida, agrupación, filtro JSON, tipo de gráfica, posición). RLS por `organization_id` con `rls_tenant_scope_ok`: leen miembros de la org, escribe solo `has_role(super_admin)`. GRANTs incluidos.
- RPC `crm_reporte_datos(p_reporte_id uuid)` SECURITY DEFINER acotada a `org_scope()`: agregación de solo lectura con agrupaciones y medidas en lista blanca (sin SQL dinámico del cliente); devuelve filas `{etiqueta, valor, extra}`.
- Frontend: `services/reportes/` (I/O + tipos), `hooks/useReportesCrm.ts`, `components/reportes/` (TarjetaReporte con las 5 gráficas vía recharts, editor de reporte, editor de tablero), ruta `/crm/reportes` y pestaña en `CrmLayout`.
- Validación: tsgo, eslint y pruebas focalizadas; `db:postcheck` + baseline. Sin publicar ni cambiar versión.
