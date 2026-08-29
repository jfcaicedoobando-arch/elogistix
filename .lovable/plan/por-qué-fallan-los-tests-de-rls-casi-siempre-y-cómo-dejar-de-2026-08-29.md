# Por qué fallan los tests de RLS casi siempre (y cómo dejar de sufrirlos)

## Diagnóstico

La base **no está mal** y las políticas **no están rotas**. Lo que falla casi siempre no es seguridad real, es **contabilidad de candados**: el CI guarda "fotos" y "listas escritas a mano" del estado de la base, y cualquier migración las deja desactualizadas.

Analogía: la base es una casa con buenas cerraduras. El CI además guarda una **foto oficial de la casa** (`supabase/schema/baseline.sql`) y una **lista de quién tiene llave** (listas curadas). Si mueves un mueble (una migración) y no actualizas la foto ni la lista, el guardia grita — aunque la casa esté perfectamente segura.

Fuentes reales de los rojos recurrentes, en orden de frecuencia:

1. **`schema-baseline`**: cualquier migración cambia el esquema; si no se regenera `supabase/schema/baseline.sql` en la misma PR, el job falla por diseño. Es el rojo más común (nos pasó hoy y varias veces esta semana).
2. **Listas curadas bidireccionales**: `_ci_service_role_only.sql` (funciones internas), whitelist de ejecutables por `anon`, `_ci_exempt_tables.sql`, `_catalogo_columnas_internas.sql`. Cada función/tabla nueva exige un segundo edit manual, o el candado grita.
3. **Guards conductuales** (`scripts/ci/run-guards.sh`, 63 guards): algunos congelan decisiones de negocio viejas. Cuando cambias la regla (p. ej. C9: ventas sí ve costos), el guard sigue exigiendo la regla anterior y hay que actualizarlo junto con el cambio.
4. **Fixtures de suites**: montos/importes hardcodeados en tests que chocan con guardas nuevas (p. ej. el tope de NC de proveedor, F5).

**Por qué se detecta tarde:** `bun run db:verify` y `db:baseline:update` (`scripts/db/local-verify.sh`) exigen **Docker**, y el entorno donde trabajo no tiene Docker. Resultado: no puedo validar antes de subir y el CI se vuelve el primer lugar donde se descubre el problema. Hoy tuve que levantar Postgres a mano (`initdb`/`pg_ctl`) cada vez, artesanalmente.

## Qué haremos

### 1. Verificación local sin Docker (la corrección de raíz)

Añadir a `scripts/db/local-verify.sh` un backend alternativo `--backend=local` (autodetectado cuando no hay Docker) que:
- levanta un Postgres efímero con `initdb`/`pg_ctl` en un puerto libre, bajo uid 1000 (root no puede correr Postgres),
- corre el mismo orden exacto que el CI: `_ci_roles` → `_ci_bootstrap` → `_ci_drift` → migraciones (respetando `drift-anclas.txt`) → `_ci_verify_rls` → `_ci_check_service_role_only` → `_ci_post_migrate`,
- reutiliza el cluster entre corridas con `--reuse` para que no tarde 5 minutos cada vez.

Con eso, `bun run db:verify`, `db:verify:all` y `db:baseline:update` funcionan igual con o sin Docker.

### 2. Regeneración de baseline reproducible

- El snapshot local no puede crear la collation ICU `lc_unicode_upper` (este Postgres viene sin ICU). Hoy la reinserto a mano. Se automatiza en `scripts/db/schema-snapshot.sh`: si la collation no existe pero la migración que la crea sí está en el repo, se inyecta la línea para que el archivo quede idéntico al que produce el CI.
- Así `bun run db:baseline:update` deja un baseline byte-a-byte igual al del CI, sin pasos manuales.

### 3. Un solo comando de cierre para cambios de base

Nuevo script `bun run db:postcheck` que corre, en orden y con resumen final:
migraciones en base limpia → `_ci_verify_rls` → candado `service_role-only` → `run-guards.sh` → regeneración y diff del baseline → suite RLS mínima.

Regla operativa (la anoto en memoria de proyecto): **toda migración cierra con `db:postcheck` verde y el baseline regenerado en el mismo cambio.** Es lo que convierte "casi siempre falla" en "falla sólo cuando hay un bug de verdad".

### 4. Guards: menos frágiles, no menos estrictos

No bajamos el nivel de seguridad. Sí quitamos fragilidad:
- Los guards que congelan una **decisión de negocio** (roles con acceso a costos, tolerancias, etc.) leen la decisión de una **única fuente** (`supabase/tests/_decisiones_negocio.sql`) en vez de repetir listas de roles en cada archivo. Cambiar la decisión pasa a ser un edit, no cinco.
- Los mensajes de fallo de los candados curados incluirán el comando exacto para arreglarlos (`bun run db:postcheck`, o la línea a agregar), para que el rojo se resuelva en un paso.
- Las listas siguen curadas a mano a propósito: autogenerarlas ocultaría regresiones reales (está documentado en `supabase/tests/rls/README.md` y lo respetamos).

### 5. Documentación corta

Una sección nueva en `supabase/tests/rls/README.md`: "Checklist al tocar la base" con los 4 rojos típicos y su arreglo en una línea cada uno.

## Detalles técnicos

- `scripts/db/local-verify.sh`: extraer el arranque/paro del servidor a funciones (`pg_up_docker` / `pg_up_local`), detectar backend por `command -v docker` + `docker info`, socket en `$TMPDIR/pgwork/sock`, datos en `.db-verify-logs/pgdata`.
- `scripts/db/schema-snapshot.sh`: post-proceso idempotente que inserta `CREATE COLLATION public.lc_unicode_upper (provider = icu, locale = 'und');` tras `CREATE SCHEMA public;` cuando falta y el repo la declara.
- `package.json`: agregar `db:postcheck`; sin cambios en las rutas que ya usa el CI.
- `.github/workflows/rls-tests.yml`: sin cambios de lógica (opcional: imprimir `bun run db:postcheck` en los mensajes de error).
- Sin migraciones de base en este trabajo: es tooling de CI y verificación.

## Fuera de alcance

- No relajar políticas RLS, ni umbrales de coverage, ni eliminar guards.
- No tocar `baseline.sql` más allá de regenerarlo con el flujo nuevo.
