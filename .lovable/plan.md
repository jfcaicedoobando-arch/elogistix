# Fix: tab "Todos" en Proveedores no muestra nada

## Causa raíz

La función RPC `public.proveedores_listado` tiene **3 firmas distintas** conviviendo en la base de datos (residuo de migraciones incrementales). PostgREST no puede elegir cuál llamar cuando el cliente no envía los parámetros opcionales (caso del tab "Todos") y responde con error `PGRST203`. El componente `ProveedorTable` recibe `undefined` y renderiza "Sin proveedores registrados".

Las otras pestañas (Logístico / Gasto operativo) funcionan porque sí mandan `p_categoria` y eso desambigua hacia la firma más nueva.

## Solución

Migración que elimina las 2 firmas viejas y conserva sólo la firma actual (la de 8 parámetros con `p_origen`, `p_categoria`, `p_subtipo_gasto`).

```sql
DROP FUNCTION IF EXISTS public.proveedores_listado(uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.proveedores_listado(uuid, text, text, integer, integer, text);
-- Se conserva: proveedores_listado(uuid, text, text, integer, integer, text, text, text)
```

Antes de ejecutar verifico con `pg_proc` las firmas exactas y los `DROP` quedan acotados a esas dos.

## Validación post-migración

1. Recargar `/proveedores` con tab "Todos" → debe listar los 20 proveedores que ya devuelve la firma nueva cuando se llama con `p_categoria='Logistico'`.
2. Tabs "Logístico" y "Gasto operativo" deben seguir funcionando igual.
3. Bump `APP_VERSION` a 12.76.5 + entrada en `CHANGELOG.md`.

## Alcance

- 1 migración SQL (sólo DROP, sin tocar la firma activa ni datos).
- 1 edit en `src/constants/appVersion.ts`.
- 1 edit en `CHANGELOG.md`.

No se tocan componentes React ni hooks: el bug es 100% de base de datos.
