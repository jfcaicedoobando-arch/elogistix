# Mejoras al módulo de Rutas marítimas

## Problema actual

La tabla en `/costeo/rutas` sólo muestra: Origen, Destino, Activa (Sí/No), eliminar. La columna "Activa" es un flag manual (`costeo_rutas.activa`) que no refleja la realidad operativa: una ruta puede estar marcada como activa pero **no tener tarifas vigentes**, y por tanto ser inútil para cotizar.

## Propuesta

### 1. Nueva columna: "Tarifas vigentes"

Por cada ruta, contar las `costeo_tarifas` que cumplen:

- `ruta_id = ruta.id`
- `estado = 'vigente'` (o el estado equivalente que use el módulo)
- `vigente_hasta >= CURRENT_DATE` (o sin fecha de fin)

Mostrar como badge numérico:

- `0` → badge rojo/destructive con texto "Sin tarifa"
- `1-2` → badge ámbar "2 tarifas"
- `3+` → badge verde "5 tarifas"

### 2. Columna "Estado" calculada (reemplaza "Activa")

Lógica derivada (no sólo el flag):


| Flag `activa` | Tarifas vigentes | Estado mostrado                                           |
| ------------- | ---------------- | --------------------------------------------------------- |
| true          | ≥1               | **Activa** (verde)                                        |
| true          | 0                | **Sin tarifa** (ámbar) — *dada de alta pero no cotizable* |
| false         | cualquiera       | **Inactiva** (gris)                                       |


El flag manual sigue existiendo (permite desactivar a propósito), pero el badge refleja el estado real.

### 3. Columnas adicionales útiles

- **Próxima a vencer**: fecha de la tarifa vigente más próxima a `vigente_hasta`. Si ≤15 días, mostrar en rojo con ícono ⚠️.
- **Última actualización**: `MAX(costeo_tarifas.updated_at)` por ruta — ayuda a detectar rutas estancadas.
- **Navieras / agentes**: cantidad de proveedores distintos con tarifa en esa ruta (mini badge).

### 4. Acciones por fila

Añadir junto a "eliminar":

- **Ver tarifas** → navega a `/costeo/tarifas?ruta=<id>` (filtro pre-aplicado).
- **Nueva tarifa** → abre el modal de alta de tarifa con la ruta pre-seleccionada. Especialmente útil cuando el estado es "Sin tarifa".

### 5. Filtro y orden

- Filtro rápido arriba: `Todas` / `Activas` / `Sin tarifa` / `Inactivas`.
- Orden por defecto: rutas con problemas primero (Sin tarifa → Próximas a vencer → Activas → Inactivas).

## Alcance técnico

**Sin cambios de schema.** Toda la información ya existe en `costeo_tarifas`.

Archivos a tocar:

- `src/features/costeo/services/rutas.ts` — extender `fetchCosteoRutas` para hacer un join/agregación con `costeo_tarifas` (subquery o segundo query agrupado por `ruta_id`).
- `src/features/costeo/types/index.ts` — añadir a `CosteoRuta`: `tarifas_vigentes_count`, `proxima_expiracion`, `ultima_actualizacion_tarifa`, `proveedores_count`.
- `src/features/costeo/routes/CosteoRutas.tsx` — nuevas columnas, badges, filtro, orden.
- Helper nuevo `src/features/costeo/utils/rutaEstado.ts` — función pura que dado `(ruta, tarifasCount)` devuelve `{ label, variant, tone }`.
- Tests: extender `rutas.test.ts` con el agregado de conteo y un test unitario para `rutaEstado.ts`.

**Sin tocar:** RLS, edge functions, migración. El conteo se hace client-side leyendo `costeo_tarifas` filtradas por org (RLS ya lo cubre).

**Versión:** bump `APP_VERSION` a `13.67.5` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se modifica el modelo de datos.
- No se altera el wizard de cotización ni la búsqueda de tarifas.
- No se toca el flag manual `activa` (sigue siendo editable más adelante; ahora sólo lectura).

## Preguntas opcionales (puedo asumir defaults si prefieres avanzar)

1. ¿El umbral de "próxima a vencer" debe ser **15 días** o prefieres otro (7/30)? 7 dias 
2. ¿"Ver tarifas" debe abrir la página de tarifas filtrada, o un panel lateral con las tarifas inline?abrir página 