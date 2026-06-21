## Diagnóstico

En el embarque **ELIMP00230** todos los documentos están en estado válido:
- 2 con archivo (`Recibido`)
- 5 marcados como `No aplica` (sin archivo) → Certificado de Origen, Factura Comercial, Ficha Técnica, Otros, Packing List

El tab de Cierre dice "5 documentos faltantes" porque la regla `docs_completos` dentro de la función `validar_cierre_embarque` (y también `embarque_admin_pendientes_resumen`) cuenta como faltante **cualquier documento sin archivo**, sin importar si está marcado como `No aplica`:

```sql
WHERE (de.archivo IS NULL OR de.archivo = '')   -- ❌ no excluye 'No aplica'
```

En cambio la función `embarque_docs_faltantes` (la que se usa para bloquear el avance de estado) **sí** trata `No aplica` como satisfecho. Las reglas están inconsistentes.

Además, el filtro del frontend `TabDocumentos` (`?focus=faltantes`) usa el mismo criterio incorrecto: `!d.archivo`, así que cuando uno entra desde el cierre, "ve" los 5 docs en pantalla pero rotulados como `No aplica`, lo cual confunde.

**Analogía:** es como si tu lista de pendientes contara las casillas marcadas como "no aplica" como pendientes. Las marcaste justo para que no contaran — la app no las está respetando.

## Cambios

### 1. Migración SQL — alinear las dos RPC de cierre con `embarque_docs_faltantes`

Reemplazar el conteo de docs faltantes en:

- `public.validar_cierre_embarque(uuid)` → regla `docs_completos`
- `public.embarque_admin_pendientes_resumen(uuid)` → campo `docs_faltantes`

Nuevo predicado (idéntico en ambas):

```sql
WHERE de.embarque_id = p_embarque_id
  AND de.deleted_at IS NULL
  AND de.archivo IS NULL
  AND de.estado <> 'No aplica'
```

No se tocan grants, RLS ni el resto de la lógica. No se modifica `embarque_docs_faltantes` (ya estaba correcta).

### 2. Frontend — `TabDocumentos.tsx`

Cambiar el filtro `filtrarFaltantes` para excluir también los `No aplica`, así cuando el usuario entre desde el deep-link `?focus=faltantes` vea sólo lo que realmente falta:

```ts
documentos.filter(d => (!d.archivo || d.archivo === '') && d.estado !== 'No aplica')
```

Si después de la fix no queda ninguno, el `emptyMessage` actual ("No hay documentos faltantes…") ya cubre el caso.

### 3. Changelog + versión

- `src/constants/appVersion.ts` → `13.90.3`
- `CHANGELOG.md` → nueva entrada `[13.90.3]` describiendo el fix.

## Fuera de alcance

- No se cambia la UI del tab Cierre, ni los meta del checklist, ni las otras reglas (`cxc`, `cxp`, etc.).
- No se reescribe `embarque_docs_faltantes`.
- No se modifican datos de embarques existentes — al recargar ELIMP00230, el contador bajará a 0 automáticamente.

## Verificación

1. Tras aplicar la migración, ejecutar `validar_cierre_embarque('7cbea742…')` y confirmar que el check `docs_completos` devuelve `ok: true` y `faltantes: 0`.
2. En la UI, recargar el tab Cierre del embarque → el check de documentos debe aparecer en verde.
3. Click en el CTA "Ir a Documentos" del check → ya no debería filtrar nada (todos los faltantes reales son cero).
