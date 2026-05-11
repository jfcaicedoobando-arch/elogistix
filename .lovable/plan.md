# ETD/ETA original (cotizado) vs actual

## Objetivo

Conservar el ETD/ETA con el que se cotizó al cliente al momento de crear el embarque, para poder compararlo contra el ETD/ETA vigente (que se va ajustando con JSONCargo o manualmente). Hoy solo existen `embarques.etd` / `embarques.eta` y cuando se actualizan se pierde la referencia original.

## Cambios

### 1. Base de datos (migración)

En `public.embarques`:

- Agregar columnas `etd_original date` y `eta_original date` (nullable).
- Backfill: `update embarques set etd_original = etd, eta_original = eta where etd_original is null;`
- Trigger `BEFORE INSERT`: si `etd_original` viene null, copiar `etd`; igual para `eta_original`. Así, embarques creados desde cotización o desde el wizard quedan con el original automáticamente.
- No se agrega trigger de UPDATE: el original es inmutable salvo edición explícita por admin (fuera de alcance).

### 2. Tipos / mappers

- `src/integrations/supabase/types.ts` se regenera solo.
- `src/lib/mappers/embarqueFromDb.ts`: incluir `etd_original` y `eta_original` en `EmbarqueFormValues` (string, opcional) y en el mapper, solo lectura.
- `src/lib/mappers/embarqueToDb.ts`: **no** mandar `etd_original`/`eta_original` en updates; en inserts dejar que el trigger los rellene (no enviarlos desde el form).
- `useEmbarqueFull` / RPC `get_embarque_full`: si selecciona `*` ya quedan; si lista columnas explícitas, agregar las dos.

### 3. UI — `src/components/embarque/TabResumen.tsx`

En la tarjeta "Ruta y Transporte", reemplazar las líneas actuales de ETD / ETA por un bloque que muestra:

- **ETD**: fecha actual + (si difiere de original) badge gris "Original: dd MMM yyyy" y sufijo `+Nd` / `−Nd`.
- **ETA**: idem.
- Si `etd_original` y `etd` coinciden, mostrar solo la fecha sin badge.

Helper local `renderFechaConOriginal(actual, original)` que formatea con `formatDate` y calcula la diferencia en días con `differenceInCalendarDays` de date-fns (ya usado en el proyecto).

### 4. Otras vistas (alcance mínimo)

- `EmbarqueDetalleHeader`: no se toca, ya muestra ETA principal.
- Lista de embarques (`Embarques.tsx`): fuera de alcance — solo se ajusta el resumen (lo pidió el usuario).
- Portal cliente: fuera de alcance.

### 5. Versionado y changelog

- `APP_VERSION` → `8.134.0` (minor: nuevo campo persistido + UI).
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Detalle técnico — trigger

```sql
create or replace function public.set_embarque_fechas_originales()
returns trigger language plpgsql as $$
begin
  if new.etd_original is null then new.etd_original := new.etd; end if;
  if new.eta_original is null then new.eta_original := new.eta; end if;
  return new;
end $$;

create trigger embarques_set_fechas_originales
before insert on public.embarques
for each row execute function public.set_embarque_fechas_originales();
```

## Verificación

1. Embarques existentes muestran `Original` igual al ETD/ETA actuales (sin badge de diferencia).
2. Al aceptar la propuesta de JSONCargo (`useApplyJsonCargoFechas`) que solo actualiza `etd`/`eta`, el resumen muestra el original intacto y un badge `+Nd` o `−Nd`.
3. Crear un embarque nuevo desde el wizard: `etd_original`/`eta_original` quedan iguales al ETD/ETA capturado.

## Fuera de alcance

- Edición manual del original (sería una acción de admin con bitácora aparte).
- Mostrar el original en lista de embarques, dashboard u operaciones.
- Tracking público / portal cliente.
