## Diagnóstico

ELIMP00273 (cotización COT-2026-0077, **LCL**) está guardado así:

| | parent embarque | contenedor hijo único |
|---|---|---|
| peso_kg | 0 | 0 |
| volumen_m3 | 0 | 0 |
| piezas | 0 | 0 |
| tipo_contenedor | LCL | LCL |
| numero_contenedor | — | (vacío) |

La cotización origen sí tiene la información de la mercancía:
- `peso_kg = 0`, `volumen_m3 = 4.09274`, `piezas = 3`
- `dimensiones_lcl = [{l:86,a:175,h:113,pzs:2,vol:3.4013}, {l:67,a:120,h:86,pzs:1,vol:0.69144}]`

Eso es lo que el usuario percibe como "antes tenía contenedores y ahora le falta información": la pieza de mercancía/volumen/piezas nunca se persistió en el embarque al crearse desde el wizard.

## Causa raíz (dos bugs concurrentes)

### Bug A — Wizard no siembra el contenedor LCL desde la cotización

`src/lib/mappers/embarqueCotizacion.ts → buildContenedoresPlaceholder` sólo crea placeholders cuando la cotización es **FCL**:

```ts
if (!esFCL(cot) || !esModoMaritimo(cot.modo)) return [];
```

Para cotizaciones **LCL**, el array `contenedores` del form queda vacío. Luego `StepDatosRutaMaritimo` (al cambiar de modo) lo inicializa con `[crearContenedorVacio(1)]` — **un contenedor con peso/volumen/piezas = 0**. El usuario nunca llena ese formulario porque la pantalla ya muestra "vinculada a COT-…".

### Bug B — Trigger `sync_embarque_desde_contenedor` borra los totales del parent

Aunque la RPC `crear_embarque_completo` (con el fix del turno anterior) insertara peso/vol/piezas correctos en `embarques`, el AFTER INSERT en `embarque_contenedores` recalcula y **sobreescribe** así:

```sql
UPDATE public.embarques
SET peso_kg = v_total_peso,           -- suma de hijos
    volumen_m3 = v_total_vol,
    piezas = v_total_piezas,
    contenedor = …, tipo_contenedor = …
WHERE id = v_embarque_id;
```

Con un hijo placeholder en ceros → el parent termina en ceros. El trigger es correcto en intención (los hijos son fuente de verdad), pero choca con un wizard que entrega hijos sin datos.

## Alcance

Mismo patrón en los embarques que vinculé en el turno anterior:

| Expediente | Cotización LCL? | Estado del parent ahora | Acción |
|---|---|---|---|
| **ELIMP00273** | LCL con `vol=4.09, pzs=3` | parent 0/0/0, hijo único 0/0/0 | **backfill** (datos sí existen en la cot) |
| ELIMP00232 | LCL pero cot con 0/0/0 | parent ya recalculado por operativos (2904 kg, 30 pzs) vía hijos editados | nada (ya está OK) |
| ELIMP00184/00204/00262 | FCL, cot sin peso/vol | hijos ya editados manualmente con datos reales | nada |

Sólo **ELIMP00273** requiere backfill puntual.

## Fix

### 1. Backfill ELIMP00273 (data-only, idempotente)

Migración con `SET LOCAL app.bypass_cierre = 'on'` (el embarque está en estado `Confirmado`, pero seguimos el mismo patrón de seguridad del turno anterior).

```sql
-- Sembrar el contenedor hijo único con los totales de la cotización LCL
UPDATE public.embarque_contenedores
   SET peso_kg = 0,
       volumen_m3 = 4.09274,
       piezas = 3,
       tipo_contenedor = COALESCE(NULLIF(tipo_contenedor, ''), 'LCL')
 WHERE id = '76866c80-675d-4b36-81cc-28211c131c88'
   AND peso_kg = 0 AND volumen_m3 = 0 AND piezas = 0;
```

El propio trigger `sync_embarque_desde_contenedor` propagará la suma al parent (`embarques.peso_kg/volumen_m3/piezas`), así que **no tocamos `embarques` directamente** — el embarque queda consistente por construcción.

### 2. Fix del wizard: sembrar contenedor LCL con totales de la cotización

`src/lib/mappers/embarqueCotizacion.ts`:

- Renombrar/extender `buildContenedoresPlaceholder` para que:
  - Si es **FCL marítimo** → comportamiento actual (N placeholders con `tipo_contenedor`).
  - Si es **LCL marítimo** → devolver **un único** contenedor pre-rellenado con `peso_kg = cot.peso_kg`, `volumen_m3 = cot.volumen_m3`, `piezas = cot.piezas`, `tipo_contenedor = "LCL"`.
  - Cualquier otro modo → `[]` (sin cambios).

- Esto sembrará valores reales en el form ANTES de que `StepDatosRutaMaritimo` cree el placeholder vacío. Hay que verificar el orden de hidratación; si `StepDatosRutaMaritimo` machaca a `[crearContenedorVacio(1)]` cuando detecta `contenedores.length === 0 && modo === 'Marítimo'`, ya no se ejecuta (porque el mapper sembró 1).

- Tests nuevos en `embarqueCotizacion.test.ts`:
  - LCL marítimo → 1 contenedor con `tipo_contenedor: "LCL"` y totales = cotización.
  - LCL aéreo o terrestre → `[]` (sin cambios).
  - FCL → comportamiento actual preservado.

### 3. Sanity check de invariantes

Añadir un test de integración ligero (puede ser sólo unitario contra el mapper + `deriveContenedoresPayload`) que verifique: para cotización LCL con vol > 0, el payload de contenedores entregado al wizard nunca es `[{peso:0, vol:0, piezas:0}]`.

### 4. Metadatos

- `APP_VERSION` → `13.66.8`.
- `CHANGELOG.md` con entrada describiendo (a) bug LCL del mapper, (b) interacción con trigger `sync_embarque_desde_contenedor`, (c) backfill puntual de ELIMP00273.

## Archivos a tocar

- `supabase/migrations/<ts>_backfill_elimp00273_contenedor_lcl.sql`
- `src/lib/mappers/embarqueCotizacion.ts`
- `src/lib/mappers/__tests__/embarqueCotizacion.test.ts` (+ `embarque.test.ts` si comparte fixtures)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## No tocar

- El trigger `sync_embarque_desde_contenedor` se conserva: la fuente de verdad de los totales son los hijos.
- La RPC `crear_embarque_completo` ya quedó arreglada en 13.66.7; el problema actual es upstream (mapper → form).
- Embarques ELIMP00184/00204/00232/00262 NO se tocan: sus contenedores ya tienen datos reales cargados por operativos.
