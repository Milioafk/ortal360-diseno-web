// Menú de sesión (todas las páginas): enlaces según el rol y botón de cerrar sesión.
// No usa Neon, solo lee la sesión guardada por auth.js.
document.addEventListener('DOMContentLoaded', () => {
  const itemSesion = document.getElementById('nav-sesion');
  if (!itemSesion) return;

  let usuario = null;
  try {
    usuario = JSON.parse(sessionStorage.getItem('usuario'));
  } catch (error) {
    usuario = null;
  }

  if (!usuario) {
    // Sin sesión se deja el enlace "Iniciar sesión" que ya trae el HTML.
    return;
  }

  // Enlaces extra según el rol (Semana 9: el cajero tiene su Caja y el cliente puede Pagar).
  //   cliente → Mis recargas y Pagar · administrador → Panel y Caja · empleado → Panel · cajero → Caja
  const ENLACES_POR_ROL = {
    cliente: [['consulta.html', 'Mis recargas'], ['pago.html', 'Pagar']],
    administrador: [['panel.html', 'Panel'], ['caja.html', 'Caja']],
    empleado: [['panel.html', 'Panel']],
    cajero: [['caja.html', 'Caja']]
  };

  const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
  (ENLACES_POR_ROL[usuario.rol] || []).forEach(([destino, texto]) => {
    const itemExtra = document.createElement('li');
    const enlace = document.createElement('a');
    enlace.href = destino;
    enlace.textContent = texto;
    if (paginaActual === destino) enlace.setAttribute('aria-current', 'page');
    itemExtra.appendChild(enlace);
    itemSesion.parentElement.insertBefore(itemExtra, itemSesion);
  });

  // Botón de cerrar sesión con el nombre del usuario.
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn-cerrar-sesion';
  boton.textContent = `Hola, ${usuario.nombre} · Cerrar sesión`;
  boton.addEventListener('click', () => {
    sessionStorage.removeItem('usuario');
    window.location.href = 'index.html';
  });
  itemSesion.replaceChildren(boton);
});
