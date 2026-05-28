# Continuación refactor contenedores — Fases B, C, D

Continuo con las siguientes 3 fases del refactor `1 embarque ↔ N contenedores`. Las dejo en un solo entregable porque B es prerrequisito directo de C, y D consume lo mismo que C.

## Fase B — Servicios + hooks + tipos (v12.4.0)

**Archivos nuevos:**
- `src/types/embarque/contenedor.ts` — tipo `EmbarqueContenedor` derivado de `Database['public']['Tables']['embarque_contenedores']['Row']` + Zod schema `embarqueContenedorSchema` (validación de campos: número requerido, tipo requerido, peso ≥ 0, etc.).
- `src/services/embarque/contenedores/crud.ts` — `listarPorEmbarque`, `crear`, `crearMuchos`, `actualizar`, `eliminar` (soft-delete), `reemplazarTodos` (delete+insert para edición masiva).
- `src/services/embarque/contenedores/index.ts` — barrel.
- `src/hooks/embarque/useContenedoresEmbarque.ts` — React Query: `useQuery` por `embarqueId` con key `['embarque-contenedores', embarqueId]`, manejo explícito de `error`, `staleTime: 30s`.

Sin cambios de UI todavía. Solo capa de datos.

## Fase C — Wizard con lista dinámica de contenedores (v12.5.0)

**StepDatosRutaMaritimo.tsx**: reemplazar los campos únicos `# Contenedor` y `Tipo` por un nuevo componente `ListaContenedoresEditable` cuando `tipo_servicio === 'FCL'`. Para LCL se mantiene el comportamiento actual (un campo fijo "LCL").

**Componentes nuevos:**
- `src/components/embarque/contenedores/ListaContenedoresEditable.tsx` (≤200 líneas):
  - Recibe `value: ContenedorBorrador[]`, `onChange`, `tiposContenedor`.
  - Botón "Agregar contenedor" (sin límite duro; soft-cap 50 con `confirm()` si se supera).
  - Lista de `FilaContenedor`.
  - Validación local: si la lista queda vacía, mostrar inline error.
- `src/components/embarque/contenedores/FilaContenedor.tsx` (≤200 líneas):
  - Inputs: número, tipo (`Select`), BL House, peso, volumen, piezas, botón eliminar.
  - Reutiliza `NumericInput` para campos numéricos.

**Wizard flow (`useNuevoEmbarqueWizard.ts`)**:
- Form pasa a tener `contenedores: ContenedorBorrador[]` en lugar de los 5 campos sueltos (`contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas`).
- Default: un contenedor vacío para no romper UX (`[{ numero_contenedor: '', tipo_contenedor: '', ... }]`).
- Validación Zod (`embarqueWizardSchemas.ts`): para marítimo FCL `contenedores.length >= 1` y cada uno con `numero_contenedor` + `tipo_contenedor` no vacíos.
- Al submit: insertar embarque + llamar `crearMuchos(embarqueId, contenedores)`. El trigger DB sincroniza los totales legacy.

**Compat:** los modos aéreo y terrestre siguen usando el modelo viejo (no aplican contenedores). Para LCL, el wizard inserta automáticamente un contenedor "LCL" al guardar.

## Fase D — Vista detalle del embarque (v12.6.0)

**Componente nuevo:**
- `src/components/embarque/contenedores/SeccionContenedores.tsx` (≤200 líneas):
  - Tabla editable con los N contenedores del embarque.
  - Reutiliza `ListaContenedoresEditable` en modo controlado por el hook.
  - Botón "Guardar cambios" → `reemplazarTodos` (delete soft + insert), invalidando query.
  - Empty state si no hay contenedores con CTA "Agregar primer contenedor".
- Se monta dentro de `TabResumen.tsx` justo después de `EmbarquesRelacionadosCard` (solo para marítimo FCL).

**Lista principal (`EmbarquesActivosTable.tsx`)**:
- Nueva columna "Contenedores": muestra el primer número + badge "(+N)" si hay más. Opt-in en density "Cómoda"; oculta en "Compacta" para no agregar scroll horizontal.
- Conteo viene de un join lateral: extender el SELECT a `embarque_contenedores(count)` o leerlo del campo legacy + count separado (decisión técnica: agregar `select` con relación y mapear).

**EmbarquesRelacionadosCard**: sin cambios de lógica, sólo se reinterpreta semánticamente (otros embarques con mismo BL Master, caso legacy). Se actualiza copy del card: "Otros embarques con el mismo BL Master" → indica que ahora los contenedores propios viven dentro del embarque.

## Cambios transversales

- `CHANGELOG.md` + `APP_VERSION` se bumpean **una vez por fase** (12.4.0, 12.5.0, 12.6.0).
- Sin tocar las RPCs `duplicar_embarque_completo` aún (queda para Fase E/F del plan original).
- Sin cambios en proformas todavía (Fase E del plan original).

## Riesgos

- El `select` con join a `embarque_contenedores` en la lista principal puede tocar paginación server-side existente. Si rompe, fallback: column oculta por defecto y agregar query separado en el hook de la lista.
- Triggers DB de sync deben tolerar inserts masivos sin race. Si aparece lock, ajustar a `STATEMENT` level en una migración menor.

## Fuera de alcance de esta tanda

- Fases E (conceptos por contenedor + proformas filtradas), F (re-propósito de duplicación), G (docs/deprecaciones) — se entregan después.
