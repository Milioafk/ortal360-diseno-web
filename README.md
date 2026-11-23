# PORTAL 360 — Entrega de Diseño Web (avance del 60 %)

## Qué se entrega
- `public/`: prototipo funcional integrado y responsivo, con HTML semántico, CSS, JavaScript y Bootstrap 5.
- `backend/`: servidor Express, autenticación con scrypt + token HMAC firmado, API REST y una sola conexión de servidor a Neon.
- `sql/01_esquema_integrado.sql`: tablas nuevas con prefijo `portal_` para evitar colisiones con las tablas antiguas.
- `referencias/`: copias de los proyectos recibidos con **cadenas de conexión eliminadas**. Sirven para comparar interfaces originales; **NO están migrados a la nueva API**.

## Instalación en local
1. Crear **una** base de datos en Neon. Ejecutar `sql/01_esquema_integrado.sql` en SQL Editor.
2. En `backend`, copiar `.env.example` a `.env`, completar `DATABASE_URL` y crear `TOKEN_SECRET` aleatorio de al menos 32 caracteres (por ejemplo con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). No subir `.env` a GitHub.
3. Instalar Node.js 20 o superior. Ejecutar `cd backend && npm install && npm start`.
4. Abrir `http://localhost:4000`. **No abrir el archivo index.html directamente**, pues la API requiere servidor.
5. Crear usuario, iniciar sesión, escoger SAT/MetroBus/CRM/AguaViva, guardar y consultar registros. Todos usan una única base Neon y las mismas credenciales de acceso del portal.

## Alcance y límites honestos
Esta entrega demuestra la integración de los **cuatro dominios** mediante un portal mínimo y un esquema común. No traslada automáticamente todas las funcionalidades de las cinco aplicaciones heredadas (pagos, caja, facturación, etc.). Su lógica original permanece como referencia. Las tablas `portal_` no se sincronizan por sí mismas con tablas `usuarios`, `pagos`, `recargas_tarjeta`, etc. Para una integración completa de módulos legados se requieren adaptadores, migración de datos y pruebas adicionales.

El login nuevo cifra contraseñas mediante scrypt; no migra usuarios con contraseñas en texto plano. Los operadores y administradores solo se asignan manualmente por un administrador de la BD en entorno de práctica; el registro público siempre crea `cliente`. Los JWT simplificados son tokens HMAC de 8 h en `sessionStorage`: útiles como MVP académico; para producción considerar sesiones en cookies HttpOnly, revocación, auditoría, CSRF y controles más finos. No se implementan pagos reales.

## Validación y rúbrica
1. HTML: `header`, `nav`, `main`, `section`, `article`, `footer` y formularios con `label`.
2. Carpetas: `public/css`, `public/js`, `backend`, `sql`, `referencias`.
3. Bootstrap 5, grilla `row` / `col-`, estilos Mobile First y media query a partir de 768 px.
4. Justificar semántica: un solo `main`, secciones con títulos, navegación accesible.
5. CSS: variables `:root`, flexbox, grid, modelo de caja, media query, focus-visible.
6. JS: `addEventListener`, `fetch`, DOM con `createElement`/`textContent`, carga dinámica, envío a API y control de errores.

## Pruebas que debes hacer antes de presentar
- Responsive a 320, 375, 768 y 1440 px (DevTools).
- Verificar `GET /api/health` con Neon configurado.
- Crear una cuenta y registrar un elemento de cada módulo, recargar y comprobar persistencia.
- Confirmar que una segunda cuenta `cliente` no ve los registros de la primera.
- Verificar que no existe `DATABASE_URL` en los archivos de `public/`.
- Capturar los mockups originales y comprobar visualmente qué partes se han incorporado.

**Importante:** Las cadenas de conexión estaban incrustadas en algunos ZIP originales, por lo que conviene rotar dichas credenciales en Neon antes de desplegar las versiones públicas. No ejecutar scripts SQL antiguos que incluyen `TRUNCATE` sobre la base unificada.
