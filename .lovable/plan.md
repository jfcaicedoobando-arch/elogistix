## Objetivo

Bloquear el avance de estado cuando faltan documentos mínimos, con dureza **mixta** según el estado destino, reutilizando la matriz canónica de `auditoria_embarques_org` y aceptando documentos en "No aplica" como satisfechos.

## Reglas

**Matriz fuente de verdad:** misma del CTE `exigidos` de `auditoria_embarques_org` (Marítimo/Aéreo/Terrestre × estado destino). Documento "satisfecho" = tiene archivo **o** estado = "No aplica" (idéntico a la auditoría).

**Dureza por estado destino:**

| Estado destino | Comportamiento si faltan docs |
|---|---|
| Borrador → Confirmado | Confirmación suave (diálogo lista faltantes, "Continuar / Cancelar") |
| Confirmado → En Tránsito | Confirmación suave |
| En Tránsito → En Aduana | **Bloqueante** (RPC rechaza + botón deshabilitado con tooltip) |
| En Aduana → Llegada / Arribo | **Bloqueante** |
| Llegada/Arribo → Entregado | **Bloqueante** |
| Entregado → EIR → Cerrado | **Bloqueante** |
| Reapertura | Sin candado (no aplica) |

Sin "forzar con justificación" — si quieres avanzar, primero subes/marcas el documento.

## Cambios técnicos

### 1. Backend (fuente de verdad)

**Migración SQL** que crea dos funciones:

- `public.embarque_docs_faltantes(p_embarque_id uuid, p_estado_destino text) RETURNS text[]`
  - SECURITY DEFINER, STABLE, search_path `public`.
  - Resuelve el embarque (modo, organization_id), aplica la **misma matriz** que `auditoria_embarques_org` (extraída a un helper compartido) y devuelve el array de nombres faltantes para el estado destino. Vacío = OK.
  - Verifica acceso con `_assert_internal_reader`.

- Modifica `public.avanzar_estado_embarque(p_embarque_id, p_nuevo_estado, p_usuario_email)`:
  - Si el estado destino está en el set bloqueante (`En Aduana`, `Llegada`, `Arribo`, `Entregado`, `EIR`, `Cerrado`), llama a `embarque_docs_faltantes` y, si retorna ≥1, lanza `RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(faltantes,', ')` con `SQLSTATE 'P0001'`.
  - Para soft (Confirmado / En Tránsito) **no** valida en backend — la decisión queda en UI para no romper auto-sync.

Para evitar duplicar la matriz: refactor de `auditoria_embarques_org` extrayendo la lógica de "docs requeridos por modo+estado" a una función inmutable `public._docs_requeridos_por_estado(p_modo text, p_estado text) RETURNS text[]` que ambas funciones reusan.

### 2. Frontend

**Hook nuevo** `src/features/embarques/hooks/useDocsFaltantesParaEstado.ts`:
- `useDocsFaltantesParaEstado(embarqueId, estadoDestino)` → `{ faltantes: string[], bloqueante: boolean, loading }`.
- Llama RPC `embarque_docs_faltantes`. Cache 30s. Sólo se ejecuta cuando hay siguiente estado.

**`useEmbarqueEstadoActions.ts`** (≤200 líneas, ya en 132):
- Importar hook y `getSiguienteEstado`.
- En `handleAvanzarEstado`:
  - Calcular `siguiente`.
  - Si `bloqueante && faltantes.length > 0` → abrir nuevo dialog `BlockDocsDialog` (lista + botón "Ir a Documentos") y retornar.
  - Si `!bloqueante && faltantes.length > 0` → abrir dialog soft de confirmación (similar al de cierre sin proforma).
  - Resto del flujo intacto.
- Exponer `warnDocsOpen`, `setWarnDocsOpen`, `blockDocsOpen`, `setBlockDocsOpen`, `docsFaltantes`, `confirmarAvanceConFaltantes`.

**`EmbarqueDetalleHeader.tsx`** (consumer del hook):
- Botón "Avanzar" deshabilitado cuando `blockDocsOpen` aplica (con `Tooltip` "Faltan documentos para pasar a {siguiente}: {lista}").
- Renderiza dos `AlertDialog` nuevos reutilizando el patrón del cierre sin proforma.

**Tests:**
- `useEmbarqueEstadoActions.test.tsx`: 3 casos nuevos (soft con faltantes confirma → avanza; bloqueante con faltantes → no avanza; sin faltantes → avanza directo).
- `embarque_docs_faltantes` integration test SQL (`supabase/tests/rls/`): caso Terrestre completo, caso Marítimo con BL faltante, caso "No aplica" satisface.

### 3. Documentación

- `CHANGELOG.md` + bump `APP_VERSION` a `13.25.0` (feat).
- Memoria nueva `mem://features/candado-docs-avance-estado` con la matriz de dureza y referencia a `_docs_requeridos_por_estado` como fuente única.
- Actualizar `mem://features/auditoria-docs-faltantes-rules` para apuntar a la función helper compartida.

## Fuera de alcance

- No se cambia la matriz de documentos por modo (sigue v13.24.1).
- No se añade override por rol — se descartó.
- No se toca el wizard de creación (`Borrador` se valida en el wizard, no aquí).
