# Portal360 Cinematic — Publicación y comprobación

## Instalación con GitHub Desktop (sin cambiar la base)

1. Usa **Portal360_CINEMATIC_PATCH.zip**. Extrae el contenido y cópialo, sin crear una carpeta adicional, dentro de `Documentos/GitHub/ortal360-diseno-web`.
2. Revisa que estén `frontend/index.html`, `frontend/css/experience.css`, `frontend/js/experience.js` y `frontend/public/gestion/ops-experience.css`.
3. En GitHub Desktop: **Changes → Summary**: `Portal360 Cinematic — historia visual de cinco experiencias` → **Commit to main → Push origin**.
4. Revisa que los 5 despliegues de Vercel aparezcan `READY`. Como no cambia `backend/server.js`, Render y Neon no requieren nuevas variables ni ejecutar SQL.
5. Prueba el portal principal: `https://portal360-web.vercel.app/` y su panel `https://portal360-web.vercel.app/gestion/index.html`.
6. Prueba paneles propios: SAT `https://portal360-sat.vercel.app/panel.html`, MetroBus `https://portal360-metrobus.vercel.app/panel.html`, CRM `https://portal360-crm-andino.vercel.app/panel.html`, AguaViva `https://portal360-aguaviva.vercel.app/panel.html`.

## Pruebas mínimas

- Navega a las cuatro portadas independientes. La intro cinematográfica no debe tapar sus menús originales.
- En cada panel propio inicia sesión con una cuenta **de demostración**, comprueba el acceso y crea un caso de prueba.
- Abre el panel general y confirma que el caso aparece en el módulo correcto.
- Modifica el estado desde el panel propio y vuelve a consultar en el general.
- En el panel general entra con un empleado de CRM; comprueba que el backend no le permita atender otros módulos.
- A 375 px, 768 px y 1440 px comprueba ausencia de scroll horizontal y uso correcto del formulario.
- Activa `prefers-reduced-motion` en el sistema: el contenido debe continuar visible sin animaciones.
- No subas Excel privado de contraseñas, `.env`, secretos, cadenas PostgreSQL ni archivos de sesiones al repositorio.

## Arquitectura y límites

- Vercel sirve HTML/CSS/JS y las cuatro interfaces independientes.
- Render autentica y valida permisos, acciones y estados.
- Neon PostgreSQL persiste usuarios, asignaciones, solicitudes y auditoría.
- Las cifras de barras del panel general se consultan desde el endpoint real `/api/gestion/resumen`.
- Esta actualización solo agrega CSS, SVG decorativos, narrativa y scripts visuales. No altera la base de datos, ni las contraseñas, ni los endpoints existentes.
- La versión del ZIP es una **entrega lista para subir**, no un despliegue confirmado. Tras publicarla debes repetir las pruebas de regresión.
