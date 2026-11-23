# Portal360 | Cuatro sitios originales con una única base de datos

## Arquitectura y alcance real
- Los cuatro sitios originales se sirven en rutas independientes `/sites/sat/`, `/sites/metrobus/`, `/sites/crm/` y `/sites/agua/` dentro de Vercel. Sus `index.html`, CSS, imágenes y páginas auxiliares originales se conservan.
- En cada portada se añade el botón **Abrir gestión conectada**. Allí hay un formulario específico para reclamos SAT, recargas MetroBus, solicitudes CRM o reportes AguaViva.
- Todas las operaciones de estas cuatro pantallas usan `https://portal360-api.onrender.com/api`, autentican con la misma cuenta y guardan en **una sola base Neon** (`portal360`, tabla `portal_modulo_items`).
- **IMPORTANTE:** los SQL heredados se sustituyen por un adaptador de API para alta y acceso de clientes, registro de reclamos/recargas/solicitudes/reportes y consulta de registros propios. Las pasarelas, cajas y paneles administrativos heredados permanecen deshabilitados y requieren una adaptación posterior. Los pagos son simulaciones y no se efectúan pagos reales.
- Esta es una integración funcional verificable de los **cuatro flujos principales de registro y consulta** con sus portadas originales; no es migración completa de cada función interna.

## Publicar
1. En Neon, en la base `portal360`, ejecutar `sql/02_modulos_independientes.sql` en SQL Editor; no ejecuta DROP/TRUNCATE.
2. Copiar todos los archivos al repositorio GitHub `Milioafk/ortal360-diseno-web`, conservando `frontend/` y `backend/` en raíz. Sustituir `backend/server.js` y `frontend/index.html`, subir `frontend/public` completo. No subir las carpetas `referencias` ni credenciales.
3. Render despliega `backend` automáticamente y utiliza las variables secretas que ya configuraste. Verificar `/api/health`.
4. Vercel despliega `frontend` con Vite. Verificar `/sites/sat/index.html`, `/sites/metrobus/index.html`, `/sites/crm/index.html`, `/sites/agua/index.html`.
5. Entrar a cada sitio y pulsar **Abrir gestión conectada**. Iniciar sesión con la cuenta Portal360, guardar registros y confirmar que persisten tras recargar.

## API
- `GET /api/modulos/sat/items`, `POST /api/modulos/sat/items`
- `GET /api/modulos/metrobus/items`, `POST /api/modulos/metrobus/items`
- `GET /api/modulos/crm/items`, `POST /api/modulos/crm/items`
- `GET /api/modulos/agua/items`, `POST /api/modulos/agua/items`
Todas requieren `Authorization: Bearer <token>` obtenido en `/api/auth/login`. Los clientes solo ven sus registros; rol administrativo puede consultar todas las entradas del módulo.

## Seguridad
- Se eliminaron los enlaces de base de datos insertados en los JavaScript heredados. La base se consulta únicamente desde Render.
- Las validaciones se aplican en el servidor además de la interfaz. Nunca subir un `.env` ni las credenciales del Neon original.
- Recomendado rotar las contraseñas que estuvieron visibles en los repositorios previos.

## URLs posteriores al despliegue
- Portal: https://portal360-web.vercel.app/
- SAT Lima: https://portal360-web.vercel.app/sites/sat/index.html
- MetroBus Lima: https://portal360-web.vercel.app/sites/metrobus/index.html
- CRM Andino: https://portal360-web.vercel.app/sites/crm/index.html
- AguaViva: https://portal360-web.vercel.app/sites/agua/index.html

Estas cuatro URL aún no existen en la versión pública anterior: aparecen solo cuando se sube este paquete a GitHub y Vercel lo vuelve a desplegar.

## Vercel: cuatro proyectos independientes ya creados
Se han creado proyectos Vercel independientes vinculados a la misma rama `main`, con estas raíces:
- `portal360-sat`: `frontend/public/sites/sat`
- `portal360-metrobus`: `frontend/public/sites/metrobus`
- `portal360-crm-andino`: `frontend/public/sites/crm`
- `portal360-aguaviva`: `frontend/public/sites/agua`
Tras subir al GitHub, revisa los despliegues y asignaciones de dominios en Vercel. Su sitio propio usa `index.html` y `integracion.html` dentro de cada raíz.

## CORS
Render debe incluir en `FRONTEND_ORIGIN` los dominios finales de Vercel de los cinco proyectos: portal principal y cada uno de los cuatro sitios. Añadir los URL definitivos tras cada primer deploy; separar mediante comas, sin rutas y sin barra final.
