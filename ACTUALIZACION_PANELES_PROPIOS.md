# Portal360 — Paneles propios conectados a una misma base de datos

Esta actualización corrige la decisión anterior de sustituir `panel.html` por una redirección al panel genérico.

## Qué cambia

| Sitio | Panel propio | Datos y permisos |
|---|---|---|
| SAT Lima | `/panel.html` con expedientes, DNI de prueba, impuestos y reclamos | API `/api/gestion/solicitudes?modulo=sat` |
| MetroBus Lima | `/panel.html` con recargas, tarjeta y simulador de importes | API `/api/gestion/solicitudes?modulo=metrobus` |
| CRM Andino | `/panel.html` con solicitudes empresariales, equipo y reloj Lima | API `/api/gestion/solicitudes?modulo=crm` |
| AguaViva | `/panel.html` con reportes, zonas, vecinos y seguimiento | API `/api/gestion/solicitudes?modulo=agua` |

Los cuatro paneles conservan nombres, estructura visual y paleta de sus sitios originales; cada uno lee y escribe datos de su módulo desde la API central en Render. El **centro general** `/gestion/index.html` en Portal360 sigue consultando el conjunto de módulos y refleja los cambios al pulsar *Actualizar*.

### Funciones reales en esta versión

- Iniciar sesión en el panel propio con las cuentas demo y sesión JWT validada en Render.
- Administrador: lectura, creación, edición de campos no financieros, cambio de estado, equipo demo por módulo, activar/desactivar operadores demo, auditoría del módulo.
- Operador: ver, crear, editar y cambiar estado de solicitudes únicamente en módulos asignados; no administrar usuarios ni otros módulos.
- Cliente: crear y consultar solo sus propias solicitudes.
- El mismo caso se consulta y modifica desde el panel de su sitio **y** desde el panel general; Neon es la fuente única.
- Exportación CSV de registros visibles; incluye protección frente a fórmulas en celdas.

### Límites explícitos

- Las recargas, pagos y tarifas son simulaciones, no se efectúan cobros ni se cargan saldos a tarjetas.
- El reloj de turnos de CRM indica la hora de Lima. La asignación visual de los turnos del equipo es **ilustrativa**, no autoriza ni restringe acciones por hora. Los permisos verificados por el servidor son de **rol y módulo**, no de turno.
- La función «Eliminar» del código legado fue sustituida por estados de seguimiento y auditoría; no se borran casos históricos.
- El entorno usa cuentas ficticias y filas demo; no se deben registrar datos reales de DNI, dirección o pagos.
- Ninguna contraseña se entrega en este paquete. El Excel privado anterior sigue siendo válido. Nunca subirlo a GitHub.

## Instalación

1. Descargar el ZIP **PATCH PANELES PROPIOS**, extraerlo y copiar **su contenido** en `Documentos/GitHub/ortal360-diseno-web`, reemplazando archivos.
2. Conservar `.git` y todas las variables de entorno de Render. **No ejecutar ningún SQL heredado**.
3. GitHub Desktop → Changes → Commit to main → Push origin. Los cuatro proyectos Vercel y Render están vinculados a este repositorio.
4. Confirmar `READY` en Vercel para los 5 proyectos y `Live` en Render para el nuevo commit.
5. Entrar a `/panel.html` de cada sitio, iniciar sesión con el Excel privado, abrir un caso de prueba y comprobar desde `/gestion/index.html` del portal que el cambio también aparece allí.

## APIs y control de seguridad

- `GET /api/auth/me` consulta en Neon el rol efectivo en **cada solicitud**.
- `GET /api/gestion/solicitudes?modulo=...` limita la lectura por módulo y rol.
- `POST /api/modulos/:modulo/items` crea registros, sin cobros reales.
- `PATCH /api/gestion/solicitudes/:id` valida rol, módulo, aislamiento demo/real, campos permitidos; registra auditoría y **no permite modificar pagos**.
- `GET /api/gestion/usuarios` y `PATCH /api/gestion/usuarios/:id` administran exclusivamente cuentas de demostración y solo se invocan por administradores.

**No se modifica la estructura SQL actual:** los usuarios, asignaciones, vistas y casos ya están en Neon.
