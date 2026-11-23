// SELECT filtrado — solo los registros del usuario en sesión, con estado de pago y acciones (Semana 9)
import { sql } from '../config/neon-config.js';
import { exigirSesion, cerrarSesion } from '../auth/auth.js';
import { formatearSoles } from '../registro/tarifario.js';

const usuario = exigirSesion(['cliente']);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
document.getElementById('saludo').textContent = usuario.nombre;

export async function listarPropios() {
  return await sql`
    SELECT r.id, r.codigo_seguimiento, r.empresa, r.num_usuarios, r.estado, r.estado_pago,
           r.monto_calculado, r.canal_pago, r.fecha_registro, p.codigo_operacion
    FROM solicitudes_demo_crm r
    LEFT JOIN pagos p ON p.id_registro = r.id AND p.estado = 'aprobado'
    WHERE r.id_usuario = ${usuario.id}
    ORDER BY r.fecha_registro DESC, r.id DESC;
  `;
}

function td(texto) {
  const c = document.createElement('td');
  c.textContent = texto;
  return c;
}

function badge(clase, texto) {
  const b = document.createElement('span');
  b.className = 'estado estado-' + clase;
  b.textContent = texto;
  return b;
}

function enlace(href, texto) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'btn btn-outline btn-sm';
  a.textContent = texto;
  return a;
}

// Celda de acciones: Editar (si aún se puede), Pagar / Ver comprobante / Exonerado
function celdaAcciones(r) {
  const acc = document.createElement('td');
  if (r.estado === 'registrado' && r.estado_pago !== 'pagado') acc.append(enlace('actualizar.html?id=' + r.id, 'Editar'));
  if (r.estado_pago === 'pendiente') {
    acc.append(enlace('pago.html?id=' + r.id, 'Pagar'));
  } else if (r.estado_pago === 'pagado' && r.codigo_operacion) {
    acc.append(enlace('comprobante.html?op=' + encodeURIComponent(r.codigo_operacion), 'Ver comprobante'));
  } else if (r.estado_pago === 'exonerado') {
    acc.append('Exonerado');
  }
  if (!acc.hasChildNodes()) acc.textContent = 'Solo lectura';
  return acc;
}

async function pintar() {
  const cuerpo = document.getElementById('cuerpo');
  const aviso = document.getElementById('aviso');
  try {
    const filas = await listarPropios();
    cuerpo.replaceChildren();
    aviso.textContent = filas.length === 0 ? 'Aún no tienes solicitudes registradas.' : '';
    for (const f of filas) {
      const tr = document.createElement('tr');
      tr.append(td(f.codigo_seguimiento), td(f.empresa), td(f.num_usuarios));
      const est = document.createElement('td');
      est.append(badge(f.estado, f.estado));
      tr.append(est, td(formatearSoles(Number(f.monto_calculado))));
      const pago = document.createElement('td');
      pago.append(badge(f.estado_pago, f.estado_pago));
      tr.append(pago, td(new Date(f.fecha_registro).toLocaleDateString('es-PE')), celdaAcciones(f));
      cuerpo.append(tr);
    }
  } catch (err) {
    console.error(err);
    aviso.textContent = 'No se pudieron cargar tus registros.';
  }
}
pintar();
