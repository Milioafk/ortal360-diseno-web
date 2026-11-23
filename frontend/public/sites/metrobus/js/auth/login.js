import { infoTurno } from './turnos.js';

// auth.js (y con él la conexión a Neon) se carga solo al enviar un formulario.
// Así las pestañas y el botón de mostrar contraseña funcionan aunque falle la conexión.
async function cargarAuth() {
  return await import('./auth.js');
}

// Traduce el error técnico a un mensaje que el usuario entienda.
function explicarError(error, accion) {
  const texto = String(error && error.message ? error.message : error).toLowerCase();
  if (texto.includes('duplicate') || texto.includes('unique')) {
    return 'Ese correo ya está registrado. Usa otro o inicia sesión.';
  }
  if (texto.includes('does not exist')) {
    const detalle = error && error.message ? error.message : error;
    return `Faltan tablas o columnas en Neon. Ejecuta sql/semana7.sql y luego sql/semana9.sql completos en el SQL Editor. Detalle: ${detalle}`;
  }
  if (texto.includes('password authentication') || texto.includes('authentication failed')) {
    return 'Neon rechazó la contraseña de la cadena de conexión (js/config/neon-config.js).';
  }
  if (texto.includes('failed to fetch') || texto.includes('import') || texto.includes('module') || texto.includes('network')) {
    return `No se pudo conectar con Neon para ${accion}. Revisa tu internet y abre el sitio con Live Server (no con doble clic).`;
  }
  return `No se pudo ${accion}. Detalle: ${error && error.message ? error.message : error}`;
}

const cajaMensaje = document.getElementById('mensaje-auth');

function mostrarMensaje(texto, esError) {
  if (!cajaMensaje) return;
  cajaMensaje.textContent = texto;
  cajaMensaje.classList.toggle('confirmacion-error', Boolean(esError));
  cajaMensaje.classList.remove('mostrar-confirmacion');
  void cajaMensaje.offsetWidth;
  cajaMensaje.classList.add('mostrar-confirmacion');
}

/* ----- Animación de bienvenida al iniciar sesión ----- */
const MS_BIENVENIDA = 2600;

function mostrarBienvenida(usuario) {
  const capa = document.getElementById('bienvenida');
  if (!capa) return;

  const turno = usuario.rol === 'empleado' ? infoTurno(usuario.turno, usuario) : null;
  let icono = '🚌';
  let saludo = `Bienvenido, ${usuario.nombre}`;
  let detalle = 'Cliente · Preparando tus recargas';

  if (usuario.rol === 'empleado' && turno) {
    icono = turno.icono;
    saludo = `${turno.saludo}, ${usuario.nombre}`;
    detalle = `Empleado · Turno ${turno.nombre} (${turno.horario})`;
  } else if (usuario.rol === 'empleado') {
    detalle = 'Empleado · Sin turno asignado';
  } else if (usuario.rol === 'administrador') {
    icono = '🛠️';
    detalle = 'Administrador · Entrando al panel de gestión';
  } else if (usuario.rol === 'cajero') {
    icono = '💵';
    detalle = 'Cajero · Abriendo el módulo de caja';
  }

  document.getElementById('bienvenida-icono').textContent = icono;
  document.getElementById('bienvenida-saludo').textContent = saludo;
  document.getElementById('bienvenida-detalle').textContent = detalle;

  const barra = document.getElementById('bienvenida-progreso');
  barra.classList.remove('cargando');
  capa.hidden = false;
  void barra.offsetWidth;          // reinicia la transición de la barra
  barra.classList.add('cargando');
}

/* ----- Pestañas: Iniciar sesión / Crear cuenta ----- */
function cambiarPestana(nombre) {
  document.querySelectorAll('.auth-tab-btn').forEach((boton) => {
    boton.setAttribute('aria-selected', String(boton.dataset.tab === nombre));
  });
  document.querySelectorAll('.auth-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nombre;
  });
}

document.querySelectorAll('.auth-tab-btn').forEach((boton) => {
  boton.addEventListener('click', () => cambiarPestana(boton.dataset.tab));
});

/* ----- Mostrar / ocultar contraseña ----- */
document.querySelectorAll('.btn-mostrar-contrasena').forEach((boton) => {
  boton.addEventListener('click', () => {
    const input = document.getElementById(boton.dataset.target);
    if (!input) return;
    const estabaOculta = input.type === 'password';
    input.type = estabaOculta ? 'text' : 'password';
    boton.textContent = estabaOculta ? 'Ocultar' : 'Mostrar';
    boton.setAttribute('aria-label', estabaOculta ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

const formIngreso = document.getElementById('form-ingreso');
const formRegistro = document.getElementById('form-registro');

if (formIngreso) {
  formIngreso.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const correo = document.getElementById('ingreso-correo').value.trim();
    const contrasena = document.getElementById('ingreso-contrasena').value;

    try {
      const { iniciarSesion, rutaInicioSegunRol } = await cargarAuth();
      const usuario = await iniciarSesion(correo, contrasena);
      if (!usuario) {
        mostrarMensaje('Correo o contraseña incorrectos.', true);
        return;
      }
      mostrarBienvenida(usuario);
      // Cada rol entra a su propia página (cliente → recargar, admin/empleado → panel, cajero → caja).
      const destino = rutaInicioSegunRol(usuario.rol);
      setTimeout(() => { window.location.href = destino; }, MS_BIENVENIDA);
    } catch (error) {
      console.error(error);
      mostrarMensaje(explicarError(error, 'iniciar sesión'), true);
    }
  });
}

if (formRegistro) {
  formRegistro.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nombre = document.getElementById('registro-nombre').value.trim();
    const dni = document.getElementById('registro-dni').value.trim();
    const correo = document.getElementById('registro-correo').value.trim().toLowerCase();
    const contrasena = document.getElementById('registro-contrasena').value;

    if (!/^[0-9]{8}$/.test(dni)) {
      mostrarMensaje('El DNI debe tener exactamente 8 dígitos.', true);
      return;
    }

    try {
      const { registrarUsuario } = await cargarAuth();
      await registrarUsuario(nombre, correo, contrasena, dni);
      mostrarMensaje('Cuenta creada correctamente. Ahora inicia sesión.', false);
      formRegistro.reset();
      cambiarPestana('ingreso');
    } catch (error) {
      console.error(error);
      mostrarMensaje(explicarError(error, 'crear la cuenta'), true);
    }
  });
}
