## Problema

En `SelectorSustituta.tsx` (línea 51-52) cada item del dropdown se renderiza como:

```
{serie} · Folio {folio_fiscal} — {numero}
```

Con datos reales sale: **"F · Folio 988 — F988"**. `numero` ya es la concatenación de `serie` + `folio_fiscal` ("F988"), así que el folio aparece dos veces.

## Solución

Simplificar la etiqueta del `SelectItem` para mostrar el número humano y (si existe) el UUID SAT truncado como pista de auditoría, sin duplicar el folio:

```
{s.numero ?? `${s.serie ?? ""}${s.folio_fiscal ?? ""}`}{s.uuid_fiscal ? ` · UUID ${s.uuid_fiscal.slice(0, 8)}…` : ""}
```

Ejemplo resultante: **"F988 · UUID 160A0EBE…"**.

## Archivo tocado

- `src/features/facturacion/components/cancelacion/SelectorSustituta.tsx` — solo el contenido del `<SelectItem>`.

Sin cambios de datos, servicios ni de otros componentes. Bump `APP_VERSION` a `13.301.24` y entrada en `CHANGELOG.md`.
