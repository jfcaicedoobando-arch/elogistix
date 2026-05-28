# Refactor: 1 embarque ↔ N contenedores

Modelar contenedores como entidad hija real de `embarques`, eliminando el patrón actual de "N embarques hermanos por BL Master".

## Objetivo

Un embarque marítimo FCL pasa a contener **N filas en `embarque_contenedores`**. Cada contenedor tiene su número, tipo, peso/volumen/piezas y BL House propios. Los conceptos financieros pueden ser globales al embarque o asignados a un contenedor específico. Las proformas pueden filtrar conceptos por contenedor.

## Fases

### Fase A — Base de datos (migración estructural + datos)

1. **Nueva tabla `embarque_contenedores`**
   - `id`, `embarque_id` (FK CASCADE), `organization_id`
   - `numero_contenedor`, `tipo_contenedor`, `bl_house` (opcional)
   - `peso_kg`, `volumen_m3`, `piezas`
   - `orden` (int, para ordenamiento estable)
   - `created_at`, `updated_at`, soft-delete (`deleted_at`, `deleted_by`)
   - GRANTs estándar + RLS por `organization_id` (espejo de `embarques`)

2. **Conceptos financieros**
   - Agregar `contenedor_id uuid NULL REFERENCES embarque_contenedores(id) ON DELETE SET NULL` a `conceptos_venta` y `conceptos_costo`.
   - `NULL` = concepto global del embarque.

3. **Migración de datos existente**
   - Para cada `embarques` con `contenedor` o `tipo_contenedor` no nulos: insertar 1 fila en `embarque_contenedores` con esos valores + peso/volumen/piezas del embarque + `orden=1`.
   - **No** colapsar embarques hermanos automáticamente (riesgo alto). Se ofrece una herramienta manual posterior para consolidar BL Masters duplicados.

4. **Compatibilidad temporal**
   - Mantener columnas `contenedor` y `tipo_contenedor` en `embarques` por ahora (deprecadas). Un trigger las sincroniza con el primer contenedor para que reportes legacy sigan funcionando. Se eliminan en una migración posterior una vez que todo el código consuma la tabla hija.

5. **RPC actualizadas**
   - `duplicar_embarque_completo`: copia también los contenedores hijos.
   - Nueva RPC opcional `agregar_contenedores_embarque(embarque_id, contenedores[])` para inserts masivos transaccionales.

### Fase B — Capa de servicios y tipos

- Nuevo módulo `src/services/embarque/contenedores/` con CRUD: `listarPorEmbarque`, `crear`, `actualizar`, `eliminar`, `reordenar`.
- Tipos en `src/types/embarque/contenedor.ts` (Zod schema).
- Hook `useContenedoresEmbarque(embarqueId)` con React Query (cache + invalidación).

### Fase C — Wizard de creación

- **Step 2 (Datos Ruta marítimo)**: reemplazar los inputs únicos `# Contenedor` y `Tipo` por un **componente `ListaContenedoresEditable`** con:
  - Botón "Agregar contenedor" (sin límite duro; soft-cap de 50 con confirmación).
  - Por fila: número, tipo (select del catálogo), BL House, peso, volumen, piezas, eliminar.
  - Validación Zod: mínimo 1 contenedor para FCL; LCL conserva flujo actual (1 fila auto "LCL").
- El submit del wizard inserta el embarque + N contenedores en una transacción (RPC).
- `peso_kg`/`volumen_m3`/`piezas` del embarque pasan a ser **derivados** (suma de hijos) — vista calculada o columnas sincronizadas por trigger.

### Fase D — Vista detalle del embarque

- Nuevo subcomponente `SeccionContenedores` dentro de `TabResumen` (o tab propio si el espacio lo pide):
  - Tabla editable in-line con los N contenedores.
  - Acciones: agregar, editar inline, eliminar.
- `EmbarquesRelacionadosCard` se reinterpreta: ahora muestra otros embarques con mismo `bl_master` (caso edge histórico), no múltiples contenedores del mismo embarque.
- En la **lista principal** (`EmbarquesActivosTable`): nueva columna "# Contenedores" (count), y badge con el primer número + "(+N)" si hay más.

### Fase E — Conceptos financieros y proformas

- En `StepCostosPrecios` y editor de conceptos: agregar selector opcional **"Asignar a contenedor"** (por defecto "Todos / Global").
- En `DialogGenerarProforma`:
  - Nuevo filtro inicial "Generar para": Todo el embarque · Contenedor específico · Selección múltiple de contenedores.
  - Los conceptos globales se prorratean o se incluyen según regla configurable (por defecto: incluir siempre).
- La consolidación multi-embarque existente se mantiene intacta.

### Fase F — Migración del flujo de duplicación

- `DialogDuplicarEmbarque` **se mantiene** pero cambia de propósito: deja de ser el camino para "más contenedores" y vuelve a ser sólo para duplicar embarques completos distintos (caso real: copiar un embarque viejo como plantilla para uno nuevo).
- Banner informativo en el diálogo: "¿Quieres más contenedores? Usa el botón 'Agregar contenedor' dentro del embarque".

### Fase G — Limpieza y documentación

- Actualizar `CHANGELOG.md` + `APP_VERSION`.
- Documento `docs/contenedores-refactor.md` con el modelo nuevo y guía de migración para usuarios.
- Marcar `embarques.contenedor` y `embarques.tipo_contenedor` como deprecadas en comentarios SQL.

## Estructura técnica

```text
supabase/migrations/
  └─ <ts>_contenedores_tabla_hija.sql        # Fase A completa

src/
  ├─ types/embarque/contenedor.ts
  ├─ services/embarque/contenedores/
  │    ├─ index.ts
  │    ├─ crud.ts
  │    └─ types.ts
  ├─ hooks/embarque/useContenedoresEmbarque.ts
  ├─ components/embarque/contenedores/
  │    ├─ ListaContenedoresEditable.tsx       # Wizard + detalle
  │    ├─ FilaContenedor.tsx
  │    └─ SeccionContenedores.tsx             # Tab detalle
  └─ components/embarque/StepDatosRutaMaritimo.tsx  # adaptado
```

## Riesgos y mitigaciones

- **Datos legacy con embarques hermanos por BL Master**: no se tocan automáticamente. Queda una herramienta opcional posterior para que el usuario consolide manualmente si lo desea.
- **Reportes y vistas existentes** que leen `embarques.contenedor` directo: siguen funcionando gracias al trigger de sincronización con el primer contenedor.
- **Proformas históricas** ya generadas: no se alteran (usan `snapshot_emision`).
- **Tamaño del refactor**: se entrega en fases independientes (A→B→C→D→E→F→G), cada una con su PR/commit y release de versión, para poder pausar/validar entre fases.

## Entregables por fase

| Fase | Output | Versión |
|------|--------|---------|
| A | Migración SQL + datos migrados | 8.x.0 |
| B | Servicios + hooks + tipos | 8.x.1 |
| C | Wizard con N contenedores | 8.x.2 |
| D | Detalle + lista actualizados | 8.x.3 |
| E | Conceptos y proformas por contenedor | 8.x.4 |
| F | Duplicación re-propósito | 8.x.5 |
| G | Docs + deprecaciones | 8.x.6 |
