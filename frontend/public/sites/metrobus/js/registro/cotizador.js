// Cotizador en vivo (lo usan registro.html, actualizar.html y el formulario del panel).
// Lee el formulario, calcula con tarifario.js y escribe el desglose en los <output>.
import { calcularMontoServicio, costoEmision, formatearSoles, marcado } from './tarifario.js';

export function iniciarCotizador(form) {
  const chkTarjeta = form.querySelector('[name="tarjeta_nueva"]');
  const chkPase = form.querySelector('[name="pase_universitario"]');
  const salidaRecarga = form.querySelector('[data-salida="recarga"], #desglose-recarga');
  const salidaTarjeta = form.querySelector('[data-salida="tarjeta"], #desglose-tarjeta');
  const salidaTotal = form.querySelector('[data-salida="total"], #monto-estimado');

  // FormData + Object.fromEntries: un checkbox sin marcar (o deshabilitado) no aparece.
  const leer = () => Object.fromEntries(new FormData(form));

  function actualizar() {
    // El pase universitario solo tiene sentido si se pide tarjeta nueva.
    if (chkPase) {
      chkPase.disabled = !chkTarjeta.checked || chkTarjeta.disabled;
      if (!chkTarjeta.checked) chkPase.checked = false;
    }
    const datos = leer();
    if (salidaRecarga) salidaRecarga.textContent = formatearSoles(Number(datos.monto_recarga) || 0);
    if (salidaTarjeta) salidaTarjeta.textContent = formatearSoles(costoEmision(datos));
    if (salidaTotal) salidaTotal.textContent = formatearSoles(calcularMontoServicio(datos));
  }

  form.addEventListener('input', actualizar);    // texto y números, en cada tecla
  form.addEventListener('change', actualizar);   // select, radio y checkbox
  actualizar();

  return { leer, actualizar, marcado };
}
