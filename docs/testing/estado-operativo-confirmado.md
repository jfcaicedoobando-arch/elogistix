# Estado operativo confirmado en tableros

ETD y ETA son previsiones. El estado operativo de un embarque procede de
`embarques.estado`, confirmado por la operación. El paso del tiempo no acredita
una salida ni un arribo. La interfaz gestiona la confirmación de salida por
separado; esta migración no cambia estados de filas ni reinterpreta el histórico.

## Alcance SQL

La migración `20261012235900_estado_operativo_confirmado.sql` corrige
la expresión que infería estado por ETD/ETA en ocho funciones: los dos cuerpos
`dashboard_*_datos`, `operaciones_stats`, `dashboard_stats`, los dos
`_dashboard_*_calc`, `sidebar_alert_counts` y `embarques_alertas_ids`.
Los tres espejos canónicos y `schema/baseline.sql` reflejan el mismo cambio.
El squash y todas las migraciones anteriores se conservan intactos.

Los conteos y etiquetas leen el estado persistido. Las fechas siguen alimentando
las previsiones de arribo y los umbrales de alerta. Una ETA vencida por sí sola no
convierte un Confirmado o En Tránsito en Arribo ni activa la demora de puerto.
No se modifica dinero, TEU, tenant, papelera, filtros, firmas ni contratos JSON.

## Reconciliación previa a la aplicación

El primer intento remoto abortó por precondiciones antes de DDL; el readback del
coordinador confirmó ocho funciones y hooks sin cambios y ninguna fila de ledger.
La migración no aplicada se corrige mediante un nuevo PR, sin reescribir commits.

El catálogo live tenía lógica financiera ausente del replay en
`dashboard_summary_datos` y `dashboard_details_datos`: `tc_factura` calcula TC USD
ponderado por subtotal de facturas vigentes; `profit_fx` lo usa para la venta del
mes. Se conservan esos dos cuerpos live byte por byte salvo la expresión de
estado. No se amplían las huellas para sobrescribir esa lógica con el cuerpo viejo.

`_dashboard_summary_calc` mantiene el fallback EUR→DOF ya presente en replay,
ausente en el perfil live. Las otras cinco funciones conservan su destino anterior.
Así, replay original, destino anterior y catálogo live revisado convergen en un
solo destino. Los hashes permitidos son exactos, sin normalización ni comodines.

La prueba USD usa dos facturas de 100 a TC18 y 300 a TC22; una NC de50 en la primera
distingue el comportamiento live (neto350 × promedio bruto21 =7350) del replay
previo (50×18+300×22 =7500). Esta prueba preserva una conducta observada; no aprueba
una nueva política fiscal ni afirma que ésa sea la única regla contable posible.
El fallback sin factura conserva50×17 =850. EUR sin TC de embarque usa DOF24 para
un gasto de10 =240; sin tasa válida informa un faltante, sin fabricar importe.

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
- `estado_operativo_preserva_fx.sql` valida numéricamente USD ponderado y
  fallbacks USD/EUR con tablas y triggers reales, dentro de BEGIN/ROLLBACK.
- `dashboards_cancelado_y_teu.sql` conserva las comprobaciones de papelera/TEU
  y comprueba ahora estado persistido en lugar de exigir el CASE retirado.
- Comparación del replay efectivo anterior y posterior: se conservan los
  cuerpos live de datos salvo estado, y el destino previo de las otras seis
  funciones; ACL, propietario, OID, firmas y seguridad son idénticos.
  Segunda aplicación idéntica en los tres perfiles revisados.
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
