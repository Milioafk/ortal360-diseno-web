// Presentation layer only; all authorization and persistence remain in native-panel.js / Render.
(()=>{
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sections=[...document.querySelectorAll('.native-story,.login-gate,.session-strip,.stats,.content-grid,.records-box,.auditbox')];
 sections.forEach(x=>x.dataset.cinemaReveal='');
 if('IntersectionObserver' in window&&!motion){const o=new IntersectionObserver(entries=>{entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.add('is-visible');o.unobserve(target)}})},{threshold:.1});sections.forEach(x=>o.observe(x));}
 else sections.forEach(x=>x.classList.add('is-visible'));
 const root=document.querySelector('.native-main');
 if(root && !motion){root.addEventListener('pointermove',e=>{const art=document.querySelector('.native-cinema-art');if(!art||!root.contains(e.target))return;const r=root.getBoundingClientRect();art.style.setProperty('--pointer-x',String((e.clientX-r.left)/r.width));},{passive:true})}
})();
