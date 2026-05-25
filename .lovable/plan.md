
## Objetivo

Convertir el CRM de "conjunto de pantallas" a un **workflow comercial real**, atacando primero lo crítico (dashboard útil, asignación de owner, linaje, recordatorios) y luego configuración + bulk + visualizaciones.

Se propone en 3 sprints. Cada uno es entregable de forma independiente — el usuario decide cuáles ejecutar y en qué orden.

---

## Sprint A — Dashboard real + workflow básico (alto impacto, bajo riesgo)

**1. CRM Dashboard real**
- Eliminar tarjeta "Próximas fases".
- Nuevos widgets: *Mis actividades de hoy*, *Oportunidades a cerrar esta semana*, *Leads sin contactar > 7 días*, *Top 5 deals abiertos*, *Mini-embudo* (conteo por etapa).
- KPIs existentes se mantienen.

**2. Asignación automática de owner**
- Al crear un lead/oportunidad sin `vendedor_id`, default = usuario actual si tiene rol vendedor o admin.
- En el form de NuevoLead/NuevaOportunidad agregar selector "Vendedor asignado" (admin/operador puede asignar a otros).

**3. Linaje visible**
- En `OportunidadDetalle`: card con "Lead origen" (link) si `lead_id` existe, y lista de cotizaciones con `oportunidad_id = self` (estado + monto + link).
- En `LeadDetalle`: card "Oportunidad convertida" (link) si existe.

**4. Recordatorios / actividades vencidas**
- Badge rojo en el tab "Actividades" del CrmLayout cuando hay vencidas para el usuario.
- Badge en sidebar global junto a "CRM".
- En `Actividades.tsx`, fila pintada en rojo claro si `fecha_programada < now()` y no completada.

**5. Acciones inline en actividad**
- Botón "Completar" en cada fila (one-click).
- Botón "Posponer 1 día" / "Posponer 1 semana".

**Impacto:** el módulo ya se siente "vivo" — el vendedor sabe qué hacer al entrar.

---

## Sprint B — Configuración + bulk + filtros (poder operativo)

**6. Configuración de pipeline (UI admin)**
- Nueva ruta `/crm/configuracion` (oculta para vendedor): CRUD de etapas (nombre, orden, color, probabilidad default, tipo abierta/ganada/perdida), motivos de pérdida y cuotas mensuales por vendedor.

**7. Bulk actions en Leads**
- Selección múltiple en la tabla.
- Acciones: reasignar vendedor, cambiar estado, eliminar (con doble confirmación).

**8. Filtros en Oportunidades**
- Filtros por: vendedor, etapa, rango de cierre, rango de monto.
- Persistir en URL vía nuqs (consistente con Embarques/Cotizaciones).

**9. Importación CSV de leads**
- Botón "Importar" en `/crm/leads` con upload + preview + validación + inserción en bloque.

**10. Datos accionables en detalle**
- Email → `mailto:`, teléfono → `tel:`, botón copiar.

---

## Sprint C — Visualización + automatizaciones (refinamiento)

**11. Gráficos**
- Forecast: barras stacked por mes (pipeline / ponderado / ganado) con Recharts.
- Reportes: embudo de conversión, donut de motivos de pérdida, ranking de vendedores vs. cuota.

**12. Eventos del sistema como actividades**
- Trigger DB que inserta una `crm_actividades` tipo "nota" cuando:
  - Una oportunidad cambia de etapa.
  - Un lead se convierte.
  - Se crea una cotización desde una oportunidad.

**13. Pre-llenado mejorado al crear cotización**
- Copiar origen/destino/modo/tipo_carga de la oportunidad → cotización.

**14. Búsqueda global (Ctrl+K)**
- Extender `useGlobalSearch` para incluir leads y oportunidades.

**15. Notas con historial en oportunidad**
- Sub-tabla `crm_oportunidad_notas` (o usar `crm_actividades` tipo "nota") con timeline cronológica en el detalle.

---

## Notas técnicas

- Sin cambios destructivos de schema; sólo se agregaría una columna/trigger en Sprint C.
- Todo respeta RLS existentes (`Vendedor own crm_*` ya filtra por `vendedor_id`).
- Componentes ≤200 líneas, sin `any`, paginación servidor donde aplique (regla Power of 10).
- Versionado: Sprint A → 11.3.0, B → 11.4.0, C → 11.5.0.

## Pregunta

¿Ejecutamos sólo **Sprint A** ahora (lo más urgente y visible) o quieres definir un orden distinto / agregar/quitar puntos?
