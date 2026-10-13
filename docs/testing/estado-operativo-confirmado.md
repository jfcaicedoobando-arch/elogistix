# Estado operativo confirmado en tableros

ETD y ETA son previsiones. El estado operativo de un embarque procede de
`embarques.estado`, confirmado por la operación. El paso del tiempo no acredita
una salida ni un arribo. La interfaz gestiona la confirmación de salida por
separado; esta migración no cambia estados de filas ni reinterpreta el histórico.

## Alcance SQL

La migración `20261012235900_estado_operativo_confirmado.sql` sustituye únicamente
la expresión que infería estado por ETD/ETA en ocho funciones: los dos cuerpos
`dashboard_*_datos`, `operaciones_stats`, `dashboard_stats`, los dos
`_dashboard_*_calc`, `sidebar_alert_counts` y `embarques_alertas_ids`.
Los tres espejos canónicos y `schema/baseline.sql` reflejan el mismo cambio.
El squash y todas las migraciones anteriores se conservan intactos.

Los conteos y etiquetas leen el estado persistido. Las fechas siguen alimentando
las previsiones de arribo y los umbrales de alerta. Una ETA vencida por sí sola no
convierte un Confirmado o En Tránsito en Arribo ni activa la demora de puerto.
No se modifica dinero, TEU, tenant, papelera, filtros, firmas ni contratos JSON.

## Seguridad y aplicación

La migración es transaccional. Verifica la existencia, propietario, ACL exacta,
SECURITY DEFINER, search_path y huellas de los ocho cuerpos revisados antes de
reemplazar nada; un catálogo distinto aborta para revisión. Acepta origen y
destino para permitir reaplicación. Reafirma las mismas ACL conforme a H6 y
compara todo `pg_proc` salvo `prosrc` al terminar. No crea tablas ni amplía acceso.
No modifica el auditor ni añade excepciones a sus comprobaciones.

No ejecutar en una base cuyo catálogo no corresponda al revisado. Si falla una
precondición, investigar el drift; no ampliar las huellas sin revisión.

## Verificación local

- Replay en PostgreSQL 17.9 efímero desde squash más migraciones, con bootstrap
  CI de servicios externos; post-migrate, RLS e integridad pasan.
- `estado_operativo_confirmado.sql` falla en el replay previo por conteos
  derivados de fechas y pasa después. Ejecuta las ocho funciones y revierte
  todas las filas de prueba.
- Casos: Confirmado con fechas pasadas, futuras, nulas o ETD hoy; En Tránsito
  con ETD futura o ETA pasada; Arribo persistido con demora; Borrador/Cancelado;
  Aéreo/Terrestre; otro tenant y papelera; previsión ETA del resumen canónico.
- `dashboards_cancelado_y_teu.sql` conserva las comprobaciones de papelera/TEU
  y comprueba ahora estado persistido en lugar de exigir el CASE retirado.
- Comparación del replay efectivo anterior y posterior: sólo cambia la
  expresión de estado; ACL, propietario, OID, firmas y seguridad son idénticos.
  Segunda aplicación idéntica.
- Auditorías de migraciones, espejos y funciones canónicas pasan. Las dos
  divergencias históricas registradas de espejos siguen sin cambios.

- El checkout SQL de validación incluye las tres migraciones de main del 12 de
  octubre. Pasan además los guards de conversión de puertos UUID, aceptación de
  cotización y paridad de notas de crédito públicas; no se revierten esos cambios.
- `audit:rpc-columns` no queda verde: informa siete referencias fuera de estas
  ocho funciones. Su salida es idéntica antes y después del parche; es deuda
  previa, no se amplía el allowlist para ocultarla.

Esta evidencia cubre SQL local. No demuestra una aplicación remota ni sustituye
la prueba integral de la confirmación de salida en la interfaz.
