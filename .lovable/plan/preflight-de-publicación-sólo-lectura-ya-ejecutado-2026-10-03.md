# Preflight de publicación (sólo lectura, ya ejecutado)

No se cambió código, datos, migraciones, secretos ni versión (13.824.14).

## Destino confirmado
- Backend Lovable Cloud administrado, instancia Live ref `eorqadkulqtneqjbsblk`, no pausada.
- Coinciden: herramientas de sesión, `.env` del cliente y `supabase/config.toml`.

## Estado del checkout sincronizado
- Migraciones en disco: sólo `20261003190000_audit02_liquidacion_costo_saldo_multimoneda.sql`. **Faltan 20261003192000 y 20261003193000** (probablemente vienen en PR116).
- Las 5 funciones existen. `config.toml` sólo declara `facturapi-webhook` con `verify_jwt = false`; las otras 4 usan el valor por defecto (sin cambio al desplegar).

## Capacidades

| Tarea | ¿Puedo? | Detalle |
| --- | --- | --- |
| Aplicar 3 migraciones existentes con su versión original | **No** | Mi herramienta crea siempre un archivo nuevo con versión propia (duplicaría historia). No hay comando oficial de `db push`/`repair`. Vía correcta: `supabase db push` desde tu pipeline o CLI autenticado. |
| Desplegar las 5 funciones desde el SHA sincronizado sin cambiar código | **Sí** | `deploy_edge_functions`, respeta `config.toml` y secretos vigentes. |

## Evidencia disponible por despliegue
- Resultado éxito/fallo por función devuelto por la herramienta.
- Logs de arranque de cada función ("booted") sin invocarla.
- Las migraciones (aplicadas por ti): consulta de sólo lectura a `supabase_migrations.schema_migrations` y `pg_get_functiondef` para confirmar cuerpos/permisos.

## Siguiente paso al aprobar
Cuando confirmes SHA final sincronizado y CI verde: desplegar sólo las 5 funciones y reportar resultado; no aplicar SQL, no invocar funciones, no timbrar ni enviar correos.
