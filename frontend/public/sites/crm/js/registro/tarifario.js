// Regla de negocio de CRM Andino Perú — función PURA: recibe datos y devuelve un número.
// No toca el DOM ni la base de datos; se puede probar en la consola:
//   calcularMontoServicio({ usuarios_crm: '5', meses: '1', modulo_facturacion: 'on' })  -> 325
//   calcularMontoServicio({ usuarios_crm: '3', meses: '2' })                           -> 270

export function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

export function formatearSoles(monto) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
}

// Un checkbox marcado llega en FormData como 'on'; si no está marcado, NO llega
export const marcado = (valor) => valor === 'on';

// S/ 45.00 mensuales por usuario × meses + S/ 100.00 (pago único) por el módulo de facturación electrónica
export function calcularMontoServicio(d) {
  const usuarios = Number(d.usuarios_crm) || 0;
  const meses = Number(d.meses) || 1;
  return redondear(45.00 * usuarios * meses + (marcado(d.modulo_facturacion) ? 100.00 : 0));
}
