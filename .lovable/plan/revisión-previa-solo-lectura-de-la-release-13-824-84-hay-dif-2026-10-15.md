# Revisión previa (solo lectura) de la release 13.824.84: hay diferencias, no se debe aplicar

Solo hice lecturas. No edité archivos, no apliqué SQL, no registré migraciones, no desplegué funciones ni publiqué. No leí datos de negocio ni credenciales.

## 1. Código y versión
- HEAD local: `8b45641a320a6e699a8d321e933bedcf2e200ac0` («Merge PR #338»). Coincide con lo que pediste.
- `APP_VERSION` = `13.824.84`.
- No hay cambios locales sin guardar.
- El manifiesto tiene la entrada `13.824.84` con 1536 archivos, igual a lo que hay en disco. El último archivo es `20261015050000_disable_demo_reseed.sql`.
- SHA-256 del archivo de la release: `5b304e234c836f9ebb0e9ebc508139e976f67ba0d765cb6537ad5d320991a278`.

## 2. Registro de migraciones en la base vinculada
- `schema_migrations` tiene 1424 filas. La última versión registrada es `20261013151000`.
- No hay ninguna versión registrada a partir de `20261014200000`.
- En disco hay 9 archivos posteriores a la última versión registrada:
  - 20261013195000_cxp_contador_autoaprobacion
  - 20261013204000_replay_demo_seed_limpia_agentes
  - 20261013210000_guard_demo_cleanup_tenant_graph
  - 20261014173500_replay_catalogos_alta_gerente_admin
  - 20261014202800_replay_crm_empresa_desde_cliente
  - 20261014202900_replay_crm_empresa_no_borrar_cliente
  - 20261014203000_demo_seed_identidad_y_aprobacion
  - 20261014203100_replay_cargos_tarifario_aplica_iva
  - 20261015050000_disable_demo_reseed (la de esta release)
- Varias de estas son «replay», es decir, copias de cambios que ya se aplicaron directo en la base. Que no estén registradas no prueba que falten sus efectos. Tampoco hay que asumir que ya se aplicaron.

## 3. Estado actual de las 4 funciones frente a lo que la migración acepta
La revisión previa (preflight) de la migración compara el SHA-256 de `prosrc` contra una lista de cuerpos revisados. También verifica owner, ACL, configuración y atributos.

| Firma | OID | SHA-256 actual de prosrc | ¿Está en la lista revisada? | Owner / SECDEF / config | ACL |
|---|---|---|---|---|---|
| `_seed_demo_limpiar_financiero()` | 204974 | 70678912…efeaeb | Sí | postgres / true / search_path=public | postgres, service_role (coincide) |
| `seed_demo_organization_core()` | 87064 | 27416fdd…ee8331 | **No** (se aceptan 2a10ee2a…, 86025390…) | coincide | coincide |
| `seed_demo_organization()` | 168299 | afcaceaa…bd29183 | Sí | coincide | authenticated, postgres, service_role (coincide) |
| `seed_demo_organization_guarded(bigint)` | 195843 | 3c862c31…2ca7b2 | **No** (no aparece en la lista) | coincide; regresa boolean y su valor por omisión es 600000 | postgres, service_role (coincide) |

Las 4 funciones existen. Su owner, lenguaje plpgsql, SECURITY DEFINER, configuración y ACL coinciden con lo esperado.

## Hallazgo: hay diferencias (drift)
Dos cuerpos de la base vinculada (core y guarded) no son los que se revisaron.
- Si se aplica la migración tal como está, se detiene con `DEMO_STOP_PREFLIGHT: unreviewed body for seed_demo_organization_core()` y revierte todo, sin hacer ningún cambio. Es como una llave que no entra en la cerradura: no rompe nada, pero tampoco abre.
- Lo más probable es que las migraciones `20261013210000_guard_demo_cleanup_tenant_graph` y/o `20261014203000_demo_seed_identidad_y_aprobacion` no se hayan aplicado aquí, o que se hayan aplicado con otro contenido. Esto **no está confirmado**: para confirmarlo hay que calcular la huella de los cuerpos que esas migraciones dejan y compararla con 27416fdd…/3c862c31….
- Esta evidencia no basta para decir que la release ya está aplicada, ni para decir que se puede aplicar.

## 4. Ruta soportada (sin ejecutarla)
- **SQL:** la única forma de aplicar SQL desde aquí es la herramienta de migraciones de Lovable. Aplica el contenido que se le entrega y registra una versión nueva. No toma un archivo del repositorio por su SHA. Para aplicar «exactamente el archivo probado», habría que entregar su contenido sin cambios y después comprobar por consulta que el `prosrc` final de cada función tenga los hashes de postimagen. Antes hay que resolver las diferencias de core y guarded, ya sea con las migraciones previas revisadas o con una nueva revisión que acepte esas preimágenes. No se debe cambiar la lista del archivo para que pase.
- **demo-access:** se despliega por nombre con la herramienta de funciones. Despliega el código del espacio de trabajo, que hoy es `8b45641`. No muestra un ID de despliegue ni un hash. La única evidencia es que el despliegue salga bien, que el log diga `booted` y la prueba HTTP v3: 503 con `{"error":"demo_unavailable"}`.
- **Orden recomendado:** SQL, después demo-access, después la prueba v3 y al final el frontend (Publicar o Update). Publicar el frontend no despliega funciones ni migraciones.

## 5. URLs
- Publicada: https://elogistix.lovable.app
- Dominios propios: https://librecarga.com y https://www.librecarga.com
- No revisé qué versión sirven hoy, porque eso requiere hacer peticiones HTTP externas.

## Siguiente paso propuesto (pide tu autorización)
1. Calcular, solo con lecturas, los hashes de postimagen de las migraciones 20261013210000 y 20261014203000, y compararlos con core y guarded en la base.
2. Según el resultado, decidir si se aplican esas migraciones previas o si se emite una revisión nueva de las preimágenes. No se aplica nada hasta que lo apruebes.
