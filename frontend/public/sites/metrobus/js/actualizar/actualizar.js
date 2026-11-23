import { sql } from '../config/neon-config.js';
import { exigirSesion, rutaInicioSegunRol } from '../auth/auth.js';
import { calcularMontoServicio, marcado } from '../registro/tarifario.js';
import { iniciarCotizador } from '../registro/cotizador.js';

const usuario = exigirSesion();

const contenedor = document.getElementById('actualizar-contenedor');
const avisoSesion = document.getElementById('actualizar-bloqueada');
const formulario = document.getElementById('form-actualizar');
const campos = document.getElementById('campos-actualizar');
const botonGuardar = document.getElementById('btn-guardar');
const datosRegistro = document.getElementById('datos-registro');
const notaSoloLectura = document.getElementById('nota-solo-lectura');
const cajaConfirmacion = document.getElementById('confirmacion-actualizar');

function mostrarMensaje(texto, esError) {
  if (!cajaConfirmacion) return;
  cajaConfirmacion.textContent = texto;
  cajaConfirmacion.classList.toggle('confirmacion-error', Boolean(esError));
  cajaConfirmacion.classList.remove('mostrar-confirmacion');
  void cajaConfirmacion.offsetWidth;
  cajaConfirmacion.classList.add('mostrar-confirmacion');
}

/* ----- SELECT del registro propio (si el id es de otro cliente, no devuelve nada) ----- */
async function obtenerRegistro(id) {
  const filas = await sql`
    SELECT id, codigo_seguimiento, numero_tarjeta, monto_recarga, tarjeta_nueva, pase_universitario,
           monto_calculado, estado, estado_pago
    FROM recargas_tarjeta
    WHERE id = ${id} AND id_usuario = ${usuario.id};
  `;
  return filas[0] || null;
}

/* ----- UPDATE: solo el dueño, solo si sigue 'registrado' y solo si NO está pagado.
         Si cambian los datos se recalcula el monto. ----- */
export async function actualizarRegistro(id, datos) {
  const monto = calcularMontoServicio(datos);
  const filas = await sql`
    UPDATE recargas_tarjeta
    SET numero_tarjeta = ${datos.numero_tarjeta},
        monto_recarga = ${datos.monto_recarga},
        tarjeta_nueva = ${marcado(datos.tarjeta_nueva)},
        pase_universitario = ${marcado(datos.pase_universitario)},
        monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'}
    WHERE id = ${id} AND id_usuario = ${usuario.id}
      AND estado = 'registrado' AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  // Si no devuelve filas, el registro ya no se podía editar (otro dueño, ya atendido o ya pagado).
  return filas.length === 1;
}

function bloquearEdicion() {
  campos.disabled = true;
  botonGuardar.hidden = true;
  notaSoloLectura.hidden = false;
}

async function inicializar() {
  if (!usuario) {
    avisoSesion.hidden = false;
    return;
  }
  if (usuario.rol !== 'cliente') {
    window.location.href = rutaInicioSegunRol(usuario.rol);
    return;
  }

  contenedor.hidden = false;
  const cotizador = iniciarCotizador(formulario);
  const id = Number(new URLSearchParams(window.location.search).get('id'));

  if (!Number.isInteger(id) || id <= 0) {
    campos.disabled = true;
    mostrarMensaje('Elige una recarga desde "Mis recargas" para editarla.', true);
    return;
  }

  let registro;
  try {
    registro = await obtenerRegistro(id);
  } catch (error) {
    console.error(error);
    campos.disabled = true;
    mostrarMensaje('No se pudo cargar la recarga. Intenta nuevamente.', true);
    return;
  }

  if (!registro) {
    campos.disabled = true;
    mostrarMensaje('No se encontró esa recarga en tu cuenta.', true);
    return;
  }

  datosRegistro.textContent = `Código ${registro.codigo_seguimiento} · Estado: ${registro.estado} · Pago: ${registro.estado_pago}`;
  document.getElementById('numero-tarjeta').value = registro.numero_tarjeta;
  document.getElementById('monto').value = Number(registro.monto_recarga).toFixed(2);
  document.getElementById('tarjeta-nueva').checked = registro.tarjeta_nueva;
  document.getElementById('pase-universitario').checked = registro.pase_universitario;
  cotizador.actualizar();

  // Ya atendida o ya pagada: se muestra en solo lectura.
  if (registro.estado !== 'registrado' || registro.estado_pago === 'pagado') {
    bloquearEdicion();
    return;
  }

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

    try {
      const actualizado = await actualizarRegistro(registro.id, { ...datos, numero_tarjeta: numero, monto_recarga: monto });
      if (actualizado) {
        mostrarMensaje('✔ Recarga actualizada. Se recalculó el total a pagar.', false);
      } else {
        bloquearEdicion();
        mostrarMensaje('Esta recarga ya fue atendida o pagada y no se puede modificar.', true);
      }
    } catch (error) {
      console.error(error);
      mostrarMensaje('No se pudo actualizar la recarga. Intenta nuevamente.', true);
    }
  });
}

document.addEventListener('DOMContentLoaded', inicializar);
