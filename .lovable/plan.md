# Auditoría Sentry — 5 issues abiertos en 24h

## Panorama

| # | Issue | Eventos | Usuarios | Causa | Acción |
|---|---|---|---|---|---|
| 1 | `JAVASCRIPT-REACT-1M` (regressed) | 53 | 7 | **Bug real:** cast jsonb → text[] en RPC | Fix con migración |
| 2 | `JAVASCRIPT-REACT-1V` (regressed) | 21 | 2 | **Duplicado de 1M** (release distinto) | Se resuelve con el mismo fix |
| 3 | `JAVASCRIPT-REACT-25` | 1 | 1 | Config faltante (FacturApi no configurado) | Ignore + mejor UX (no como crash) |
| 4 | `JAVASCRIPT-REACT-28` | 2 | 1 | Validación del SAT (razón social ≠ RFC) | Ignore (dato del usuario, no bug) |
| 5 | `JAVASCRIPT-REACT-1Z` | 2 | 1 | HTTP 502 transitorio de FacturApi | Ignore (upstream) |

## Fix principal — Issues #1 y #2

**Síntoma:** al abrir el diálogo de timbrar/enviar factura en `/facturacion/:id`, Sentry captura `code: 22P02 – malformed array literal: "[\"karol.hernandez@..\", ..]"`. `queryKey = ["cliente_defaults_facturacion", <cliente_id>]`.

**Causa exacta:** la migración `20260707230551_688593e5-a0bf-4431-9b6d-106979898873.sql` (RPC `obtener_defaults_facturacion_cliente`) hace:

```sql
DECLARE v_last_cc text[];
...
SELECT fe.cc INTO v_last_cc
FROM public.factura_envios fe ...
```

Pero `public.factura_envios.cc` es **`jsonb`**, no `text[]`. Postgres intenta castear el jsonb (un array JSON literal `["a@x","b@x",...]`) a `text[]` y truena con:

```
"[" must introduce explicitly-specified array dimensions
```

Confirmado con `information_schema.columns`: `factura_envios.cc` = `jsonb`, y los datos reales (`SELECT cc::text FROM factura_envios`) muestran `["karol.hernandez@...", ...]` (JSON), no `{karol.hernandez@...,...}` (Postgres array).

**Fix:** cambiar el SELECT para convertir el jsonb array en `text[]` correctamente:

```sql
SELECT ARRAY(SELECT jsonb_array_elements_text(fe.cc))
  INTO v_last_cc
FROM public.factura_envios fe
JOIN public.facturas f ON f.id = fe.factura_id
WHERE f.cliente_id = p_cliente_id
  AND fe.organization_id = v_org
  AND fe.estado = 'enviado'
ORDER BY fe.created_at DESC
LIMIT 1;
```

Se hace en una nueva migración `CREATE OR REPLACE FUNCTION public.obtener_defaults_facturacion_cliente(...)`. No cambia la firma ni los `GRANT`.

**Verificación:**
- `select * from obtener_defaults_facturacion_cliente('87bdcbf1-4476-43f5-a6a2-ac4991658f6e')` debe regresar una fila con `cc_emails` como `text[]` sin lanzar `22P02`.
- Recargar `/facturacion/<id>` en preview con un cliente que tenga historial de envíos y confirmar que el diálogo abre.

**Sentry:** marcar `JAVASCRIPT-REACT-1M` y `JAVASCRIPT-REACT-1V` como `resolved` referenciando la nueva migración.

## Issues #3, #4, #5 — no son bugs de código

- **#25 – FacturApi no configurado:** un usuario intentó timbrar sin haber configurado FacturApi para su organización. El `throw` ya es intencional y muestra un mensaje claro. Recomendación: `update_issue` → `ignored` (`untilEscalating`) con `reason` explicando que es error esperado de configuración. Opcional: envolver el `throw` para no reportar a Sentry cuando el mensaje ya se muestra en toast (no lo incluyo aquí porque cambia lógica de negocio y sólo ocurrió 1 vez).
- **#28 – Razón social ≠ RFC (SAT):** el SAT rechazó el timbrado porque la razón social del receptor no coincide con la registrada en el CSF. Es dato del cliente, no un bug. Ignorar en Sentry.
- **#1Z – HTTP 502:** error transitorio de upstream (FacturApi o gateway). Ignorar en Sentry `forDuration` 1 semana; si vuelve, ya escalará solo.

## Versionado y changelog

- Bump `APP_VERSION` a `13.218.5`.
- Entrada en `CHANGELOG.md` describiendo el fix del RPC + issueIds resueltos e ignorados.

## Analogía

El RPC era como una charola marcada "sólo cubiertos" (text[]) donde alguien puso una servilleta doblada con dibujos de cubiertos (jsonb array). Cuando el mesero quería tomar cubiertos de la charola, se atoraba porque el papel no eran cubiertos. Ahora primero desdoblamos la servilleta y sacamos los cubiertos reales antes de ponerlos en la charola.
