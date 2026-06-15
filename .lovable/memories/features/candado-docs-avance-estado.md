---
name: Candado de documentos al avanzar estado de embarque
description: Reglas de bloqueo de transición de estado por documentos faltantes. Mixto por estado destino. Fuente única en RPC SQL.
type: feature
---

Al avanzar el estado de un embarque, la app aplica un candado por documentos faltantes con dureza **mixta** según el estado destino:

| Estado destino | Comportamiento |
|---|---|
| Confirmado, En Tránsito | **Soft**: dialog de confirmación, usuario puede avanzar igual |
| En Aduana, Llegada, Arribo, Entregado, EIR, Cerrado | **Hard**: botón deshabilitado + RPC rechaza con `documentos_faltantes: ...` |

Documento "satisfecho" = `archivo IS NOT NULL` OR `estado = 'No aplica'`. Consistente con la regla `docs_faltantes` de auditoría.

**Fuente única (backend)**:
- `public._docs_requeridos_por_estado(modo text, estado text) RETURNS text[]` — IMMUTABLE. Matriz canónica modo × estado. La consumen `auditoria_embarques_org` y `embarque_docs_faltantes`.
- `public.embarque_docs_faltantes(embarque_id uuid, estado_destino text) RETURNS text[]` — SECURITY DEFINER, STABLE.
- `public.avanzar_estado_embarque(...)` valida internamente cuando el destino está en el set bloqueante.

**Frontend**:
- Hook `useDocsFaltantesParaEstado(embarqueId, estadoDestino)` (cache 30s).
- `useEmbarqueEstadoActions` orquesta los tres dialogs (block / warn-docs / warn-cierre).
- `EmbarqueDetalleHeader` muestra tooltip con la lista de faltantes en el botón disabled.

**Mantenimiento**: si agregas un nuevo documento, modo o estado, actualiza **sólo** `_docs_requeridos_por_estado` y `getDocsForMode` (UI del wizard) en la misma PR.
