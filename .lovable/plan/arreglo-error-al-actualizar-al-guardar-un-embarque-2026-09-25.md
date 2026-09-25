# Arreglo: "Error al actualizar" al guardar un embarque

## Qué pasa
Alan (Elogistix) no pudo guardar el embarque: la app llama a un proceso de guardado nuevo (`actualizar_embarque_con_contenedores`), pero ese proceso nunca se instaló en la base. El archivo existe en el proyecto (`20260925021600_atomic_embarque_update_containers.sql`) pero no se aplicó. Es como mandar la carta a una oficina nueva que todavía no abre: el cartero regresa diciendo "no existe esa dirección". Esto afecta a **todas** las ediciones de embarques hoy.

## Qué se hará
1. Aplicar esa migración tal cual está en el repo (sin reescribirla). Crea la función que guarda embarque + contenedores en un solo paso atómico, reutilizando `actualizar_embarque_completo` y `sincronizar_contenedores_embarque`, con idempotencia y bloqueo optimista; permisos sólo para usuarios autenticados.
2. Verificar con una consulta que la función existe con sus 7 parámetros y los permisos correctos.
3. Cerrar con `bun run db:postcheck` y regenerar la baseline (regla del proyecto) y agregar la migración al manifest si el audit lo exige.
4. Pruebas focalizadas: `src/features/embarques/services/__tests__/mutations.test.ts`.

## Fuera de alcance
Sin cambios de código de la app, versión, CHANGELOG ni publicación. CI/RLS completos quedan en GitHub Actions. Tras aplicar, Alan puede reintentar el guardado (el cambio de base aplica de inmediato también en el sitio publicado).
