## Diagnóstico

El radar de drift aplica TODAS las migraciones sobre una base de Postgres vacía. La que falla es:

`supabase/migrations/20260729035825_...sql` (FIX C5 — filtro `deleted_at IS NULL` en 9 RPCs).

Esa migración no escribe las funciones: las **parchea por texto**. Lee la definición vigente con `pg_get_functiondef`, busca un fragmento exacto ("ancla") y lo reemplaza. Si el ancla no aparece, el helper `_c5_patch` lanza `LC_C5_ANCLA_NO_ENCONTRADA`.

Analogía: en vez de entregar el documento completo, la migración dice "busca este párrafo y edítalo". En producción el párrafo existía (venía de ediciones hechas fuera del historial). En una base limpia, reconstruida sólo con migraciones, alguno de esos párrafos es distinto y el parche se cae.

Además el log de CI no dice cuál ancla falló: el paso imprime sólo `sed -n '1,10p'` del log, y esas 10 líneas se las comen los `(1 row)` de los parches que sí pasaron. Por eso el error real quedó fuera del recorte.

## Plan

### 1. Ver el error real (diagnóstico reproducible)
- Levantar un Postgres efímero en el sandbox (`nix run nixpkgs#postgresql`, `initdb` en `/tmp`) — nunca contra la base del proyecto.
- Aplicar `supabase/tests/rls/_ci_bootstrap.sql` y luego todas las migraciones en orden, igual que CI.
- Registrar exactamente qué llamada a `_c5_patch` falla y con qué ancla.

### 2. Hacer la migración auto-suficiente
Para cada función cuyo ancla no exista en base limpia, sustituir el parche por un `CREATE OR REPLACE FUNCTION` **completo**, tomando el cuerpo de la última migración que la define y añadiéndole el filtro `deleted_at IS NULL`. Resultado: la misma definición final tanto en producción (donde ya está aplicada) como en base limpia.

Para las funciones cuyo ancla sí resuelve en limpio se conserva el parche actual, salvo que la reproducción muestre lo contrario.

Se mantiene el bloque de verificación dura final (`LC_C5_INCOMPLETO`), que garantiza que las 9 funciones terminan con el filtro.

### 3. Mejorar el reporte del radar de drift
En `.github/workflows/rls-tests.yml`, en el paso "Apply migrations SIN parches de drift": en lugar de las primeras 10 líneas del log, imprimir las líneas que contienen el error (`ERROR`/`FATAL`/`DETAIL`) más las últimas líneas del log. Así el próximo drift se diagnostica sin adivinar.

### 4. Verificación
- Reaplicar todas las migraciones en la base efímera: debe terminar sin drift nuevo.
- Ejecutar la suite `test_rls_soft_delete_rpcs.sql` contra esa base para confirmar que el comportamiento (ocultar borrados) sigue intacto.
- `actionlint` sobre el workflow modificado.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Detalles técnicos

- Archivos a tocar: `supabase/migrations/20260729035825_41a7d79d-....sql` (reescritura parcial, mismo timestamp para no alterar el historial ya aplicado) y `.github/workflows/rls-tests.yml`.
- No se ejecuta ninguna migración nueva contra la base del proyecto: en producción esa migración ya está aplicada y su edición es idempotente respecto al estado final.
- Riesgo controlado: si algún cuerpo histórico difiriera del vigente en producción, el `CREATE OR REPLACE` completo podría revertir cambios posteriores. Por eso, para cada función se toma la definición de la migración **más reciente** que la define y se compara antes de reescribir; las que no lo requieran se dejan como parche.
