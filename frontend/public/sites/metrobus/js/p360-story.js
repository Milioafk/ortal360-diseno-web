// Passive cinematic intro; never changes the original booking, payment, or register logic.
(()=>{
 const film=document.querySelector('.p360-film');
 if(!film || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 if('IntersectionObserver' in window){
  const view=new IntersectionObserver(([entry])=>{film.classList.toggle('p360-film-inview',entry.isIntersecting)},{threshold:.07});view.observe(film);
 }
})();
