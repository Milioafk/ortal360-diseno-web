// caja.html — módulo del cajero: cobro presencial, verificación de pagos en línea y resumen del día.
import { sql } from '../config/neon-config.js';
import { exigirRol } from '../auth/auth.js';
import { formatearSoles, redondear } from '../registro/tarifario.js';
import { generarCodigoOperacion } from '../pago/validaciones.js';

// Solo el cajero y el administrador (un throw detiene el script si no hay permiso).
const usuario = exigirRol('cajero', 'administrador');
if (!usuario) throw new Error('Acceso denegado');

/* =========================================================
   A. DATOS — consultas a Neon (los ${valor} viajan como parámetros: sin inyección SQL)
   ========================================================= */

// Búsqueda con ILIKE por código, DNI, nombre o número de tarjeta.
async function buscarPendientes(criterio = '') {
  const patron = `%${criterio.trim()}%`;
  return await sql`
    SELECT r.id, r.id_usuario, r.codigo_seguimiento, r.numero_tarjeta, r.monto_calculado, r.fecha_registro,
           u.nombre AS cliente, u.dni
    FROM recargas_tarjeta r
    LEFT JOIN usuarios u ON u.id = r.id_usuario        -- LEFT: incluye recargas creadas en el panel
    WHERE r.estado_pago = 'pendiente'
      AND (r.codigo_seguimiento ILIKE ${patron} OR u.dni ILIKE ${patron}
           OR u.nombre ILIKE ${patron} OR r.numero_tarjeta ILIKE ${patron})
    ORDER BY r.fecha_registro ASC, r.id ASC
    LIMIT 50;
  `;
}

const METODOS_CAJA = {
  efectivo:  { metodo: 'efectivo',  proveedor: null },
  pos:       { metodo: 'pos',       proveedor: null },
  andipay:   { metodo: 'billetera', proveedor: 'andipay' },
  pagomovil: { metodo: 'billetera', proveedor: 'pagomovil' }
};

// Cobro en ventanilla: el pago y el cambio de estado se confirman juntos (transacción).
// Al cobrar se activa el saldo de la tarjeta. Queda auditado con id_cajero.
async function cobrarPresencial({ registro, opcion, montoRecibido, referencia }) {
  const { metodo, proveedor } = METODOS_CAJA[opcion];
  const monto = Number(registro.monto_calculado);
  let vuelto = null;

  if (metodo === 'efectivo') {
    if (!(montoRecibido >= monto)) throw new Error('El monto recibido es menor que el total.');
    vuelto = redondear(montoRecibido - monto);
    referencia = 'Efectivo';
  } else {
    montoRecibido = null;
    referencia = (metodo === 'pos' ? 'Voucher ' : 'Op. ') + referencia;
  }

  const codigo = generarCodigoOperacion('CJ');
  await sql.transaction([
    sql`INSERT INTO pagos (codigo_operacion, id_registro, id_usuario, canal, metodo, proveedor_billetera,
                           referencia, monto, monto_recibido, vuelto, estado, id_cajero)
        VALUES (${codigo}, ${registro.id}, ${registro.id_usuario}, 'caja', ${metodo}, ${proveedor},
                ${referencia}, ${monto}, ${montoRecibido}, ${vuelto}, 'aprobado', ${usuario.id});`,
    sql`UPDATE recargas_tarjeta
        SET estado_pago = 'pagado', canal_pago = 'caja', fecha_pago = NOW(), saldo_actual = monto_recarga
        WHERE id = ${registro.id} AND estado_pago = 'pendiente';`
  ]);
  return { codigo, vuelto };
}

// Pagos de la pasarela de una fecha, en hora de Lima (aprobados y rechazados).
async function listarPagosEnLinea(fecha, soloPorVerificar) {
  return await sql`
    SELECT p.id, p.codigo_operacion, p.metodo, p.proveedor_billetera, p.marca_tarjeta, p.referencia,
           p.monto, p.estado, p.motivo_rechazo, p.verificado, p.fecha_pago,
           r.codigo_seguimiento, u.nombre AS cliente, v.nombre AS verificador
    FROM pagos p
    JOIN recargas_tarjeta r ON r.id = p.id_registro
    LEFT JOIN usuarios u ON u.id = p.id_usuario
    LEFT JOIN usuarios v ON v.id = p.verificado_por
    WHERE p.canal = 'pasarela'
      AND (p.fecha_pago AT TIME ZONE 'America/Lima')::date = ${fecha}::date
      AND (${soloPorVerificar}::boolean = false OR (p.estado = 'aprobado' AND p.verificado = false))
    ORDER BY p.fecha_pago DESC, p.id DESC;
  `;
}

// Conciliación: el cajero confirma que el pago figura en el estado de cuenta de la entidad.
async function verificarPago(idPago) {
  await sql`
    UPDATE pagos
    SET verificado = true, verificado_por = ${usuario.id}, fecha_verificacion = NOW()
    WHERE id = ${idPago} AND canal = 'pasarela' AND estado = 'aprobado';
  `;
}

async function resumenDelDia(fecha) {
  return await sql`
    SELECT canal, metodo, COUNT(*)::int AS operaciones, SUM(monto) AS total
    FROM pagos
    WHERE estado = 'aprobado'
      AND (fecha_pago AT TIME ZONE 'America/Lima')::date = ${fecha}::date
    GROUP BY canal, metodo
    ORDER BY canal, metodo;
  `;
}

/* =========================================================
   B. INTERFAZ
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const tablaPendientes = $('#tabla-pendientes tbody');
const tablaEnLinea = $('#tabla-en-linea tbody');
const tablaResumen = $('#tabla-resumen tbody');
const dialogo = $('#dialogo-cobro');
const formCobro = $('#form-cobro');
const selectMetodo = $('#metodo-caja');
const inputRecibido = $('#monto-recibido');
const inputReferencia = $('#referencia');
const inputFecha = $('#fecha-caja');
const chkPorVerificar = $('#solo-por-verificar');
const cajaMensaje = $('#mensaje-caja');

$('#caja-sesion').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;

// Mensajes con la misma animación de confirmación de la Semana 5.
function mostrarMensaje(texto, esError) {
  cajaMensaje.textContent = texto;
  cajaMensaje.classList.toggle('confirmacion-error', Boolean(esError));
  cajaMensaje.classList.remove('mostrar-confirmacion');
  void cajaMensaje.offsetWidth;
  cajaMensaje.classList.add('mostrar-confirmacion');
}

// Fecha de HOY en Lima con formato AAAA-MM-DD (el formato que espera <input type="date">).
const hoyEnLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
inputFecha.value = hoyEnLima();

let pendientesCache = [];
let registroEnCobro = null;
let ultimoIdVisto = null;

function celda(fila, texto = '') {
  const td = document.createElement('td');
  td.textContent = texto ?? '—';       // textContent: nunca interpretar datos como HTML
  fila.append(td);
  return td;
}

function boton(texto, accion, id) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn-tabla btn-${accion}`;
  b.textContent = texto;
  b.dataset.accion = accion;
  b.dataset.id = id;
  return b;
}

function filaVacia(tbody, columnas, texto) {
  const tr = document.createElement('tr');
  const td = celda(tr, texto);
  td.colSpan = columnas;
  td.className = 'celda-vacia';
  tbody.append(tr);
}

function describirMedio(p) {
  if (p.metodo === 'billetera') return `Billetera ${p.proveedor_billetera} ${p.referencia}`;
  if (p.marca_tarjeta) return `${p.marca_tarjeta} ${p.referencia}`;
  return p.referencia ?? p.metodo;
}

// ---- Cobro presencial ----
async function pintarPendientes(criterio = '') {
  pendientesCache = await buscarPendientes(criterio);
  tablaPendientes.replaceChildren();
  if (pendientesCache.length === 0) return filaVacia(tablaPendientes, 6, 'Sin recargas pendientes para esa búsqueda.');
  for (const r of pendientesCache) {
    const tr = document.createElement('tr');
    celda(tr, r.codigo_seguimiento);
    celda(tr, r.cliente ?? 'Atención presencial');
    celda(tr, r.dni ?? '—');
    celda(tr, r.numero_tarjeta);
    celda(tr, formatearSoles(Number(r.monto_calculado)));
    celda(tr).append(boton('Cobrar', 'cobrar', r.id));
    tablaPendientes.append(tr);
  }
}

$('#form-buscar').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await pintarPendientes(new FormData(e.target).get('criterio'));
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudo buscar. Revisa tu conexión a Neon.', true);
  }
});

function ajustarCamposMetodo() {
  const esEfectivo = selectMetodo.value === 'efectivo';
  $('#campo-recibido').hidden = !esEfectivo;
  $('#campo-referencia').hidden = esEfectivo;
  inputRecibido.required = esEfectivo;
  inputReferencia.required = !esEfectivo;
  $('#vuelto').textContent = formatearSoles(0);
}
selectMetodo.addEventListener('change', ajustarCamposMetodo);

inputRecibido.addEventListener('input', () => {
  const vuelto = Number(inputRecibido.value) - Number(registroEnCobro.monto_calculado);
  $('#vuelto').textContent = vuelto >= 0 ? formatearSoles(redondear(vuelto)) : 'Monto insuficiente';
});

// Delegación de eventos: un solo listener para todos los botones "Cobrar".
tablaPendientes.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-accion="cobrar"]');
  if (!b) return;
  registroEnCobro = pendientesCache.find((r) => r.id === Number(b.dataset.id));
  if (!registroEnCobro) return;
  $('#cobro-codigo').textContent = registroEnCobro.codigo_seguimiento;
  $('#cobro-total').textContent = formatearSoles(Number(registroEnCobro.monto_calculado));
  formCobro.reset();
  ajustarCamposMetodo();
  dialogo.showModal();
});

$('#cancelar-cobro').addEventListener('click', () => dialogo.close());

formCobro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(formCobro));
  if (datos.metodo !== 'efectivo' && !/^\d{6,12}$/.test(datos.referencia ?? '')) {
    mostrarMensaje('Ingresa el número de voucher u operación (6 a 12 dígitos).', true);
    return;
  }
  if (datos.metodo === 'efectivo' && !(Number(datos.monto_recibido) >= Number(registroEnCobro.monto_calculado))) {
    mostrarMensaje('El monto recibido es menor que el total a cobrar.', true);
    return;
  }
  const total = formatearSoles(Number(registroEnCobro.monto_calculado));
  if (!confirm(`¿Confirmar el cobro de ${total} por la recarga ${registroEnCobro.codigo_seguimiento}?`)) return;

  const botonConfirmar = $('#confirmar-cobro');
  botonConfirmar.disabled = true;       // evita el doble clic = doble cobro
  try {
    const { codigo, vuelto } = await cobrarPresencial({
      registro: registroEnCobro,
      opcion: datos.metodo,
      montoRecibido: Number(datos.monto_recibido),
      referencia: datos.referencia
    });
    dialogo.close();
    mostrarMensaje(`✔ Cobro registrado. Operación ${codigo}.` + (vuelto !== null ? ` Vuelto: ${formatearSoles(vuelto)}.` : ''), false);
    $('#enlace-comprobante-a').href = `comprobante.html?op=${encodeURIComponent(codigo)}`;
    $('#enlace-comprobante').hidden = false;
    await Promise.all([pintarPendientes($('#criterio').value), refrescar()]);
  } catch (error) {
    console.error(error);
    dialogo.close();
    mostrarMensaje(error.code === '23505' ? 'Esta recarga ya fue pagada.' : (error.message || 'No se pudo registrar el cobro.'), true);
    await pintarPendientes($('#criterio').value).catch(() => {});
  } finally {
    botonConfirmar.disabled = false;
  }
});

// ---- Pagos en línea (lo que el cliente pagó por la pasarela) ----
async function pintarPagosEnLinea() {
  const pagos = await listarPagosEnLinea(inputFecha.value, chkPorVerificar.checked);
  tablaEnLinea.replaceChildren();
  if (pagos.length === 0) filaVacia(tablaEnLinea, 8, 'Sin operaciones en línea para esta fecha.');

  for (const p of pagos) {
    const tr = document.createElement('tr');
    if (p.estado === 'rechazado') tr.className = 'fila-rechazada';
    celda(tr, new Date(p.fecha_pago).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }));
    celda(tr, p.codigo_operacion);
    celda(tr, p.codigo_seguimiento);
    celda(tr, p.cliente ?? '—');
    celda(tr, describirMedio(p));
    celda(tr, formatearSoles(Number(p.monto)));
    celda(tr, p.estado === 'aprobado' ? 'Aprobado' : `Rechazado: ${p.motivo_rechazo}`);
    const tdAccion = celda(tr, '');
    if (p.estado === 'aprobado' && !p.verificado) tdAccion.append(boton('Verificar', 'verificar', p.id));
    else if (p.verificado) tdAccion.textContent = `Verificado por ${p.verificador}`;
    else tdAccion.textContent = '—';
    tablaEnLinea.append(tr);
  }

  // Aviso de pagos nuevos desde la última revisión.
  const idsAprobados = pagos.filter((p) => p.estado === 'aprobado').map((p) => p.id);
  const maxId = idsAprobados.length ? Math.max(...idsAprobados) : 0;
  if (ultimoIdVisto !== null && maxId > ultimoIdVisto) {
    const nuevos = idsAprobados.filter((id) => id > ultimoIdVisto).length;
    $('#aviso-nuevos').textContent = `🔔 Ingresaron ${nuevos} pago(s) nuevo(s) por la pasarela.`;
  }
  ultimoIdVisto = Math.max(ultimoIdVisto ?? 0, maxId);
}

tablaEnLinea.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-accion="verificar"]');
  if (!b) return;
  if (!confirm('¿Confirmas que este pago figura en el estado de cuenta de la entidad?')) return;
  try {
    await verificarPago(Number(b.dataset.id));
    mostrarMensaje('✔ Pago verificado.', false);
    await pintarPagosEnLinea();
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudo verificar el pago. Intenta nuevamente.', true);
  }
});

// ---- Resumen del día ----
async function pintarResumen() {
  const filas = await resumenDelDia(inputFecha.value);
  tablaResumen.replaceChildren();
  if (filas.length === 0) filaVacia(tablaResumen, 4, 'Sin operaciones aprobadas en esta fecha.');
  let total = 0;
  for (const f of filas) {
    const tr = document.createElement('tr');
    celda(tr, f.canal === 'pasarela' ? 'En línea' : 'Ventanilla');
    celda(tr, f.metodo);
    celda(tr, String(f.operaciones));
    celda(tr, formatearSoles(Number(f.total)));
    tablaResumen.append(tr);
    total += Number(f.total);
  }
  $('#total-dia').textContent = formatearSoles(redondear(total));
}

async function refrescar() {
  try {
    await Promise.all([pintarPagosEnLinea(), pintarResumen()]);
    $('#caja-vivo').textContent = `🟢 En vivo · actualizado a las ${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}`;
  } catch (error) {
    console.error(error);
    $('#caja-vivo').textContent = '🔴 Sin conexión con Neon';
  }
}

inputFecha.addEventListener('change', () => { ultimoIdVisto = null; $('#aviso-nuevos').textContent = ''; refrescar(); });
chkPorVerificar.addEventListener('change', refrescar);

// Revisa cada 15 segundos si entraron pagos por la pasarela (solo con la pestaña visible).
setInterval(() => {
  if (document.hidden) return;
  refrescar();
  if (!dialogo.open) pintarPendientes($('#criterio').value).catch(console.error);
}, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });

pintarPendientes().catch((error) => {
  console.error(error);
  mostrarMensaje('No se pudieron cargar las recargas pendientes. ¿Ejecutaste sql/semana9.sql?', true);
});
refrescar();
