// Formulario de contacto: guarda la consulta o el reclamo en Neon (tabla solicitudes).
import { turnoDeHora } from '../auth/turnos.js';

const formulario = document.getElementById('form-reclamo');
const cajaMensaje = document.getElementById('confirmacion-contacto');

function mostrarMensaje(texto, esError) {
  if (!cajaMensaje) return;
  cajaMensaje.textContent = texto;
  cajaMensaje.classList.toggle('confirmacion-error', Boolean(esError));
  cajaMensaje.classList.remove('mostrar-confirmacion');
  void cajaMensaje.offsetWidth;
  cajaMensaje.classList.add('mostrar-confirmacion');
}

function explicarError(error) {
  const texto = String(error && error.message ? error.message : error).toLowerCase();
  if (texto.includes('does not exist')) {
    return 'Falta la tabla solicitudes en Neon. Ejecuta sql/semana7.sql completo en el SQL Editor.';
  }
  if (texto.includes('failed to fetch') || texto.includes('import') || texto.includes('module') || texto.includes('network')) {
    return 'No se pudo conectar con Neon. Revisa tu internet y abre el sitio con Live Server.';
  }
  return 'No se pudo enviar la solicitud. Intenta nuevamente.';
}

if (formulario) {
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const datos = {
      nombre: document.getElementById('nombre').value.trim(),
      dni: document.getElementById('dni').value.trim(),
      correo: document.getElementById('correo').value.trim(),
      categoria: document.getElementById('categoria').value,
      tipo: document.getElementById('tipo').value,
      mensaje: document.getElementById('mensaje').value.trim()
    };

    if (!/^[0-9]{8}$/.test(datos.dni)) {
      mostrarMensaje('El DNI debe tener exactamente 8 dígitos.', true);
      return;
    }

    try {
      // La conexión se carga solo al enviar, así el formulario abre aunque falle Neon.
      const { sql } = await import('../config/neon-config.js');
      const turno = turnoDeHora();   // turno en el que llega la solicitud, según la hora actual
      await sql`
        INSERT INTO solicitudes (categoria, tipo, nombre, dni, correo, mensaje, turno_gestion)
        VALUES (${datos.categoria}, ${datos.tipo}, ${datos.nombre}, ${datos.dni}, ${datos.correo}, ${datos.mensaje}, ${turno}::text)
      `;
      mostrarMensaje(`✔ Tu ${datos.categoria} fue enviada. Un empleado la revisará pronto.`, false);
      formulario.reset();
    } catch (error) {
      console.error(error);
      mostrarMensaje(explicarError(error), true);
    }
  });
}
