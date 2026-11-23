# Guía de sustentación (Unidad 4)

**¿Por qué una base de datos?** El servidor central tiene una única variable `DATABASE_URL` que apunta a Neon; los registros se distinguen por `modulo`.

**¿Qué HTML semántico usamos?** `header` contiene la navegación, `main` delimita contenido principal, `section` agrupa bloques, `article` presenta tarjetas e historial, `footer` información del proyecto.

**¿Qué es Mobile First?** Diseñamos primero para pantallas pequeñas; Bootstrap reorganiza columnas con `col-sm-6` y `col-lg-3`, y CSS añade ajustes desde 768 px.

**¿Cómo funciona JS?** `addEventListener` responde a clics y submits. `fetch` consulta `/api`. El historial se dibuja con `createElement` y `textContent`, evitando interpolar HTML sin filtrar.

**¿Cómo protegemos Neon?** La contraseña de la base solo existe en `.env` del servidor. El navegador habla con la API, que comprueba tokens.

**¿Qué hace cada tabla?** `portal_usuarios` guarda la identidad compartida y `portal_registros` guarda datos de los cuatro módulos con `modulo` y `usuario_id`.

**¿Qué falta para el 100 %?** Integración profunda de pagos/caja y funciones históricas de cada proyecto; adaptar los sitios legados para consumir el mismo backend, pruebas de accesibilidad y despliegue.

**Modificación en vivo sugerida:** cambiar el color de `.brand-accent` en CSS, añadir campo visible al formulario o modificar la etiqueta de un módulo en `app.js`.
