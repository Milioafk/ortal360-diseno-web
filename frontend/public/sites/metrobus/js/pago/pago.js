// pago.html — pasarela de pagos del cliente (tarjeta y billetera electrónica).
import { exigirRol } from '../auth/auth.js';
import { formatearSoles } from '../registro/tarifario.js';
import {
  formatearNumeroTarjeta, formatearVencimiento, detectarMarca, validarFormularioTarjeta,
  validarCelular, validarCodigoAprobacion
} from './validaciones.js';
import { obtenerRegistro, listarPendientesCliente, pagarConTarjeta, pagarConBilletera } from './pasarela.js';

// Solo el cliente paga en línea (un throw en el nivel superior detiene todo el script).
const usuario = exigirRol('cliente');
if (!usuario) throw new Error('Acceso denegado');

const $ = (selector) => document.querySelector(selector);
const selectRegistro = $('#registro');
const resumenMonto = $('#resumen-monto');
const mensaje = $('#mensaje-pago');
const formTarjeta = $('#form-tarjeta');
const formBilletera = $('#form-billetera');
const inputNumero = $('#numero');
const inputVenc = $('#vencimiento');
const marcaDetectada = $('#marca-detectada');
const panelResumen = document.querySelector('.pago-resumen');
const panelMetodos = $('#pago-metodos');

let registroActual = null;

/* ----- Mensaje con la animación de confirmación de la Semana 5 ----- */
function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.classList.toggle('confirmacion-error', tipo === 'error');
  mensaje.classList.toggle('confirmacion-info', tipo === 'info');
  mensaje.classList.remove('mostrar-confirmacion');
  void mensaje.offsetWidth;                       // reinicia la animación
  mensaje.classList.add('mostrar-confirmacion');
}

function mostrarError(campo, texto = '') {
  document.querySelector(`#error-${campo}`).textContent = texto;
  document.querySelector(`#${campo}`).setAttribute('aria-invalid', texto ? 'true' : 'false');
}

// 1. Cargar las recargas pendientes del cliente
async function cargarPendientes() {
  const pendientes = await listarPendientesCliente(usuario.id);
  selectRegistro.replaceChildren();

  if (pendientes.length === 0) {
    panelResumen.hidden = true;
    panelMetodos.hidden = true;
    mostrarMensaje('No tienes recargas pendientes de pago.', 'info');
    return;
  }
  for (const p of pendientes) {
    const opcion = document.createElement('option');
    opcion.value = p.id;
    opcion.textContent = `${p.codigo_seguimiento} — ${formatearSoles(Number(p.monto_calculado))}`;
    selectRegistro.append(opcion);
  }
  // Si llegó desde registro.html o consulta.html con ?id=, se preselecciona esa recarga.
  const idUrl = new URLSearchParams(location.search).get('id');
  if (idUrl) {
    if (pendientes.some((p) => String(p.id) === idUrl)) selectRegistro.value = idUrl;
    else mostrarMensaje('Esa recarga ya está pagada o no es tuya. Elige otra de la lista.', 'info');
  }
  await seleccionarRegistro();
}

async function seleccionarRegistro() {
  registroActual = await obtenerRegistro(Number(selectRegistro.value), usuario.id);
  resumenMonto.textContent = registroActual ? formatearSoles(Number(registroActual.monto_calculado)) : '—';
}

// 2. Alternar entre tarjeta y billetera
function mostrarMetodo() {
  const metodo = document.querySelector('input[name="metodo"]:checked').value;
  formTarjeta.hidden = metodo !== 'tarjeta';
  formBilletera.hidden = metodo !== 'billetera';
}

// 3. Formato en vivo
inputNumero.addEventListener('input', () => {
  inputNumero.value = formatearNumeroTarjeta(inputNumero.value);
  marcaDetectada.textContent = detectarMarca(inputNumero.value) ?? '';
});
inputVenc.addEventListener('input', () => {
  inputVenc.value = formatearVencimiento(inputVenc.value);
});

// 4. Procesar un pago (común a tarjeta y billetera)
async function procesar(formulario, operacion) {
  if (!registroActual || registroActual.estado_pago !== 'pendiente') {
    mostrarMensaje('Selecciona una recarga pendiente de pago.', 'error');
    return;
  }
  const boton = formulario.querySelector('button[type="submit"]');
  const textoOriginal = boton.textContent;
  boton.disabled = true;                       // evita el doble clic = doble cobro
  boton.textContent = 'Procesando...';
  mostrarMensaje('Conectando con la entidad...', 'info');
  try {
    const resultado = await operacion();
    if (resultado.aprobado) {
      formulario.reset();
      marcaDetectada.textContent = '';
      mostrarMensaje(`✔ Pago aprobado. Operación ${resultado.codigo}. Tu saldo se activó.`, 'exito');
      setTimeout(() => {
        window.location.href = `comprobante.html?op=${encodeURIComponent(resultado.codigo)}`;
      }, 1500);
    } else {
      mostrarMensaje(`Pago rechazado: ${resultado.motivo}`, 'error');
    }
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudo procesar el pago. Revisa tu conexión.', 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

formTarjeta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(formTarjeta));
  const { valido, errores, marca, venc } = validarFormularioTarjeta(datos);
  ['numero', 'vencimiento', 'cvv', 'titular'].forEach((campo) => mostrarError(campo, errores[campo]));
  if (!valido) return;       // un dato inválido se bloquea aquí y nunca llega a Neon
  await procesar(formTarjeta, () => pagarConTarjeta({
    registro: registroActual, usuario, numero: datos.numero,
    mes: venc.mes, anio: venc.anio, cvv: datos.cvv, marca
  }));
});

formBilletera.addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(formBilletera));
  const celularOk = validarCelular(datos.celular);
  const codigoOk = validarCodigoAprobacion(datos.codigo);
  mostrarError('celular', celularOk ? '' : 'Celular de 9 dígitos que empiece con 9.');
  mostrarError('codigo', codigoOk ? '' : 'El código tiene 6 dígitos.');
  if (!celularOk || !codigoOk) return;
  await procesar(formBilletera, () => pagarConBilletera({
    registro: registroActual, usuario, proveedor: datos.proveedor,
    celular: datos.celular, codigoAprobacion: datos.codigo
  }));
});

document.querySelectorAll('input[name="metodo"]').forEach((r) => r.addEventListener('change', mostrarMetodo));
selectRegistro.addEventListener('change', seleccionarRegistro);
mostrarMetodo();
cargarPendientes().catch((error) => {
  console.error(error);
  mostrarMensaje('No se pudieron cargar tus recargas. Revisa tu conexión a Neon.', 'error');
});
