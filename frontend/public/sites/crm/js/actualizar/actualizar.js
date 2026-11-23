// UPDATE — el cliente edita solo su propio registro, mientras esté 'registrado' y no 'pagado' (Semana 9)
import { sql } from '../config/neon-config.js';
import { exigirSesion, cerrarSesion } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles, marcado } from '../registro/tarifario.js';

const usuario = exigirSesion(['cliente']);
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

export async function actualizarRegistro(id, datos) {
  const monto = calcularMontoServicio(datos);
  // id_usuario, estado y estado_pago en el WHERE: nadie edita lo ajeno, lo atendido ni lo ya pagado
  const filas = await sql`
    UPDATE solicitudes_demo_crm
    SET nombre = ${datos.nombre}, empresa = ${datos.empresa}, correo = ${datos.correo},
        num_usuarios = ${datos.usuarios}, mensaje = ${datos.mensaje},
        usuarios_crm = ${Number(datos.usuarios_crm)}, meses = ${Number(datos.meses)},
        modulo_facturacion = ${marcado(datos.modulo_facturacion)},
        monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'}
    WHERE id = ${id} AND id_usuario = ${usuario.id}
      AND estado = 'registrado' AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  return filas.length === 1 ? monto : null;   // null: no existe, no es tuyo, fue atendido o ya fue pagado
}

const id = Number(new URLSearchParams(window.location.search).get('id'));
const form = document.getElementById('form-actualizar');
const campos = document.getElementById('campos');
const msg = document.getElementById('mensaje');

function mostrar(texto, tipo) {
  msg.textContent = texto;
  msg.className = 'msg visible ' + tipo;
}

async function cargar() {
  if (!id) { form.hidden = true; return mostrar('No se indicó qué registro editar.', 'error'); }
  try {
    const filas = await sql`
      SELECT * FROM solicitudes_demo_crm WHERE id = ${id} AND id_usuario = ${usuario.id};
    `;
    if (filas.length === 0) { form.hidden = true; return mostrar('No se encontró ese registro.', 'error'); }
    const r = filas[0];
    form.nombre.value = r.nombre;
    form.empresa.value = r.empresa;
    form.correo.value = r.correo;
    form.usuarios.value = r.num_usuarios;
    form.usuarios_crm.value = r.usuarios_crm;
    form.meses.value = r.meses;
    form.modulo_facturacion.checked = r.modulo_facturacion;
    form.mensaje.value = r.mensaje || '';
    document.getElementById('codigo').textContent = r.codigo_seguimiento;
    if (r.estado !== 'registrado' || r.estado_pago === 'pagado') {
      campos.disabled = true;
      document.getElementById('btn-guardar').hidden = true;
      mostrar(r.estado_pago === 'pagado'
        ? 'Esta solicitud ya fue pagada; solo puedes verla.'
        : 'Este registro ya fue atendido (' + r.estado + '); solo puedes verlo.', 'error');
    }
  } catch (err) {
    console.error(err);
    form.hidden = true;
    mostrar('No se pudo cargar el registro.', 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  try {
    const monto = await actualizarRegistro(id, {
      nombre: form.nombre.value.trim(), empresa: form.empresa.value.trim(),
      correo: form.correo.value.trim(), usuarios: form.usuarios.value,
      usuarios_crm: form.usuarios_crm.value, meses: form.meses.value,
      modulo_facturacion: form.modulo_facturacion.checked ? 'on' : '',
      mensaje: form.mensaje.value.trim()
    });
    mostrar(monto !== null
      ? '✓ Registro actualizado. Nuevo monto: ' + formatearSoles(monto) + '.'
      : 'No se pudo actualizar: el registro ya fue atendido o pagado.',
      monto !== null ? 'ok' : 'error');
  } catch (err) {
    console.error(err);
    mostrar('Error al actualizar. Intenta de nuevo.', 'error');
  }
});
cargar();
