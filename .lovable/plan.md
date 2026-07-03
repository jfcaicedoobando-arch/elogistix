## Diagnóstico

La última migración de `convertir_proformas_a_factura` (20260703230529) llama a `public.idempotency_commit(uuid, text, jsonb)`, pero esa función no existe. Las únicas funciones disponibles son:

- `idempotency_claim(_key uuid, _fn text)`
- `idempotency_store(_key uuid, _response jsonb)`

Es el mismo error que se corrigió en 13.170.5 y regresó al recrear la RPC en 13.170.8.

**Analogía:** es como si al reescribir una receta cambiaste el nombre de un ingrediente por uno inexistente en la despensa; la despensa sigue teniendo `idempotency_store`, no `idempotency_commit`.

## Cambios

1. **Nueva migración** que hace `CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura` reemplazando el bloque final:

   ```sql
   PERFORM public.idempotency_store(
     p_request_id,
     jsonb_build_object('factura_ids', to_jsonb(v_factura_ids))
   );
   ```

   El resto del cuerpo queda igual (incluye la corrección previa de `estado_proforma`/`fecha_facturacion`).

2. **`src/constants/appVersion.ts`** → `13.170.9`.

3. **`CHANGELOG.md`** → entrada `[13.170.9] - 2026-07-03`: fix DB `42883 idempotency_commit does not exist`, se restaura la llamada a `idempotency_store(uuid, jsonb)`.

## Verificación

- Confirmar en el preview que Karol/Isela puedan convertir la proforma `894e5e0a…` sin error 42883.
