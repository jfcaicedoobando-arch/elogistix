ns: Fases E, F, G del refactor `1 embarque ↔ N contenedores`.

## Fase E — Conceptos por contenedor + proformas filtradas (v12.6.0)

**Objetivo:** permitir asignar cada concepto (venta/costo) a un contenedor específico, y generar proformas filtradas por contenedor.

**Tipos / servicios:**
- Extender `ConceptoVenta` y `ConceptoCosto` (en `src/types/...`) con `contenedor_id: string | null` (ya existe la columna en DB desde Fase A).
- Actualizar `src/services/embarque/conceptos/*` (crud) para leer/escribir `contenedor_id`. Default `null` = "aplica a todo el embarque".
- Nuevo helper `src/lib/domain/conceptosPorContenedor.ts`: `agruparPorContenedor(conceptos, contenedorIds)` → devuelve `{ porContenedor: Record<id, Concepto[]>, generales: Concepto[] }`.

**UI conceptos (TabFinanciero / ResumenConceptosVenta):**
- Nueva columna "Contenedor" (Select) en las filas de conceptos. Opciones: "General (todo el embarque)" + lista de `embarque_contenedores`. Solo visible si el embarque tiene ≥ 2 contenedores; si tiene 1 o 0, se oculta y queda `null`.
- Componente nuevo `src/components/embarque/conceptos/SelectContenedorConcepto.tsx` (≤120 líneas) — usa `useContenedoresEmbarque`.

**Proforma — paso de selección:**
- `PasoSeleccionConceptos.tsx`: agregar filtro tipo chips "Contenedor" arriba de la tabla. Opciones: "Todos", "Generales", uno por cada contenedor. Persistir selección en estado local del dialog.
- `DialogGenerarProforma.tsx`: pasar `contenedorIdFiltro?: string | null` al PDF.
- `generators/proformaPdf.tsx`: si viene `contenedorIdFiltro`, filtra conceptos y agrega subtítulo "Proforma del contenedor [número]". Mantener layout existente.

**Cambios DB:** ninguno (la columna `contenedor_id` ya existe).

## Fase F — Re-propósito de duplicación (v12.7.0)

**Contexto:** `DialogDuplicarEmbarque` + RPC `duplicar_embarque_completo` hoy crea un embarque hermano para cada contenedor extra. Con el nuevo modelo eso ya no aplica.

**Cambios:**
- `DialogDuplicarEmbarque.tsx`: cambiar copy a "Duplicar embarque como plantilla" — crea **un** embarque nuevo, copiando contenedores y conceptos (cliente puede editar). Quitar la opción "duplicar N veces".
- Nueva migración: actualizar RPC `duplicar_embarque_completo` para que copie también filas de `embarque_contenedores` (con nuevos IDs) y re-mapear `contenedor_id` en `conceptos_venta`/`conceptos_costo` copiados. Mantener compatibilidad con embarques legacy (sin contenedores child).
- Test mínimo en `src/services/embarque/__tests__/duplicar.test.ts` (mock RPC) que valide el mapeo.

## Fase G — Wizard parte 2 + docs + deprecaciones (v12.8.0)

**Wizard (pendiente de Fase C):**
- Integrar `ListaContenedoresEditable` dentro de `StepDatosRutaMaritimo.tsx` reemplazando los 5 campos sueltos (`contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas`) cuando `tipo_servicio === 'FCL'`.
- `useNuevoEmbarqueWizard.ts`: form pasa a `contenedores: ContenedorBorrador[]`. Default `[]`. Submit: insertar embarque + `crearMuchos`. LCL inserta un contenedor "LCL" automático. Aéreo/terrestre sin cambios.
- Zod: `contenedores.length >= 1` para FCL.

**Deprecación legacy:**
- Marcar `embarques.contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas` como deprecated en JSDoc de los tipos derivados (`src/types/embarque.ts`). No eliminar: el trigger DB los sigue sincronizando para reportes y export.
- Crear `docs/embarques-contenedores.md` con: modelo de datos, flujo wizard, cómo se filtran proformas, plan de remoción futura de campos legacy (no en esta tanda).

**Changelog/version:** bump independiente por cada fase (12.6.0 / 12.7.0 / 12.8.0).

## Riesgos

- Cambiar la RPC de duplicación puede romper flujos en producción demo: validar con un embarque de prueba antes del merge.
- Filtro por contenedor en proformas debe respetar conceptos `null` (generales) — siempre incluidos a menos que el usuario filtre explícitamente a "Generales" only.
- El Select de contenedor en conceptos debe invalidarse si el contenedor se elimina (soft-delete) — fallback a `null` con toast.

## Fuera de alcance

- Remoción real de columnas legacy en `embarques` (futuro).
- Reportes financieros por contenedor (futuro, requiere agregar dashboard).