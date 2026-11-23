// comprobante.html — constancia de pago imprimible (window.print + @media print).
import { sql } from '../config/neon-config.js';
import { exigirRol } from '../auth/auth.js';
import { formatearSoles } from '../registro/tarifario.js';

// Todos los perfiles con sesión pueden entrar; el cliente solo ve sus propios comprobantes.
const usuario = exigirRol('cliente', 'administrador', 'empleado', 'cajero');
if (!usuario) throw new Error('Sin sesión');

const NOMBRES_METODO = {
  tarjeta_debito: 'Tarjeta de débito', tarjeta_credito: 'Tarjeta de crédito',
  billetera: 'Billetera electrónica', efectivo: 'Efectivo', pos: 'Tarjeta en POS'
};

const contenedor = document.querySelector('#comprobante');
const op = new URLSearchParams(location.search).get('op');

// El botón "Volver" lleva a la página de inicio de cada perfil.
const volver = document.querySelector('#enlace-volver');
volver.href = { cliente: 'consulta.html', cajero: 'caja.html' }[usuario.rol] ?? 'panel.html';

function agregarDato(lista, etiqueta, valor) {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = etiqueta;
  dd.textContent = valor ?? '—';
  lista.append(dt, dd);
}

async function cargar() {
  let pago = null;
  if (op) {
    const filas = await sql`
      SELECT p.codigo_operacion, p.canal, p.metodo, p.proveedor_billetera, p.marca_tarjeta, p.referencia,
             p.monto, p.monto_recibido, p.vuelto, p.fecha_pago, p.id_usuario,
             r.codigo_seguimiento, r.numero_tarjeta, r.monto_recarga, r.tarjeta_nueva, r.pase_universitario,
             u.nombre AS cliente, c.nombre AS cajero
      FROM pagos p
      JOIN recargas_tarjeta r ON r.id = p.id_registro
      LEFT JOIN usuarios u ON u.id = p.id_usuario
      LEFT JOIN usuarios c ON c.id = p.id_cajero
      WHERE p.codigo_operacion = ${op} AND p.estado = 'aprobado';
    `;
    pago = filas[0] ?? null;
  }

  // Un cliente solo puede ver sus propios comprobantes.
  if (!pago || (usuario.rol === 'cliente' && pago.id_usuario !== usuario.id)) {
    contenedor.textContent = 'Comprobante no encontrado.';
    return;
  }

  const dl = document.createElement('dl');
  agregarDato(dl, 'N.° de operación', pago.codigo_operacion);
  agregarDato(dl, 'Recarga', pago.codigo_seguimiento);
  agregarDato(dl, 'Tarjeta recargada', pago.numero_tarjeta);
  agregarDato(dl, 'Cliente', pago.cliente ?? 'Atención presencial');
  agregarDato(dl, 'Canal', pago.canal === 'pasarela' ? 'Pago en línea' : 'Ventanilla');
  agregarDato(dl, 'Medio', `${NOMBRES_METODO[pago.metodo]} ${pago.marca_tarjeta ?? pago.proveedor_billetera ?? ''} ${pago.referencia ?? ''}`.trim());
  agregarDato(dl, 'Monto de la recarga', formatearSoles(Number(pago.monto_recarga)));
  if (pago.tarjeta_nueva) {
    agregarDato(dl, 'Tarjeta nueva', pago.pase_universitario ? 'Con pase universitario (50 %)' : 'Emisión de tarjeta');
  }
  agregarDato(dl, 'Total pagado', formatearSoles(Number(pago.monto)));
  if (pago.metodo === 'efectivo') {
    agregarDato(dl, 'Recibido', formatearSoles(Number(pago.monto_recibido)));
    agregarDato(dl, 'Vuelto', formatearSoles(Number(pago.vuelto)));
  }
  if (pago.cajero) agregarDato(dl, 'Atendido por', pago.cajero);
  agregarDato(dl, 'Fecha y hora', new Date(pago.fecha_pago).toLocaleString('es-PE', { timeZone: 'America/Lima' }));
  contenedor.replaceChildren(dl);
}

cargar().catch((error) => {
  console.error(error);
  contenedor.textContent = 'No se pudo cargar el comprobante. Revisa tu conexión a Neon.';
});

document.querySelector('#imprimir').addEventListener('click', () => window.print());
