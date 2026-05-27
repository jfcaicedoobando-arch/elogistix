## Auditoría de los 68 hallazgos de paginación + revisión preventiva (180-200 líneas)

### Parte A — Triaje de los 68 hallazgos sin `.range()/.limit()/.single()`

La heurística marca cualquier `.from().select()` sin esos modificadores. La mayoría son falsos positivos (queries por PK, agregados, catálogos acotados). Se clasifican en 3 categorías:

**Categoría 1 — Falso positivo (no requiere acción)**
- Queries por `id`/PK que devuelven 0-1 fila pero no usan `.single()` (devuelven array). Ej: `services/cliente/relacionados.ts`, `services/embarque/queries/conceptos.ts`, `services/embarque/queries/colaterales.ts`.
- Queries hijas de un embarque/cotización/cliente concreto (limitadas por FK). Ej: `services/embarque/eventos.ts`, `services/embarque/queries/expedientes.ts`, `services/embarque/queries/proveedores.ts`, `services/proforma/queries.ts`, `services/portal/queries.ts`.
- Counts / agregados (`select('id', { count: 'exact' })` o similares). Ej: `services/admin/stats.ts`, `services/auditoria/index.ts` agregados.
- `.maybeSingle()` (la heurística no lo reconoce). Ej: posibles en `services/configuracion`, `services/cliente-usuarios`.

**Categoría 2 — Catálogo acotado (documentar + tope defensivo opcional)**
- `services/catalogos/index.ts` (puertos, países, monedas — datasets conocidos < 1k).
- `services/planes/index.ts` (planes SaaS — < 20 filas).
- `services/configuracion/index.ts` (config global — 1 fila por org).
- `services/admin/organizations.ts` (tenants — < 200 esperado).

Acción: añadir `.limit(N)` defensivo donde N sea claramente > dataset esperado, sin paginación real.

**Categoría 3 — Riesgo real (requiere `.range()` o `.limit()`)**
- `services/embarque/queries/listado.ts` líneas 14, 68, 141, 169 — si alguno alimenta lista de UI, debe paginar (el flujo principal ya usa `paginados.ts`; estos pueden ser exports o helpers).
- `services/admin/members.ts` (miembros por org — puede crecer).
- `services/facturas/index.ts`, `services/facturas/proyeccion.ts`, `services/facturas/huecoFacturacion.ts` — listas potencialmente largas.
- `services/cotizacion/queries.ts` — verificar si alimenta dashboard o lista visible.
- `services/proveedor/index.ts` — listado de proveedores.
- `services/cliente/crud.ts` líneas 65, 76 — verificar uso.
- `services/usuario/index.ts:29` — listado de usuarios.
- `services/tracking/index.ts:59` — tracking events.
- `hooks/embarque/useJsonCargoTracking.ts:220`.

### Entregable Parte A

1. **Nuevo script** `scripts/audit-pagination.ts` que:
   - Recorra `src/services/**` y `src/hooks/**`.
   - Detecte `.from('X').select(...)` sin `.range/.limit/.single/.maybeSingle`.
   - Para cada hit, intente clasificar:
     - **OK** si la query tiene `.eq('id'|'<x>_id', ...)` o `count: 'exact'` o `count: 'planned'`.
     - **CATALOG** si la tabla está en una allowlist (`puertos`, `paises`, `monedas`, `planes`, `configuracion`, `organizations`).
     - **RISK** en cualquier otro caso.
   - Emita `docs/pagination-audit.md` con tabla + sólo el bucket **RISK** detallado.
2. **Aplicar correcciones** sólo a los hits **RISK** confirmados manualmente:
   - Añadir `.limit(500)` defensivo si es lista interna admin/dashboard.
   - Añadir `.range()` + parámetros de paginación si es lista visible para el usuario.
3. **Actualizar** `docs/power10-baseline.md` con conteo nuevo (OK / CATALOG / RISK) y enlace al nuevo doc.

### Parte B — Revisión preventiva de archivos 180-200 líneas (D13)

Lista actual (20 archivos productivos en el rango):

```
199 src/lib/domain/embarqueWizardSchemas.ts
198 src/components/auditoria/HallazgosFiltros.tsx
195 src/pages/dashboard/Bitacora.tsx
195 src/lib/audit/diffFields.ts
194 src/pdf/theme/styles.ts
193 src/pages/crm/Oportunidades.tsx
192 src/hooks/shared/useToast.ts
192 src/components/shared/VirtualDataTable.tsx
190 src/hooks/cliente/useClienteDetalleController.ts
190 src/components/facturacion/proformasColumns.tsx
187 src/pages/clientes/Clientes.tsx
185 src/components/dashboard/EmbarquesActivosTable.tsx
184 src/pages/portal/PortalEmbarqueDetalle.tsx
184 src/pages/admin/Idempotencia.tsx
183 src/lib/domain/proforma.ts
182 src/lib/auditoria/ejecutivoAgregados.ts
181 src/pages/cotizaciones/CotizacionDetalle.tsx
181 src/pages/clientes/ClienteDetalle.tsx
```

Acción:
- Revisar **sólo** los archivos > 190 líneas (los 10 superiores) en busca de:
  - Helpers obvios que se pueden extraer sin cambiar comportamiento.
  - Funciones únicas que aún están "pegadas" (candidatas a sub-archivo).
- Si la división es trivial → extraer. Si requiere refactor invasivo → marcar como deuda baja en `mem://audit/pendings` y dejarlo.
- Los archivos 180-189 líneas se ignoran (margen sano vs el cap de 250).

### Entregables Parte B
- 0-5 extracciones quirúrgicas (helpers a `lib/`, sub-componentes, etc.).
- Nota en `docs/audit-cleanslate-11.69.0.md` §6 actualizada.

### Versionado
- Bump `APP_VERSION` → `11.70.0` (minor: nueva auditoría + script).
- Entrada CHANGELOG con resumen de buckets (OK / CATALOG / RISK), correcciones aplicadas y extracciones.

### Validación
- `bunx vitest run` — 770/770 verde.
- `bun scripts/audit-pagination.ts` — el conteo RISK debe quedar en 0.
- Lint sin nuevos warnings.
