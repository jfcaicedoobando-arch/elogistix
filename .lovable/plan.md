# Plan: los avisos (toasts) no deben quedar tapados por el botón de cerrar

## Problema
En los avisos con título y descripción largos, el texto se corta debajo del botón "×" de cerrar. El botón flota encima del texto y el contenido no le reserva espacio (confirmado en `src/components/ui/sonner.tsx`: el `closeButton` está posicionado de forma absoluta a la derecha y la columna de contenido no tiene margen derecho).

## Cambio (un solo archivo: `src/components/ui/sonner.tsx`)
- Al estilo del toast se le agrega un margen interno derecho (`padding-right`) suficiente para el botón de cerrar (32 px del botón + holgura), de modo que el texto nunca pase por debajo de la "×".
- No se mueve el botón, no se cambian colores ni tamaños: es el ajuste mínimo para que el texto se corte en renglón nuevo antes de llegar al botón, en todos los avisos de la app (es el mismo Toaster global, así que se corrige en todos lados a la vez).

## Validación local (rápida)
- Verificación visual con Playwright: disparar el aviso "La cotización no tiene costos cargados" y confirmar en captura que el texto completo se lee sin quedar bajo la "×".
- Tipos y estilo limpios. Sin cambios de base de datos; CI/RLS quedan a GitHub Actions.

## Nota
Corrección visual mínima (YAGNI). No requiere versión nueva salvo que el usuario lo indique; de hacerse, se registra en CHANGELOG siguiendo la convención.
