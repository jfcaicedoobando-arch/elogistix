
# Verificación visual de Fase B en `/costeo/tarifas`

Ahora que ya estás autenticado con un usuario con acceso, voy a capturar `/costeo/tarifas` con Playwright para validar que los cambios de Fase B se vean correctamente:

- KPIs compactos en una sola fila (~56 px) con borde sutil.
- Indicador de filtro activo cuando das clic en "Pendientes" o "Por vencer".
- Barra de filtros sin `Card`, búsqueda más ancha con placeholder nuevo y selects `h-9` con labels inline (`Aprob:`, `Vigencia:`, `Agente:`, `Cont:`).
- Fila de contexto con contador `N tarifas` a la izquierda y toggle Agrupada/Tabla a la derecha.

Después te reporto observaciones y, si encuentro algo que ajustar (alineación, contraste, overflow en pantallas chicas), te lo digo antes de tocar código.

¿Apruebo y continúo con la verificación?
