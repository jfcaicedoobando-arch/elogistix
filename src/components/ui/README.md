# Primitivas UI adaptadas

Base Radix/shadcn con tokens y comportamientos propios de Libre Carga.
No es una copia read-only: controles, botones y variantes fueron adaptados.

Preferir wrappers compartidos o componentes del feature para necesidades locales.
Un cambio transversal en una primitiva requiere revisar consumidores, foco,
teclado, labels, error/deshabilitado, claro/oscuro y pantallas estrechas.

No sobrescribir cambios locales con una actualización CLI de shadcn.
Revisar el diff de proveedor y aplicar sólo lo aprobado.

El wrapper estándar `FormField` vive en `src/components/shared/FormField.tsx`;
no confundirlo con las primitivas RHF de esta carpeta.

Ver [sistema de diseño](../../../docs/design-system.md).
