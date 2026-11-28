# CRM Andino — React
Migración del panel de solicitudes a React 19 y Vite. Conserva la API central de Portal360. La base de datos Neon se comunica únicamente con el backend. Los flujos heredados de caja, pagos y facturación no han sido migrados en esta versión.

## Desarrollo
- npm install
- npm run dev
- npm run build
- npm run preview

## Arquitectura
- src/main.jsx: montaje de React.
- src/App.jsx: estados, efectos, sesión, permisos de UI, solicitudes y filtros.
- src/components.jsx: componentes con props y formularios controlados.
- src/api.js: fetch, JSON y autorización Bearer.
- src/styles.css: diseño responsive.
- vercel.json: proxy de /api hacia Render. VITE_API_URL=/api.
- vite.config.js: proxy equivalente para desarrollo.

## Publicación
https://portal360-crm-andino-react.vercel.app
API pública: https://portal360-api.onrender.com/api
Verificar el build y el login con cuentas de demostración. No mostrar credenciales en video. Los permisos reales se validan en el backend.