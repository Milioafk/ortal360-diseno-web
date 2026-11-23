import { sql } from '../config/neon-config.js';

export async function registrarUsuario(nombre, correo, contrasena, dni) {
  // El rol no se envía: la columna "rol" tiene 'cliente' por defecto.
  // El DNI sirve para que el cajero encuentre al cliente en ventanilla (Semana 9).
  await sql`
    INSERT INTO usuarios (nombre, correo, contrasena, dni)
    VALUES (${nombre}, ${correo}, ${contrasena}, ${dni})
  `;
}

export async function iniciarSesion(correo, contrasena) {
  const filas = await sql`
    SELECT id, nombre, rol, turno, hora_inicio, hora_fin FROM usuarios
    WHERE correo = ${correo} AND contrasena = ${contrasena};
  `;
  if (filas.length === 0) return null;
  sessionStorage.setItem('usuario', JSON.stringify(filas[0]));
  return filas[0];
}

export function cerrarSesion() {
  sessionStorage.removeItem('usuario');
}

// Devuelve el usuario en sesión ({ id, nombre, rol, turno, hora_inicio, hora_fin }) o null si no hay sesión.
export function exigirSesion() {
  const usuario = sessionStorage.getItem('usuario');
  if (!usuario) return null;
  return JSON.parse(usuario);
}

// Semana 9 — control de acceso por rol.
// Sin sesión → login.html. Con sesión pero sin permiso → alerta y vuelta a index.html.
// Devuelve el usuario si tiene permiso, o null si fue redirigido.
export function exigirRol(...rolesPermitidos) {
  const usuario = exigirSesion();
  if (!usuario) {
    window.location.href = 'login.html';
    return null;
  }
  if (!rolesPermitidos.includes(usuario.rol)) {
    alert('Tu perfil no tiene acceso a esta página.');
    window.location.href = 'index.html';
    return null;
  }
  return usuario;
}

// Página de inicio de cada rol (login.js y las páginas que redirigen la usan).
export function rutaInicioSegunRol(rol) {
  const rutas = {
    cliente: 'registro.html',
    administrador: 'panel.html',
    empleado: 'panel.html',
    cajero: 'caja.html'
  };
  return rutas[rol] ?? 'index.html';
}
