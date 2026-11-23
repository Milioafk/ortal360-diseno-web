// INSERT — el cliente registra su solicitud de demo con su monto calculado (Semana 9)
import { sql } from '../config/neon-config.js';
import { exigirRol, cerrarSesion } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles, marcado } from './tarifario.js';

const usuario = exigirRol('cliente');
if (!usuario) throw new Error('Acceso denegado');
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

const form = document.querySelector('#form-registro');
const salidaMonto = document.querySelector('#monto-estimado');
const msg = document.getElementById('mensaje');

const leerFormulario = () => Object.fromEntries(new FormData(form));

function actualizarCotizacion() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio(leerFormulario()));
}

form.addEventListener('input', actualizarCotizacion);   // texto y números, en cada tecla
form.addEventListener('change', actualizarCotizacion);  // select, radio y checkbox
actualizarCotizacion();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const datos = leerFormulario();
  const monto = calcularMontoServicio(datos);            // se recalcula: no se confía en la pantalla
  const estadoPago = monto === 0 ? 'exonerado' : 'pendiente';
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const filas = await sql`
      INSERT INTO solicitudes_demo_crm
        (id_usuario, codigo_seguimiento, nombre, empresa, correo, num_usuarios, mensaje,
         usuarios_crm, meses, modulo_facturacion, monto_calculado, estado_pago, estado)
      VALUES
        (${usuario.id}, ${codigo}, ${datos.nombre.trim()}, ${datos.empresa.trim()}, ${datos.correo.trim()},
         ${datos.usuarios}, ${datos.mensaje.trim()},
         ${Number(datos.usuarios_crm)}, ${Number(datos.meses)}, ${marcado(datos.modulo_facturacion)},
         ${monto}, ${estadoPago}, 'registrado')
      RETURNING id;
    `;
    if (estadoPago === 'pendiente') {
      window.location.href = 'integracion.html';
    } else {
      msg.textContent = '✓ Solicitud ' + codigo + ' registrada. Tu trámite está exonerado de pago.';
      msg.className = 'msg visible ok';
      form.reset();
      actualizarCotizacion();
      boton.disabled = false;
    }
  } catch (error) {
    console.error(error);
    msg.textContent = 'No se pudo registrar la solicitud. Intenta nuevamente.';
    msg.className = 'msg visible error';
    boton.disabled = false;
  }
});
