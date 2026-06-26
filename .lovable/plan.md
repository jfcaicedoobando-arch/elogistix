## Objetivo
Dejar `bun run lint -- --max-warnings 0` en verde arreglando los 2 hallazgos del CI:

1. **Error** `@typescript-eslint/no-explicit-any` en `supabase/functions/_shared/facturapiAuth.ts:56`.
2. **Warning** `complexity` (20 > 16) en `DashboardEjecutivoFacturacion.tsx:100`.

## Cambios

### 1. `supabase/functions/_shared/facturapiAuth.ts`
- Reemplazar el parámetro `supabase: any` por un tipo mínimo estructural local (no importamos `SupabaseClient` para no acoplar la edge function al SDK ni romper otros llamadores). Ejemplo:
  ```ts
  type SupabaseLike = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: FacturapiCredencialRow | null; error: unknown }>;
        };
      };
    };
  };
  ```
  Y `resolveFacturapiKey(supabase: SupabaseLike, organizationId: string)`.
- Alternativa más simple si el tipo estructural se complica: usar `// SAFE-CAST: Deno edge — supabase client typing` + `// eslint-disable-next-line @typescript-eslint/no-explicit-any`. Preferimos la primera (tipo estructural) para cumplir Power of 10 sin marcador.

### 2. `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
La complejidad viene de los ternarios inline anidados en los props de los `<Kpi>` ("Facturado mes": label, tone y hint con `(dash.data?.facturas_sin_tc ?? 0) > 0` repetido 3 veces).

- Extraer al inicio del componente:
  ```ts
  const sinTc = (dash.data?.facturas_sin_tc ?? 0) > 0;
  const facturadoLabel = sinTc ? "Facturado mes ⚠️" : "Facturado mes";
  const facturadoTone = sinTc ? "warn" : "default";
  const facturadoHint = sinTc ? `...${dash.data?.facturas_sin_tc}...` : "...";
  const porTimbrarTone = porTimbrar > 0 ? "warn" : "default";
  ```
- Sustituir los ternarios inline en el JSX por estas constantes. Esto baja la complejidad ciclomática por debajo de 16 sin cambiar comportamiento visible.

## Verificación
- `bun run lint -- --max-warnings 0` debe terminar con exit 0.
- No tocar lógica de datos ni UI visible. Sólo refactor de claridad + tipado.
- Bump `APP_VERSION` a `13.136.5` y agregar entrada en `CHANGELOG.md`.

## Riesgos
- Mínimos: el tipo estructural de `SupabaseLike` podría no cubrir algún llamador futuro, pero los 4 callers actuales (las edge functions facturapi-*) pasan el cliente creado con `createClient`, que cumple esa forma.
