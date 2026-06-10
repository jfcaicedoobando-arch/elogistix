# Módulo Costeo — Tarifas Marítimas China → México (v1)

## Objetivo

Centralizar las tarifas que mandan los agentes de carga chinos para rutas marítimas China→México y permitir que cualquier usuario, al cotizar, vea las **3 mejores opciones vigentes** ranqueadas por precio total, con desempate por **días de crédito del agente** y luego **días libres de demoras**.

## Alcance v1 (explícito)

Incluye:

- Solo flete marítimo FCL.
- Solo rutas de puertos principales de China → puertos de México.
- Solo contenedores 20' y 40' (con campo libre para otros tipos a futuro).
- Captura manual tipo matriz.
- Consulta (lookup) desde el wizard de Cotización; **no** autollena conceptos.

Fuera de alcance v1: aéreo, terrestre, LCL, exportación MX→China, importación de Excel, parseo IA, márgenes automáticos, alertas de vencimiento por correo.

---

## Modelo de datos

Cuatro tablas nuevas en `public`, todas con `organization_id`, RLS por membresía y GRANT estándar.

### 1. `costeo_agentes_proveedores`

Extiende/enlaza a `proveedores` existente con campos específicos de costeo:

- `proveedor_id` (FK a `proveedores`, único)
- `pais` (default 'CN')
- `dias_credito` (int, **criterio de desempate principal**)
- `contacto_tarifario` (texto)
- `activo` (bool)

> Si un proveedor ya existe en `proveedores`, lo enriquecemos; si no, se crea desde aquí.

### 2. `costeo_rutas`

Catálogo de pares de puertos cacheados para evitar combinaciones inválidas:

- `puerto_origen_id` (FK `puertos`, restringido a country='CN')
- `puerto_destino_id` (FK `puertos`, restringido a country='MX')
- `activa` (bool)
- UNIQUE(origen, destino)

### 3. `costeo_tarifas` (tabla principal — la matriz)

Una fila = una oferta de un agente para una ruta y naviera, vigente en un rango.

- `agente_id` (FK `costeo_agentes_proveedores`)
- `naviera_id` (FK `navieras`)
- `ruta_id` (FK `costeo_rutas`)
- `tipo_contenedor_id` (FK `tipos_contenedor`, típicamente 20'/40')
- `moneda` (default 'USD')
- `flete_base` (numeric)
- `dias_libres_demoras` (int, **criterio de desempate secundario**)
- `vigente_desde` (date)
- `vigente_hasta` (date)
- `transit_time_dias` (int, informativo)
- `notas` (texto)
- `estado` (`borrador` | `vigente` | `vencida` — calculada/actualizada)
- `creado_por`, timestamps
- UNIQUE(agente, naviera, ruta, tipo_contenedor, vigente_desde)

### 4. `costeo_tarifa_recargos`

Conceptos variables (BAF, LSS, ISPS, THC origen, THC destino MX, DTHC, handling…) ligados a cada tarifa:

- `tarifa_id` (FK con cascade)
- `concepto` (enum/texto controlado)
- `lado` (`origen` | `destino`)
- `monto` (numeric)
- `moneda`
- `incluido_en_total` (bool, default true)

> Separar recargos permite ver el desglose, mantener el flete base limpio y sumar el "precio total comparable" en una vista.

### Vista `costeo_tarifas_vigentes_v`

Vista que calcula:

- `total_comparable` = `flete_base + SUM(recargos.incluido_en_total)`
- Filtra `vigente_desde <= :fecha AND vigente_hasta >= :fecha`
- Trae `dias_credito` del agente para ranking
- Une nombres de puerto/naviera/agente para la UI

---

## Motor de ranking (Top 3)

RPC `obtener_top_tarifas(p_ruta_id, p_tipo_contenedor_id, p_fecha)` que devuelve 3 filas ordenadas por:

1. `total_comparable` ASC
2. `dias_credito` DESC  *(desempate principal — más crédito gana)*
3. `dias_libres_demoras` DESC  *(desempate secundario)*
4. `vigente_hasta` DESC  *(prefiere la que dure más)*

Si no hay vigentes, devuelve vacío y la UI muestra "Sin tarifas vigentes para esta ruta/contenedor".

---

## UI / Navegación

Nueva sección de sidebar **"Costeo"** (rol: ops y admin):

- `/costeo/tarifas` — Lista paginada (DataTable) con filtros: ruta, naviera, agente, contenedor, estado (vigente/por vencer/vencida). Badge de color por estado. Botón "Nueva tarifa".
- `/costeo/tarifas/nueva` y `/costeo/tarifas/:id/editar` — Formulario con:
  - Selectores: Agente, Naviera, Puerto origen (CN), Puerto destino (MX), Tipo contenedor
  - Flete base + moneda
  - Fechas vigencia (desde/hasta)
  - Días libres demoras, transit time
  - Tabla embebida de Recargos (add/remove, concepto, lado, monto)
  - Notas
- `/costeo/agentes` — Gestión de agentes/proveedores con `dias_credito`.
- `/costeo/rutas` — Alta rápida de pares CN→MX (selector restringido por país).

### Integración con Cotizaciones (lookup)

En el paso de Ruta del wizard de Cotización marítima FCL: cuando estén definidos origen, destino y tipo de contenedor, mostrar un panel lateral **"Sugerencias de Costeo"** con el Top 3:

```text
┌──────────────────────────────────────────────┐
│ Top tarifas vigentes  Shanghai → Manzanillo │
├──────────────────────────────────────────────┤
│ 1) USD 2,450 · MSC · Agente ABC             │
│    Crédito 45 d · 14 d libres · Vence 30/06 │
│ 2) USD 2,510 · COSCO · Agente XYZ           │
│    Crédito 30 d · 21 d libres · Vence 15/07 │
│ 3) USD 2,580 · ONE · Agente DEF             │
│    Crédito 30 d · 14 d libres · Vence 20/06 │
└──────────────────────────────────────────────┘
```

El usuario decide; nada se inserta automáticamente.

---

## Reglas de negocio

- Estado `vencida` se calcula en lectura (vista) — no requiere job nocturno en v1.
- Edición de tarifa vigente queda registrada en `bitacora_actividad`.
- Eliminar tarifa requiere doble confirmación (typable "ELIMINAR") siguiendo el estándar del proyecto.
- Toda la captura está en MXN/USD; la comparación se hace en USD (moneda canónica del flete marítimo). Si llega en otra moneda, se convierte con `useExchangeRates`.
- IVA no aplica en flete internacional China→MX → no tocar `useTasaIVA`.

---

## Seguridad (RLS)

- Lectura: cualquier miembro de la organización.
- Escritura (insert/update/delete): roles `admin`, `ops_manager`, `coordinador` (a confirmar con `roles-catalog`).
- Multi-tenant: `organization_id` en todas las tablas; políticas usando `organization_members`.

---

## Detalles técnicos

- Hooks: `useCosteoTarifas`, `useCosteoTarifa(id)`, `useUpsertCosteoTarifa`, `useTopTarifas(rutaId, contenedorId, fecha)`, `useCosteoAgentes`, `useCosteoRutas`.
- Servicios: `src/services/costeo/{tarifas,agentes,rutas}.ts`.
- Feature folder: `src/features/costeo/` con `components/`, `domain/`, `routes/`, `hooks/`, `types/`.
- Cumple Power of 10: componentes ≤200 líneas, sin `any`, paginación server-side en lista.
- `CHANGELOG.md` + bump `APP_VERSION` al cerrar la implementación.
- Memory nueva: `mem://features/costeo-tarifas-maritimas` (modelo, reglas de ranking, criterios de desempate).

---

## Entregables por fase

**Fase 1 — Cimientos (1 migración + catálogos UI)**

- Migración con 4 tablas, vista, RPC, RLS, GRANTs.
- CRUD de Agentes y Rutas.

**Fase 2 — Matriz de tarifas**

- Lista, formulario nuevo/editar, recargos embebidos.
- Filtros y badges de estado.

**Fase 3 — Integración con Cotizaciones**

- Panel "Top 3" en el wizard marítimo FCL.
- Memory + changelog.

---

## Preguntas abiertas (opcional aclarar antes de Fase 1)

1. ¿La lista de puertos principales de China la cargo yo (Shanghai, Ningbo, Shenzhen/Yantian, Qingdao, Xiamen, Tianjin/Xingang, Guangzhou) o ya están todos en `puertos`? Tu
2. ¿Quieres que el "lado destino MX" (THC, handling local) se capture en este módulo o vive en otro lado para no duplicar? Va a ser en el modulo de costeo, pero dentro de submodulos.
3. ¿Algún umbral para marcar "por vencer" (ej. ≤ 7 días)?

Si me confirmas estas tres puedo arrancar Fase 1 en cuanto pases a build mode.