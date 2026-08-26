# Permitir que los roles operativos creen cotizaciones

## Problema

El usuario `alan.hernandez@elogistixshipping.com` (rol Coordinador Logístico) puede entrar a `/cotizaciones/nueva`, llenar el paso 1 y al guardar recibe "No tienes permisos" (error de base de datos 42501).

Causa confirmada:
- El rol del usuario está bien registrado (Coordinador Logístico en membresías y en roles).
- La ruta del wizard está abierta a roles operativos y de consulta.
- La regla de escritura en base de datos (`puede_escribir_cotizaciones`) sólo autoriza: super admin, admin de organización, admin, gerente comercial, vendedor y ejecutivo de pricing.

Es decir: la puerta está abierta pero la caja fuerte no reconoce la llave.

## Decisión

Dar permiso de creación/edición de cotizaciones a todos los roles operativos:
`coordinador_logistico`, `gerente_operaciones`, `operador`, `customer_service`
(además de los que ya lo tienen).

## Cambios

1. Base de datos: actualizar `public.puede_escribir_cotizaciones()` para incluir los cuatro roles operativos. Esta función es la que usan las políticas de acceso de la tabla de cotizaciones, así que también habilita conceptos y costos ligados por la misma regla.
2. App: agregar los mismos roles a la lista `SALES` en `src/lib/access/permissionMatrix.ts`, que es el espejo en la interfaz de esa función (queda documentado el vínculo).
3. Verificación cruzada: revisar que las tablas hijas del wizard (`cotizacion_costos`, `conceptos_venta`, `cotizacion_versiones`) queden autorizadas con la misma regla; si alguna usa una lista de roles propia, alinearla en la misma migración.
4. Pruebas: añadir/actualizar el test de la matriz de permisos para fijar que estos roles pueden escribir cotizaciones y evitar que la lista se desincronice de la base de datos.
5. Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION` a 13.750.0.

## Nota

Los roles de sólo consulta (`viewer`, `gerente_visor`) siguen sin poder crear cotizaciones; para ellos el botón de "Nueva cotización" seguirá oculto.
