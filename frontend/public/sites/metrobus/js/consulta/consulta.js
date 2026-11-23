import { sql } from '../config/neon-config.js';
import { exigirSesion, rutaInicioSegunRol } from '../auth/auth.js';
import { formatearSoles } from '../registro/tarifario.js';

const contenedor = document.getElementById('consulta-contenedor');
const avisoSesion = document.getElementById('consulta-bloqueada');
const cuerpoTabla = document.getElementById('cuerpo-tabla-recargas');
const sinRecargas = document.getElementById('sin-recargas');
const cajaMensaje = document.getElementById('mensaje-consulta');

function mostrarMensaje(texto, esError) {
  if (!cajaMensaje) return;
  cajaMensaje.textContent = texto;
  cajaMensaje.classList.toggle('confirmacion-error', Boolean(esError));
  cajaMensaje.classList.remove('mostrar-confirmacion');
  void cajaMensaje.offsetWidth;
  cajaMensaje.classList.add('mostrar-confirmacion');
}

/* ----- SELECT: solo los registros del usuario en sesión, con su estado de pago ----- */
async function listarRecargas(idUsuario) {
  return await sql`
    SELECT r.id, r.codigo_seguimiento, r.numero_tarjeta, r.monto_recarga, r.monto_calculado,
           r.saldo_actual, r.estado, r.estado_pago, r.fecha_registro, p.codigo_operacion
    FROM recargas_tarjeta r
    LEFT JOIN pagos p ON p.id_registro = r.id AND p.estado = 'aprobado'
    WHERE r.id_usuario = ${idUsuario}
    ORDER BY r.fecha_registro DESC, r.id DESC;
  `;
}

// createElement + textContent: lo que viene de la base nunca se interpreta como HTML.
function celda(fila, texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '';
  fila.append(td);
  return td;
}

function etiqueta(texto, clase) {
  const span = document.createElement('span');
  span.className = `estado ${clase}`;
  span.textContent = texto;
  return span;
}

function enlace(texto, href, clase = 'enlace-accion') {
  const a = document.createElement('a');
  a.className = clase;
  a.href = href;
  a.textContent = texto;
  return a;
}

// Celda de acciones: Pagar / Ver comprobante / Exonerado y, mientras se pueda, Editar.
function accionesDe(td, r) {
  const contenedorAcciones = document.createElement('div');
  contenedorAcciones.className = 'acciones-fila';

  if (r.estado_pago === 'pendiente') {
    contenedorAcciones.append(enlace('Pagar', `pago.html?id=${encodeURIComponent(r.id)}`, 'enlace-accion enlace-pagar'));
  } else if (r.estado_pago === 'pagado' && r.codigo_operacion) {
    contenedorAcciones.append(enlace('Ver comprobante', `comprobante.html?op=${encodeURIComponent(r.codigo_operacion)}`));
  } else if (r.estado_pago === 'exonerado') {
    contenedorAcciones.append(etiqueta('Exonerado', 'estado-atendido'));
  }
  // Solo se puede editar mientras siga 'registrado' y sin pagar.
  if (r.estado === 'registrado' && r.estado_pago === 'pendiente') {
    contenedorAcciones.append(enlace('Editar', `actualizar.html?id=${encodeURIComponent(r.id)}`));
  }
  if (!contenedorAcciones.children.length) td.textContent = '—';
  else td.append(contenedorAcciones);
}

function pintarTabla(recargas) {
  cuerpoTabla.replaceChildren();

  if (recargas.length === 0) {
    sinRecargas.hidden = false;
    return;
  }
  sinRecargas.hidden = true;

  recargas.forEach((r) => {
    const fila = document.createElement('tr');
    celda(fila, r.codigo_seguimiento);
    celda(fila, r.numero_tarjeta);
    celda(fila, formatearSoles(Number(r.monto_recarga)));
    celda(fila, formatearSoles(Number(r.monto_calculado)));
    celda(fila, r.estado_pago === 'pagado' ? formatearSoles(Number(r.saldo_actual)) : 'Sin activar');
    celda(fila, null).append(etiqueta(r.estado, `estado-${r.estado}`));
    celda(fila, null).append(etiqueta(r.estado_pago, `estado-pago-${r.estado_pago}`));
    celda(fila, new Date(r.fecha_registro).toLocaleDateString('es-PE'));
    accionesDe(celda(fila, null), r);
    cuerpoTabla.append(fila);
  });
}

async function inicializarHistorial() {
  const usuario = exigirSesion();

  if (!usuario) {
    avisoSesion.hidden = false;
    return;
  }
  if (usuario.rol !== 'cliente') {
    window.location.href = rutaInicioSegunRol(usuario.rol);
    return;
  }

  contenedor.hidden = false;
  try {
    pintarTabla(await listarRecargas(usuario.id));
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudo cargar tu historial de recargas.', true);
  }
}

document.addEventListener('DOMContentLoaded', inicializarHistorial);
