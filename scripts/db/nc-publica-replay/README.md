# Reproducción local de paridad de NC públicas

Este harness carga DDL literal del repositorio en un **cluster nuevo de PostgreSQL
17.9**, ejecuta el `DO $mig$` histórico de AUD-ANALISIS-7, observa el desfase del
helper público antiguo y aplica la migración forward completa. No reproduce el
cálculo con JavaScript. No usa Supabase, Docker, BD existente, credenciales,
servicios fiscales, navegador ni datos de producción.

## Preparar sin PostgreSQL ni dependencias

```bash
node scripts/db/nc-publica-replay/prepare.mjs --out /ruta/nueva/evidencia
```

Opciones de extracción: `--source-root REPO` para las migraciones históricas y
`--candidate-root REPO` para la migración forward. Ambos defaults son la raíz del
repositorio que contiene el harness. El directorio de salida debe estar vacío.
Preparar archivos no demuestra resultados de PostgreSQL.

## Ejecutar

Desde un usuario normal del sistema con Bash, Node y PostgreSQL **17.9** ya
disponibles:

```bash
PG_BIN=/ruta/postgresql-17.9/bin bash scripts/db/nc-publica-replay/run.sh
```

Opciones: `PG_LIB` para bibliotecas del runtime disponible;
`NC_REPLAY_SOURCE_ROOT`, `NC_REPLAY_CANDIDATE_ROOT`; `NC_REPLAY_PORT` para un puerto
local libre (por defecto uno aleatorio entre 40000 y 59999);
`NC_REPLAY_OUT_DIR` para un directorio nuevo de evidencia.

El runner verifica versiones de `initdb`, `pg_ctl`, `postgres` y `psql` **antes
de inicializar o conectar**. Rechaza otro runtime. Limpia variables heredadas de
libpq y ejecuta los procesos con `env -i`, sin variables de credenciales. Usa
archivos vacíos propios para pgpass y pgservice, `psql -X -w --single-transaction`, host y hostaddr
explícitos 127.0.0.1. Sólo conecta después del arranque exitoso de su cluster.
Un puerto ocupado hace fallar el arranque; no conecta a otra BD. Un trap detiene
el cluster y espera confirmación; si el apagado falla, reporta el error y sale
con fallo. Tras confirmarlo se conserva apagado en la evidencia. No instala
dependencias. No es un runner de PostgreSQL nativo para PowerShell.

## Fuentes y alcance

- Interno literal desde `20260827193052`, wrapper PL/pgSQL antiguo desde
  `20260902004000`, cierre ACL público desde `20260902006000`.
- Conversor, `pago_rep_anulado` y `_saldo_factura_calc` literales desde
  `20260910231259`.
- `DO` completo literal desde `20261001183654`: en el esquema mínimo encuentra
  únicamente el interno y el saldo entre sus funciones objetivo. No toca al
  wrapper público, porque no figura en su lista.
- Forward completa desde `20261012010000_nc_publica_paridad_replay.sql`.
- Roles y tablas mínimos, sin RLS, triggers, tenant, autenticación ni constraints
  de la aplicación. No certifica replay completo, integración de producción,
  catálogo alojado ni seguridad cross-tenant.
- ACL literal de replay: interno INVOKER con authenticated/service_role; público
  y saldo DEFINER sólo service_role. Owner postgres de initdb. La preservación se
  prueba sobre esta variante histórica; no transforma al interno para simular
  metadatos de una BD alojada. El forward no redefine el interno.

24 casos por fase, 48 resultados: Timbrada/Aplicada, Borrador/Cancelada de NC,
borrado lógico, MXN/USD/EUR, TC ausente/1, misma moneda sin TC, factura
ausente/borrada/cancelada/sustituida, notas combinadas, pagos vigentes/anulados/
borrados, transición de la misma NC Timbrada a Aplicada sin doble conteo y de
NC activa a borrada (resta 0, saldo 100).
Una factura borrada puede seguir aportando NC a ambos helpers: el test conserva
su semántica existente y espera saldo canónico 0. No cambia esa regla.

La fase before exige los valores del wrapper antiguo y demuestra mismatches
intencionales contra el interno; la fase after exige paridad total. Preserva OID,
owner, ACL exacta, search_path, volatilidad, SECURITY DEFINER, definición completa
del interno y SHA-256 de filas fixture; compara datos antes y después del forward.

## Evidencia

`source-hashes.json` registra SHA-256 de bytes UTF-8 exactos, extractos y SQL
preparado sin transformar los cuerpos. CR/CRLF no revisado se rechaza. Una ejecución exitosa deja `results.csv`,
`metadata.csv`, `summary.json`, versiones y logs de initdb/arranque/matriz. La
salida `NC_PUBLICA_REPLAY_MATRIX_PASS` sólo se emite tras assertions reales de
PostgreSQL. Si falta el runtime, la evidencia se limita a preparación/inspección;
no se afirma reproducción ejecutada ni regeneración oficial de baseline.
