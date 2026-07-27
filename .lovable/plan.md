## Bug

Al editar el embarque `ELIMP00342`, la BD rechaza el UPDATE con:

```
23514 — new row for relation "embarques" violates check constraint "embarques_tc_eur_pos"
```

## Causa raíz (verificada)

- El constraint en la BD es `CHECK (tipo_cambio_eur > 0)` (y su hermano `embarques_tc_usd_pos`). Un `NULL` está permitido; un `0` no.
- El mapper `src/features/embarques/domain/mappers/embarqueToDb.ts:105-112` hace:
  ```ts
  tipo_cambio_usd: Number(v.tipoCambioUSD),
  tipo_cambio_eur: Number(v.tipoCambioEUR),
  ```
  Cuando el usuario no captura EUR (embarque en USD, como este de Vietnam→Ensenada), `v.tipoCambioEUR` llega como `""` / `undefined`, y `Number("")` = `0`. Ese `0` es lo que la BD rechaza.

Analogía: el formulario está dejando el campo "tipo de cambio euro" en blanco, pero el mapper lo traduce como "cero pesos por euro" — un valor imposible que la báscula de la base rechaza. Hay que traducir el blanco como "no aplica" (NULL), no como "cero".

## Cambio

Un único archivo, en la capa de mapeo (presentación → BD):

**`src/features/embarques/domain/mappers/embarqueToDb.ts`** — reemplazar `partesFinancieras` para que `tipo_cambio_usd` y `tipo_cambio_eur` sean `null` cuando el valor no sea un número finito estrictamente positivo. Regla explícita:

```ts
const tcOrNull = (raw: unknown): number | null => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};
```

Aplicado a ambas monedas. Esto respeta el constraint (`NULL` permitido, `>0` permitido, `0`/`NaN`/`""` → `NULL`).

## Versionado y changelog

- Bump `APP_VERSION` a `13.320.18` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` explicando el fix.

## Verificación

- Test unitario nuevo en `src/features/embarques/domain/mappers/__tests__/embarqueToDb.test.ts` (o `embarqueRoundtrip.test.ts` si ya cubre el caso) que valide:
  - `tipoCambioEUR: ""` → `tipo_cambio_eur: null`
  - `tipoCambioEUR: "0"` → `tipo_cambio_eur: null`
  - `tipoCambioEUR: "19.87"` → `tipo_cambio_eur: 19.87`
- Correr `bun run test -- embarqueToDb` para confirmar.

## Fuera de alcance

- No se toca el constraint (`> 0` es la regla correcta del negocio).
- No se toca el formulario ni el schema Zod — el fix es en la frontera de serialización, que es donde nace el `0` fantasma.
- No se re-guardan embarques históricos: los que ya persistieron un tipo de cambio válido se quedan igual; los que fallaban al guardar volverán a funcionar en el próximo Save.
