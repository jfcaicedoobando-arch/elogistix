## Paso 2 — Datos que solo tiene el lead (se agregan como propiedades nuevas de Empresa)
Texto: País, Ciudad, Estado (entidad federativa), Dirección, Código postal, RFC, Sector, Sitio web, Mercancía, Origen, Destino, Aduana / puerto, Incoterm, Volumen, Frecuencia, Proveedor actual, Dolor explícito, Consecuencia, Estatus ICP, Motivo de nutrición, Notas.
Número: Años establecida. Fecha: Fecha de nutrición.

Después se copia el valor de cada lead a su empresa. Aparecerán solas en la ficha de la empresa y en **CRM → Propiedades**, donde se pueden renombrar o archivar.

**No se pasan** (son datos del sistema, no de la empresa): etapa del lead, vendedor asignado, calificación 1–5 (ya la reemplaza el puntaje A/B/C) y los vínculos de conversión.

**Nota sobre "Volumen":** en el lead es texto libre ("2 contenedores al mes"), mientras que Empresa tiene "Volumen de importación (USD)" en número. Como no son lo mismo, se agrega como propiedad aparte.

## Qué no cambia
- Las pantallas de Leads y Prospectos siguen igual por ahora y no se borra ningún lead. Si después quieres ocultarlas del menú, lo vemos aparte.
- No hay cambios de estructura en la base: solo se agregan propiedades y valores.

## Antes de ejecutar
Esto escribe datos en la base real (24 empresas y sus contactos). Te pido confirmación justo antes de correrlo y te muestro cuántos datos se llenaron.

## Detalles técnicos
- Fuente única: `crm_leads` (Prospectos = filtro por `estado`). Enlace: `crm_empresas.lead_origen_id` / `crm_contactos.lead_origen_id`.
- Columnas nativas de contacto (`nombre/email/telefono`) se actualizan solo si son null o vacías.
- Propiedades nuevas: insert en `crm_propiedades` (objeto `empresa`, claves snake_case, `orden` continuo); valores en `crm_valores` con `ON CONFLICT DO NOTHING` para no pisar valores existentes. `fuente` e `interes_modo` se mapean a opciones vigentes vía `crm_propiedad_opciones` (`idVigente`); si no hay opción equivalente, se omite y se reporta.
- Script idempotente por `run_sql`, por organización. Validación: conteos antes/después y revisar una ficha en pantalla. CI/RLS completos quedan para GitHub Actions.
