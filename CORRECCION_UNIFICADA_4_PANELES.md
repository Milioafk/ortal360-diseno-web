# Portal360 · Corrección unificada de paneles (SAT / MetroBus / CRM / AguaViva)

**Objetivo:** la administración y los empleados ingresan al panel seguro `gestion.html` de **cada sitio**, conservando sus páginas originales y las consultas/operaciones a través de Render → Neon.

## Diagnóstico (código original)

| Sitio | Panel legado | Problema detectado | Corrección |
|---|---|---|---|
| SAT Lima | `panel.html` | Consultas `JOIN usuarios` y filtros de turno no soportados; registro público mostraba opción «Administrador» | Acceso a `gestion.html`, rutas por rol y registro público solo cliente |
| MetroBus | `panel.html` | Consultas/operaciones heredadas de recargas + `usuarios` no migradas; rol `empleado` distinto de `operador` | Acceso a `gestion.html`; redirección por rol `operador` |
| CRM Andino | `panel.html` | Consultas `solicitudes_demo_crm` con `JOIN`, y gestión por turnos heredada no soportada | Acceso a `gestion.html`; sin SQL directo desde el navegador |
| AguaViva | `panel.html` | Consultas y cambios heredados de `reportes_fuga`, con referencias a roles y turnos antiguos | Acceso a `gestion.html`; se corrige el enlace y el login |

Las páginas originales de **inicio, descripción, formularios y consultas** se conservan. Se añade un enlace visible al centro de operaciones a cada portada y login.

## Panel nuevo funcional

- **Administrador:** ver casos de módulos, cambiar estado, gestionar roles y módulos de las cuentas demo, consultar bitácora.
- **Operador:** ver y tramitar casos de los módulos autorizados. Si usa el panel de su sitio, ese módulo aparece preseleccionado.
- **Cliente:** ver sus propias solicitudes, sin permisos de administración.
- **Backend:** valida el rol y las asignaciones desde `portal_usuarios` y `portal_staff_modulos`, no desde el HTML.
- **Una base:** todos los sistemas siguen usando la misma base `portal360` de Neon.

## Alcance y limitaciones

- **No hace falta ningún SQL ni recrear cuentas:** ya están creados los 50 usuarios y datos ficticios.
- `panel.html` de cada sitio ahora **redirige** al panel moderno y no ejecuta consultas legadas que producen errores. El código legado se conserva como fuente, pero no se ejecuta.
- **No se han portado** horarios de turno ni todas las funciones de caja, comprobantes, conciliación o pagos de los cuatro sistemas. Las simulaciones de cobro **no son transacciones reales**.
- La sesión se guarda por dominio en `sessionStorage`: al pasar de un dominio Vercel a otro es normal volver a autenticarse.
- Las contraseñas demo están únicamente en el Excel **privado** ya entregado; **no incluyas ese Excel ni archivos `.env` en GitHub**.

## Publicación, proyecto conectado a GitHub

1. Descomprime **Actualización unificada** y copia su contenido a la raíz local de `ortal360-diseno-web` (fusión de carpetas). **No** copies la carpeta contenedora ni elimines `.git`.
2. En GitHub Desktop revisa los cambios y ejecuta `Commit to main` → `Push origin`.
3. Render y Vercel están conectados a `main`; revisa los despliegues. Render debe mostrar `Live`, y cinco proyectos de Vercel deben mostrar `READY`.
4. Prueba que `/panel.html` de cada sitio redirija a `/gestion.html` sin el error de SQL.
5. Inicia sesión en `gestion.html` con `admin01@portal360.example`, `empleado.crm01@portal360.example` y `cliente01@portal360.example` **con la contraseña del Excel privado**.
6. Con el administrador, cambia el estado de un caso **DEMO-CRM-...**; recarga y verifica que el cambio persiste. También verifica el histórico en `portal_auditoria`.

## Enlaces del panel ya publicado, válidos después de `Push origin`

- SAT Lima: https://portal360-sat.vercel.app/gestion.html
- MetroBus: https://portal360-metrobus.vercel.app/gestion.html
- CRM Andino: https://portal360-crm-andino.vercel.app/gestion.html
- AguaViva: https://portal360-aguaviva.vercel.app/gestion.html
- Portal360: https://portal360-web.vercel.app/gestion/index.html

## Precauciones

No uses `run_sql` de los proyectos anteriores ni ejecutes scripts que incluyen `TRUNCATE` en esta base. No copies cadenas de conexión de Neon al frontend. `DATABASE_URL` y `TOKEN_SECRET` permanecen en las variables de entorno de Render.
