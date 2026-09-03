# Arreglo: al elegir "Agente de Carga" se pierde el RFC cargado desde la CSF

## Qué está pasando (confirmado en el código)

Dos comportamientos del modal "Nuevo proveedor" se pisan entre sí:

1. Al seleccionar un país en el campo "País *" (que sólo aparece para Agente de Carga), el select borra el RFC de forma incondicional: además de guardar el país, ejecuta un "limpiar RFC". Si el RFC venía de la CSF, se pierde.
2. El campo de RFC/Tax ID sólo se dibuja si el proveedor no es Agente de Carga o si ya se eligió país. Es decir: en el instante en que eliges "Agente de Carga", el RFC desaparece de pantalla aunque el dato siga en memoria, y da la sensación de que ya se borró.

Analogía: es como si al marcar la casilla "viene del extranjero" el formulario esconde la hoja del RFC y, al escoger el país, la vuelve a poner pero en blanco.

## Cambios propuestos (mínimos)

1. `PaisAgenteSelect`: al elegir país, sólo guardar el país. Ya no borrar el RFC.
2. Paso 1: mostrar siempre el campo RFC/Tax ID (quitar la condición que lo oculta mientras no haya país). El campo sigue siendo obligatorio y la etiqueta sigue cambiando a "Tax ID" cuando el origen es Extranjero.
3. Dejar el orden de campos como está (Origen → Nombre → Tipo → País → RFC/Tax ID), para que el país siga siendo visible como requisito del agente de carga.

No se toca la validación de faltantes, ni la deduplicación por RFC, ni el paso 2, ni la base de datos, ni permisos.

## Detalles técnicos

- `src/features/proveedor/components/NuevoProveedorStep1FiscalFields.tsx`: en `PaisAgenteSelect`, `onValueChange` pasa a `c.setField("pais", v)` únicamente.
- `src/features/proveedor/components/NuevoProveedorStep1.tsx`: eliminar `mostrarRfc` y renderizar `<RfcField />` siempre.
- `CHANGELOG.md`: bullet breve en `[Unreleased]`; sin cambio de `APP_VERSION` salvo que se pida cerrar versión.

## Validación

Prueba focalizada del flujo (CSF → cambiar tipo a Agente de Carga → elegir país) verificando que el RFC se conserva; typecheck/lint focalizado de los dos archivos. CI, RLS y suites globales quedan para GitHub Actions.
