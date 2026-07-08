## Objetivo

Convertir el tab de **Tracking** en un flujo dirigido con exactamente 2 acciones:
1. **Actualizar ETA** (con la fecha nueva que publica la naviera).
2. **Marcar Llegada real** (única forma de pasar el embarque de "En Tránsito" a "Arribo").

Además, preservar el **ETA original** como referencia y propagar el ETA vigente a toda la app (hueco de facturación, timeline, dashboards).

---

## Cambios en base de datos

**Migración:** agregar columna `eta_original DATE NULL` a `embarques`.

- Se **backfilla** con el valor actual de `eta` para todos los embarques existentes (`UPDATE embarques SET eta_original = eta WHERE eta_original IS NULL`).
- En adelante, `eta_original` se llena automáticamente vía **trigger BEFORE INSERT** con el valor de `eta` al crear el embarque, y **nunca se sobrescribe** después (trigger BEFORE UPDATE que ignora cambios).
- El campo `eta` sigue siendo el "vigente" y es el que consume toda la app.

**No** se crean columnas nuevas para "llegada real" — ya existe `fecha_llegada_real`.

---

## Cambios en dominio / lógica de estado

Archivo: `src/features/embarques/domain/embarque.ts` — función `calcularEstadoEmbarque`:

- Hoy: `hoy >= fechaETA → "Arribo"` automático.
- Nuevo: `hoy >= fechaETA` solo devuelve `"Arribo"` **si `fecha_llegada_real` está capturada**. Sin llegada real, se queda en `"En Tránsito"` (con ETA vencido) aunque el ETA haya pasado.
- La firma del método recibe un parámetro extra `fechaLlegadaReal: string | null`. Se actualizan los callers (TabResumen, dashboards, listados).

---

## Cambios en el tab de Tracking

Archivo principal: `src/features/embarques/components/tracking/` (revisar `TrackingNuevoEventoForm` y componentes hermanos).

- Reemplazar el botón "Registrar Evento" (que hoy abre un formulario con 11 tipos) por un **menú con 2 opciones**:
  1. **"Actualizar ETA"** → abre modal (FormDialogShell) con:
     - Campo fecha (nuevo ETA).
     - Campo texto opcional "Fuente / Motivo" (ej. "Portal Maersk").
     - Al guardar: actualiza `embarques.eta`, crea evento `tipo="Cambio de ETA"` con descripción `"ETA actualizado de {anterior} a {nuevo}"` y ubicación = fuente/motivo.
  2. **"Marcar Llegada real"** → abre modal con:
     - Campo fecha (llegada real, default hoy).
     - Campo ubicación (puerto/aeropuerto destino, pre-lleno).
     - Al guardar: actualiza `embarques.fecha_llegada_real` **y** `embarques.estado = 'Arribo'`, crea evento `tipo="Arribo a Puerto"`.
     - Este es el único camino UI para llegar al estado "Arribo".
- Se elimina del UI la posibilidad de crear eventos manuales de los otros 9 tipos (Zarpe, Transbordo, Descarga, Despacho Aduanal, Liberación, En Ruta Terrestre, Entrega, Demora, Inspección, Otro). Los eventos históricos siguen visibles en el timeline.
- El enum `tipo_evento_tracking` en BD se conserva intacto (los datos históricos no se rompen); solo se agrega el valor `"Cambio de ETA"` al enum si no existe.

---

## Cambios en el resumen del embarque

Archivo: `src/features/embarques/components/tabResumen/ResumenCards.tsx` (dentro de `RutaTransporteCard`).

- Añadir fila **"ETA original"** que muestra `embarque.eta_original` con `FechaConOriginal` reutilizable, comparando contra el `eta` vigente (badge `+Nd` cuando difieren).
- El campo **"ETA"** sigue mostrando el valor vigente.
- El campo **"Llegada real"** se destaca cuando existe; cuando no existe y `hoy >= eta`, se muestra badge amarillo "Pendiente de capturar".

---

## Propagación del ETA vigente

Como `eta` sigue siendo el mismo campo que hoy consume toda la app, la propagación es automática para:
- Hueco de facturación (`fetchEmbarquesParaHueco` ya filtra por `eta`).
- Timeline de fases (`embarqueFases.ts`).
- Dashboards de operaciones y alertas.

No se requieren cambios adicionales en esos consumidores.

---

## Detalles técnicos

- **Nueva mutation** `useActualizarEta(embarqueId)` en `src/features/embarques/hooks/mutations/` que hace `UPDATE embarques SET eta = ...` + inserta evento en `eventos_embarque` en una sola transacción (RPC `actualizar_eta_embarque`).
- **Reutilizar** `useActualizarFechaLlegadaReal` existente, extendiéndola para que también actualice `estado='Arribo'` y cree el evento de arribo (hoy solo actualiza la fecha).
- **Trigger BD** `embarques_eta_original_trigger`:
  ```
  BEFORE INSERT: NEW.eta_original := COALESCE(NEW.eta_original, NEW.eta)
  BEFORE UPDATE: NEW.eta_original := OLD.eta_original  -- inmutable
  ```
- **Tests unitarios** para `calcularEstadoEmbarque` cubriendo el nuevo caso "ETA vencido sin llegada real → En Tránsito".
- Bump `APP_VERSION` a `13.214.0` y entrada en `CHANGELOG.md`.

---

## Preguntas menores que asumo (avísame si prefieres otra cosa)

- El **historial de cambios de ETA** queda registrado como eventos en `eventos_embarque` (tipo `"Cambio de ETA"`), no en tabla aparte. Es suficiente para auditoría.
- El campo "Fuente" del evento ETA es texto libre; no se agrega catálogo de navieras.
- Los embarques que **hoy ya están en "Arribo" por cálculo automático** sin `fecha_llegada_real` capturada seguirán mostrando "Arribo" (para no romper visualmente el histórico). El bloqueo aplica solo a embarques que crucen el ETA a partir del deploy.
