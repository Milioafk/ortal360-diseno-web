// Eventos DOM + fetch; nunca incluye credenciales de Neon.
const $=id=>document.getElementById(id);
const modules={sat:'SAT Lima',metrobus:'MetroBus',crm:'CRM Andino',agua:'AguaViva'};
let selected='sat';let mode='login';let session=null;
try{session=JSON.parse(sessionStorage.getItem('portal_session')||'null')}catch{session=null}
function notify(message){$('notificationText').textContent=message;bootstrap.Toast.getOrCreateInstance($('notification')).show()}
async function request(endpoint,options={}){
 const response=await fetch(`/api${endpoint}`,{...options,headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.token}`}:{})}});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`Error HTTP ${response.status}`);return data;
}
function renderSession(){
 $('sessionInfo').textContent=session?`Sesión iniciada: ${session.usuario.nombre} · ${session.usuario.rol}`:'No has iniciado sesión.';
 $('logoutBtn').classList.toggle('d-none',!session);
}
function setMode(next){mode=next;$('nameBox').classList.toggle('d-none',mode==='login');$('nombre').required=mode==='register';$('tabLogin').className=mode==='login'?'btn btn-primary':'btn btn-outline-primary';$('tabRegister').className=mode==='register'?'btn btn-primary':'btn btn-outline-primary';$('tabLogin').setAttribute('aria-pressed',String(mode==='login'));$('tabRegister').setAttribute('aria-pressed',String(mode==='register'));$('authSubmit').textContent=mode==='login'?'Iniciar sesión':'Registrarme';$('contrasena').autocomplete=mode==='login'?'current-password':'new-password';}
$('tabLogin').addEventListener('click',()=>setMode('login'));
$('tabRegister').addEventListener('click',()=>setMode('register'));
$('logoutBtn').addEventListener('click',()=>{session=null;sessionStorage.removeItem('portal_session');renderSession();loadRecords();notify('Sesión cerrada')});
$('authForm').addEventListener('submit',async e=>{
 e.preventDefault();const payload={correo:$('correo').value,contrasena:$('contrasena').value};if(mode==='register')payload.nombre=$('nombre').value;
 try{session=await request(mode==='login'?'/auth/login':'/auth/registro',{method:'POST',body:JSON.stringify(payload)});sessionStorage.setItem('portal_session',JSON.stringify(session));$('contrasena').value='';renderSession();notify('Acceso correcto');await loadRecords();}catch(err){notify(err.message)}
});
document.querySelectorAll('.module-button').forEach(btn=>btn.addEventListener('click',()=>{selected=btn.dataset.module;$('selectedModuleLabel').textContent=`Módulo seleccionado: ${modules[selected]}`;loadRecords();$('registros').scrollIntoView({behavior:'smooth'})}));
$('entryForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!session){notify('Primero inicia sesión');$('acceso').scrollIntoView();return}
 try{await request('/registros',{method:'POST',body:JSON.stringify({modulo:selected,titulo:$('titulo').value,detalle:$('detalle').value})});e.target.reset();notify('Registro guardado en la base compartida');await loadRecords()}catch(err){notify(err.message)}
});
$('refreshBtn').addEventListener('click',loadRecords);
async function loadRecords(){
 const box=$('records');box.replaceChildren();if(!session){const p=document.createElement('p');p.textContent='Inicia sesión para consultar el historial.';box.append(p);return}
 try{
 const rows=await request(`/registros?modulo=${encodeURIComponent(selected)}`);if(!rows.length){const p=document.createElement('p');p.textContent='Aún no hay registros en este módulo.';box.append(p);return}
 rows.forEach(r=>{
 const article=document.createElement('article');article.className='record';const head=document.createElement('div');head.className='record-head';const title=document.createElement('h4');title.textContent=r.titulo;const status=document.createElement('span');status.className='badge text-bg-primary';status.textContent=r.estado;head.append(title,status);
 const detail=document.createElement('p');detail.textContent=r.detalle;const info=document.createElement('small');info.textContent=`#${r.id} · ${new Date(r.creado_en).toLocaleString('es-PE')} ${r.autor?'· '+r.autor:''}`;article.append(head,detail,info);
 if(['operador','administrador'].includes(session.usuario.rol)){const sel=document.createElement('select');sel.className='form-select form-select-sm mt-2';sel.setAttribute('aria-label',`Estado de registro ${r.id}`);['registrado','en_revision','atendido'].forEach(x=>{const option=new Option(x.replace('_',' '),x);sel.add(option)});sel.value=r.estado;sel.addEventListener('change',async()=>{try{await request(`/registros/${r.id}`,{method:'PATCH',body:JSON.stringify({estado:sel.value})});notify('Estado actualizado');await loadRecords()}catch(err){notify(err.message)}});article.append(sel)}box.append(article)
 });
 }catch(err){const p=document.createElement('p');p.textContent=err.message;box.append(p)}
}
renderSession();loadRecords();
