## El bug (analogía)

`supabase.rpc` es como un mesero: sabe llevarte el platillo, pero **necesita saber a qué mesa pertenece** (el `this`). En `versionado/index.ts` hacemos:

```ts
function rpc(): RpcCaller {
  return supabase.rpc as unknown as RpcCaller;  // ← lo arrancamos del restaurante
}
// luego:
rpc()("recotizar_cotizacion", {...});  // mesero sin mesa → busca `this.rest` → undefined
```

Al guardar `supabase.rpc` como función suelta y llamarla después, **pierde el `this`**. Internamente Supabase intenta `this.rest...` y truena con:
> Cannot read properties of undefined (reading 'rest')

Por eso el tab de Conciliación falla: hace `obtenerCostosCotizacionVersion` → `rpc()(...)` → boom.

## Fix (1 línea)

Archivo: `src/features/cotizacion/services/versionado/index.ts`

```ts
function rpc(): RpcCaller {
  // SAFE-CAST: RPCs nuevas (Fase 2) aún no están en los tipos generados.
  return supabase.rpc.bind(supabase) as unknown as RpcCaller;
}
```

`.bind(supabase)` le amarra la mesa al mesero. Mismo cast, mismo tipo, sin tocar nada más.

## Validación

1. Recargar `/embarques/.../?tab=conciliacion` → tabla debe renderizar (o mostrar "sin cotización" limpio).
2. El embarque actual no tiene `version_aceptada` ni delta, así que `cotizados=[]`, `reales=[Flete Marítimo USD 912.81]` → debe mostrar 1 fila sólo en columna Real.

## Changelog

- Bump `APP_VERSION` patch y entrada en `CHANGELOG.md` raíz:
  `Fix: tab Conciliación dejaba de cargar por pérdida de contexto en supabase.rpc del servicio de versionado.`

## Sin cambios

- No se tocan tipos, RPCs, ni otros consumidores.
- No se toca UI de TabConciliacion.
