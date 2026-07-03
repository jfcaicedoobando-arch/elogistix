## Bug: Convertir proforma a factura falla con `DB_ERROR`

**Analogía**: Es como llamar a una función `guardar(clave, respuesta)` pasándole tres cosas en vez de dos — Postgres no encuentra una versión con esa firma y aborta.

### Causa raíz

La RPC `public.convertir_proformas_a_factura` invoca al final:

```sql
PERFORM public.idempotency_store(
  p_request_id,
  'convertir_proformas_a_factura',   -- ← argumento de más
  jsonb_build_object('id', v_factura.id, 'numero', v_factura.numero)
);
```

Pero la función real tiene firma `idempotency_store(_key uuid, _response jsonb)` (2 args). El nombre de la función (`fn`) ya se registró antes en `idempotency_claim(p_request_id, 'convertir_proformas_a_factura')`, así que el segundo argumento es redundante.

Resultado: Postgres lanza `42883 — function public.idempotency_store(uuid, unknown, jsonb) does not exist`.

### Solución

Migración que reemplaza `convertir_proformas_a_factura` con una versión idéntica salvo por la llamada corregida:

```sql
PERFORM public.idempotency_store(
  p_request_id,
  jsonb_build_object('id', v_factura.id, 'numero', v_factura.numero)
);
```

Pasos:

1. Recuperar el cuerpo actual de `convertir_proformas_a_factura` con `pg_get_functiondef` (ya verificado).
2. Crear migración `CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(...)` con la línea corregida (mantener resto del cuerpo, security definer, search_path, permisos existentes).
3. Bump `APP_VERSION` a `13.159.2` y entrada en `CHANGELOG.md` describiendo el fix.

### Verificación

- Reintentar el flujo Proforma → Factura desde `/proformas/:id` (misma proforma del reporte) y confirmar que genera borrador sin error.
- Confirmar que reintento con el mismo `p_request_id` sigue devolviendo cached response (idempotencia intacta).

### Fuera de alcance

- No se modifica la firma de `idempotency_store` (otros callers dependen de la versión de 2 args).
- No se toca código frontend (`convertirAFactura.ts` sigue igual).
