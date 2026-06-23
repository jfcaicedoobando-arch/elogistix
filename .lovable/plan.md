## Objetivo

Cerrar el ciclo de aprobación de tarifas marítimas. Hoy el agente puede crear/editar tarifas en `borrador` y el RPC `agente_aprobar_tarifa(_tarifa_id, _estado)` ya existe (v13.128), pero **no hay UI en `/costeo/tarifas` para que operaciones apruebe o rechace**, y el agente no ve por qué le rechazaron una tarifa.

## Alcance

### 1. Base de datos (1 migración)
- Agregar columnas a `costeo_tarifas`:
  - `motivo_rechazo text` — texto libre que escribe operaciones al rechazar.
  - `aprobada_por uuid` (FK `auth.users`), `aprobada_en timestamptz` — auditoría.
- Reemplazar `agente_aprobar_tarifa(_tarifa_id, _estado)` por una versión con tercer parámetro opcional `_motivo text`:
  - Si `_estado='rechazada'` exige motivo no vacío.
  - Si `_estado='vigente'` limpia `motivo_rechazo` y registra `aprobada_por = auth.uid()`, `aprobada_en = now()`.
  - Mantiene la misma comprobación de roles (`admin`, `admin_org`, `gerente_operaciones`, `coordinador_logistico`, `ejecutivo_pricing`, `operador`, `super_admin`).
- Insertar fila en `notificaciones_internas` para el agente cuando se aprueba o rechaza (canal interno, ya existe la tabla).

### 2. UI operaciones — `/costeo/tarifas`
- **Filtro de aprobación** en `CosteoTarifasFiltros`: chips Pendientes (borrador) / Aprobadas (vigente) / Rechazadas / Todas. Por defecto **Pendientes** para que operaciones vea la bandeja de trabajo al entrar.
- **Columna "Aprobación"** en `CosteoTarifasTable` con `EstadoAprobacionBadge` (mismo componente que el portal del agente).
- **Acciones por fila** cuando `estado_aprobacion === 'borrador'`:
  - Botón ✓ Aprobar (verde) → llama RPC con `vigente`.
  - Botón ✗ Rechazar (rojo) → abre `DialogRechazarTarifa` que pide motivo (textarea, min 5 chars) y llama RPC con `rechazada` + motivo.
- Cuando `estado_aprobacion === 'rechazada'`: mostrar tooltip con el motivo en el badge y botón "Reactivar como borrador".
- Toast de éxito + invalidación de la query `costeo_tarifas` y la del portal del agente.

### 3. Hook + servicio
- Nuevo `src/features/costeo/services/aprobacion.ts` con `aprobarTarifa(id)`, `rechazarTarifa(id, motivo)`, `reactivarTarifa(id)` (wrappers del RPC).
- Nuevo hook `useAprobacionTarifa()` con las 3 mutations + invalidación de `['costeo-tarifas']` y `['portal-agente','tarifas']`.

### 4. UI agente — `/agente/tarifas` y `/agente/inicio`
- `AgenteTarifas.tsx`: en filas con `estado_aprobacion === 'rechazada'` mostrar el `motivo_rechazo` debajo (texto pequeño rojo) y mantener el botón Editar para corregir y reenviar (al guardar el trigger vuelve a `borrador` y limpia motivo).
- `AgenteInicio.tsx`: en el alert de rechazadas listar las primeras 3 rutas + motivo abreviado.
- Extender `fetchTarifasAgente` y su tipo para devolver `motivo_rechazo`, `aprobada_en`.

### 5. Reenvío automático
- Trigger `costeo_tarifas_agente_force_borrador` (creado en v13.129): ampliarlo para que al cambiar `estado_aprobacion` de `rechazada` → `borrador` limpie `motivo_rechazo`.

### 6. Versionado y memoria
- `APP_VERSION` → `13.130.0`.
- Entrada en `CHANGELOG.md`.
- Actualizar `.lovable/memories/features/portal-agente-carga.md` con el ciclo completo.

## Detalles técnicos

```text
Operaciones                            Agente
───────────                            ──────
/costeo/tarifas  (tab Pendientes)
  │ Aprobar ─────► RPC vigente ─────► toast + portal ve "Vigente"
  │ Rechazar(motivo) ─► RPC rechazada
  │                       │
  │                       └─► notificaciones_internas ─► /agente/inicio alert
  │                                                       /agente/tarifas badge + motivo
  Agente edita rechazada ─► trigger fuerza borrador, limpia motivo
  │
  └► vuelve a Pendientes
```

## Fuera de alcance
- Emails reales (sólo notificaciones in-app).
- Aprobación masiva.
- Historial de cambios de estado (sólo última aprobación queda registrada).
