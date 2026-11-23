import { sql } from '../config/neon-config.js';
import { exigirSesion, rutaInicioSegunRol } from '../auth/auth.js';
import { infoTurno, enTurno, turnoDeHora, TURNOS } from '../auth/turnos.js';
import { calcularMontoServicio, formatearSoles, marcado } from '../registro/tarifario.js';
import { iniciarCotizador } from '../registro/cotizador.js';

const usuario = exigirSesion();

// Solo administrador o empleado pueden entrar al panel (el cliente va a registrar y el cajero a caja).
const tieneAcceso = Boolean(usuario) && ['administrador', 'empleado'].includes(usuario.rol);
if (!usuario) {
  window.location.href = 'login.html';
} else if (!tieneAcceso) {
  window.location.href = rutaInicioSegunRol(usuario.rol);
}

// Datos del empleado en sesión: lo que él crea o edita queda registrado a su nombre y a su turno.
// El administrador no pertenece a ningún turno, por eso para él estos valores son null.
const esEmpleado = Boolean(usuario) && usuario.rol === 'empleado';
const idEmpleado = esEmpleado ? usuario.id : null;
const turnoEmpleado = esEmpleado ? (usuario.turno || null) : null;

// El administrador siempre puede operar. El empleado solo mientras esté dentro de su turno.
function puedeOperar() {
  return !esEmpleado || enTurno(turnoEmpleado, usuario);
}

// Segunda barrera: aunque alguien reactive un botón desde el navegador, estas funciones no escriben fuera de turno.
function exigirTurno() {
  if (!puedeOperar()) throw new Error('FUERA_DE_TURNO');
}

/* ================= Operaciones CRUD sobre recargas_tarjeta ================= */

// Consultar — todos los registros, no solo los de un usuario.
export async function listarTodos() {
  return await sql`
    SELECT r.id, r.codigo_seguimiento, r.numero_tarjeta, r.monto_recarga,
           r.tarjeta_nueva, r.pase_universitario, r.monto_calculado, r.estado_pago, r.canal_pago,
           r.estado, r.fecha_registro, r.turno_gestion,
           u.nombre AS cliente, e.nombre AS empleado
    FROM recargas_tarjeta r
    LEFT JOIN usuarios u ON u.id = r.id_usuario
    LEFT JOIN usuarios e ON e.id = r.id_empleado
    ORDER BY r.fecha_registro DESC, r.id DESC;
  `;
}

// Crear — atención presencial: no hay cliente en sesión, por eso id_usuario queda en NULL.
// El monto se calcula con el tarifario; la recarga nace 'pendiente' y el cliente paga luego en caja.html
// buscando este código. El panel nunca marca un registro como pagado: los pagos nacen en la pasarela o en caja.
export async function crearRegistro(datos) {
  exigirTurno();
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  const monto = calcularMontoServicio(datos);
  await sql`
    INSERT INTO recargas_tarjeta (codigo_seguimiento, numero_tarjeta, monto_recarga, tarjeta_nueva, pase_universitario,
                                  monto_calculado, estado_pago, saldo_actual, estado, id_empleado, turno_gestion)
    VALUES (${codigo}, ${datos.numero_tarjeta}, ${datos.monto_recarga}, ${marcado(datos.tarjeta_nueva)}, ${marcado(datos.pase_universitario)},
            ${monto}, ${monto === 0 ? 'exonerado' : 'pendiente'}, 0, ${datos.estado}, ${idEmpleado}::int, ${turnoEmpleado || turnoDeHora()}::text);
  `;
  return codigo;
}

// Actualizar — cualquier registro, incluido el estado.
// Si edita un empleado, el registro pasa a su nombre y turno; si edita el administrador, se conserva lo que ya tenía.
// Una recarga ya pagada no cambia de tarjeta ni de monto (el pago quedó registrado con ese total):
// por eso el UPDATE de datos solo aplica si estado_pago <> 'pagado' y devuelve false si no pudo.
export async function actualizarComoPanel(id, datos) {
  exigirTurno();
  const monto = calcularMontoServicio(datos);
  const filas = await sql`
    UPDATE recargas_tarjeta
    SET numero_tarjeta = ${datos.numero_tarjeta},
        monto_recarga = ${datos.monto_recarga},
        tarjeta_nueva = ${marcado(datos.tarjeta_nueva)},
        pase_universitario = ${marcado(datos.pase_universitario)},
        monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'},
        estado = ${datos.estado},
        id_empleado = COALESCE(${idEmpleado}::int, id_empleado),
        turno_gestion = COALESCE(${turnoEmpleado}::text, turno_gestion)
    WHERE id = ${id} AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  return filas.length === 1;
}

// Recarga ya pagada: solo se puede cambiar el estado operativo (registrado / atendido / rechazado).
export async function actualizarSoloEstado(id, estado) {
  exigirTurno();
  await sql`
    UPDATE recargas_tarjeta
    SET estado = ${estado},
        id_empleado = COALESCE(${idEmpleado}::int, id_empleado),
        turno_gestion = COALESCE(${turnoEmpleado}::text, turno_gestion)
    WHERE id = ${id};
  `;
}

// Eliminar — la interfaz pide confirmación antes de llamar esta función.
// Si la recarga tiene historial de pagos (aprobados o rechazados) PostgreSQL lo impide (código 23503).
export async function eliminarRegistro(id) {
  exigirTurno();
  try {
    await sql`DELETE FROM recargas_tarjeta WHERE id = ${id};`;
    return { ok: true };
  } catch (error) {
    if (error.code === '23503' || String(error.message).includes('foreign key')) {
      return { ok: false, mensaje: 'No se puede eliminar: la recarga tiene historial de pagos. Cambia su estado a "rechazado".' };
    }
    throw error;
  }
}

/* ================================ Interfaz ================================ */

const ESTADOS = ['registrado', 'atendido', 'rechazado'];

const contenido = document.getElementById('panel-contenido');
const textoSesion = document.getElementById('panel-sesion');
const formulario = document.getElementById('form-panel');
const tituloForm = document.getElementById('titulo-form-panel');
const botonGuardar = document.getElementById('btn-guardar-panel');
const botonCancelar = document.getElementById('btn-cancelar');
const cuerpoTabla = document.getElementById('cuerpo-tabla-panel');
const tarjetaTurno = document.getElementById('panel-turno');
const iconoTurno = document.getElementById('panel-turno-icono');
const tituloTurno = document.getElementById('panel-turno-titulo');
const detalleTurno = document.getElementById('panel-turno-detalle');
const filtroTurno = document.getElementById('filtro-turno');
const textoTotal = document.getElementById('panel-total');
const textoVacio = document.getElementById('panel-vacio');
const resumenTurnos = document.getElementById('resumen-turnos');
const textoVivo = document.getElementById('panel-vivo');
const cajaConfirmacion = document.getElementById('confirmacion-panel');
const notaPagado = document.getElementById('nota-pagado');

let registros = [];
let editandoId = null;

// Misma animación de confirmación de la Semana 5 (no se crea ninguna nueva).
function mostrarMensaje(texto, esError) {
  if (!cajaConfirmacion) return;
  cajaConfirmacion.textContent = texto;
  cajaConfirmacion.classList.toggle('confirmacion-error', Boolean(esError));
  cajaConfirmacion.classList.remove('mostrar-confirmacion');
  void cajaConfirmacion.offsetWidth;
  cajaConfirmacion.classList.add('mostrar-confirmacion');
}

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Aplica el filtro de turno elegido (el empleado arranca viendo las recargas de su turno).
function registrosFiltrados() {
  const filtro = filtroTurno.value;
  if (filtro === 'todos') return registros;
  return registros.filter((r) => r.turno_gestion === filtro);
}

function etiqueta(texto, clase) {
  const span = document.createElement('span');
  span.className = clase;
  span.textContent = texto;
  return span;
}

function celda(fila, texto) {
  const td = document.createElement('td');
  td.textContent = texto ?? '';
  fila.append(td);
  return td;
}

function pintarTabla() {
  const visibles = registrosFiltrados();
  cuerpoTabla.replaceChildren();
  textoTotal.textContent = `Mostrando ${visibles.length} de ${registros.length} recargas`;
  textoVacio.hidden = visibles.length > 0;

  const bloqueado = !puedeOperar();
  visibles.forEach((r, indice) => {
    const fila = document.createElement('tr');
    fila.style.setProperty('--i', indice);   // retraso escalonado de la animación de entrada

    // createElement + textContent: lo que viene de la base nunca se interpreta como HTML.
    celda(fila, r.codigo_seguimiento);
    celda(fila, r.cliente ? r.cliente : 'Atención presencial');
    celda(fila, r.numero_tarjeta);
    celda(fila, formatearSoles(Number(r.monto_calculado)));
    celda(fila, '').append(etiqueta(r.estado, `estado estado-${r.estado}`));

    // Estado de pago (y por qué canal se pagó)
    const tdPago = celda(fila, '');
    tdPago.append(etiqueta(r.estado_pago, `estado estado-pago-${r.estado_pago}`));
    if (r.canal_pago) {
      const canal = document.createElement('small');
      canal.className = 'canal-pago';
      canal.textContent = r.canal_pago === 'pasarela' ? ' en línea' : ' en caja';
      tdPago.append(canal);
    }

    const turno = infoTurno(r.turno_gestion);
    const tdTurno = celda(fila, turno ? '' : '—');
    if (turno) tdTurno.append(etiqueta(turno.nombre, `turno turno-${r.turno_gestion}`));

    celda(fila, r.empleado ? r.empleado : '—');
    celda(fila, new Date(r.fecha_registro).toLocaleDateString('es-PE'));

    const acciones = document.createElement('div');
    acciones.className = 'acciones-fila';
    [['editar', 'Editar', 'btn-editar'], ['eliminar', 'Eliminar', 'btn-eliminar']].forEach(([accion, texto, clase]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn-tabla ${clase}`;
      b.textContent = texto;
      b.dataset.accion = accion;
      b.dataset.id = r.id;
      b.setAttribute('aria-label', `${texto} la recarga ${r.codigo_seguimiento}`);
      if (bloqueado) { b.disabled = true; b.title = 'Fuera de tu turno'; }
      acciones.append(b);
    });
    celda(fila, '').append(acciones);
    cuerpoTabla.append(fila);
  });
}

// Resumen en vivo: cuántas recargas tiene cada turno.
function pintarResumen() {
  resumenTurnos.innerHTML = Object.entries(TURNOS).map(([clave, t]) => {
    const cantidad = registros.filter((r) => r.turno_gestion === clave).length;
    return `<span class="resumen-turno resumen-${clave}">${t.icono} ${esc(t.nombre)}: <strong>${cantidad}</strong></span>`;
  }).join('');
}

let firmaAnterior = '';

async function recargarTabla() {
  try {
    const nuevos = await listarTodos();
    const firma = JSON.stringify(nuevos);
    // Solo se vuelve a dibujar si algo cambió (así no parpadea ni molesta mientras editas).
    if (firma !== firmaAnterior) {
      firmaAnterior = firma;
      registros = nuevos;
      pintarTabla();
      pintarResumen();
    }
    textoVivo.textContent = `🟢 En vivo · actualizado a las ${new Date().toLocaleTimeString('es-PE')}`;
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudieron cargar las recargas. Revisa tu conexión a Neon y que hayas ejecutado sql/semana9.sql.', true);
  }
}

// Campos que alimentan la tarifa: se bloquean cuando la recarga ya está pagada.
const CAMPOS_TARIFA = ['numero-tarjeta', 'monto', 'tarjeta-nueva', 'pase-universitario'];
function bloquearCamposTarifa(bloquear) {
  CAMPOS_TARIFA.forEach((id) => { document.getElementById(id).disabled = bloquear; });
  notaPagado.hidden = !bloquear;
  if (!bloquear) cotizador.actualizar();   // vuelve a habilitar el pase solo si hay tarjeta nueva
}

function modoCrear() {
  editandoId = null;
  bloquearCamposTarifa(false);
  formulario.reset();
  cotizador.actualizar();
  tituloForm.textContent = 'Nueva recarga (atención presencial)';
  botonGuardar.value = 'Crear recarga';
  botonCancelar.hidden = true;
}

function modoEditar(registro) {
  editandoId = registro.id;
  bloquearCamposTarifa(false);
  document.getElementById('numero-tarjeta').value = registro.numero_tarjeta;
  document.getElementById('monto').value = Number(registro.monto_recarga).toFixed(2);
  document.getElementById('tarjeta-nueva').checked = registro.tarjeta_nueva;
  document.getElementById('pase-universitario').checked = registro.pase_universitario;
  document.getElementById('estado').value = registro.estado;
  cotizador.actualizar();
  bloquearCamposTarifa(registro.estado_pago === 'pagado');   // pagada: solo se cambia el estado operativo
  tituloForm.textContent = `Editar recarga ${registro.codigo_seguimiento}`;
  botonGuardar.value = 'Guardar cambios';
  botonCancelar.hidden = false;
  formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function guardarFormulario(evento) {
  evento.preventDefault();

  if (!puedeOperar()) {
    mostrarMensaje('Estás fuera de tu turno: no puedes crear ni editar recargas.', true);
    return;
  }

  const registroEditado = editandoId === null ? null : registros.find((r) => r.id === editandoId);
  const estaPagado = Boolean(registroEditado) && registroEditado.estado_pago === 'pagado';
  const estado = document.getElementById('estado').value;
  if (!ESTADOS.includes(estado)) {
    mostrarMensaje('Elige un estado válido.', true);
    return;
  }

  const datos = cotizador.leer();
  const numeroTarjeta = String(datos.numero_tarjeta ?? '').trim();
  const monto = parseFloat(datos.monto_recarga);

  if (!estaPagado) {
    if (!/^[0-9]{10}$/.test(numeroTarjeta)) {
      mostrarMensaje('El número de tarjeta debe tener exactamente 10 dígitos.', true);
      return;
    }
    if (Number.isNaN(monto) || monto < 2) {
      mostrarMensaje('El monto mínimo de recarga es S/ 2.00.', true);
      return;
    }
  }

  try {
    if (editandoId === null) {
      const codigo = await crearRegistro({ ...datos, numero_tarjeta: numeroTarjeta, monto_recarga: monto, estado });
      mostrarMensaje(`✔ Recarga creada. Código: ${codigo}. El cliente la paga en caja.`, false);
    } else if (estaPagado) {
      await actualizarSoloEstado(editandoId, estado);
      mostrarMensaje('✔ Estado actualizado (la recarga ya está pagada, el monto no cambia).', false);
    } else {
      const actualizado = await actualizarComoPanel(editandoId, { ...datos, numero_tarjeta: numeroTarjeta, monto_recarga: monto, estado });
      if (!actualizado) {
        mostrarMensaje('Esa recarga se pagó mientras la editabas: solo se puede cambiar su estado.', true);
        firmaAnterior = '';
        await recargarTabla();
        return;
      }
      mostrarMensaje('✔ Recarga actualizada correctamente. Se recalculó el total.', false);
    }
    modoCrear();
    await recargarTabla();
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message === 'FUERA_DE_TURNO'
      ? 'Estás fuera de tu turno: no puedes crear ni editar recargas.'
      : 'No se pudo guardar la recarga. Intenta nuevamente.', true);
  }
}

async function manejarClicTabla(evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;

  if (!puedeOperar()) {
    mostrarMensaje('Estás fuera de tu turno: no puedes editar ni eliminar recargas.', true);
    return;
  }

  const id = Number(boton.dataset.id);
  const registro = registros.find((r) => r.id === id);
  if (!registro) return;

  if (boton.dataset.accion === 'editar') {
    modoEditar(registro);
    return;
  }

  // Eliminar: confirmación obligatoria antes de borrar.
  const confirmado = window.confirm(
    `¿Eliminar la recarga ${registro.codigo_seguimiento}? Esta acción no se puede deshacer.`
  );
  if (!confirmado) return;

  try {
    const resultado = await eliminarRegistro(id);
    if (!resultado.ok) {
      mostrarMensaje(resultado.mensaje, true);
      return;
    }
    if (editandoId === id) modoCrear();
    mostrarMensaje('✔ Recarga eliminada correctamente.', false);
    await recargarTabla();
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message === 'FUERA_DE_TURNO'
      ? 'Estás fuera de tu turno: no puedes editar ni eliminar recargas.'
      : 'No se pudo eliminar la recarga. Intenta nuevamente.', true);
  }
}

function mostrarTarjetaTurno() {
  if (!esEmpleado) {
    iconoTurno.textContent = '🛠️';
    tituloTurno.textContent = 'Administrador';
    detalleTurno.textContent = 'Ves y gestionas las recargas de todos los turnos.';
    return;
  }
  const turno = infoTurno(turnoEmpleado, usuario);
  if (turno) {
    iconoTurno.textContent = turno.icono;
    tituloTurno.textContent = `Tu turno: ${turno.nombre} (${turno.horario})`;
    detalleTurno.textContent = puedeOperar()
      ? '✅ Estás en turno: puedes crear, editar y eliminar. Lo que hagas queda registrado a tu nombre y a este turno.'
      : '⛔ Estás fuera de tu turno: solo puedes consultar. Crear, editar y eliminar se habilitan cuando empiece tu horario.';
  } else {
    iconoTurno.textContent = '🕒';
    tituloTurno.textContent = 'Sin turno asignado';
    detalleTurno.textContent = '⛔ Pide al administrador que te asigne un turno (mañana, tarde o noche). Mientras tanto solo puedes consultar.';
  }
}

// Habilita o bloquea el formulario y los botones según el turno. Se vuelve a evaluar cada 30 s.
let operableAntes = null;
function aplicarEstadoTurno() {
  const operable = puedeOperar();
  if (operable === operableAntes) return;
  operableAntes = operable;

  formulario.querySelector('fieldset').disabled = !operable;
  tarjetaTurno.classList.toggle('fuera-turno', !operable);
  if (!operable && editandoId !== null) modoCrear();
  mostrarTarjetaTurno();
  pintarTabla();
  if (!operable) mostrarMensaje('Estás fuera de tu turno: el panel queda en solo consulta.', true);
}

// Cotizador en vivo del formulario (se crea una sola vez al iniciar el panel).
let cotizador;

async function iniciarPanel() {
  cotizador = iniciarCotizador(formulario);
  const turno = infoTurno(turnoEmpleado, usuario);
  textoSesion.textContent = `Sesión: ${usuario.nombre} (${usuario.rol}${turno ? ' · turno ' + turno.nombre.toLowerCase() : ''})`;
  contenido.hidden = false;
  mostrarTarjetaTurno();

  // El empleado empieza viendo su turno; puede cambiar el filtro para ver todas las recargas.
  if (turno) {
    filtroTurno.value = turnoEmpleado;
    const opcion = filtroTurno.querySelector(`option[value="${turnoEmpleado}"]`);
    if (opcion) opcion.textContent += ' (mi turno)';
  }
  filtroTurno.addEventListener('change', pintarTabla);

  formulario.addEventListener('submit', guardarFormulario);
  botonCancelar.addEventListener('click', modoCrear);
  cuerpoTabla.addEventListener('click', manejarClicTabla);

  await recargarTabla();
  aplicarEstadoTurno();
  setInterval(aplicarEstadoTurno, 30000);

  // Tiempo real: consulta Neon cada 5 s (se pausa si la pestaña está oculta).
  setInterval(() => { if (!document.hidden) recargarTabla(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recargarTabla(); });
}

if (tieneAcceso) {
  document.addEventListener('DOMContentLoaded', iniciarPanel);
}
