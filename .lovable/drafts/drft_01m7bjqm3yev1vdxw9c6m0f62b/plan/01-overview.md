# Portal de Brokers (vendedores externos)

Nuevo rol **Broker** con su propio portal acotado, alta desde Gestión de usuarios y un módulo interno de monitoreo. Se entrega en 3 fases; cada fase se prueba antes de empezar la siguiente.

## Decisiones tomadas
- **Comisión compartida:** existe un solo % por oportunidad; se reparte entre broker y KAM asignado (ej. 15% total: broker 10%, KAM 5%). Mismas reglas que vendedores: se devenga al cobro, sobre utilidad real, con NC restando.
- **Acceso:** el broker recibe un correo de invitación para crear su contraseña.
- **Multiempresa:** un mismo broker puede trabajar para varias organizaciones; en cada una tiene su propio % y sólo ve lo suyo.

## Fase 1 — Alta de brokers y portal básico
- Gestión de usuarios: pestaña **Brokers** con botón **Crear broker nuevo** (nombre, correo, % inicial de comisión). Envía invitación.
- Al entrar, el broker cae en el **Portal de Brokers** (no ve el ERP).
- **Mis empresas:** lista de empresas donde es broker y la etapa en vivo de sus oportunidades.

## Fase 2 — Consultar e ingresar empresa
- Buscador con sugerencias mientras escribe. Sólo muestra el **nombre** y si es Cliente o Prospecto (En cotización, Negociación, Cerrado ganado, Nutrición). Ningún otro dato.
- **Es cliente:** no disponible.
- **Es prospecto:** formulario de petición (a quién conoce — sólo rol; relación previa y confianza; tiempo estimado de cierre). Llega a Administradores, KAMs y Gerente Comercial para autorizar o rechazar. La respuesta llega al broker; si se autoriza queda como vendedor externo.
- **No existe:** alta de empresa con estado **Prospecto externo**, fuente **Broker** automática y los campos pedidos (país, tipo de transporte múltiple, volumen USD, rutas, agente aduanal/transportista propio, RFC, sector, origen, destino, Incoterm, proveedor actual, notas). Luego contactos (nombre, correo, teléfono, puesto, móvil, fijo). Se crea oportunidad en Prospecto con etiqueta **Prospecto externo** y se asigna un KAM por **turno rotativo ordenado**.

## Fase 3 — Comisiones y módulo de monitoreo
- Portal: apartado **Comisiones** con total liquidado, total pendiente y estatus de cada comisión.
- Módulo interno **Brokers**: lista de brokers, cuántos prospectos externos ha pasado cada uno, detalle de sus prospectos, sus comisiones y cambio de % (con bitácora).
