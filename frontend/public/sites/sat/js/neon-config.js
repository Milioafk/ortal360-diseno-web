// Compatibilidad segura Portal360 para operaciones principales del sitio original.
// No contiene credenciales PostgreSQL: usa la API Node.js hospedada en Render.
const MODULO='sat';
const URL='https://portal360-api.onrender.com/api';
function token(){try{return JSON.parse(sessionStorage.getItem('portal_session')||'null')?.token||''}catch{return ''}}
async function api(path,method='GET',data){
 const response=await fetch(URL+path,{method,headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'HTTP '+response.status);
 return body;
}
function authSave(response){sessionStorage.setItem('portal_session',JSON.stringify(response));sessionStorage.setItem('usuario',JSON.stringify(response.usuario));}
function mapRecord(r){
 const d=r.datos||{};
 return {...d,id:r.id,id_usuario:JSON.parse(sessionStorage.getItem('usuario')||'null')?.id,codigo_seguimiento:d.codigo_referencia||r.codigo,estado:r.estado,estado_pago:d.estado_pago||'pendiente',monto_calculado:Number(d.monto_calculado||d.monto_recarga||0),fecha_registro:r.creado_en};
}
async function execute(query,values){
 const q=query.replace(/\s+/g,' ').trim().toLowerCase();
 if(q==='select 1'||q==='select 1;'){await api('/health');return [{ok:1}]}
 // Los cuatro módulos comparten una cuenta: las claves únicamente se procesan en Render.
 if(/^insert into usuarios\s*\(/.test(q)){
   const out=await api('/auth/registro','POST',{nombre:values[0],correo:values[1],contrasena:values[2]});authSave(out);
   return [{...out.usuario,turno:null}];
 }
 if(q.includes('from usuarios')&&q.includes('where correo =')&&q.includes('contrasena =')){
   try{const out=await api('/auth/login','POST',{correo:values[0],contrasena:values[1]});authSave(out);return [{...out.usuario,turno:null,hora_inicio:null,hora_fin:null}]}catch(e){if(e.message==='Credenciales incorrectas')return [];throw e}
 }
 if(q.startsWith('select id from usuarios where correo ='))return [];
 if(MODULO==='sat'&&q.includes('insert into reclamos_tributarios')){
   const d={codigo_referencia:values[0],nombre_propietario:values[1],dni:values[2],tipo_impuesto:values[3],motivo:values[4],valor_tasacion:values[5],monto_calculado:values[6],estado_pago:'pendiente'};
   const out=await api('/modulos/sat/items','POST',d);return [{id:out.id}];
 }
 if(MODULO==='metrobus'&&q.includes('insert into recargas_tarjeta')){
   const d={codigo_referencia:values[1],numero_tarjeta:values[2],monto_recarga:values[3],tarjeta_nueva:values[4],pase_universitario:values[5],monto_calculado:values[6],estado_pago:'pendiente'};
   const out=await api('/modulos/metrobus/items','POST',d);return [{id:out.id}];
 }
 if(MODULO==='crm'&&q.includes('insert into solicitudes_demo_crm')){
   const d={codigo_referencia:values[1],nombre:values[2],empresa:values[3],correo_contacto:values[4],num_usuarios:values[5],mensaje:values[6],usuarios_crm:values[7],meses:values[8],modulo_facturacion:values[9],monto_calculado:values[10],estado_pago:'pendiente'};
   const out=await api('/modulos/crm/items','POST',d);return [{id:out.id}];
 }
 if(MODULO==='agua'&&q.includes('insert into reportes_fuga')){
   const d={codigo_referencia:values[0],nombre_vecino:values[1],direccion:values[2],descripcion:values[3],imagen_url:values[4],diametro_pulg:values[6],zona:values[7],monto_calculado:values[8],estado_pago:'pendiente'};
   const out=await api('/modulos/agua/items','POST',d);return [{id:out.id}];
 }
 const table={sat:'reclamos_tributarios',metrobus:'recargas_tarjeta',crm:'solicitudes_demo_crm',agua:'reportes_fuga'}[MODULO];
 // Solo consultas de registros propios, sin acceso a otras tablas ajenas.
 if(q.startsWith('select')&&q.includes('from '+table)&&!q.includes(' join pagos')&&!q.includes(' join usuarios')){
   const rows=await api('/modulos/'+MODULO+'/items');
   return rows.map(mapRecord).filter(r=>{
     if(q.includes(' where ')&&q.includes('id =')&&values.length){const num=values.find(x=>/^\d+$/.test(String(x)));if(num!==undefined&&!q.includes('id_usuario')&&!q.includes('usuario_id')&&r.id!==Number(num))return false}
     return true;
   });
 }
 throw Error('Operación heredada no migrada. Utiliza «Abrir gestión conectada»; pagos, caja y gestión administrativa permanecen deshabilitados.');
}
export function sql(strings,...values){
 if(typeof strings==='string')throw Error('La operación SQL directa no está permitida');
 let query='';for(let i=0;i<strings.length;i++)query+=strings[i]+(i<values.length?'?':'');
 return execute(query,values);
}
sql.transaction=()=>{throw Error('Las transacciones de pago heredadas están deshabilitadas. No se realizan cobros reales')};
sql.query=()=>{throw Error('Las consultas SQL directas están deshabilitadas')};
