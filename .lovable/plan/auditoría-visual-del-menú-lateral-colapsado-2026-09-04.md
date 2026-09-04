# Auditoría visual del menú lateral colapsado

Revisé la app con sesión real (usuario KAM, organización Chino Cochino) en 1280x720, 1366x768, 1440x900, 1920x1080, 1024x600 y 390x844, con el menú expandido y colapsado.

## Lo que está bien

- Al colapsar, cada icono muestra su nombre en una etiqueta flotante al pasar el cursor (verificado sobre CRM).
- El punto rojo de alertas se conserva sobre el icono cuando hay pendientes.
- La organización activa aparece como icono con su etiqueta flotante.
- En celular el menú sigue apareciendo como panel completo con texto; no queda vacío ni cortado.
- La versión de la app se oculta al colapsar (correcto: no cabe).

## Problemas encontrados

1. **Accesos que se quedan fuera de la vista sin ningún aviso (principal).** Con el menú colapsado, la columna de iconos mide 777 px de alto mientras la pantalla sólo deja 595 px en 1280x720: **2 accesos quedan fuera** y 1 en 1366x768. Sí se puede desplazar, pero no hay barra visible, sombra ni flecha, así que parecen no existir. Con roles que ven más módulos (por ejemplo administración) el recorte es mayor.

2. **El alto desperdiciado viene de las líneas divisorias.** Colapsado se pintan 5 líneas separadoras con margen amplio más el relleno de cada grupo; ese espacio no aporta información (los títulos de grupo ya no se ven) y es justo lo que empuja los últimos accesos fuera de pantalla.

3. **El icono de organización se ve igual que un módulo.** Colapsado queda en la misma columna, mismo tamaño y mismo estilo que los accesos navegables, aunque no es un botón; invita a hacer clic sin respuesta.

## Qué haría (mínimo, sin funciones nuevas)

- Reducir el espacio vertical del menú colapsado: separadores más compactos y sin relleno extra por grupo, conservando la separación visual entre bloques. Con eso los 12 accesos del rol KAM entran completos en 1280x720.
- Agregar una señal de desplazamiento (degradado sutil arriba/abajo, sólo cuando de verdad hay contenido oculto) para que nunca parezca que faltan módulos, incluso en roles con más accesos o pantallas más bajas.
- Diferenciar el indicador de organización del resto: un poco más compacto y con estilo de etiqueta, no de botón navegable.
- No cambio los módulos, los permisos, el orden del menú ni el comportamiento expandido ni el de celular.

## Detalles técnicos

- Archivos: `src/components/layout/SidebarGroupBlock.tsx` (margen del `Separator` y padding del `SidebarGroup` en modo `collapsed`), `src/components/layout/AppSidebar.tsx` (contenedor de `SidebarContent` con la señal de scroll), `src/components/layout/OrgBadge.tsx` (variante colapsada más compacta).
- La señal de scroll se resuelve con clases utilitarias sobre el contenedor existente + estado local derivado de `scrollHeight > clientHeight`, con limpieza del listener; sin librerías nuevas.
- Pruebas enfocadas nuevas/ajustadas en `src/components/layout/__tests__`: rail colapsado renderiza los 12 accesos, la señal aparece sólo con desbordamiento, y el indicador de organización no es un elemento navegable.
- Validaciones: pruebas enfocadas de layout, ESLint focalizado, typecheck y build. CI y RLS completos quedan para GitHub Actions.
