// Portal360 visual layer: progressive enhancement. No credentials, no API writes.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const elements = [...document.querySelectorAll('[data-reveal]')];
if ('IntersectionObserver' in window && !reduce) {
 const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); reveal.unobserve(entry.target) }
 }), { threshold: .12 });
 elements.forEach(el => reveal.observe(el));
} else elements.forEach(el => el.classList.add('is-revealed'));

const hero = document.querySelector('[data-parallax]');
if (hero && !reduce && window.matchMedia('(pointer:fine)').matches) {
 let desiredX=0,desiredY=0,frame=null;
 hero.addEventListener('pointermove',e => {
  const b=hero.getBoundingClientRect();desiredX=(e.clientX-(b.left+b.width/2))/b.width*16;desiredY=(e.clientY-(b.top+b.height/2))/b.height*16;
  if(!frame)frame=requestAnimationFrame(()=>{hero.style.setProperty('--parallax-x',desiredX.toFixed(2));hero.style.setProperty('--parallax-y',desiredY.toFixed(2));frame=null});
 },{passive:true});
 hero.addEventListener('pointerleave',()=>{desiredX=desiredY=0;hero.style.setProperty('--parallax-x','0');hero.style.setProperty('--parallax-y','0')});
}

const stages=[...document.querySelectorAll('.story-frame')];const fill=document.querySelector('#storyLineFill');const counter=document.querySelector('#storyProgressText');
if(stages.length && 'IntersectionObserver' in window && !reduce){
 const obs=new IntersectionObserver(entries=>{
  entries.forEach(({target,isIntersecting})=>{if(!isIntersecting)return;
   const index=stages.indexOf(target);
   stages.forEach((el,i)=>el.classList.toggle('is-current',i===index));
   if(fill)fill.style.width=((index+1)/stages.length*100)+'%';
   if(counter)counter.textContent=`CAPÍTULO 0${index+1} / 03`;
  });
 },{rootMargin:'-25% 0px -25% 0px',threshold:.1});
 stages.forEach(el=>obs.observe(el));
}
// Data modules have no fake counters. Update visual selection only after the real app updates its own state.
document.querySelectorAll('.p360-choose').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.cinematic-service').forEach(card=>card.classList.remove('is-selected'));
 btn.closest('.cinematic-service')?.classList.add('is-selected');
}));
