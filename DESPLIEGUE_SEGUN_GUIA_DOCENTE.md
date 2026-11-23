# Portal360 — despliegue de acuerdo con la guía HTML del docente

## Estado verificado el 23 de noviembre de 2026
- Neon: proyecto `portal360-diseno-web`, identificador `noisy-leaf-19048425`, base `portal360`, en AWS US East 2 (Ohio). Tablas `portal_usuarios` y `portal_registros`, con índices, creadas por SQL no destructivo.
- GitHub: el conector no devuelve ningún repositorio accesible. **No se publicó código**.
- Render: el conector devuelve el workspace `My Workspace`, pero exige confirmación de cuál usar antes de desplegar. **No se creó un servicio**.
- Vercel: el equipo `tucherro` requiere autorización del usuario. **No se creó un proyecto ni se publicó el frontend**.

## Estructura
- `frontend/` — Vite + HTML5 + CSS3 + JS + Bootstrap. Vercel debe apuntar Root Directory a `frontend` y Output Directory a `dist`.
- `backend/` — Express y Neon; Render debe apuntar Root Directory a `backend`, Build `npm install`, Start `npm start`.
- `sql/` — esquema compartido PostgreSQL, ya ejecutado en la base dedicada.
- `Portal360_Postman_collection.json` — colección de pruebas HTTP importable.
- `referencias/` — materiales originales, **no integrados por completo** con sus funciones específicas.

## Publicación después de autorizar GitHub/Render/Vercel
1. Subir el proyecto a un repositorio nuevo. Revisar `git status` y excluir `.env`, `node_modules` y `dist`.
2. Render: crear servicio web desde el repositorio con Root Directory `backend`, plan Free y región Ohio, si está disponible. Variables: `DATABASE_URL` (cadena privada de Neon), `TOKEN_SECRET` (aleatoria de 32+ caracteres), `FRONTEND_ORIGIN` (URL exacta de Vercel). Render establece PORT por sí mismo.
3. Verificar `GET https://SERVICIO.onrender.com/api/health` y el JSON `{ok:true,...}`.
4. Vercel: importar el mismo repositorio con Root Directory `frontend`, Framework Vite, Output Directory `dist`, variable pública `VITE_API_URL=https://SERVICIO.onrender.com/api`. Volver a desplegar después de cambiar variables VITE_.
5. Actualizar `FRONTEND_ORIGIN` en Render con el dominio real Vercel; comprobar registro, inicio de sesión, consultas y persistencia.
6. Postman: importar la colección y sustituir `baseUrl` por la API de Render con `/api`. Usar correo de prueba propio y no publicar contraseñas reales.

## Límites
La plataforma comparte identidad y registros de solicitudes entre cuatro módulos académicos; esto **no implica** que se hayan migrado las operaciones originales (pago de papeletas, venta de pasajes, caja, facturación, etc.). Las capturas y mockups se deben cotejar manualmente. Las credenciales expuestas en ZIP antiguos deben rotarse en sus fuentes originales.

## Para exponer
1. Mostrar arquitectura Frontend Vercel → API Render → Neon PostgreSQL.
2. Explicar `header/nav/main/section/footer`, grilla Bootstrap y `@media` en CSS.
3. Enseñar evento `submit`, uso de `fetch`, `createElement`, `textContent` y JSON.
4. Demostrar `GET /api/health`, registro, login y CRUD mínimo de registros.
5. Mostrar panel SQL de Neon con tablas creadas y confirmar que no hay cadenas secretas en JS público.
