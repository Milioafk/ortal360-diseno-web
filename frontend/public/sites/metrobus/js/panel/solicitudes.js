// Panel: consultas y reclamos del formulario de contacto.
// Los ven el administrador y los empleados de los 3 turnos. Marcar como atendido solo dentro del horario.
import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { infoTurno, enTurno } from '../auth/turnos.js';

const usuario = exigirSesion();
const tieneAcceso = Boolean(usuario) && ['administrador', 'empleado'].includes(usuario.rol);
const esEmpleado = tieneAcceso && usuario.rol === 'empleado';

function puedeOperar() {
  return !esEmpleado || enTurno(usuario.turno, usuario);
}

async function listarSolicitudes() {
  return await sql`
    SELECT s.id, s.categoria, s.tipo, s.nombre, s.dni, s.correo, s.mensaje, s.estado,
           s.turno_gestion, s.fecha_registro, e.nombre AS empleado
    FROM solicitudes s
    LEFT JOIN usuarios e ON e.id = s.id_empleado
    ORDER BY (s.estado = 'pendiente') DESC, s.fecha_registro DESC, s.id DESC;
  `;
}

async function cambiarEstado(id, estado) {
  if (!puedeOperar()) throw new Error('FUERA_DE_TURNO');
  const idEmpleado = esEmpleado ? usuario.id : null;
  const turno = esEmpleado ? (usuario.turno || null) : null;
  await sql`
    UPDATE solicitudes
    SET estado = ${estado},
        id_empleado = ${estado === 'atendido' ? idEmpleado : null}::int,
        turno_gestion = COALESCE(${turno}::text, turno_gestion)
    WHERE id = ${id};
  `;
}

const TIPOS = { tarjeta: 'Tarjeta', ruta: 'Ruta o frecuencia', estacion: 'Estación o paradero', otro: 'Otro' };

const cuerpo = document.getElementById('cuerpo-solicitudes');
const textoTotal = document.getElementById('sol-total');
const textoVacio = document.getElementById('sol-vacio');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroEstado = document.getElementById('filtro-estado-sol');
const caja = document.getElementById('confirmacion-sol');

let solicitudes = [];
let firmaAnterior = '';

function mostrarMensaje(texto, esError) {
  if (!caja) return;
  caja.textContent = texto;
  caja.classList.toggle('confirmacion-error', Boolean(esError));
  caja.classList.remove('mostrar-confirmacion');
  void caja.offsetWidth;
  caja.classList.add('mostrar-confirmacion');
}

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function visibles() {
  return solicitudes.filter((s) =>
    (filtroCategoria.value === 'todos' || s.categoria === filtroCategoria.value) &&
    (filtroEstado.value === 'todos' || s.estado === filtroEstado.value));
}

function pintar() {
  const lista = visibles();
  const bloqueado = puedeOperar() ? '' : ' disabled title="Fuera de tu turno"';
  cuerpo.innerHTML = '';
  textoTotal.textContent = `Mostrando ${lista.length} de ${solicitudes.length}`;
  textoVacio.hidden = lista.length > 0;

  lista.forEach((s, indice) => {
    const turno = infoTurno(s.turno_gestion);
    const fila = document.createElement('tr');
    fila.style.setProperty('--i', indice);
    fila.innerHTML = `
      <td>${new Date(s.fecha_registro).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td><span class="estado categoria-${esc(s.categoria)}">${esc(s.categoria)}</span></td>
      <td>${esc(TIPOS[s.tipo] || s.tipo)}</td>
      <td>${esc(s.nombre)}<br><small>DNI ${esc(s.dni)} · ${esc(s.correo)}</small></td>
      <td class="celda-mensaje">${esc(s.mensaje)}</td>
      <td>${turno ? `<span class="turno turno-${esc(s.turno_gestion)}">${esc(turno.nombre)}</span>` : '—'}</td>
      <td><span class="estado estado-${esc(s.estado)}">${esc(s.estado)}</span></td>
      <td>${s.empleado ? esc(s.empleado) : '—'}</td>
      <td>
        <button type="button" class="btn-tabla ${s.estado === 'pendiente' ? 'btn-editar' : 'btn-eliminar'}"
                data-id="${s.id}" data-estado="${s.estado === 'pendiente' ? 'atendido' : 'pendiente'}"${bloqueado}>
          ${s.estado === 'pendiente' ? 'Marcar atendido' : 'Reabrir'}
        </button>
      </td>
    `;
    cuerpo.appendChild(fila);
  });
}

async function recargar() {
  try {
    const nuevas = await listarSolicitudes();
    const firma = JSON.stringify(nuevas) + puedeOperar();
    if (firma !== firmaAnterior) {
      firmaAnterior = firma;
      solicitudes = nuevas;
      pintar();
    }
  } catch (error) {
    console.error(error);
    const falta = String(error && error.message).toLowerCase().includes('does not exist');
    mostrarMensaje(falta
      ? 'Falta la tabla solicitudes en Neon. Ejecuta sql/semana7.sql completo en el SQL Editor.'
      : 'No se pudieron cargar las consultas y reclamos. Revisa tu conexión a Neon.', true);
  }
}

async function manejarClic(evento) {
  const boton = evento.target.closest('button[data-id]');
  if (!boton) return;
  if (!puedeOperar()) {
    mostrarMensaje('Estás fuera de tu turno: solo puedes consultar.', true);
    return;
  }
  try {
    await cambiarEstado(Number(boton.dataset.id), boton.dataset.estado);
    mostrarMensaje(boton.dataset.estado === 'atendido' ? '✔ Marcado como atendido.' : '✔ Reabierto como pendiente.', false);
    firmaAnterior = '';
    await recargar();
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message === 'FUERA_DE_TURNO'
      ? 'Estás fuera de tu turno: solo puedes consultar.'
      : 'No se pudo actualizar. Intenta nuevamente.', true);
  }
}

if (tieneAcceso && cuerpo) {
  document.addEventListener('DOMContentLoaded', () => {
    filtroCategoria.addEventListener('change', pintar);
    filtroEstado.addEventListener('change', pintar);
    cuerpo.addEventListener('click', manejarClic);
    recargar();
    // Tiempo real: se vuelve a consultar cada 5 s (pausado con la pestaña oculta).
    setInterval(() => { if (!document.hidden) recargar(); }, 5000);
  });
}
