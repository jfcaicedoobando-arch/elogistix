# Buscador global: legibilidad de la fila seleccionada y pulido visual

## El problema (confirmado en pantalla)

Capturé el modal del buscador en 1920x1080 con una fila seleccionada. La fila activa se pinta con el azul de marca a full saturación (`--accent`, #2563EB) mientras el texto secundario y el icono siguen usando el gris de texto apagado. Resultado: el expediente se lee en blanco, pero el cliente y el BL/M quedan azul-sobre-azul, prácticamente invisibles. Es exactamente lo que reportas: no se ve qué se va a seleccionar.

Causa: en el primitivo compartido `CommandItem`, el estado seleccionado aplica `bg-accent` + `text-accent-foreground` al contenedor, pero los hijos traen su propio color gris fijo, que no se recolorea.

Analogía: es como pintar el resaltador de un cuaderno con marcador azul intenso encima de texto escrito con lápiz gris — el título en tinta blanca sobrevive, el resto desaparece.

## Cambios propuestos

### 1. Fila seleccionada legible (la corrección clave)

Cambiar el resaltado de "bloque azul sólido" a "superficie azul suave + barra indicadora":

- Fondo suave del azul de marca en lugar de sólido (claro y oscuro, ambos con contraste verificado).
- Barra vertical de 2px del color de acento al inicio de la fila, para que la fila activa se distinga sin depender solo del fondo.
- El texto principal mantiene el color de texto normal (deja de invertirse a blanco) y el texto secundario mantiene el gris apagado, que sí contrasta sobre la superficie suave.
- Icono del tipo de documento pasa al color de acento cuando la fila está activa.
- Se agrega transición de color suave y mismo tratamiento en hover, para que ratón y teclado se vean iguales.

Esto se hace una sola vez en el primitivo compartido, así que también arregla la paleta Cmd+P del CRM sin duplicar estilos.

### 2. Pulido visual del modal (auditoría)

- Ancho del diálogo: hoy usa el ancho por defecto (angosto), lo que trunca clientes y BL en pantallas grandes. Se amplía a un ancho de comando cómodo y se centra más arriba, estilo Spotlight.
- Alto de la lista: hoy corta a ~300px y esconde grupos completos. Se sube a un alto relativo a la ventana con scroll propio.
- Encabezados de grupo: se vuelven "sticky" al hacer scroll y se les da mayúsculas/espaciado consistentes con el resto de la app.
- Jerarquía de la fila: expediente en semibold, cliente/BL en línea secundaria truncada con `title`, para que no se corte información sin aviso.
- Pie del modal con las teclas de ayuda (navegar, abrir, cerrar) — ausente hoy.
- Estado vacío con icono y texto guía en lugar de solo la frase suelta.
- Se revisa el foco visible y `aria-selected` para que lector de pantalla y vista coincidan.

## Alcance y notas técnicas

- Archivos: `src/components/ui/command.tsx` (item seleccionado, lista, grupo, empty, ancho del diálogo, pie) y `src/components/shared/GlobalSearch.tsx` (jerarquía de la fila, estado vacío, teclas de ayuda).
- Los colores nuevos se definen como tokens semánticos en el CSS global (superficie de selección suave, claro y oscuro). No se escriben colores literales en los componentes.
- Test de regresión: se agrega una prueba que verifica que la fila seleccionada usa la superficie suave y que el texto secundario no queda invertido, más un test de que el pie de teclas se anuncia.
- Verificación visual: nueva captura en 1920x1080 con fila seleccionada, antes de cerrar el cambio.
- `APP_VERSION` + `CHANGELOG.md` se actualizan en el mismo cambio.

## Fuera de alcance (posible seguimiento)

Los menús desplegables y los `select` de la app usan el mismo patrón `focus:bg-accent` sólido. No los toco en este cambio para no mover media app de golpe; si quieres, lo hago después como pase de consistencia.
