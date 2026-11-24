// Complemento únicamente visual. Los permisos y los datos continúan en role-dashboard.js / Render.
(() => {
 const root=document.querySelector('#opsTelemetry');
 const bars=document.querySelector('#opsTelemetryBars');
 const list={sat:'SAT Lima',metrobus:'MetroBus',crm:'CRM Andino',agua:'AguaViva'};
 if(!root||!bars)return;
 const render=async() => {
  const token=JSON.parse(sessionStorage.getItem('portal_session')||'null')?.token;
  if(!token){root.hidden=true;return;}
  try{
   const response=await fetch('https://portal360-api.onrender.com/api/gestion/resumen',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw Error('No se obtuvo un resumen');
   const value=await response.json();const data=Array.isArray(value.modulos)?value.modulos:[];
   const max=Math.max(1,...data.map(x=>Number(x.total)||0));
   bars.replaceChildren();
   for(const m of data){
    const el=document.createElement('article');el.className='ops-bar '+m.modulo;
    const h=document.createElement('div');h.className='ops-bar-head';
    const n=document.createElement('span');n.textContent=list[m.modulo]||m.modulo;
    const count=document.createElement('b');count.textContent=String(m.total);h.append(n,count);
    const track=document.createElement('div');track.className='ops-bar-track';
    const fill=document.createElement('div');fill.className='ops-bar-fill';fill.style.setProperty('--fill',Math.max(0,Math.min(100,Number(m.total)/max*100))+'%');track.append(fill);
    const note=document.createElement('small');note.textContent=`${m.pendientes} pendientes · ${m.atendidos} atendidas`;
    el.append(h,track,note);bars.append(el);
   }
   root.hidden=!data.length;
  }catch{root.hidden=true;}
 };
 // Rely on native observer to notice authentication state; no changes to auth protocol.
 const workspace=document.querySelector('#workspace');
 if(workspace && 'MutationObserver' in window){const observer=new MutationObserver(()=>{if(!workspace.hidden)render();else root.hidden=true});observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});}
 document.querySelector('#reloadBtn')?.addEventListener('click',()=>setTimeout(render,300));
 document.querySelector('#loginForm')?.addEventListener('submit',()=>setTimeout(render,1100));
 if(workspace&&!workspace.hidden)render();
})();
