# Cierre del refactor 1↔N contenedores antes del workflow de proformas

Pasé una auditoría completa al código. **No, los 3 pendientes que mencioné antes NO eran todos.** La auditoría encontró 10 pendientes adicionales — varios son bloqueantes para tener una experiencia consistente multi-contenedor y, sobre todo, **3 de ellos sí afectan directamente las proformas** y conviene cerrarlos antes de rediseñar ese workflow.

A continuación el plan, agrupado por fases y priorizado por impacto.

---

## Fase 1 — Bloqueantes que afectan proformas (v12.10.0) ⚠️ Hacer antes del workflow

### 1.1 Conversión cotización → embarque no crea contenedores hijos

- **Archivo:** `src/services/cotizacion/conversiones/embarques.ts:30-55`
- **Hoy:** crea N embarques (uno por contenedor de la cotización) escribiendo sólo los campos LEGACY (`contenedor`, `tipo_contenedor`, etc.). **Nunca** inserta en `embarque_contenedores`.
- **Cambio:** después del `crearEmbarqueRpc`, insertar una fila en `embarque_contenedores` con los datos de la cotización (número, tipo, peso/volumen/piezas, BL House si aplica). Mantener el modelo "1 embarque por contenedor de la cotización" (no agruparlos) para no cambiar la semántica.
- **Tamaño:** Mediano.

### 1.2 `ProformaConsolidadaDocument` agrupa por el contenedor LEGACY

- **Archivo:** `src/pdf/documents/ProformaConsolidadaDocument.tsx:38-40`
- **Hoy:** agrupa los conceptos por `p.embarques?.contenedor` (1 string). Si los conceptos tienen `contenedor_id` apuntando a hijos distintos, los fusiona todos bajo el legacy.
- **Cambio:** propagar `numero_contenedor` del hijo en la query de `DialogGenerarProforma` y agrupar por ahí; fallback al legacy cuando el concepto sea `General`.
- **Tamaño:** Mediano.

### 1.3 Dominio `proforma.ts` también agrupa por legacy

- **Archivo:** `src/lib/domain/proforma.ts:138`
- **Cambio:** misma corrección (consumir el `numero_contenedor` del hijo). Dependencia directa de 1.2.
- **Tamaño:** Chico.

### 1.4 Tests de regresión del nuevo agrupador

- Fixtures en `proforma.test.ts` con un embarque que tenga `contenedor` legacy = null y 2 conceptos asignados a 2 contenedores distintos. Validar que el agrupador devuelve 2 grupos, no 1.
- **Tamaño:** Chico.

**Versionado:** `APP_VERSION → 12.10.0` + entrada en `CHANGELOG.md`.

---

## Fase 2 — Bloqueantes operativos no proforma (v12.11.0)

### 2.1 Hidratar `contenedores` en wizard de edición

- **Archivo:** `src/hooks/embarque/useEditarEmbarqueWizard.ts`
- Importar `useContenedoresEmbarque(id)` y, tras `initialized`, hacer `setValue('contenedores', filas)` con `{ shouldDirty: false }`. Así el paso Ruta del wizard de edición refleja todos los contenedores.
- **Tamaño:** Mediano.

### 2.2 Tracking multi-contenedor (edge function + UI)

- **Edge:** `supabase/functions/jsoncargo-track/index.ts` + `_shared/jsoncargoSync.ts`. Iterar `embarque_contenedores` activos del embarque y disparar 1 request por cada uno; persistir N filas en `tracking_externo` (necesita columna `contenedor_id` ahí — verificar antes y agregar migración si falta).
- **UI:** `TrackingLiveCard` recibe un selector/chips de contenedor (default = primero). `TabTracking.tsx:53` y `PortalEmbarqueDetalle.tsx:172` pasan la lista en lugar del legacy.
- **Tamaño:** Grande. Es la pieza más invasiva.
- **Nota:** si la API de JSONCargo cobra por request, validar el costo antes de implementar.

**Versionado:** `APP_VERSION → 12.11.0`.

---

## Fase 3 — Mejoras de visibilidad multi-contenedor (v12.12.0)

Bugs cosméticos pero visibles para operadores y clientes.

### 3.1 Lista de embarques y Dashboard

- `src/components/dashboard/EmbarquesActivosTable.tsx:51-54`: replicar el badge `+N` que ya existe en `embarqueColumns.tsx:78`.
- `embarqueColumns.tsx`: cuando `contenedor` legacy esté vacío pero existan hijos, mostrar el primero de la lista en vez de `-`.

### 3.2 Portal cliente

- `PortalEmbarqueResumenTab.tsx:66` y `portal/EmbarqueCard.tsx:68`: listar todos los contenedores (chips o "MSCU123 +2").
- `usePortalEmbarquesController.ts:15`: extender el filtro de búsqueda para incluir los números de todos los contenedores (vía join o `contenedores_concat` precalculado).

### 3.3 Búsqueda global Ctrl+K

- Verificar el RPC `search` (panel interno). Si filtra sólo en `embarques.contenedor`, agregar UNION con `embarque_contenedores.numero_contenedor` y BL House.

### 3.4 Reporte proyección de facturación

- `src/services/facturas/proyeccion/buildFilas.ts:51` + `src/lib/domain/proyeccionFacturacion/agrupar.ts:12`: leer todos los contenedores hijos para el campo "# contenedores" y la lista. Migración del query del fetch source si es necesario.

### 3.5 Re-sync de tracking en update

- `src/hooks/embarque/mutations/useUpdateEmbarque.ts:44`: condición a `(e.contenedor || hayHijos)`.

### 3.6 CSV export embarques

- `src/hooks/embarque/useEmbarquesPageController.ts:110-111`: concatenar números con `;` o agregar columna `contenedores_total`.

**Versionado:** `APP_VERSION → 12.12.0`.

---

## Fase 4 — Tests y limpieza (v12.13.0)

### 4.1 Tests faltantes

- `convertirCotizacionAEmbarques` inserta en `embarque_contenedores`.
- `useEditarEmbarqueWizard` hidrata `contenedores`.
- Tracking multi-contenedor (mock del fetch).
- CSV export con N contenedores.
- Filtro de búsqueda portal con N contenedores.

### 4.2 Documentación

- Actualizar `docs/embarques-contenedores.md` con: tracking multi-contenedor, conversión desde cotización, hidratación en edición, comportamiento en proformas consolidadas.

### 4.3 Limpieza opcional

- Una vez todo el código lee desde hijos, evaluar marcar los campos legacy como `nullable` por defecto en nuevos embarques (sin migrar datos antiguos). NO se eliminan columnas — siguen sirviendo de caché vía trigger.

**Versionado:** `APP_VERSION → 12.13.0`.

---

## Resumen ejecutivo


| Fase | Versión | Bloqueante para proformas | Tamaño total          |
| ---- | ------- | ------------------------- | --------------------- |
| 1    | 12.10.0 | **Sí**                    | Mediano               |
| 2    | 12.11.0 | No (operativo)            | Grande (por tracking) |
| 3    | 12.12.0 | No                        | Mediano               |
| 4    | 12.13.0 | No                        | Chico-Mediano         |


### Recomendación

1. **Ejecutar Fase 1 ya** (es la única que invalida el rediseño del workflow de proformas si se hace después).
2. **Después de Fase 1, podemos saltar directamente al workflow mejorado de proformas** que querías diseñar.
3. **Fase 2, 3 y 4 se pueden intercalar** según prioridad del negocio — no bloquean el rediseño, sólo afectan otras vistas.

### Preguntas para confirmar antes de implementar

- ¿Aprobamos arrancar con **Fase 1 completa** y luego pasar al workflow de proformas? Hacemos Fase 1-4 antes de ir al workflow de proformas.
- En **B.4 (cotización → embarque)**: ¿el modelo sigue siendo "1 embarque por contenedor de la cotización" o quieres que ahora se cree **1 embarque con N contenedores hijos**? Esto cambia bastante la migración. Creo que lo correcto es 1 embarque con N contenedores hijo, pero no estoy seguro.  Que opinas? Cuáles son las mejores prácticas?
- En **2.2 (tracking)**: ¿la API de JSONCargo cobra por request? Si sí, conviene un toggle "sincronizar todos los contenedores" en vez de hacerlo automático.  Vamos a dejar de usar Jsoncargo, crea un archivo MD para despues quitar todo lo que tenga que relacion con ese proveedor.