
# Ocultar hallazgos revisados por defecto

Los hallazgos marcados como revisados desaparecerán de la bandeja de auditoría. Los KPIs y el badge del sidebar contarán solo los pendientes. Un toggle permitirá volver a verlos cuando se necesiten.

## Comportamiento esperado

- Al marcar un hallazgo como **revisado**, sale de la tabla y de los KPIs.
- El conteo del **sidebar** baja también (badge de "Auditoría").
- En la barra de filtros, el toggle de revisión cambia su default a **"Pendientes"** (en lugar de "Todos") y muestra cuántos hay ocultos: *"Mostrando 487. 26 revisados ocultos."*
- Al cambiar el filtro a "Revisados" o "Todos", reaparecen.
- En la vista **"Por regla"** (acordeón), el conteo del badge de cada regla refleja solo pendientes. Los revisados también se ocultan ahí.

## Cambios técnicos

### 1. `src/pages/Auditoria.tsx`
- Inyectar `useAuditoriaRevisiones()` para tener el `Map` de revisiones.
- Calcular `hallazgosPendientes = hallazgos.filter(h => !revisiones.has(revisionKey(h)))`.
- Pasar **solo pendientes** a:
  - `AuditoriaKpis` (recalcular `por_severidad` localmente sobre pendientes)
  - El acordeón "Por regla" (`porRegla` se construye desde pendientes)
  - El contador "Mostrando X de Y" (Y = pendientes, no total)
- Mostrar línea informativa: *"N hallazgos revisados están ocultos. [Ver revisados]"* (botón que cambia un estado local `mostrarRevisados`).

### 2. `src/components/auditoria/HallazgosTablaPaginada.tsx`
- Cambiar default de `filtroRevision` de `"todos"` a `"pendientes"`.
- La pestaña "Tabla completa" sigue recibiendo `hallazgos` completos pero filtra por defecto a pendientes (consistente con el comportamiento actual del select).
- Agregar una pista visual junto al contador: *"X de Y · Z revisados ocultos"* cuando `filtroRevision === "pendientes"` y haya revisados.

### 3. `src/components/auditoria/HallazgoTabla.tsx` (vista por regla)
- Recibe ya filtrados desde `Auditoria.tsx`, no requiere cambios internos más allá de aceptar listas vacías con mensaje "Sin hallazgos pendientes".

### 4. Badge del sidebar — `useAuditoriaCount`
- Modificar `select` para restar las revisiones del total. Como el hook `useAuditoriaRevisiones` vive en otro query, se hace combinando ambos:
  - Opción elegida: dentro de `useAuditoriaCount`, también suscribirse al query `["auditoria", "revisiones"]` y devolver `total - revisadosCount`.
- Invalidar `AUDITORIA_QUERY_KEY` cuando se marca/desmarca una revisión (ya se invalida `REVISIONES_KEY`; agregar también la otra para que el badge reaccione al instante).

### 5. Sin migración
- No se toca el esquema de BD. La tabla `auditoria_revisiones` ya tiene todo lo necesario.

### 6. Versionado y changelog
- Bump a `v8.99.52` (patch).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `changelogData.ts`.

## Diagrama de flujo resultante

```text
Usuario marca revisado
        │
        ▼
upsert en auditoria_revisiones  ──► invalida [auditoria, revisiones]
                                 └► invalida [auditoria, embarques]
        │
        ▼
Re-render:
  • Tabla: el hallazgo desaparece (filtro "Pendientes" por default)
  • KPIs: bajan (Crítico/Alto/Medio recalculados sin revisados)
  • Sidebar badge: baja
  • Línea: "1 revisado oculto · [Ver revisados]"
```
