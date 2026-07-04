## Problema

Al timbrar, el usuario ve un mensaje genérico: **"No se pudo timbrar: facturapi_error"**. No sabemos qué falló realmente (RFC inválido, CP, moneda, código SAT, key de sandbox vs live, etc.) por dos bugs que se refuerzan:

1. **La respuesta 502 de la edge function no incluye `message`**. Devuelve `{ error: "facturapi_error", status, detail }`. El cliente (`toReadableError` en `facturapi.ts`) usa `body.message ?? body.error`, así que sólo ve `"facturapi_error"`.
2. **El insert a `bitacora_actividad` usa la columna equivocada**: el código pasa `detalle: {...}` pero la tabla se llama `detalles`. Los ocho edge functions de FacturApi tienen el mismo typo, por eso al consultar `bitacora_actividad WHERE accion='facturapi_emitir_failed'` no aparece nada — el insert falla en silencio y perdemos toda la forensía.

## Solución

### 1. Devolver el mensaje humano en la respuesta 502

En `supabase/functions/facturapi-emitir/index.ts` (y los 7 hermanos: `facturapi-cancelar`, `facturapi-emitir-rep`, `facturapi-cancelar-rep`, `facturapi-emitir-nota-credito`, `facturapi-cancelar-nota-credito`, `facturapi-descargar`, `facturapi-enviar-email`), extraer un `message` desde `detail` (que suele ser `{ message: "…" }` o `{ error: "…" }` según lo que devuelve FacturApi) y agregarlo al JSON:

```ts
const humanMessage =
  (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string")
    ? detail.message
    : `FacturApi respondió ${status}`;
return json({ error: "facturapi_error", status, detail, message: humanMessage }, 502);
```

Con eso, `toReadableError` del cliente muestra el motivo real ("El RFC del receptor no es válido", "El código postal no coincide con el régimen fiscal", etc.).

### 2. Corregir el nombre de columna en los 8 edge functions

Renombrar la llave `detalle:` → `detalles:` en todos los `bitacora_actividad.insert({...})` de:
- `facturapi-emitir/index.ts` (2 ocurrencias)
- `facturapi-emitir-rep/index.ts` (2)
- `facturapi-emitir-nota-credito/index.ts` (2)
- `facturapi-cancelar/index.ts` (2)
- `facturapi-cancelar-rep/index.ts` (2)
- `facturapi-cancelar-nota-credito/index.ts` (2)
- `facturapi-enviar-email/index.ts` (2)
- `facturapi-webhook/index.ts` (2)

A partir de ahí, podré consultar `bitacora_actividad` para ver el detalle exacto de cualquier fallo futuro sin depender de logs del runtime.

### 3. CHANGELOG + versión

- `src/constants/appVersion.ts` → `13.170.18`
- Entrada `## [13.170.18] - 2026-07-04` en `CHANGELOG.md` (root) explicando: exponer motivo real de FacturApi + fix de columna `detalles` en bitácora.

## Fuera de alcance

- No se tocan RLS ni migraciones.
- No se cambia UI ni hooks del cliente (`toReadableError` ya sabe usar `message`).
- No se instala nada nuevo.

## Analogía

Ahorita FacturApi grita el motivo del rechazo pero nosotros sólo repetimos "algo salió mal": vamos a repetir la queja tal cual al usuario. Y al mismo tiempo destapamos la cajita negra (bitácora) que llevaba semanas sin registrar nada porque estábamos guardando en una gaveta con nombre equivocado.

## Siguiente paso tras el deploy

Pedirle a Karol reintentar el timbrado; el toast va a mostrar el motivo real y, si aún falla, la fila en `bitacora_actividad` tendrá el JSON completo de FacturApi para diagnóstico definitivo (probablemente falta configurar el ambiente correcto, RFC, o algún catálogo SAT en la factura).
