# Fusionar Leads y Prospectos en Empresas y Contactos

Hoy hay 24 leads vivos (11 Nuevo, 11 Prospecto, 2 Convertido) y los 24 ya tienen su Empresa y Contacto creados, pero esas fichas solo guardan nombre, correo y teléfono. El resto de la información del lead se quedó en el lead. El plan pasa esa información a Empresas y Contactos y convierte "Lead" y "Prospecto" en un **estado de la empresa**.

## 1. Propiedades que ya existen (se complementan, no se duplican)

| Dato del lead | Destino | Regla |
|---|---|---|
| Empresa | Empresa · nombre | Ya existe; no se toca |
| Contacto, correo, teléfono | Contacto · nombre, correo, teléfono | Se llena solo si el contacto lo tiene vacío |
| Cargo del contacto | Contacto · Puesto | Se llena si está vacío |
| Fuente | Empresa · Fuente | Se usa la opción equivalente de la lista |
| Interés de modo (Marítimo, Aéreo…) | Empresa · Tipo de transporte | Se marca la opción equivalente |
| Rutas | Empresa · Rutas principales | Se llena si está vacío |
| Volumen (texto) | Empresa · Volumen de importación (USD) | Solo si el texto es un número claro; si no, va a la nueva "Volumen (descripción)" |

Nunca se sobrescribe un dato que alguien ya capturó en la empresa o el contacto.

## 2. Propiedades nuevas en Empresa (las que no existían)
País, Ciudad, Estado (entidad federativa), Dirección, C.P., RFC, Sitio web, Sector, Años establecida, Mercancía, Origen, Destino, Aduana/puerto, Incoterm, Frecuencia, Volumen (descripción), Proveedor actual, Dolor explícito, Consecuencia, Estatus ICP, Motivo de nutrición, Fecha de nutrición y Notas.

Se ignoran: la calificación manual 1–5 (ya la reemplaza el puntaje A/B/C) y los campos internos (quién creó, fechas, vínculos de conversión).

## 3. Estado de la empresa
- **Lead**: empresa registrada que todavía no entra al embudo de oportunidades.
- **Prospecto**: al pasarla a prospecto se crea (o reutiliza) su oportunidad en la etapa **Prospecto** del embudo.
- **Cliente**: cuando ya se dio de alta en Clientes (ganada).

Los leads actuales quedan así: Nuevo/Contactado → Lead, Prospecto → Prospecto, Convertido → Cliente.

En la ficha de Empresa habrá un botón **"Pasar a prospecto"** que sólo aparece en estado Lead.
