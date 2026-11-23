// Tarifario de MetroBus Lima (caso 23) — regla de negocio como funciones PURAS.
// No tocan el DOM ni la base de datos, por eso se pueden probar en la consola del navegador:
//   calcularMontoServicio({ monto_recarga: '20', tarjeta_nueva: 'on', pase_universitario: 'on' })  → 22.25
//   calcularMontoServicio({ monto_recarga: '10' })                                                  → 10

export const COSTO_TARJETA_NUEVA = 4.50;      // emisión de una tarjeta nueva
export const DESCUENTO_PASE = 0.5;            // con pase universitario la emisión cuesta el 50 %

export function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

export function formatearSoles(monto) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
}

// Un checkbox marcado llega en FormData como 'on'; si no está marcado, NO llega.
export const marcado = (valor) => valor === 'on' || valor === true;

// Costo de emisión de la tarjeta: 0 si no la pide; S/ 4.50 normal; S/ 2.25 con pase universitario.
export function costoEmision(d) {
  if (!marcado(d.tarjeta_nueva)) return 0;
  return redondear(marcado(d.pase_universitario) ? COSTO_TARJETA_NUEVA * DESCUENTO_PASE : COSTO_TARJETA_NUEVA);
}

// Regla: monto de recarga + S/ 4.50 si solicita tarjeta nueva (50 % con pase universitario).
// El descuento aplica a la emisión de la tarjeta, no al saldo recargado.
export function calcularMontoServicio(d) {
  const recarga = Number(d.monto_recarga) || 0;
  return redondear(recarga + costoEmision(d));
}
