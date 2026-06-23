## Diagnóstico actual

Los 3 modales hoy se ven como hijos de proyectos distintos:


| Modal                       | Header                                                         | Footer                                                   | Layout                                    | Tamaño | Progreso                |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ------ | ----------------------- |
| **Nuevo Cliente**           | Título plano + descripción                                     | Plano, sin separador                                     | 2 columnas básicas, sin agrupar secciones | `lg`   | Texto "Paso 1 de 2"     |
| **Nuevo Proveedor**         | Título plano + descripción                                     | Plano, sin separador                                     | Delegado a `Step1/Step2` (también plano)  | `md`   | Texto "Paso 1 de 2"     |
| **Nueva Factura Proveedor** | Título + **chip de Total** a la derecha, borde inferior, `p-0` | **Sticky** con resumen Subtotal/IVA/Ret/Total, separador | Secciones bien delimitadas                | `xl`   | Sin pasos (single page) |


La **factura** ya tiene el "look" más maduro. La propuesta es subir Cliente y Proveedor a ese mismo nivel y, de paso, limar 4-5 detalles de UX.

## Lenguaje visual unificado

Crear un **shell de diálogo** compartido (`FormDialogShell`) que estandarice:

1. **Header con "icon-tile"**: un cuadradito redondeado con el ícono de la entidad (👤 cliente, 🏢 proveedor, 📄 factura) + Título grande + descripción tenue.
2. **Slot derecho** opcional para un "resumen vivo" (Total en factura, "RFC detectado ✓" en cliente cuando se sube CSF, "Datos OK" en proveedor).
3. **Stepper visual** (dots o barra segmentada) en lugar del texto "Paso X de 2", reutilizable para wizards de 2-3 pasos.
4. **Cuerpo scrolleable** con `px-6 py-5 space-y-5` y borde inferior fijo del header (como hoy hace factura).
5. **Footer sticky** con separador, alineado a la derecha, con loader unificado y botón principal con color de acción.
6. **Tamaños consistentes** por complejidad: `md` (proveedor), `lg` (cliente), `xl` (factura).

Sin tocar tokens de color/tipo — todo con tokens semánticos existentes (`bg-primary/10`, `text-primary`, `border`, etc.).

## Mejoras específicas por modal

### Nuevo Cliente

- Convertir la fila de botones "Manual / Subir CSF" en un **toggle segmentado** (estilo Tabs) más limpio.
- **Agrupar campos** en 2 bloques visibles: "Datos fiscales" (RFC, Régimen, Uso CFDI, CP) y "Datos de contacto" (Nombre, Dirección, Ciudad, Estado, Contacto, Email, Teléfono).
- Mostrar **badge "Prellenado desde CSF"** sobre los campos que vinieron del PDF, para que el usuario sepa qué confiar.
- En el área de drop del CSF: hacerla **drag-and-drop real** (no solo botón) y mostrar el nombre del PDF parseado.
- Validar **formato de RFC** y CP en vivo con mensaje inline.

### Nuevo Proveedor

- Adoptar el mismo `FormDialogShell` con icon-tile + stepper.
- En el Step 1: separar "Identificación" (Tipo, RFC/Tax ID, Razón social) de "Contacto" (Email, Teléfono, Dirección).
- Igual que cliente: validación de RFC/Tax ID inline y autodetección de tipo (Nacional/Extranjero) a partir del RFC.
- Step 2: agrupar visualmente "Bancarios" vs "Comerciales" con sub-encabezados pequeños.

### Nueva Factura de Proveedor

Ya es la referencia, pero pulir:

- Mover el chip de Total al **icon-tile header** estándar para que se vea igual de bien en los otros 2.
- En la sección "Carga CFDI": cuando el XML se parsea, mostrar **mini-resumen** (RFC emisor, folio, fecha, total) antes de prellenar el form, para que el usuario confirme.
- En el resumen del footer, marcar **Total** con un peso visual mayor (ya es semibold, subirlo a `text-base font-bold`) y añadir el símbolo de moneda al lado del label.
- El botón "Guardar factura" en variante `default` con un sutil `shadow-sm`; cuando hay errores, deshabilitar y mostrar tooltip con la lista.

## Estructura técnica (para el dev)

```text
src/components/shared/
  FormDialogShell.tsx       ← nuevo, ≤200 líneas
    props: { open, onOpenChange, icon, title, description,
             size, step?, totalSteps?, headerSlot?, footer, children }
  FormDialogStepper.tsx     ← nuevo, dots/segmentos
  FormDialogSection.tsx     ← wrapper con sub-título + grid responsive
```

Refactorizar los 3 modales para consumir `FormDialogShell`. Los controllers/hooks NO cambian — sigue siendo solo UI/presentación.

## Fuera de alcance

- Cambios en validaciones de negocio, RLS, RPCs o esquema.
- Tocar EditarCliente/EditarProveedor/EditarFactura (se haría en una segunda iteración una vez aprobado el shell).
- Cambios de paleta o tipografía.

## Entregable

- 3 archivos nuevos en `src/components/shared/`.
- 3 modales refactorizados al nuevo shell.
- Captura de pantalla antes/después de los 3 para validar el lenguaje común.
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

No olvides que, al final, usarás tus herramientas para verificarse visualmente y hacer los cambios que consideres necesarios. 