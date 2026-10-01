# Reconstrucción del CRM por objetos

Así es como quedaría el CRM nuevo con base en las entrevistas: cuatro objetos que se pueden ligar entre sí, propiedades que el administrador de Libre Carga configura sin programar, el embudo de 7 etapas, la solicitud a Pricing, el puntaje A/B/C y reportes que se arman desde la pantalla. Todo el historial de leads, oportunidades y actividades se pasa al modelo nuevo sin perder nada.

## Decisiones tomadas
- **Empresas** del CRM van separadas de Clientes. Cuando una oportunidad se gana, la empresa se copia a Clientes con el alta que ya existe (documentos, aprobación y crédito).
- **Migrar todo**: los leads actuales se vuelven Empresas y Contactos. Las oportunidades y actividades se conservan con sus vínculos.
- **Solo Libre Carga** (super admin) puede crear, editar o borrar propiedades y armar reportes. Los demás usuarios solo usan el CRM y ven los reportes.

## Objetos y sus vínculos
- Una **Empresa** puede tener varios contactos y varias oportunidades.
- Una **Oportunidad** puede tener varias empresas, varios contactos y varias actividades.
- Una **Actividad** puede tener varias empresas y varios contactos, pero solo una oportunidad.
- Un **Contacto** puede pertenecer a varias empresas.
