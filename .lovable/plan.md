
# Auditoría visual de `DetailHeader` (1920×1080)

Capturé en FullHD las páginas de detalle reales de Factura, Proforma, Proveedor, Lead, Oportunidad, Tesorería, Estado de cuenta, Cliente, Cotización y Embarque. El componente en sí se ve sólido y consistente; los problemas están en **cómo lo usa cada página**, no en el componente.

## Hallazgos

**1. Estados "no encontrado" quedan sin encabezado (el más grave).**
En `/cotizaciones/:id` y `/embarques/:id` con un ID inexistente la pantalla muestra sólo el texto "Cotización no encontrada" centrado: sin título, sin botón Volver, sin acciones. El usuario queda varado y sólo puede usar el botón del navegador. Cliente sí ofrece un botón "Volver a Clientes", pero tampoco muestra encabezado. Analogía: es como una recepción donde, si no encuentran tu cita, apagan la luz y quitan la señalización de salida.

**2. La etiqueta de "Volver" es inconsistente.**
Conviven tres estilos: `Volver` a secas (Factura), sólo el nombre del destino (`Proformas`, `Proveedores`, `Tesorería`, `Leads`, `Oportunidades`) y `Cliente` (Estado de cuenta, ambiguo: no dice si vuelve al listado o a la ficha).

**3. Las acciones no viven en el mismo lugar.**
Proveedor y Lead las ponen en `trailing`, alineadas con el título (correcto). Factura y Proforma las dejan en una barra suelta debajo del encabezado. Estado de cuenta las manda a una fila propia alineada a la derecha, desconectada del título. Resultado: el ojo no sabe dónde buscar los botones al cambiar de módulo.

**4. Estado de cuenta pierde el nombre del cliente.**
El título es genérico ("Estado de cuenta") y el cliente no aparece ni en título ni en subtítulo, aunque es la entidad de la página.

**5. CRM apila cuatro niveles de encabezado.**
`CRM` (h1) → descripción → tabs → botón Volver → título del lead. Demasiado peso vertical antes del contenido útil.

**6. Detalles menores de alineación.**
El bloque de total en `trailing` (Factura/Proforma) queda alto respecto al título; Tesorería es el único `DetailHeader` sin icono.

## Plan de corrección

**Ola 1 — Estados vacíos y de error (prioridad alta)**
- Crear `DetailNotFound` (encabezado + tarjeta de estado vacío) que use `DetailHeader` con título tipo "Cotización no encontrada", `backTo` al listado y mensaje de ayuda.
- Aplicarlo en Cotización, Embarque, Cliente, Factura, Proforma y Proveedor, para que el botón Volver exista siempre, incluso en error.

**Ola 2 — Etiqueta de retorno canónica**
- Convención única: `Volver a {Listado}` (ej. "Volver a Facturación", "Volver a Proformas", "Volver a Cliente Rollos y Etiquetas Rollet").
- Ajustar los 16 sitios que hoy usan `DetailHeader` y añadir un test de arquitectura que exija `backLabel` explícito cuando `backTo` es una ruta.

**Ola 3 — Acciones dentro del encabezado**
- Mover la barra de acciones de Factura, Proforma y Estado de cuenta al slot `trailing`, dejando en "Más acciones" lo secundario para que no se desborde en 1366 px.
- Estado de cuenta: título con el nombre del cliente y subtítulo con el periodo.

**Ola 4 — Densidad en CRM y pulido**
- En Lead y Oportunidad, ocultar el `backTo` (ya hay tabs y breadcrumb) o comprimir el bloque CRM a una sola línea, ganando ~90 px de altura útil.
- Alinear verticalmente el bloque de total en `trailing` y añadir icono a Tesorería.

## Notas técnicas

- Sin cambios de lógica de negocio: sólo presentación (`src/components/shared/DetailHeader.tsx` y sus 16 consumidores).
- El guardrail existente `src/__tests__/architecture/detail-header-canonical.test.ts` se amplía con la regla de `backLabel`.
- Se añaden tests en `DetailHeader.test.tsx` para el nuevo `DetailNotFound` y verificación FullHD posterior con capturas de las mismas rutas.
- Al terminar: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
