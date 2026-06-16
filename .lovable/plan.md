# Pack B Extendido — Herencia ampliada cotización → embarque

Extiende el mapper de vinculación para que al crear un embarque desde una cotización se hereden 7 campos adicionales (tarifa, garantías, demoras, almacenaje, seguro, notas), y se muestre un `HeredadoBadge` en todos los campos del wizard de embarque que vienen de la cotización.

## Alcance funcional

Al vincular cotización → embarque, además de lo ya heredado se traerán:

| Campo cotización | Campo embarque (nuevo) | Tipo |
|---|---|---|
| `tarifa_id` | `tarifa_id` | uuid FK → `costeo_tarifas` |
| `carta_garantia` | `carta_garantia` | boolean |
| `dias_libres_destino` | `dias_libres_destino` | integer |
| `dias_almacenaje` | `dias_almacenaje` | integer |
| `seguro` | `seguro` | boolean |
| `valor_seguro_usd` | `valor_seguro_usd` | numeric |
| `notas` | `notas` | text |

Al **desvincular** la cotización, estos campos se limpian a su default (igual que el patrón actual en `DESVINCULAR_DEFAULTS`).

## Cambios técnicos

### 1. Migración DB
Una sola migración que añade 7 columnas a `public.embarques`:
- `tarifa_id uuid NULL REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL`
- `carta_garantia boolean NOT NULL DEFAULT false`
- `dias_libres_destino integer NOT NULL DEFAULT 0`
- `dias_almacenaje integer NOT NULL DEFAULT 0`
- `seguro boolean NOT NULL DEFAULT false`
- `valor_seguro_usd numeric(14,2) NULL`
- `notas text NULL`

No requiere cambios de RLS (políticas existentes ya cubren todas las columnas).

### 2. Tipos y mapper
- `CotizacionParaVincular` (`src/lib/mappers/embarqueCotizacion.ts`): añadir los 7 campos opcionales.
- `buildVincularCotizacionUpdates`: emitir nuevos `FieldUpdate` para cada campo.
- `DESVINCULAR_DEFAULTS`: agregar defaults de limpieza.
- Tests en `embarqueCotizacion.test.ts`: cubrir vincular y desvincular para cada campo nuevo.

### 3. Form values
- `EmbarqueFormValues` (`src/lib/mappers/embarqueFromDb.ts`): agregar `tarifaId`, `cartaGarantia`, `diasLibresDestino`, `diasAlmacenaje`, `seguro`, `valorSeguroUsd`, `notas`.
- `mapEmbarqueRowToFormValues`: leer desde la row.
- `embarqueToDb.ts`: serializar al payload de insert/update.
- `useEmbarqueForm.ts`: defaults vacíos y `vincularCotizacion` propagando los nuevos campos vía `setValue({shouldValidate, shouldDirty})` + `trigger()`.

### 4. UI wizard de embarque + HeredadoBadge
- Detectar herencia: un campo se considera heredado si `cotizacion_id` está presente y el valor actual coincide con el de la cotización original (mismo patrón que ya usa `TarifaFields`).
- Hook utilitario `useHeredadoCotizacion(field)` en `src/features/embarques/hooks/` para centralizar la comparación y evitar duplicación.
- Agregar `<HeredadoBadge />` junto a los labels de los campos heredados en las secciones del wizard de embarque:
  - Datos generales: cliente, modo, tipo, incoterm, tipo_carga, tipo_contenedor
  - Mercancía: descripción, peso, volumen, piezas, seguro, valor seguro, notas
  - Ruta: puerto/aeropuerto/ciudad origen y destino
  - Tarifa/condiciones: tarifa marítima, carta garantía, días libres, días almacenaje
  - MSDS

### 5. Auto-cálculos derivados
Como `tarifa_id`, `carta_garantia` y `dias_libres_destino` ya alimentan a los hooks de garantías y demoras existentes (ver mem://features/garantias-demoras), heredarlos hará que esos cálculos se activen automáticamente en el nuevo embarque sin código extra.

### 6. Metadata
- Bump `APP_VERSION` → `13.33.0`.
- Entrada en `CHANGELOG.md` (root) con bullet breve.

## Fuera de alcance
- `tarifa_demoras_venta_id` (no existe en `cotizaciones`).
- `dimensiones_lcl` / `dimensiones_aereas` (estructuras JSON complejas, requieren UI dedicada; se proponen para un pack futuro).
- Refactor de campos existentes ya heredados sin badge previo — se agrega badge pero no se reescribe lógica.

## Orden de ejecución
1. Migración DB (espera aprobación).
2. Tipos regenerados → mapper + form values + serialización.
3. Hook `useHeredadoCotizacion` + badges en UI.
4. Tests del mapper.
5. Bump versión + changelog.
