# Fase 5 — Embarque borrador desde cotización aceptada (Brecha 6)

Cierra la última brecha del flujo de aceptación: cuando una cotización queda en `Aceptada`, operaciones puede generar el embarque borrador con un solo clic, reutilizando todos los datos de la cotización (contenedores, costos, ventas) y dejándolo listo para que ops complete fechas, tracking y documentación.

## Decisiones de producto (ya validadas)

- **Disparo**: semiautomático — botón "Crear borrador" visible en la cotización aceptada (no se ejecuta al aceptar el cliente).
- **Estado inicial**: nuevo valor `Borrador` en el enum `estado_embarque`.
- **Prospectos**: se bloquea. La acción exige `cliente_id IS NOT NULL`. Si la cotización es de prospecto, el botón se deshabilita con tooltip "Convierte el prospecto a cliente primero".
- **Implementación**: RPC nueva `crear_embarque_borrador_desde_cotizacion` (`SECURITY DEFINER`) que replica la lógica de `convertirCotizacionAEmbarques` dentro de Postgres, en una sola transacción.

## 1. Cambios de base de datos

Una sola migración que hace todo lo siguiente:

### 1.1 Enum y catálogos

- `ALTER TYPE estado_embarque ADD VALUE 'Borrador' BEFORE 'Confirmado'`.
- `Borrador` queda fuera de `ESTADOS_ACTIVOS` (no cuenta como operación viva en KPIs ni en alertas de demurrage).

### 1.2 RPC `crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid) returns uuid`

`SECURITY DEFINER`, search_path fijo, owned por `postgres`. Pasos internos:

1. `SELECT ... FOR UPDATE` de la cotización; valida:
   - Pertenece a `current_user_org_id()` o caller es `super_admin`.
   - Caller tiene rol `admin` u `operador` (no clientes, no viewers).
   - `estado = 'Aceptada'`.
   - `cliente_id IS NOT NULL` (bloqueo prospectos).
   - `embarque_id IS NULL` (idempotencia: si ya se generó, devuelve el existente).
2. Genera expediente vía `generar_expediente(p_tipo => cot.tipo)`.
3. `INSERT INTO embarques (...)` con `estado = 'Borrador'`, copiando `cliente_id`, `cliente_nombre`, `modo`, `tipo`, `incoterm`, `descripcion_mercancia`, `peso_kg`, `volumen_m3`, `piezas`, `operador`, `tipo_carga`, `tipo_contenedor`, `cotizacion_id`.
4. Inserta N contenedores hijos repartiendo peso/volumen/piezas (misma lógica que el TS actual).
5. Inserta `conceptos_costo` desde `cotizacion_costos` aplicando la regla BL/Contenedor.
6. Inserta `conceptos_venta` parseando el jsonb `cotizaciones.conceptos_venta`.
7. `UPDATE cotizaciones SET embarque_id = ...` — **NO** cambia `estado` a `En operación`; el trigger existente `sync_cotizacion_embarque_link` se ajusta para ignorar embarques en `Borrador` (ver 1.3).
8. Inserta en `bitacora_actividad` (`modulo='Cotizaciones'`, `accion='Borrador de embarque creado'`).
9. Inserta `notificaciones_internas` para admins/operadores de la org ("Borrador de embarque #expediente creado desde cotización #folio").
10. `RETURN embarque_id`.

### 1.3 Ajuste de trigger `sync_cotizacion_embarque_link`

Hoy mueve la cotización a `En operación` al vincular un embarque. Se modifica para que **solo dispare** cuando `NEW.estado <> 'Borrador'`. Así:

- Crear borrador: cotización queda en `Aceptada` con `embarque_id` apuntando al borrador.
- Cuando operaciones confirma el embarque (`Borrador → Confirmado`), el trigger sí mueve la cotización a `En operación`.

### 1.4 Grants y RLS

La RPC es `SECURITY DEFINER` así que no necesita policies nuevas; ya existen para `embarques`, `embarque_contenedores`, `conceptos_costo`, `conceptos_venta`. Se hace `GRANT EXECUTE ON FUNCTION crear_embarque_borrador_desde_cotizacion(uuid) TO authenticated`.

## 2. Frontend

### 2.1 Constantes

- `src/constants/embarqueConstants.ts`: añadir `'Borrador'` al inicio de `ESTADOS_EMBARQUE`. **No** añadirlo a `ESTADOS_ACTIVOS`.
- Badge color para `Borrador`: `bg-muted text-muted-foreground` (gris neutro, semantic tokens).

### 2.2 Servicio + hook

- `src/services/cotizacion/conversiones/embarques.ts`: nueva función `crearEmbarqueBorradorDesdeCotizacion(cotizacionId)` que llama la RPC y devuelve el `embarque_id`.
- `src/hooks/cotizacion/useCotizacionConversions.ts`: nuevo `useCrearEmbarqueBorrador()` (mutation + invalidación de `queryKeys.cotizaciones.*` y `queryKeys.embarques.*`).
- El TS legado `convertirCotizacionAEmbarques` **se conserva** (lo usan flujos manuales antiguos) pero se marca `@deprecated` en jsdoc apuntando a la RPC nueva.

### 2.3 UI — `CotizacionDetalle`

- Cuando `cotizacion.estado === 'Aceptada'` y `cotizacion.embarque_id === null`:
  - Botón primario "Crear embarque borrador" en el header.
  - Si `es_prospecto || !cliente_id`: botón deshabilitado + tooltip "Convierte el prospecto a cliente primero".
  - Confirm dialog ligero: "Se creará un embarque borrador con los datos de esta cotización. ¿Continuar?".
  - Al éxito: toast + `navigate(/embarques/<id>)`.
- Cuando ya hay `embarque_id`: link "Ver embarque borrador" en el header.

### 2.4 UI — Lista de embarques

- Filtros y badge soportan `Borrador` (gris).
- Banner sutil dentro del `EmbarqueDetalle` cuando `estado === 'Borrador'`: "Este embarque es un borrador generado desde la cotización #folio. Complétalo y cambia su estado a Confirmado."

## 3. Documentación

- `docs/flujo-aceptacion-cotizacion.md`:
  - Sección 4: nuevo paso 10 "Operaciones crea embarque borrador con un clic".
  - Sección 8: Brecha 6 marcada como ✅ cerrada en 12.30.0 (semiautomático con botón).
  - Sección 3: documentar nuevo estado `Borrador` en `estado_embarque` y la transición `Aceptada → Aceptada (con borrador) → En operación (al confirmar embarque)`.

## 4. Versión y changelog

- `src/constants/appVersion.ts` → `12.30.0`.
- `CHANGELOG.md` → entrada `[12.30.0] - 2026-05-31` con bullets:
  - Nuevo estado `Borrador` para embarques.
  - RPC `crear_embarque_borrador_desde_cotizacion` (SECURITY DEFINER, idempotente, bloquea prospectos).
  - Botón "Crear embarque borrador" en cotizaciones aceptadas.
  - Trigger de vínculo cotización↔embarque ignora borradores; la cotización pasa a `En operación` solo cuando el embarque se confirma.
  - Brecha 6 del flujo de aceptación cerrada.

## 5. Power of 10 / arquitectura

- Componentes nuevos < 200 líneas, sin `any`.
- Mutation con cleanup automático de TanStack Query.
- Toda la escritura masiva ocurre en la RPC (una transacción, atómica).
- Sin `style={{}}` estático; colores vía tokens.

## Lo que **NO** se hace en esta fase

- No se envía email (sigue dependiendo de dominio).
- No se elimina la función TS `convertirCotizacionAEmbarques` (deprecada pero viva por compatibilidad).
- No se cambia el wizard de "Nuevo embarque" — el borrador puede editarse desde `EditarEmbarque` que ya existe.

## Resultado esperado

- Operaciones genera el embarque con un clic desde la cotización aceptada.
- Embarque nace en `Borrador`, fuera de KPIs activos, hasta que ops lo confirma.
- Cotización queda vinculada inmediatamente; pasa a `En operación` solo al confirmar el embarque.
- Flujo de aceptación completo: ✅ Brecha 1 (in-app), ✅ Brecha 2, ✅ Brecha 3, ✅ Brecha 4 (in-app), ✅ Brecha 5, ✅ Brecha 6. Quedan únicamente los emails (Brechas 1 y 4 en su canal email) pendientes del dominio.
