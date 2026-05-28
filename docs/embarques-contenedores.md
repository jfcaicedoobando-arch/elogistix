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
