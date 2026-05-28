# Embarques ↔ Contenedores

Documenta el modelo de datos y los flujos UI introducidos por el refactor
"1 embarque ↔ N contenedores" (Fases A–G, v12.3.0 – v12.7.0).

## Modelo de datos

```
embarques (1) ───────────────< embarque_contenedores (N)
                                    │
                                    └──< conceptos_venta / conceptos_costo
                                         (campo opcional contenedor_id)
```

- **`embarque_contenedores`**: número, tipo, BL House, peso, volumen, piezas,
  `orden`, soft-delete. RLS por `organization_id` + lectura para clientes
  propietarios.
- **`conceptos_venta.contenedor_id`** y **`conceptos_costo.contenedor_id`**
  (nullable). `NULL` significa "concepto general del embarque" — siempre se
  incluye al filtrar proformas por contenedor.

### Campos legacy en `embarques` (deprecated)

`contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas` se
sincronizan automáticamente desde el primer contenedor hijo (`orden ASC`) vía
trigger `sync_embarque_desde_contenedor`. Se mantienen por compat con export,
reportes y listados. Plan de eliminación: cuando todas las vistas migren a leer
desde `embarque_contenedores`.

## Capa de datos (cliente)

- **Types**: `src/types/embarque/contenedor.ts` (Zod schema
  `contenedorBorradorSchema`, helpers `rowAContenedorBorrador`).
- **Servicios**: `src/services/embarque/contenedores/`
  (`listarPorEmbarque`, `crear`, `crearMuchos`, `actualizar`, `eliminar`
  soft-delete, `reemplazarTodos`).
- **Hook**: `useContenedoresEmbarque(embarqueId)` con React Query.

## UI

- **Vista detalle (`TabResumen.tsx`)**: `SeccionContenedores` permite agregar,
  editar y eliminar contenedores con "Guardar cambios" (delete-soft +
  re-insert vía `reemplazarTodos`).
- **Wizard de creación**: captura un contenedor inicial. Los adicionales se
  agregan desde el detalle (integración wizard-multicontenedor diferida a una
  futura versión menor).

## Proformas filtradas por contenedor

`DialogGenerarProforma` (v12.6.0):

- Chips de filtro en el paso de selección: "Todos", "Generales",
  uno por cada contenedor.
- "Generales" filtra solo conceptos con `contenedor_id IS NULL`.
- Seleccionar un contenedor incluye sus conceptos + los generales (porque
  también aplican a ese contenedor).
- Al confirmar, la proforma resultante registra en `notas` un prefijo
  `"Proforma del contenedor X"` que aparece en el PDF.

## Duplicación de embarques

RPC `duplicar_embarque_completo` (v12.7.0) ahora:

1. Crea N nuevos embarques (uno por entrada en `p_copias`).
2. Copia los contenedores hijos del embarque origen → embarque copia.
3. Re-mapea `contenedor_id` en los conceptos copiados al `id` del nuevo
   contenedor correspondiente (matching por `orden`). Si el concepto era
   general (`NULL`) sigue siendo general en la copia.

## Flujo wizard (v12.8.0)

A partir de v12.8.0, el wizard "Nuevo Embarque" usa la lista dinámica de contenedores en `StepDatosRutaMaritimo`:

- **FCL**: el operador agrega N contenedores con `ListaContenedoresEditable`. Validación zod en `validateStepRuta` exige `contenedores.length >= 1` y que cada fila tenga `numero_contenedor` y `tipo_contenedor`.
- **LCL**: el wizard no muestra la lista; al persistir se inyecta automáticamente una única fila con `tipo_contenedor='LCL'`.
- **Aéreo / Terrestre**: `contenedores` queda vacío y no se insertan filas hijas.

El submit (`useEmbarqueSubmitOrchestrator` → `useCreateEmbarque`) llama `crearMuchos(embarqueId, contenedores)` después de `crearEmbarqueRpc`. El trigger DB sincroniza `embarques.contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3` y `piezas` desde la tabla hija para mantener compatibilidad con reportes y queries legacy.

## Asignar conceptos a un contenedor (v12.9.0)

Al **editar** un embarque con ≥2 contenedores, el paso de Costos del wizard muestra una columna extra "Contenedor" en cada fila de costo y de venta (componente `SelectContenedorConcepto`). Opciones:

- **General (todo el embarque)** → `contenedor_id = null`. Es el default y siempre aparece en cualquier filtro de proforma.
- **Cualquier contenedor del embarque** → guarda el `id` del contenedor.

`TabCostos` también incluye la columna "Contenedor" en modo lectura.

### Por qué importa

Sin este paso, todos los conceptos quedaban como "General" y los chips de filtro por contenedor en `DialogGenerarProforma` (v12.6.0) no separaban nada. Con la asignación habilitada, generar una "Proforma del Contenedor MSCU123…" trae sólo:

1. Los conceptos asignados a ese contenedor.
2. Los conceptos generales (aplican a todo el embarque).

### Reglas

- Si el embarque tiene 0 o 1 contenedor, la columna se oculta automáticamente (no aporta valor).
- Si un concepto referencia un contenedor que se eliminó (soft-delete), se trata como "General" al filtrar (`conceptosPorContenedor.ts`).
- El wizard de creación (`NuevoEmbarque`) **no** muestra esta columna: el embarque aún no existe, así que primero se crea con sus contenedores y luego se editan los conceptos para asignarlos.
