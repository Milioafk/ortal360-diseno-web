// registro.html — cotizador en vivo + INSERT con monto (Semana 9).
import { sql } from '../config/neon-config.js';
import { exigirSesion, rutaInicioSegunRol } from '../auth/auth.js';
import { turnoDeHora } from '../auth/turnos.js';
import { calcularMontoServicio, marcado } from './tarifario.js';
import { iniciarCotizador } from './cotizador.js';

const formulario = document.getElementById('form-recarga');
const contenedorRecarga = document.getElementById('recarga-contenedor-sesion');
const avisoSesion = document.getElementById('recarga-bloqueada');
const cajaConfirmacion = document.getElementById('confirmacion-recarga');

/* ----- Mensaje de confirmación / error (animación de la Semana 5) ----- */
function mostrarMensaje(texto, esError) {
  if (!cajaConfirmacion) return;
  cajaConfirmacion.textContent = texto;
  cajaConfirmacion.classList.toggle('confirmacion-error', Boolean(esError));
  cajaConfirmacion.classList.remove('mostrar-confirmacion');
  void cajaConfirmacion.offsetWidth;
  cajaConfirmacion.classList.add('mostrar-confirmacion');
}

/* ----- INSERT en Neon (tabla recargas_tarjeta) con el monto calculado ----- */
async function guardarRegistro(datos, idUsuario) {
  const codigo = 'COD-' + Date.now().toString().slice(-8); // código de seguimiento simple
  const turno = turnoDeHora();   // turno en el que se hace la recarga, según la hora actual
  // El monto se recalcula aquí: no se confía en lo que muestra la pantalla.
  const monto = calcularMontoServicio(datos);
  const estadoPago = monto === 0 ? 'exonerado' : 'pendiente';
  // El saldo se activa recién cuando se paga (saldo_actual = 0 mientras esté pendiente).
  const filas = await sql`
    INSERT INTO recargas_tarjeta (id_usuario, codigo_seguimiento, numero_tarjeta, monto_recarga,
                                  tarjeta_nueva, pase_universitario, monto_calculado, estado_pago,
                                  saldo_actual, estado, turno_gestion)
    VALUES (${idUsuario}, ${codigo}, ${datos.numero_tarjeta}, ${datos.monto_recarga},
            ${marcado(datos.tarjeta_nueva)}, ${marcado(datos.pase_universitario)}, ${monto}, ${estadoPago},
            0, 'registrado', ${turno}::text)
    RETURNING id;
  `;
  return { id: filas[0].id, codigo, monto, estadoPago };
}

function inicializarFormularioRecarga() {
  if (!formulario) return;

  const usuario = exigirSesion();

  // Sin sesión activa no se puede acceder al formulario de recarga.
  if (!usuario) {
    contenedorRecarga.hidden = true;
    avisoSesion.hidden = false;
    return;
  }
  // Solo el cliente recarga: administrador/empleado van al panel y el cajero a caja.
  if (usuario.rol !== 'cliente') {
    window.location.href = rutaInicioSegunRol(usuario.rol);
    return;
  }
  contenedorRecarga.hidden = false;
  avisoSesion.hidden = true;

  const cotizador = iniciarCotizador(formulario);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const datos = cotizador.leer();
    const numero = String(datos.numero_tarjeta ?? '').trim();
    const monto = parseFloat(datos.monto_recarga);

    if (!/^[0-9]{10}$/.test(numero)) {
      mostrarMensaje('El número de tarjeta debe tener exactamente 10 dígitos.', true);
      return;
    }
    if (Number.isNaN(monto) || monto < 2) {
      mostrarMensaje('El monto mínimo de recarga es S/ 2.00.', true);
      return;
    }

    const boton = formulario.querySelector('input[type="submit"]');
    boton.disabled = true;   // evita el doble clic = dos registros
    try {
      const r = await guardarRegistro({ ...datos, numero_tarjeta: numero, monto_recarga: monto }, usuario.id);
      if (r.estadoPago === 'pendiente') {
        mostrarMensaje(`✔ Recarga ${r.codigo} registrada. Ahora elige cómo pagar.`, false);
        setTimeout(() => { window.location.href = 'integracion.html'; }, 1400);
      } else {
        mostrarMensaje(`✔ Recarga ${r.codigo} registrada. Está exonerada de pago.`, false);
        boton.disabled = false;
      }
      formulario.reset();
      cotizador.actualizar();
    } catch (error) {
      console.error(error);
      mostrarMensaje('No se pudo guardar la recarga. Intenta nuevamente.', true);
      boton.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', inicializarFormularioRecarga);
