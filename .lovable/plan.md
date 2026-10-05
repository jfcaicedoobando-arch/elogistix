# Arreglar adjuntos de Solicitudes a Pricing

## Qué pasó
La solicitud de Yvonne sí se guardó, pero el archivo se rechazó. La carpeta privada de adjuntos de pricing existe, pero no tiene reglas de acceso: hay 0 reglas, cuando debería tener una para leer y otra para subir.

Analogía: abrimos un archivero nuevo, pero nunca le dimos copia de la llave a nadie. El guardia (la seguridad de la base) hace lo correcto: si nadie tiene llave, no deja entrar.

Causa: el borrador que se aceptó tenía 2 cambios de base pendientes (las reglas de adjuntos y el folio mensual con tarifas ligadas a solicitudes). Ninguno de los dos se aplicó en la base real. También verifiqué que la columna que liga las tarifas con las solicitudes no existe.

## Qué voy a hacer
1. Aplicar los dos cambios de base de ese borrador, sin modificarlos y en orden: primero el folio mensual con tarifas, después las reglas de adjuntos. Así esa pantalla queda completa y no se rompe a medias.
2. Confirmar en la base que existen las 2 reglas de adjuntos y la columna nueva de tarifas.
3. Registrar los cambios en el CHANGELOG sin subir la versión (la subo si me autorizas). Ejecutar db:postcheck y regenerar la baseline.
4. Pedirle a Yvonne que abra la oportunidad otra vez y vuelva a adjuntar el archivo. No se perdió nada más.

## Detalles técnicos
- Archivos: `.lovable/drafts/drft_01m46jm8s2efs9pk1f7zeewadr/migrations/20261005180000_pricing_respuesta_tarifas_folio_mensual.sql` y `20261005204000_pricing_adjuntos_storage.sql`. Los dos se aplican tal cual con la herramienta de migraciones.
- Las reglas de storage revisan con EXISTS que la solicitud exista y pertenezca a `org_scope()`. La ruta tiene la forma `{org}/{solicitud}/{archivo}`, igual que en `adjuntosPricing.ts`. No hay que cambiar el frontend.
- Revisaré el SQL del folio antes de aplicarlo. Ese cambio renumera 3 solicitudes y no debe borrar datos.
- Validaciones: solo consultas puntuales a la base. CI/RLS completos quedan pendientes en GitHub Actions.
