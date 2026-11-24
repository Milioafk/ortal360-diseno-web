const API='https://portal360-api.onrender.com/api';
const modules={sat:'SAT Lima',metrobus:'MetroBus',crm:'CRM Andino',agua:'AguaViva'};
const $=id=>document.getElementById(id);
let session=null,profile=null,allCases=[];
try{session=JSON.parse(sessionStorage.getItem('portal_session')||'null')}catch{session=null}
const node=(tag,text='',cls='')=>{const v=document.createElement(tag);v.textContent=String(text);if(cls)v.className=cls;return v};
function notice(msg,good=false){const box=$('notice');box.hidden=false;box.textContent=msg;box.className='notice'+(good?' good':'')}
async function api(path,method='GET',body){
 let response;
 try{response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(session?.token?{Authorization:'Bearer '+session.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})}
 catch{throw Error('Sin conexión con Render. Si el plan es gratuito puede tardar en activarse. Vuelve a intentarlo.');}
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Error HTTP '+response.status);
 return result;
}
function signOut(){session=null;profile=null;sessionStorage.removeItem('portal_session');$('workspace').hidden=true;$('loginSection').hidden=false;$('notice').hidden=true}
$('logoutBtn').addEventListener('click',signOut);
$('reloadBtn').addEventListener('click',()=>refresh().catch(e=>notice(e.message)));
$('moduleFilter').addEventListener('change',()=>renderCases());
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 const form=new FormData(e.target);
 try{const user=await api('/auth/login','POST',{correo:form.get('correo'),contrasena:form.get('contrasena')});session=user;sessionStorage.setItem('portal_session',JSON.stringify(user));e.target.reset();notice('Inicio de sesión correcto',true);await refresh()}
 catch(err){notice(err.message)}finally{btn.disabled=false}
});
function td(tr,value,cls=''){const t=node('td',value,cls);tr.append(t);return t}
function getScopeText(){if(!profile)return '';const m=profile.modulos||[];return profile.usuario.rol==='cliente'?'Mis solicitudes':profile.usuario.rol==='administrador'?'Todos los módulos':m.map(x=>modules[x]||x).join(', ')}
async function refresh(){
 profile=await api('/auth/me');
 $('workspace').hidden=false;$('loginSection').hidden=true;
 $('welcome').textContent=profile.usuario.nombre;
 $('roleBadge').textContent={administrador:'Administrador general',operador:'Empleado / operador',cliente:'Cliente'}[profile.usuario.rol]||profile.usuario.rol;
 $('scopeBadge').textContent=getScopeText();
 const role=profile.usuario.rol;
 $('adminSection').hidden=role!=='administrador';$('auditSection').hidden=role!=='administrador';
 $('caseHint').textContent=role==='administrador'?'Puedes atender cualquier módulo. Los cambios quedan registrados en auditoría.':role==='operador'?'Puedes atender solicitudes únicamente de tus módulos asignados.':'Puedes consultar tus solicitudes, pero no modificar su estado.';
 const [summary,cases]=await Promise.all([api('/gestion/resumen'),api('/gestion/solicitudes')]);
 allCases=cases;renderKpis(summary);renderCases();
 if(role==='administrador')await Promise.all([loadUsers(),loadAudit()]);
}
function renderKpis(summary){
 const grid=$('kpis');grid.replaceChildren();const data=summary.modulos||[];
 const totals={total:data.reduce((a,x)=>a+Number(x.total),0),pendientes:data.reduce((a,x)=>a+Number(x.pendientes),0),atendidos:data.reduce((a,x)=>a+Number(x.atendidos),0),modules:data.length};
 [['Solicitudes visibles',totals.total],['Pendientes',totals.pendientes],['Atendidas',totals.atendidos],['Módulos visibles',totals.modules]].forEach(([label,num])=>{
  const box=node('div','','kpi');box.append(node('span',label),node('strong',num));grid.append(box);
 });
}
function renderCases(){
 const body=$('casesBody');body.replaceChildren();const filter=$('moduleFilter').value;
 const data=allCases.filter(x=>filter==='todos'||x.modulo===filter);
 $('casesEmpty').hidden=data.length>0;
 for(const r of data){
  const tr=document.createElement('tr');td(tr,r.codigo);td(tr,modules[r.modulo]||r.modulo);td(tr,r.autor||'');
  const details=Object.entries(r.datos||{}).filter(([key])=>!['origen','estado_pago'].includes(key)).slice(0,3).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join('\n');
  td(tr,details.slice(0,240),'detail');
  const stat=td(tr,'');stat.append(node('span',r.estado,'status '+r.estado));
  const actions=td(tr,'');
  if(profile?.usuario.rol==='administrador'||profile?.usuario.rol==='operador'){
    const sel=document.createElement('select');sel.setAttribute('aria-label','Cambiar estado de '+r.codigo);
    for(const st of ['registrado','en_revision','atendido']){const opt=new Option(st.replaceAll('_',' '),st);sel.add(opt)}sel.value=r.estado;
    const btn=node('button','Guardar','mini');btn.type='button';btn.addEventListener('click',async()=>{
     btn.disabled=true;try{await api('/gestion/solicitudes/'+r.id,'PATCH',{estado:sel.value});notice('Estado actualizado: '+r.codigo,true);await refresh()}catch(e){notice(e.message)}finally{btn.disabled=false}
    });actions.append(sel,document.createTextNode(' '),btn);
  }else actions.append(node('span','Solo lectura','muted'));
  body.append(tr);
 }
}
async function loadUsers(){
 const users=await api('/gestion/usuarios');const body=$('usersBody');body.replaceChildren();
 const roles=['administrador','operador','cliente'];
 for(const u of users){
  const tr=document.createElement('tr');const account=td(tr,u.nombre);account.append(node('small',u.correo,'email'));
  const roleCell=td(tr,'');const sel=document.createElement('select');sel.setAttribute('aria-label','Rol '+u.correo);
  roles.forEach(rol=>sel.add(new Option(rol,rol)));sel.value=u.rol;roleCell.append(sel);
  const moduleCell=td(tr,'');const group=node('div','','user-modules');const checks=[];
  for(const [key,label] of Object.entries(modules)){
    const labelEl=document.createElement('label');const ch=document.createElement('input');ch.type='checkbox';ch.value=key;ch.checked=(u.modulos||[]).includes(key);checks.push(ch);
    labelEl.append(ch,document.createTextNode(' '+label));group.append(labelEl);
  }moduleCell.append(group);
  const enabledCell=td(tr,'');const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!u.activo;enabled.title='Cuenta activa';enabledCell.append(enabled);
  const action=td(tr,'');const btn=node('button','Aplicar','mini');btn.type='button';if(Number(u.id)===Number(profile.usuario.id))btn.disabled=true;
  btn.addEventListener('click',async()=>{
   btn.disabled=true;try{
    const modulos=checks.filter(c=>c.checked).map(c=>c.value);
    if(sel.value==='operador'&&!modulos.length)throw Error('Selecciona algún módulo para el empleado');
    await api('/gestion/usuarios/'+u.id,'PATCH',{rol:sel.value,activo:enabled.checked,modulos});
    notice('Cuenta demo actualizada: '+u.correo,true);await refresh();
   }catch(err){notice(err.message)}finally{btn.disabled=false}
  });action.append(btn);body.append(tr);
 }
}
async function loadAudit(){
 const logs=await api('/gestion/auditoria');const body=$('auditBody');body.replaceChildren();
 if(!logs.length){const row=document.createElement('tr');const t=td(row,'Todavía no hay acciones administrativas registradas.');t.colSpan=5;body.append(row);return}
 for(const a of logs){const tr=document.createElement('tr');for(const val of [new Date(a.creado_en).toLocaleString('es-PE'),a.actor,a.accion,a.modulo||'—',a.entidad_id||'—'])td(tr,val);body.append(tr)}
}
if(session?.token){refresh().catch(e=>{signOut();notice('Vuelve a iniciar sesión: '+e.message)})}
