// Buscador en vivo de estaciones (script propio de rutas.html, no requiere Neon).
document.addEventListener('DOMContentLoaded', () => {
  const buscador = document.getElementById('buscador-estaciones');
  if (!buscador) return;

  buscador.addEventListener('input', () => {
    const texto = buscador.value.trim().toLowerCase();
    document.querySelectorAll('.estaciones-lista li').forEach((item) => {
      const coincide = item.textContent.toLowerCase().includes(texto);
      item.style.display = coincide ? '' : 'none';
    });
  });
});
