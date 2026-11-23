// Aviso de diagnóstico para login.html. Es un script clásico (no módulo) a propósito:
// los módulos NO se ejecutan si la página se abre con doble clic (file://), y justo ese
// caso es el que este aviso detecta. Con Live Server o Vercel no hace nada.
(function () {
  if (window.location.protocol !== 'file:') return;
  document.addEventListener('DOMContentLoaded', function () {
    var aviso = document.createElement('div');
    aviso.className = 'aviso-local';
    aviso.setAttribute('role', 'alert');
    aviso.textContent = 'Abriste la página con doble clic (file://) y por eso los botones no responden. ' +
      'En Visual Studio Code abre la carpeta del proyecto, haz clic derecho en login.html y elige "Open with Live Server".';
    var principal = document.querySelector('main');
    if (principal) principal.insertBefore(aviso, principal.firstChild);
  });
})();
