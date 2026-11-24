/**
 * Portal360 · controlador de panel propio de cada sistema.
 * Todas las lecturas/escrituras autorizadas pasan por Render; NO usa Neon directamente.
 */
const APP = document.body.dataset.p360Module;
const API = 'https://portal360-api.onrender.com/api';
const schemas={
 sat:{label:'Reclamos tributarios',fields:['nombre_propietario','dni','tipo_impuesto','motivo','valor_tasacion'],required:['nombre_propietario','dni','tipo_impuesto','motivo'],columns:['nombre_propietario','dni','tipo_impuesto','motivo']},
 metrobus:{label:'Recargas',fields:['numero_tarjeta','monto_recarga','tarjeta_nueva','pase_universitario'],required:['numero_tarjeta','monto_recarga'],columns:['numero_tarjeta','monto_recarga','tarjeta_nueva','pase_universitario']},
 crm:{label:'Solicitudes CRM',fields:['nombre','empresa','correo_contacto','num_usuarios','usuarios_crm','meses','modulo_facturacion','mensaje'],required:['nombre','empresa','correo_contacto','num_usuarios','mensaje'],columns:['nombre','empresa','correo_contacto','num_usuarios']},
 agua:{label:'Reportes de agua',fields:['nombre_vecino','zona','direccion','diametro_pulg','imagen_url','descripcion'],required:['nombre_vecino','zona','direccion','diametro_pulg','descripcion'],columns:['nombre_vecino','zona','direccion','descripcion']}
};
const fields=schemas[APP];
if(!fields) throw new Error('Módulo de panel desconocido');
const el=id=>document.getElementById(id);
let session=null,profile=null,casos=[],editando=null,roster=[];
try{session=JSON.parse(sessionStorage.getItem('portal_session')||'null')}catch{}
const dateString=val=>val?new Date(val).toLocaleString('es-PE',{timeZone:'America/Lima'}):'—';
const roleName={administrador:'Administrador',operador:'Empleado / operador',cliente:'Cliente'};
function node(tag,txt,cls){const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n}
function toast(str,error=false){const n=el('notice');n.hidden=false;n.textContent=str;n.className='notice '+(error?'is-error':'is-ok')}
async function api(path,method='GET',body){
 let res;
 try{res=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(session?.token?{Authorization:'Bearer '+session.token}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
 catch{throw Error('No se pudo conectar con Render. Verifica tu internet y el estado de la API.');}
 const json=await res.json().catch(()=>({}));if(!res.ok)throw Error(json.error||'HTTP '+res.status);return json;
}
function logout(){session=null;profile=null;casos=[];roster=[];editando=null;sessionStorage.removeItem('portal_session');sessionStorage.removeItem('usuario');el('workspace').hidden=true;el('loginGate').hidden=false;el('notice').hidden=true;el('loginForm').reset();el('recordForm').reset()}
function isStaff(){return ['administrador','operador'].includes(profile?.usuario?.rol)}
function checkScope(){if(profile?.usuario?.rol==='operador' && !(profile.modulos||[]).includes(APP))throw Error('Este empleado no está asignado a este sistema. Usa el panel de tu módulo.');}
async function load(){
 profile=await api('/auth/me');checkScope();
 const u=profile.usuario;el('who').textContent=u.nombre;el('role').textContent=roleName[u.rol]||u.rol;
 el('scope').textContent=u.rol==='cliente'?'Mis solicitudes':u.rol==='administrador'?'Supervisión de este sistema':'Módulo asignado: '+fields.label;
 el('workspace').hidden=false;el('loginGate').hidden=true;
 // Lectura real: una base compartida, filtrada por rol y módulo en Render.
 const [rows,resumen]=await Promise.all([api('/gestion/solicitudes?modulo='+APP),api('/gestion/resumen')]);
 casos=rows;
 renderStats(resumen);renderCases();
 await Promise.all([renderTeam(),renderAudit()]);
}
function renderStats(summary){
 const mine=(summary.modulos||[]).find(a=>a.modulo===APP)||{};
 const total=Number(mine.total||0),pending=Number(mine.pendientes||0),done=Number(mine.atendidos||0);
 const counts=[['Solicitudes',total],['Pendientes',pending],['Atendidas',done],['En revisión',casos.filter(c=>c.estado==='en_revision').length]];
 const box=el('stats');box.replaceChildren();for(const [label,num] of counts){const card=node('article',undefined,'metric');card.append(node('span',label),node('strong',num));box.append(card)}
}
function valueOf(row,key){const val=(row.datos||{})[key];if(typeof val==='boolean')return val?'Sí':'No';return val===undefined||val===null||val===''?'—':String(val)}
function renderCases(){
 const query=el('search').value.trim().toLocaleLowerCase('es-PE');const st=el('stateFilter').value;
 const visible=casos.filter(row=>(st==='todos'||st===row.estado)&&(!query||[row.codigo,row.autor,row.estado,...Object.values(row.datos||{})].join(' ').toLocaleLowerCase('es-PE').includes(query)));
 const rows=el('rows');rows.replaceChildren();el('empty').hidden=visible.length>0;
 for(const item of visible){
  const tr=document.createElement('tr');tr.append(node('td',item.codigo||'—'),...fields.columns.map(key=>node('td',valueOf(item,key))));
  const statusCell=node('td',undefined,'status-cell');statusCell.append(node('span',item.estado,'status status-'+item.estado));tr.append(statusCell);
  tr.append(node('td',dateString(item.creado_en)));
  const action=node('td',undefined,'actions');
  if(isStaff()){
   const edit=node('button','Editar','mini');edit.type='button';edit.addEventListener('click',()=>beginEdit(item));action.append(edit);
   const sel=document.createElement('select');sel.setAttribute('aria-label','Cambiar estado de '+item.codigo);
   for(const [v,label] of [['registrado','Registrado'],['en_revision','En revisión'],['atendido','Atendido'],['rechazado','Rechazado']])sel.add(new Option(label,v));sel.value=item.estado;
   const save=node('button','Guardar estado','mini secondary');save.type='button';save.addEventListener('click',async()=>{
    save.disabled=true;try{await api('/gestion/solicitudes/'+item.id,'PATCH',{estado:sel.value});toast('Estado de '+item.codigo+' actualizado. El panel general verá el cambio.',false);await load();}catch(e){toast(e.message,true);save.disabled=false}
   });action.append(sel,save);
  }else action.append(node('span','Solo lectura','muted'));
  tr.append(action);rows.append(tr);
 }
}
function beginEdit(item){
 if(!isStaff())return;
 editando=item;
 const form=el('recordForm');for(const key of fields.fields){const ctl=form.elements.namedItem(key);if(!ctl)continue;const val=(item.datos||{})[key];if(ctl.type==='checkbox')ctl.checked=val===true||val==='true';else ctl.value=(val===undefined||val===null)?'':String(val)}
 el('formTitle').textContent='Editar '+item.codigo;
 el('createBtn').textContent='Guardar cambios';el('cancelEdit').hidden=false;
 document.querySelector('.formbox').scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelEdit(){editando=null;el('recordForm').reset();el('formTitle').textContent='Nuevo registro';el('createBtn').textContent='Crear registro';el('cancelEdit').hidden=true;calculateFare()}
function readForm(){
 const f=el('recordForm');const result={};for(const key of fields.fields){const ctl=f.elements.namedItem(key);if(!ctl)continue;result[key]=ctl.type==='checkbox'?ctl.checked:String(ctl.value).trim()}
 return result;
}
async function saveForm(event){
 event.preventDefault();const b=el('createBtn');b.disabled=true;const data=readForm();
 try{
  if(editando){await api('/gestion/solicitudes/'+editando.id,'PATCH',{estado:editando.estado,datos:data});toast('Datos del expediente actualizados; sincronizado con el panel general.');}
  else{const r=await api('/modulos/'+APP+'/items','POST',data);toast('Registro '+r.codigo+' creado en Neon. Los cuatro sistemas comparten la base.');}
  cancelEdit();await load();
 }catch(e){toast(e.message,true)}finally{b.disabled=false}
}
const turnos=['Día · 06–14','Tarde · 14–22','Noche · 22–06'];
async function renderTeam(){
 const box=el('team');box.replaceChildren();const role=profile.usuario.rol;
 if(role!=='administrador'){el('staffHint').textContent=role==='operador'?'Trabajas en este módulo. El administrador asigna turnos y permisos desde Neon.':'Solo el personal autorizado puede gestionar otros usuarios.';return}
 const users=await api('/gestion/usuarios');roster=users.filter(u=>u.rol==='operador'&&(u.modulos||[]).includes(APP));
 el('staffHint').textContent='Personal de '+fields.label+'. Puedes activar o suspender las cuentas ficticias (los turnos se muestran solo como referencia visual).';
 if(!roster.length){box.append(node('p','No hay empleados demo asignados.'));return}
 for(const [i,staff] of roster.entries()){
  const entry=node('article',undefined,'staff-card');const content=node('div');content.append(node('strong',staff.nombre),node('small',staff.correo));const badge=node('span',turnos[i%3],'shift');content.append(badge);
  const btn=node('button',staff.activo?'Desactivar':'Activar','mini');btn.type='button';btn.setAttribute('aria-label',(staff.activo?'Desactivar':'Activar')+' '+staff.nombre);
  btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('/gestion/usuarios/'+staff.id,'PATCH',{rol:'operador',activo:!staff.activo,modulos:staff.modulos});toast('Empleado '+staff.nombre+(staff.activo?' desactivado':' activado'));await load();}catch(e){toast(e.message,true);btn.disabled=false}});
  entry.append(content,btn);box.append(entry);
 }
}
async function renderAudit(){
 const section=el('auditBox');section.hidden=profile.usuario.rol!=='administrador';if(section.hidden)return;
 const data=await api('/gestion/auditoria');const body=el('auditRows');body.replaceChildren();
 const scoped=data.filter(x=>x.modulo===APP).slice(0,12);
 for(const x of scoped){const tr=document.createElement('tr');tr.append(node('td',dateString(x.creado_en)),node('td',x.accion),node('td',x.actor),node('td',x.entidad_id||'—'));body.append(tr)}
 if(!scoped.length){const tr=document.createElement('tr'),td=node('td','Sin eventos de auditoría para este módulo.');td.colSpan=4;tr.append(td);body.append(tr)}
}
function calculateFare(){if(APP!=='metrobus')return;const f=el('recordForm');let amount=Number(f.elements.namedItem('monto_recarga')?.value||0);if(!Number.isFinite(amount))amount=0;let card=f.elements.namedItem('tarjeta_nueva')?.checked?(f.elements.namedItem('pase_universitario')?.checked?2.25:4.5):0;el('fareEstimate').textContent='S/ '+(amount+card).toFixed(2)}
function clock(){if(APP!=='crm')return;const now=new Date();const formatter=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});const parts=formatter.formatToParts(now),h=Number(parts.find(p=>p.type==='hour').value)%24;el('limaClock').textContent=formatter.format(now);const shift=h>=6&&h<14?'dia':h>=14&&h<22?'tarde':'noche';el('turnoActual').textContent='Turno orientativo: '+{dia:'Día',tarde:'Tarde',noche:'Noche'}[shift];document.querySelectorAll('.shift-seg').forEach(n=>n.classList.toggle('active',n.dataset.shift===shift))}
function exportCSV(){
 const rows=casos.filter(r=>el('stateFilter').value==='todos'||r.estado===el('stateFilter').value);
 const header=['Código','Estado','Autor','Fecha',...fields.fields];const csvCell=x=>{let s=String(x??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 const lines=[header.map(csvCell).join(',')];for(const r of rows)lines.push([r.codigo,r.estado,r.autor,dateString(r.creado_en),...fields.fields.map(k=>valueOf(r,k))].map(csvCell).join(','));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='portal360-'+APP+'-casos.csv';a.click();URL.revokeObjectURL(url);
}
el('loginForm').addEventListener('submit',async e=>{e.preventDefault();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{const f=new FormData(e.target);const r=await api('/auth/login','POST',{correo:f.get('correo'),contrasena:f.get('contrasena')});session=r;sessionStorage.setItem('portal_session',JSON.stringify(r));sessionStorage.setItem('usuario',JSON.stringify(r.usuario));await load();toast('Bienvenido a tu panel propio. Los datos provienen de Neon.');}catch(err){toast(err.message,true);el('workspace').hidden=true;el('loginGate').hidden=false}finally{submit.disabled=false}});
el('recordForm').addEventListener('submit',saveForm);
el('cancelEdit').addEventListener('click',cancelEdit);
el('logout').addEventListener('click',logout);
el('reload').addEventListener('click',()=>load().catch(e=>toast(e.message,true)));
el('stateFilter').addEventListener('change',renderCases);el('search').addEventListener('input',renderCases);
el('exportCSV').addEventListener('click',exportCSV);
if(APP==='metrobus'){el('recordForm').addEventListener('input',calculateFare);calculateFare()}
if(APP==='crm'){clock();setInterval(clock,1000)}
if(session?.token)load().catch(e=>{toast('Necesitas volver a iniciar sesión o verificar tu módulo: '+e.message,true);el('loginGate').hidden=false;el('workspace').hidden=true;session=null;sessionStorage.removeItem('portal_session')});
