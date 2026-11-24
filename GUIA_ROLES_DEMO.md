# Portal360 · Simulación de 50 cuentas y permisos por rol

## Qué está preparado en Neon

- 50 cuentas **ficticias**: 3 `administrador`, 12 `operador` (empleados) y 35 `cliente`.
- 12 asignaciones de empleados a un módulo de SAT, MetroBus, CRM o AguaViva (3 por área).
- 50 filas en `portal_modulo_items` + 50 filas en `portal_registros`.
- Vistas: `portal_sat_reclamos`, `portal_metrobus_recargas`, `portal_crm_solicitudes`, `portal_agua_reportes`.
- La cuenta original de Portal360 se conserva. La base Neon es `portal360` (proyecto `portal360-diseno-web`).
- Las contraseñas de las cuentas demo se almacenaron en Neon con bcrypt y **se migran a scrypt al primer inicio de sesión**.

## IMPORTANTE: archivo Excel privado

El archivo **`Portal360_50_Cuentas_Demo_PRIVADO.xlsx` NO debe subirse a GitHub, Vercel, Render ni a ninguna URL pública**. Se entrega de forma separada, fuera del ZIP para el repositorio. Tiene 50 correos ficticios con dominio `.example` y claves de prueba distintas.

No publicar esas contraseñas ni usarlas para servicios reales. Antes de usar información verdadera, suspender las cuentas demo. Los cargos, montos, DNIs y direcciones de las pruebas son ficticios; no hay cobros reales.

## Publicar esta actualización

1. Extrae el ZIP de actualización y **copia su contenido** encima de la carpeta `Documentos/GitHub/ortal360-diseno-web` (no copies la carpeta exterior como subcarpeta).
2. No modifiques las variables privadas `DATABASE_URL` y `TOKEN_SECRET` en Render.
3. En GitHub Desktop revisa los archivos y pulsa `Commit to main`, después `Push origin`.
4. Render y Vercel están enlazados al mismo repositorio. Verifica que Render termine el despliegue en **Live**.
5. El esquema `sql/04_roles_y_auditoria.sql` ya fue aplicado en Neon. No lo tienes que ejecutar otra vez.
6. Entra en https://portal360-web.vercel.app/gestion/index.html o en el Panel por rol de cada sitio.

## URL por sistema

- SAT: https://portal360-sat.vercel.app/gestion.html
- MetroBus: https://portal360-metrobus.vercel.app/gestion.html
- CRM: https://portal360-crm-andino.vercel.app/gestion.html
- AguaViva: https://portal360-aguaviva.vercel.app/gestion.html
- Panel global: https://portal360-web.vercel.app/gestion/index.html

## Matriz de roles (autorizada en backend)

| Acción | Administrador | Empleado operador | Cliente |
|---|---|---|---|
| Ver casos | Todos | Solo módulos asignados | Solo los suyos |
| Cambiar estado de casos | Sí | Solo sus módulos | No |
| Ver usuarios y gestionar roles | Sí, **solo cuentas demo** | No | No |
| Activar / desactivar demo | Sí | No | No |
| Ver auditoría | Sí | No | No |
| Registrar su propia solicitud | Sí | Sí | Sí |

**Restricción sensible:** empleados no pueden ver información de módulos ajenos; las comprobaciones son del servidor, no solo del interfaz. Los administradores demo están diseñados únicamente para el laboratorio; si se hacen públicas sus claves podrían acceder a datos compartidos. Mantén la base de demostración sin datos reales.

## Guion rápido de sustentación

1. Administrador: inicia con `admin01@portal360.example` y su contraseña del Excel privado. Enseña el resumen y las 50 cuentas.
2. Edita una solicitud y muestra cómo queda la acción en el registro de auditoría.
3. Empleado SAT: entra con `empleado.sat01@portal360.example`, atiende un caso de SAT e intenta entrar a CRM. La API debe rechazar lo segundo.
4. Cliente: entra con `cliente01@portal360.example`; solo ve su historial. No puede modificar estados.
5. Refresca las páginas y comprueba que los cambios persisten en Neon.

## Consultas SQL de verificación (solo lectura)

```sql
SELECT rol,COUNT(*) FROM portal_usuarios WHERE es_demo=TRUE GROUP BY rol;
SELECT modulo,COUNT(*) FROM portal_modulo_items WHERE codigo LIKE 'DEMO-%' GROUP BY modulo;
SELECT * FROM portal_crm_solicitudes WHERE codigo LIKE 'DEMO-%' LIMIT 5;
SELECT * FROM portal_auditoria ORDER BY id DESC LIMIT 20;
```

## Límites honestos

Los formularios principales de cada sitio y el panel por roles funcionan con la API compartida. Los sistemas anteriores tenían funcionalidades extra (pagos, cajas y facturación) cuya migración completa no está incluida en esta demo; no se simulan cobros como realizados. La API en Render Free puede tardar en responder al salir del modo de reposo.
