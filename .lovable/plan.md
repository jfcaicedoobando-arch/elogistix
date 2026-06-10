
# Fase 2 — Costeo: Condiciones de Naviera + Vínculo a Proveedores

Amplía el módulo Costeo existente para reflejar el modelo real: el **agente de carga** cobra el flete; la **naviera** cobra garantía de contenedor y demoras. Agrega "Carta Garantía" como flag global por naviera y un tabulador escalonado de demoras. Además, vincula agentes y navieras al catálogo de Proveedores de forma obligatoria.

## 1. Cambios en base de datos

### 1.1 `costeo_agentes` — vínculo obligatorio a Proveedores
- `proveedor_id` pasa a **NOT NULL** y FK a `proveedores.id` (restrict on delete).
- Migración: bloquear la migración si hay filas con `proveedor_id` null hasta que el usuario las reasocie (o seedear desde Proveedores tipo "Agente de Carga" país CN). En esta fase asumimos cero filas previas (módulo recién creado) y aplicamos NOT NULL directo.
- En el alta de agente: el formulario obliga a elegir un proveedor existente (tipo "Agente de Carga", país CN); si no existe, link para "Crear proveedor" antes de continuar.

### 1.2 Nueva tabla `costeo_navieras_condiciones`
Una fila por **(organization_id × naviera_id)** — condiciones comerciales que negociamos con cada naviera.

Campos de dominio:
- `naviera_id` FK `navieras.id`
- `proveedor_id` FK `proveedores.id` **NOT NULL** (tipo "Naviera") — vínculo obligatorio
- `tiene_carta_garantia` boolean default false
- `carta_garantia_vigente_hasta` date null
- `carta_garantia_folio` text null
- `carta_garantia_notas` text null
- `dias_libres_demoras_default` int default 0 — días libres estándar antes de cobrar demoras
- `moneda_demoras` text default 'USD'
- `notas` text null

Constraints:
- UNIQUE (organization_id, naviera_id)
- CHECK: si `tiene_carta_garantia = true` entonces `carta_garantia_vigente_hasta IS NOT NULL`

### 1.3 Nueva tabla `costeo_naviera_demoras_tarifa`
Tabulador escalonado por naviera y tipo de contenedor.

Campos:
- `naviera_condicion_id` FK `costeo_navieras_condiciones.id` ON DELETE CASCADE
- `tipo_contenedor_id` FK `tipos_contenedor.id`
- `desde_dia` int NOT NULL (inclusive, contado desde el primer día con cargo)
- `hasta_dia` int null (null = "en adelante")
- `monto_por_dia` numeric(12,2) NOT NULL
- `moneda` text default 'USD'

Constraints:
- CHECK `desde_dia >= 1`
- CHECK `hasta_dia IS NULL OR hasta_dia >= desde_dia`
- UNIQUE (naviera_condicion_id, tipo_contenedor_id, desde_dia)
- Validación a nivel app: rangos no se traslapan dentro del mismo (naviera_condicion, tipo_contenedor).

### 1.4 RLS y GRANTs
- Ambas tablas: RLS por `organization_id` usando `organization_members` (mismo patrón que `costeo_tarifas`).
- Lectura: cualquier miembro de la organización.
- Escritura: roles `admin`, `ops_manager`, `coordinador`.
- GRANTs a `authenticated` y `service_role` en la misma migración.

### 1.5 Función de cálculo `calcular_costo_demoras(naviera_condicion_id, tipo_contenedor_id, dias_excedidos)`
- SECURITY DEFINER, STABLE.
- Recorre los rangos del tabulador y suma `monto_por_dia × días en cada tramo`.
- Devuelve `{ total: numeric, moneda: text, desglose: jsonb[] }`.
- Útil para simulaciones en el detalle de embarque/cotización.

### 1.6 Vista `costeo_top_tarifas_v` (extender la existente)
- Hacer LEFT JOIN con `costeo_navieras_condiciones` por `(organization_id, naviera_id)`.
- Exponer en cada fila del Top 3:
  - `naviera_tiene_carta_garantia`
  - `naviera_carta_garantia_vigente_hasta`
  - `naviera_dias_libres_default`
  - `naviera_demora_dia_6_usd` (lookup precalculado del tramo que cubre el día 6, como referencia visual)

## 2. Frontend

### 2.1 Nuevos archivos
```text
src/features/costeo/
  types/navieraCondicion.ts       # CosteoNavieraCondicion, DemorasTramo
  services/navieraCondiciones.ts  # CRUD + tramos de demoras
  hooks/useNavieraCondiciones.ts  # query + mutations
  routes/CosteoNavieras.tsx       # listado por naviera (200 LOC máx)
  components/NavieraCondicionForm.tsx     # form con carta garantía
  components/DemorasTarifaEditor.tsx      # tabla editable de tramos
  components/CartaGarantiaBadge.tsx       # chip "Carta Garantía vigente / Por vencer / Vencida"
```

### 2.2 Modificaciones
- `CosteoAgentes.tsx`: agregar select obligatorio "Proveedor (Agente de Carga, China)" con link a "+ Nuevo proveedor" que abra el wizard existente prefiltrado.
- Sidebar `sidebarItems.ts`: agregar "Navieras (Condiciones)" bajo el grupo Costeo.
- `appRoutes.tsx`: nueva ruta `/costeo/navieras` lazy.
- `CosteoTarifas.tsx` (placeholder de fase 2 ya existente): en la matriz/Top 3, mostrar columnas/chips de carta garantía y demoras (vienen de la vista).

### 2.3 UX de `CosteoNavieras.tsx`
- DataTable de navieras del catálogo `navieras` con badge de estatus de carta garantía y "días libres".
- Acción "Configurar" abre dialog con:
  - Switch "Carta Garantía vigente" + fecha de expiración + folio + notas.
  - Vínculo a proveedor (select obligatorio tipo Naviera).
  - Sección "Tabulador de demoras" por tipo de contenedor (20'STD, 40'STD, 40'HC, 20'RF, 40'RF):
    - Rows editables: Desde día — Hasta día — USD/día.
    - Botón "Agregar tramo".
    - Validación: rangos contiguos sin huecos ni traslapes.

### 2.4 Alertas de vencimiento
- En sidebar de Costeo, badge si hay cartas garantía con `vigente_hasta` ≤ 30 días.
- Hook `useCartasGarantiaPorVencer()` consultable también en el dashboard de Operaciones.

## 3. Integración con Cotizaciones/Embarques (preparar, no romper)
- El "Top 3" en el wizard de cotización (fase 3) mostrará por opción: flete del agente + chip de garantía/sin garantía + costo estimado de demora a N días.
- En esta fase 2 solo dejamos los datos disponibles; la UI del wizard se hará en fase 3.

## 4. Reglas de negocio
- Si una naviera **no** tiene condiciones registradas, la tarifa aparece con "Condiciones de naviera pendientes" en el Top 3 (badge ámbar).
- Carta garantía vencida = se trata como "sin carta": en el embarque se asume que habrá depósito.
- Eliminación de naviera bloqueada si existe `costeo_navieras_condiciones` (mensaje claro).

## 5. Versionado y changelog
- Bump `APP_VERSION` a **12.72.0**.
- Entrada en `CHANGELOG.md` (root): "Costeo Fase 2 — condiciones de naviera, carta garantía, tabulador de demoras escalonado y vínculo obligatorio agente↔proveedor".

## 6. Detalles técnicos (Power of 10)
- Componentes ≤ 200 LOC; partir `NavieraCondicionForm` en sub-componentes si crece.
- Sin `any`. Tipos en `src/features/costeo/types/navieraCondicion.ts`.
- Hooks con cleanup (no aplica realtime aquí).
- Cálculos monetarios via `financialUtils` / `currency.js`.
- Fechas vía utilidades UTC existentes.
- Toda mutación de condiciones se registra en `bitacora_actividad`.

## 7. Fuera de alcance (fase 3)
- UI del Top 3 dentro del wizard de cotización.
- Cálculo automático de garantía/demoras en facturación a cliente.
- Importación masiva de tabuladores desde Excel.
