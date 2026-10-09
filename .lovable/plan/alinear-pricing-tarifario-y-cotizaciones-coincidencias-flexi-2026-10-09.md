# Alinear Pricing, Tarifario y Cotizaciones + coincidencias flexibles

## Qué vas a ver
1. **Mismos nombres en los tres lugares** (solicitud a Pricing, Nueva tarifa marítima y cotización):
   Modo de transporte, Tipo de contenedor, Incoterm, País de origen, Puerto de origen, País de destino, Puerto de destino, Agente, Naviera, Flete, Vigencia, Días libres. Se cambian sólo las etiquetas en pantalla (por ejemplo "Servicio" pasa a "Modo de transporte", "AOL/POL" a "Puerto de origen"); los datos guardados no cambian.
2. **Coincidencias flexibles**: una solicitud sugiere tarifas cuando coinciden modo, tipo de contenedor, país de origen y país de destino. Si la solicitud trae puerto, se usa para ordenar primero las del mismo puerto, pero ya no excluye las demás. El Incoterm decide qué cargos se suman (FOB suma cargos del agente). Se muestran **todas** las coincidencias vigentes (hoy se cortan a 10), ordenadas de menor a mayor flete.
3. **Cotizar desde la solicitud**: cada opción tiene el botón **"Cotizar con esta opción"**. Guarda la opción en la solicitud (como hoy "Usar esta opción") y abre una cotización nueva ya llenada con la empresa y contacto de la oportunidad, ruta, contenedor, incoterm y la tarifa elegida (flete y cargos).
4. **Desde una cotización nueva**: al elegir la empresa, si tiene una oportunidad en etapa **"En negociación"** con solicitudes de Pricing respondidas, aparece **"Usar respuesta de Pricing"**. Muestra las opciones respondidas; al elegir una se pasan los mismos datos a la cotización.

## Reglas
- Sólo tarifas vigentes a la fecha tentativa de carga (o hoy si no hay).
- La tarifa sigue siendo la fuente; la cotización la liga como hoy (tarifa vinculada), sin copiar ni recalcular costos internos.
- No cambia quién puede elegir opciones ni quién puede cotizar.

## Fuera de alcance
Modos distintos de marítimo en el tarifario (el tarifario sólo tiene tarifas marítimas: si la solicitud es Aérea o Terrestre no habrá sugerencias). Sin cambios a cotizaciones ya existentes.

## Detalles técnicos
- `coincidencias.ts`: comparar país vía `puertos.country` de la ruta (agregar `country` al select de `tarifarioService`) contra `origen`/`destino` de la solicitud; puerto como criterio de orden; `servicio` debe ser Marítimo; quitar `slice(0,10)`. Actualizar pruebas de coincidencias.
- Etiquetas: catálogo compartido de etiquetas en `src/features/costeo` usado por formulario/detalle de pricing, `TarifaFormFields` y wizard de cotización.
- "Cotizar con esta opción": tras `crm_aplicar_tarifa_tarifario`, navegar al wizard de nueva cotización con `oportunidad_id` y `tarifa_id` en la URL; el wizard ya soporta tarifa vinculada y oportunidad, se precarga empresa/contacto desde la oportunidad.
- Wizard: componente `OpcionesPricingCotizacion` (≤200 líneas) que lista solicitudes `respondida` con `tarifa_tarifario_id` o tarifas ligadas de oportunidades de la empresa en etapa "En negociación" (lectura con RLS existente).
- Sin migraciones nuevas. Pruebas focalizadas de coincidencias y del precargado; CI/RLS completos en GitHub Actions. Sin cambio de versión salvo autorización.
