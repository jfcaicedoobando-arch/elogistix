## Propiedades configurables
Cada objeto tiene propiedades. Tipos que se pueden usar: lista de una opción, lista de varias opciones, número, fecha y texto libre. En el módulo **CRM → Propiedades**, el super admin puede crear, renombrar, reordenar, marcar como obligatoria o archivar una propiedad, y agregar o editar opciones de las listas.

**Regla de las entrevistas:** si se renombra una opción (por ejemplo, "Terrestre" pasa a "Terrestre (Camión | Tráiler)"), en la base de datos se guarda como un valor nuevo y el anterior se archiva. En pantalla se ve como un cambio de nombre y los reportes viejos siguen cuadrando. Borrar una propiedad la archiva y no se pierde ningún dato.

## Propiedades iniciales (de las entrevistas)
- **Empresa:** Fuente (Prospección, Referido, Referido Finkargo), Tipo de transporte, Rutas principales, Volumen de importación (USD), Potencial mensual (TEUs), Tiene agente aduanal o transportista propio, Perfil de crédito.
- **Contacto:** Puesto, Nivel de decisión (Director, Gerente, Analista), Teléfono móvil, Teléfono fijo, Correo, LinkedIn.
- **Oportunidad:** Servicio, Complejidad (Estándar, Compleja, Especial), Motivo de pérdida, Monto estimado, Fecha de cierre esperada.
- **Actividad:** Tipo (llamada, reunión, correo, WhatsApp), Resultado, Asistió a la reunión.

## Fases de entrega (cada una se revisa antes de pasar a la siguiente)
1. **Base de objetos y vínculos.** Se crean los objetos, sus vínculos, las propiedades y la migración de los datos actuales. Se protege la información para que cada empresa solo vea la suya.
2. **Pantallas de los 4 objetos.** Lista, ficha con propiedades y vínculos, y forma para ligar registros entre objetos.
3. **Módulo de Propiedades** (solo super admin).
4. **Embudo de 7 etapas:** Sospechoso, Prospecto, Calificado, Negociación, Cerrado ganado, Cerrado perdido (con motivo obligatorio) y Nutrición. Los ganados se dan de alta en Clientes.
5. **Solicitud a Pricing:** el formato que hoy se llena en Sheets queda dentro de la oportunidad. Operaciones responde con opciones de tarifa y el reloj cuenta el tiempo de respuesta (8, 24–36 y 48 horas según complejidad).
6. **Puntaje A/B/C:** reglas configurables que suman o restan puntos. A va de 80 a 100, B de 50 a 79 y C de menos de 50.
7. **Reportes dinámicos:** el super admin elige objeto, filtro, agrupación y tipo de gráfica (barras, línea, pastel, número o tabla) y los acomoda en tableros.

## Fuera de alcance
Nada del resto del ERP (embarques, facturación, compras) cambia. No se publica ni se cambia la versión sin tu autorización.

## Detalles técnicos
- Tablas nuevas: `crm_empresas`, `crm_contactos`, tablas de vínculos (`crm_empresa_contacto`, `crm_oportunidad_empresa`, `crm_oportunidad_contacto`, `crm_actividad_empresa`, `crm_actividad_contacto`) y una columna `oportunidad_id` única en actividades.
- Propiedades: `crm_propiedades` (objeto, clave, tipo y archivada), `crm_propiedad_opciones` (con `reemplaza_a` para renombrar sin perder el valor anterior) y `crm_valores` (formato EAV con una columna por tipo e índices).
- Pricing: `crm_solicitudes_pricing` + `crm_pricing_opciones`. Scoring: `crm_scoring_reglas`. Reportes: `crm_reportes` y `crm_tableros` (configuración en JSON), resueltos con un RPC de agregación de solo lectura.
- RLS por `organization_id`. La escritura de propiedades, reglas y reportes queda limitada a `has_role(super_admin)`. Cada tabla lleva GRANT.
- Migración: el lead pasa a empresa y contacto. Oportunidades y actividades conservan su id y se re-vinculan. Las tablas viejas quedan como solo lectura hasta validar.
- En el draft, las migraciones se preparan y se aplican al aceptar. Archivos de 200 líneas o menos y pruebas focalizadas por fase.
