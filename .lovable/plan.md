
# Bajar 3 warnings de `complexity` en edge functions de FacturApi

`bun run lint -- --max-warnings 0` falla por 3 warnings (nada roto en runtime, es un umbral estricto de ESLint):

| Archivo | Complexity | Máx |
|---|---|---|
| `facturapi-cancelar-nota-credito/index.ts:45` | 18 | 16 |
| `facturapi-descargar/index.ts:106` | 17 | 16 |
| `facturapi-emitir-nota-credito/index.ts:33` | 20 | 16 |

## Causa raíz

Los tres handlers repiten el mismo ternario denso para sacar el `message` humano de la respuesta de FacturApi:

```ts
const message =
  (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>)
    && typeof (detail as Record<string, unknown>).message === "string")
      ? (detail as Record<string, string>).message
      : `FacturApi respondió ${status}`;
```

Ese one-liner suma 4 ramas booleanas (`&&` + ternario) a cada handler. Sacarlo a un helper resuelve las 3 warnings sin cambiar comportamiento.

## Cambios

### 1. `supabase/functions/_shared/facturapiClient.ts` — nuevo helper

Añadir junto a `describeFacturapiError`:

```ts
export function extractFacturapiMessage(detail: unknown, status: number | string): string {
  if (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>)) {
    const m = (detail as Record<string, unknown>).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return `FacturApi respondió ${status}`;
}
```

### 2. Reemplazar el ternario in-line en los 3 archivos

- `facturapi-emitir-nota-credito/index.ts` (línea ~80)
- `facturapi-cancelar-nota-credito/index.ts` (línea ~92)
- `facturapi-descargar/index.ts` (línea ~142)

Cada uno pasa a:

```ts
const message = extractFacturapiMessage(detail, status);
```

Con eso baja al menos 3-4 puntos de complejidad ciclomática en cada handler, dejando las 3 funciones ≤16 (lint pasa con `--max-warnings 0`).

### 3. Registro

- `APP_VERSION` → `13.172.1` (patch, sin cambios funcionales).
- `CHANGELOG.md`: entrada breve — "Refactor interno: helper `extractFacturapiMessage` compartido en edge functions FacturApi para cumplir umbral de complejidad ESLint (0 warnings)."

## Fuera de alcance

- Nada de UI, nada de BD, nada de contrato de las funciones.
- No se toca la lógica de timbrado ni el badge `SANDBOX` de v13.172.0.
- No se despliegan funciones (solo pasa el lint local/CI); si quieres redeploy, lo pido explícito.

## Detalles técnicos

- `extractFacturapiMessage` es puro y typesafe. Devuelve el `message` humano cuando FacturApi envía `{ message: "..." }`, y si no, arma un fallback con el status. Se exporta del mismo módulo (`_shared/facturapiClient.ts`) que ya contiene `describeFacturapiError`, que es donde vive la lógica del SDK.
- No requiere tests nuevos (comportamiento textual idéntico, la rama ya está cubierta implícitamente por los tests que ejercen el path de error).
