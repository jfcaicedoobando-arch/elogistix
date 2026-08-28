# Arreglar el CI de RLS: cliente de Postgres desactualizado en el runner

## Qué está pasando

El servidor de pruebas ya corre **Postgres 17.9** (la imagen pinneada por digest en `rls-tests.yml`), pero el runner de GitHub (`ubuntu-24.04`) trae de fábrica las herramientas cliente **16.15**. `pg_dump` es estricto: se niega a respaldar un servidor más nuevo que él mismo, por eso el paso "Dump prepared database" aborta con *server version mismatch*.

Analogía: el servidor guarda los archivos en un formato de cajón nuevo y el runner llegó con un maletín del año pasado que no cierra con esas carpetas.

Esto apareció al subir el Postgres de CI de 15 a 17 en la versión 13.784.0; antes cliente y servidor eran compatibles por casualidad.

## Cómo lo arreglamos

Instalar el cliente de Postgres 17 en el runner desde el repositorio oficial PGDG antes de cualquier paso que hable con la base, en todos los jobs de `rls-tests.yml`:

1. Nueva acción compuesta `.github/actions/setup-pg-client/action.yml` que agrega el repositorio PGDG, instala `postgresql-client-17` y lo pone primero en el `PATH`. Al final imprime `psql --version` y `pg_dump --version` como evidencia.
2. Usar esa acción como primer paso (después de `checkout`) en los 6 jobs del workflow que usan `psql`, `pg_dump` o `pg_restore`: el job de preparación del snapshot, los grupos de suites y el job de baseline.
3. La versión del cliente queda fija en `17` y documentada junto al pin de la imagen, para que subir la imagen obligue a revisar ambos.

No se toca la imagen de Postgres, ni las migraciones, ni `baseline.sql`: el dump de baseline ya se genera **dentro** del contenedor, así que su formato no cambia. Tampoco cambia el `key` del cache del snapshot, salvo por el hash del propio workflow, que se invalida solo al editar el archivo (comportamiento esperado y deseable aquí).

## Notas técnicas

- `pg_restore` 16 tampoco puede leer de forma confiable un dump generado por 17; instalar el cliente 17 en los jobs de suites evita que el error se mueva del dump al restore.
- `psql` sí tolera versiones distintas, pero se unifica a 17 para no mantener dos comportamientos.
- La instalación se hace con `apt-get` sobre `apt.postgresql.org` con la llave verificada, sin descargar binarios sueltos.

## Cierre

Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION` a `13.787.1`.
