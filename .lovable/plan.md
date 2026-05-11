## Objetivo

Cuando JSONCargo (y a futuro otros adaptadores) no entreguen un campo explícito de ATA pero el último movimiento del contenedor ya esté en el puerto de descarga (descargado / disponible / en patio), tomar la fecha de ese último movimiento como **ATA propuesta** y permitir aplicarla a `embarques.fecha_llegada_real`.

## Lógica de inferencia (edge function `jsoncargo-track`)

En `_shared/jsoncargo.ts` añadir `pickEffectiveAta(data)`:

1. Si existe un campo explícito de ATA (no lo hay hoy en JSONCargo) → usarlo.
2. Si `last_location` coincide con `discharging_port` (ya hay heurística `isAtDestination`) **Y** `container_status` indica arribo/descarga/disponible:
   - Patrones: `discharged`, `unloaded`, `available`, `gate out`, `delivered`, `at yard`, `empty returned`, `released`.
3. Tomar `timestamp_of_last_location` (preferido) o `last_movement_timestamp` como ATA.
4. Devolver `null` si nada aplica.

En el evento derivado existente (`Arribo a Puerto`) ya se genera la fila — no se duplica nada, solo se propone la fecha al embarque.

## Cambios

**`supabase/functions/_shared/jsoncargo.ts`**
- Nueva función `pickEffectiveAta(data): { iso: string | null, isInferred: boolean }`.

**`supabase/functions/jsoncargo-track/index.ts`**
- Calcular `ataPropuesta` (date YYYY-MM-DD).
- Agregar al `summary`: `ata_propuesta`, `ata_actual` (= `embarque.fecha_llegada_real`), `ata_difiere`, `ata_is_inferred`.

**`src/hooks/embarque/useJsonCargoTracking.ts`**
- Extender `JsonCargoSummary` con los 4 campos nuevos.
- Reflejar la misma heurística en `extractSummary()` (para el payload cacheado).
- Extender `useApplyJsonCargoFechas` para aceptar `ata?: string | null` y escribir `fecha_llegada_real`.

**`src/components/embarque/TrackingLiveCard.tsx`**
- Mostrar bloque "ATA propuesta" cuando `ata_propuesta && ata_difiere`, con badge "Inferida del último movimiento" si `ata_is_inferred`.
- Botón "Aplicar fecha de arribo" → llama al hook con `ata`.
- Si ya se desea aplicar todo junto, incluir ATA en la acción "Aplicar todas".

**Changelog y versión**
- `APP_VERSION` → `8.135.0` (feature menor).
- Entrada en `Changelog.tsx` y `src/content/changelog/v8/chunks/0.ts`.

## Notas

- No se hardcodea ATA si el estado no es claramente "ya descargado/disponible" — si solo dice "on vessel" en el puerto destino (buque atracado pero contenedor aún a bordo), no se propone, para evitar adelantar la fecha real de descarga.
- Cuando se implemente el adaptador AI (Wan Hai etc.), se reutiliza la misma forma de `summary` y la UI ya soportará ATA inferida.
