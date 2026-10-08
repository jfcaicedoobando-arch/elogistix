# Release13.824.43: Aging canónico

Paquete local sobre42 f625928628fb36de36a69266ec7b5e1e8155c343. No publicado; sin SQL remoto, GUI, PAC ni hosting. La revisión independiente sigue pendiente.

## Fuente y límites

Candidato79ef2b222db1eda922f48045cb5a097c6ffaf5b7, delta contra d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f, confirmado en accounting-splits-final/index.json. El worktree original audit70-aging conserva81c4af4; la fuente atómica es el candidato del split. SQL001600 SHA-2561da271c012a2d62f2c4124064e9fc248766886dd0f6ed0fbc35ed971d9e99aea. No incluye el split Por pagar001700.

Sólo cambia el cuerpo de public.cxp_aging_proveedores(uuid,date). Saldo canónico por factura/moneda, NC proveedor sólo Aplicada, congelado134 incluso cero/desconocido, umbral0.005, todas las cubetas y filtro de organización. p_fecha reclasifica saldos actuales; no implica corte histórico. No hay DML/backfill, tabla, firma, trigger ni permiso nuevo. CxC Timbrada/Aplicada, referencia NULL131/134, cronología135, captura62/130 y cierre139 quedan intactos. Las entradas35–42 del manifest y migraciones anteriores se preservan; sólo se agrega43.

## Reintegración obligatoria

Esta pila local39→42 aún no contiene el replay tarifario20261006234000 que se prepara para main acb. Antes de publicar, incorporar ese replay en39 y revalidar toda la pila39→43 sobre el SHA final, preservando Drizzle0010 y consumidores upstream. No se afirma compatibilidad global con main ni se publicará este snapshot antiguo. Los fallos externos de CI de main no se consideran corregidos por este paquete.

## Validación y futura aplicación

Exigir replay limpio43 y snapshot igual a baseline; forward42→43 dos veces, filas de todas las tablas públicas sin cambios y sólo cuerpo Aging distinto en el catálogo completo previo a grants CI. Comparar owner, ACL explícita/canónica, privilegios efectivos, firma, defaults, retorno y atributos. Guardas oficiales/RLS, CAS37, suites131/134/135/139/62/130 y Aging en UTC/CDMX. Frontend enfocado, auditorías y tipos/build sobre el paquete exacto; los antecedentes42 no son evidencia43. Tipos app42 terminó137 y continúa como bloqueo heredado hasta verificar.

La aplicación futura exige proyecto/backend confirmado, historiales Supabase/Drizzle, hashes, duplicados y high-water marks; verificar35–42 efectivos y cuerpo previo exacto. Preparar envelope transaccional específico con locks/timeouts, precondiciones repetidas, SQL exacto y único registro001600; verificar catálogo/datos/historia antes de COMMIT y desde una transacción nueva. Drift implica detener/ROLLBACK; transporte incierto requiere releer, no repetir a ciegas. No ejecutar fixtures en backend real.

## Recomposición local sobre main2538 y replay0010

Este candidato recompone el delta revisado `a7e0eeb193473f1729410d28054316be9da009c2` sobre el padre `f61faa906717a375e50088007cdfce3dba4a2164`. Conserva el release39 revisado `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`, el replay Drizzle0010, su forward restrictivo234100 y los cambios CRM/Costeo heredados. Los manifiestos históricos35–39 permanecen iguales al nuevo39; sólo se actualiza la entrada inédita43 para incluir el inventario real. El SQL propio del paquete conserva sus bytes y SHA-256 de la fuente. Las validaciones descritas arriba pertenecen a la fuente histórica y no certifican esta nueva composición; la validación conjunta de la cadena se registra por separado. No se aplicó SQL remoto, no se publicó frontend y no se actualizó ningún PR.
