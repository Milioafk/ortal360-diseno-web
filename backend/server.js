import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

if (!process.env.DATABASE_URL || !process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < 32) {
  throw new Error('Configure DATABASE_URL y TOKEN_SECRET (32 caracteres mínimo) en backend/.env');
}
const sql = neon(process.env.DATABASE_URL);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render está detrás de un proxy de confianza; evita alertas de express-rate-limit.
app.use(helmet({ contentSecurityPolicy: false })); // CDN Bootstrap en prototipo; fijar CSP antes de producción.
app.use(express.json({ limit: '20kb' }));
// CORS restringido al frontend publicado en Vercel, nunca abierto por defecto.
const allowedOrigins=(process.env.FRONTEND_ORIGIN||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
app.use('/api',(req,res,next)=>{
 const origin=req.headers.origin;
 if(origin && allowedOrigins.includes(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 }
 if(req.method==='OPTIONS') return res.status(origin && allowedOrigins.includes(origin)?204:403).end();
 next();
});

app.use('/api',rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));
const modules=new Set(['sat','metrobus','crm','agua']);
const hashPassword=(pwd,salt=randomBytes(16).toString('hex'))=>`${salt}:${scryptSync(pwd,salt,64).toString('hex')}`;
function passwordMatches(pwd,stored){
  const [salt,hash]=String(stored).split(':');
  if(!salt||!hash||!/^[a-f0-9]{128}$/.test(hash))return false;
  const calculated=scryptSync(pwd,salt,64);
  return timingSafeEqual(calculated,Buffer.from(hash,'hex'));
}
const base64url=(x)=>Buffer.from(JSON.stringify(x)).toString('base64url');
function sign(payload){
 const body=base64url({...payload,exp:Math.floor(Date.now()/1000)+8*60*60});
 const sig=createHmac('sha256',process.env.TOKEN_SECRET).update(body).digest('base64url');
 return `${body}.${sig}`;
}
function readToken(token){
 if(typeof token!=='string')return null;
 const [body,sig,...extra]=token.split('.');
 if(!body||!sig||extra.length)return null;
 const correct=createHmac('sha256',process.env.TOKEN_SECRET).update(body).digest();
 let supplied;try{supplied=Buffer.from(sig,'base64url')}catch{return null}
 if(correct.length!==supplied.length||!timingSafeEqual(correct,supplied))return null;
 try {const p=JSON.parse(Buffer.from(body,'base64url').toString());return Number(p.exp)>Date.now()/1000?p:null}catch{return null}
}
function auth(req,res,next){
 const match=/^Bearer (\S+)$/.exec(req.headers.authorization||'');
 const token=match?readToken(match[1]):null;
 if(!token||!Number.isSafeInteger(token.id))return res.status(401).json({error:'Inicia sesión para continuar'});
 // El token solo identifica: los permisos se consultan de nuevo en Neon en cada solicitud.
 sql`SELECT id,nombre,correo,rol,activo,es_demo FROM portal_usuarios WHERE id=${token.id}`
 .then(([u])=>{
   if(!u||!u.activo)return res.status(401).json({error:'Cuenta inexistente o suspendida'});
   req.user={id:Number(u.id),nombre:u.nombre,correo:u.correo,rol:u.rol,es_demo:u.es_demo};next();
 }).catch(e=>{console.error('Autenticación:',e.message);res.status(503).json({error:'No se pudo verificar la cuenta'});});
}
async function allowedModule(user,modulo){
 if(!modules.has(modulo))return false;
 if(user.rol==='administrador')return true;
 if(user.rol!=='operador')return false;
 const rows=await sql`SELECT 1 FROM portal_staff_modulos WHERE usuario_id=${user.id} AND modulo=${modulo}`;
 return rows.length>0;
}
async function logAudit(actor_id,accion,modulo=null,entidad_id=null,detalles={}){
 try{await sql`INSERT INTO portal_auditoria(actor_id,accion,modulo,entidad_id,detalles)
 VALUES (${actor_id},${accion},${modulo},${entidad_id},${JSON.stringify(detalles)}::jsonb)`}
 catch(e){console.error('Auditoría no guardada:',e.message)}
}
const wrap=f=>(req,res)=>Promise.resolve(f(req,res)).catch(e=>{
 console.error('Error de API:',e.message);
 res.status(500).json({error:'Error al consultar la base de datos. Verifica la configuración del servidor.'});
});
app.get('/api/health',wrap(async(req,res)=>{await sql`SELECT 1`;res.json({ok:true,base:'Neon PostgreSQL',modulos:[...modules]})}));
app.post('/api/auth/registro',wrap(async(req,res)=>{
 const nombre=String(req.body?.nombre||'').trim(), correo=String(req.body?.correo||'').trim().toLowerCase(),pwd=req.body?.contrasena;
 if(nombre.length<2||nombre.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)||typeof pwd!=='string'||pwd.length<10||pwd.length>128)return res.status(400).json({error:'Nombre, correo válido y contraseña de 10 a 128 caracteres requeridos'});
 const [u]=await sql`INSERT INTO portal_usuarios (nombre,correo,password_hash) VALUES (${nombre},${correo},${hashPassword(pwd)}) ON CONFLICT (correo) DO NOTHING RETURNING id,nombre,correo,rol`;
 if(!u)return res.status(409).json({error:'Correo ya registrado'});
 res.status(201).json({usuario:u,token:sign({id:Number(u.id),rol:u.rol,nombre:u.nombre})});
}));
app.post('/api/auth/login',wrap(async(req,res)=>{
 const correo=String(req.body?.correo||'').trim().toLowerCase(),pwd=req.body?.contrasena;
 if(typeof pwd!=='string'||correo.length>180)return res.status(400).json({error:'Datos inválidos'});
 const [u]=await sql`SELECT id,nombre,correo,rol,activo,es_demo,password_hash FROM portal_usuarios WHERE correo=${correo}`;
 if(!u||!u.activo)return res.status(401).json({error:'Credenciales incorrectas o cuenta suspendida'});
 let coincide=false;
 if(/^\$2[aby]\$/.test(u.password_hash)){
   // Cuentas de la práctica: Neon pgcrypto bcrypt; se migran a scrypt al primer acceso.
   const [v]=await sql`SELECT crypt(${pwd},${u.password_hash})=${u.password_hash} AS coincide`;
   coincide=v?.coincide===true;
   if(coincide){await sql`UPDATE portal_usuarios SET password_hash=${hashPassword(pwd)} WHERE id=${u.id} AND password_hash=${u.password_hash}`;}
 }else{coincide=passwordMatches(pwd,u.password_hash)}
 if(!coincide)return res.status(401).json({error:'Credenciales incorrectas'});
 await sql`UPDATE portal_usuarios SET ultimo_acceso=NOW() WHERE id=${u.id}`;
 res.json({usuario:{id:u.id,nombre:u.nombre,correo:u.correo,rol:u.rol,es_demo:u.es_demo},token:sign({id:Number(u.id),rol:u.rol,nombre:u.nombre})});
}));
app.get('/api/registros',auth,wrap(async(req,res)=>{
 const modulo=String(req.query.modulo||'');if(!modules.has(modulo))return res.status(400).json({error:'Módulo inválido'});
 if(req.user.rol==='operador'&&!await allowedModule(req.user,modulo))return res.status(403).json({error:'Empleado sin acceso a este módulo'});
 const rows=req.user.rol==='cliente'
 ?await sql`SELECT id,modulo,titulo,detalle,estado,creado_en FROM portal_registros WHERE modulo=${modulo} AND usuario_id=${req.user.id} ORDER BY creado_en DESC LIMIT 100`
 :req.user.es_demo
 ?await sql`SELECT r.id,r.modulo,r.titulo,r.detalle,r.estado,r.creado_en,u.nombre AS autor FROM portal_registros r JOIN portal_usuarios u ON u.id=r.usuario_id WHERE r.modulo=${modulo} AND u.es_demo=TRUE ORDER BY r.creado_en DESC LIMIT 100`
 :await sql`SELECT r.id,r.modulo,r.titulo,r.detalle,r.estado,r.creado_en,u.nombre AS autor FROM portal_registros r JOIN portal_usuarios u ON u.id=r.usuario_id WHERE r.modulo=${modulo} ORDER BY r.creado_en DESC LIMIT 100`;
 res.json(rows);
}));
app.post('/api/registros',auth,wrap(async(req,res)=>{
 const modulo=String(req.body?.modulo||''),titulo=String(req.body?.titulo||'').trim(),detalle=String(req.body?.detalle||'').trim();
 if(!modules.has(modulo)||titulo.length<3||titulo.length>160||detalle.length<5||detalle.length>4000)return res.status(400).json({error:'Completa módulo, título (3–160) y detalle (5–4000)'});
 const [row]=await sql`INSERT INTO portal_registros (modulo,usuario_id,titulo,detalle) VALUES (${modulo},${req.user.id},${titulo},${detalle}) RETURNING id,modulo,titulo,detalle,estado,creado_en`;
 res.status(201).json(row);
}));
app.patch('/api/registros/:id',auth,wrap(async(req,res)=>{
 if(!['operador','administrador'].includes(req.user.rol))return res.status(403).json({error:'Permisos insuficientes'});
 const id=Number(req.params.id),estado=String(req.body?.estado||'');
 if(!Number.isSafeInteger(id)||id<1||!['registrado','en_revision','atendido'].includes(estado))return res.status(400).json({error:'Datos inválidos'});
 const [current]=await sql`SELECT r.modulo,u.es_demo AS propietario_demo FROM portal_registros r JOIN portal_usuarios u ON u.id=r.usuario_id WHERE r.id=${id}`;
 if(!current)return res.status(404).json({error:'Registro no encontrado'});
 if(req.user.es_demo&&!current.propietario_demo)return res.status(403).json({error:'Cuentas de demostración solo pueden modificar datos ficticios'});
 if(!await allowedModule(req.user,current.modulo))return res.status(403).json({error:'No tienes permiso en ese módulo'});
 const [row]=await sql`UPDATE portal_registros SET estado=${estado},actualizado_en=NOW() WHERE id=${id} RETURNING id,estado`;
 await logAudit(req.user.id,'actualizar_estado_consulta',current.modulo,id,{estado});res.json(row);
}));

// Operaciones de dominios independientes. Todos comparten un PostgreSQL y una identidad.
const domainColumns={
 sat:['nombre_propietario','dni','tipo_impuesto','motivo','valor_tasacion','monto_calculado','codigo_referencia','estado_pago'],
 metrobus:['numero_tarjeta','monto_recarga','tarjeta_nueva','pase_universitario','monto_calculado','codigo_referencia','estado_pago'],
 crm:['nombre','empresa','correo_contacto','num_usuarios','mensaje','modulo_facturacion','usuarios_crm','meses','monto_calculado','codigo_referencia','estado_pago'],
 agua:['nombre_vecino','direccion','descripcion','zona','diametro_pulg','imagen_url','monto_calculado','codigo_referencia','estado_pago']
};
function normalizedDomainData(mod,input){
 const obj={};for(const key of domainColumns[mod]){
   const value=input?.[key];if(typeof value==='boolean'){obj[key]=value;continue;}
   if(value===undefined||value===null||value===''){obj[key]='';continue;}
   if(!['string','number'].includes(typeof value))throw new Error('Dato inválido');
   const s=String(value).trim();if(s.length>2000)throw new Error('Dato demasiado largo');obj[key]=s;
 }
 const mandatory={sat:['nombre_propietario','dni','tipo_impuesto','motivo'],metrobus:['numero_tarjeta','monto_recarga'],crm:['nombre','empresa','correo_contacto','num_usuarios','mensaje'],agua:['nombre_vecino','direccion','descripcion','zona','diametro_pulg']};
 for(const k of mandatory[mod])if(!obj[k])throw new Error('Completa el campo '+k);
 if(mod==='sat'&&!/^\d{8}$/.test(obj.dni))throw new Error('El DNI debe tener 8 dígitos');
 if(mod==='metrobus'&&!/^\d{10}$/.test(obj.numero_tarjeta))throw new Error('La tarjeta debe tener 10 dígitos');
 if(mod==='metrobus'&&!(Number(obj.monto_recarga)>=2&&Number(obj.monto_recarga)<=2000))throw new Error('Monto entre S/2 y S/2000');
 if(mod==='agua'&&!(Number(obj.diametro_pulg)>0&&Number(obj.diametro_pulg)<1000))throw new Error('Diámetro inválido');
 return obj;
}
app.get('/api/modulos/:modulo/items',auth,wrap(async(req,res)=>{
 const modulo=req.params.modulo;if(!modules.has(modulo))return res.status(404).json({error:'Módulo no encontrado'});
 if(req.user.rol==='operador'&&!await allowedModule(req.user,modulo))return res.status(403).json({error:'Empleado sin acceso a este módulo'});
 const items=req.user.rol==='cliente' ? await sql`SELECT id,codigo,datos,estado,creado_en FROM portal_modulo_items WHERE modulo=${modulo} AND usuario_id=${req.user.id} ORDER BY id DESC LIMIT 100`
 :req.user.es_demo ? await sql`SELECT id,codigo,datos,estado,creado_en FROM portal_modulo_items WHERE modulo=${modulo} AND usuario_id IN (SELECT id FROM portal_usuarios WHERE es_demo=TRUE) ORDER BY id DESC LIMIT 100`
 :await sql`SELECT id,codigo,datos,estado,creado_en FROM portal_modulo_items WHERE modulo=${modulo} ORDER BY id DESC LIMIT 100`;
 res.json(items);
}));
app.post('/api/modulos/:modulo/items',auth,wrap(async(req,res)=>{
 const modulo=req.params.modulo;if(!modules.has(modulo))return res.status(404).json({error:'Módulo no encontrado'});
 let datos;try{datos=normalizedDomainData(modulo,req.body)}catch(e){return res.status(400).json({error:e.message})}
 const codigo=`${{sat:'SAT',metrobus:'MB',crm:'CRM',agua:'AG'}[modulo]}-${randomBytes(5).toString('hex').toUpperCase()}`;
 const [item]=await sql`INSERT INTO portal_modulo_items(modulo,usuario_id,codigo,datos) VALUES (${modulo},${req.user.id},${codigo},${JSON.stringify(datos)}::jsonb) RETURNING id,codigo,datos,estado,creado_en`;
 await logAudit(req.user.id,'crear_solicitud',modulo,Number(item.id),{codigo:item.codigo});
 res.status(201).json(item);
}));


// PANEL DE ROLES: permisos reales controlados en el backend (no solo ocultación en HTML).
app.get('/api/auth/me',auth,wrap(async(req,res)=>{
 const modulos=req.user.rol==='administrador'?[...modules]:req.user.rol==='operador'
  ?(await sql`SELECT modulo FROM portal_staff_modulos WHERE usuario_id=${req.user.id} ORDER BY modulo`).map(x=>x.modulo):[];
 res.json({usuario:req.user,modulos});
}));
app.get('/api/gestion/resumen',auth,wrap(async(req,res)=>{
 let summary;
 if(req.user.rol==='administrador'){
   summary=req.user.es_demo
   ?await sql`SELECT modulo,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='registrado')::int AS pendientes,COUNT(*) FILTER(WHERE estado='atendido')::int AS atendidos FROM portal_modulo_items WHERE usuario_id IN (SELECT id FROM portal_usuarios WHERE es_demo=TRUE) GROUP BY modulo ORDER BY modulo`
   :await sql`SELECT modulo,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='registrado')::int AS pendientes,COUNT(*) FILTER(WHERE estado='atendido')::int AS atendidos FROM portal_modulo_items GROUP BY modulo ORDER BY modulo`;
 }else if(req.user.rol==='operador'){
   summary=req.user.es_demo
   ?await sql`SELECT modulo,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='registrado')::int AS pendientes,COUNT(*) FILTER(WHERE estado='atendido')::int AS atendidos FROM portal_modulo_items WHERE modulo IN (SELECT modulo FROM portal_staff_modulos WHERE usuario_id=${req.user.id}) AND usuario_id IN (SELECT id FROM portal_usuarios WHERE es_demo=TRUE) GROUP BY modulo ORDER BY modulo`
   :await sql`SELECT modulo,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='registrado')::int AS pendientes,COUNT(*) FILTER(WHERE estado='atendido')::int AS atendidos FROM portal_modulo_items WHERE modulo IN(SELECT modulo FROM portal_staff_modulos WHERE usuario_id=${req.user.id}) GROUP BY modulo ORDER BY modulo`;
 }else{
   summary=await sql`SELECT modulo,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='registrado')::int AS pendientes,COUNT(*) FILTER(WHERE estado='atendido')::int AS atendidos FROM portal_modulo_items WHERE usuario_id=${req.user.id} GROUP BY modulo ORDER BY modulo`;
 }
 const roles=req.user.rol==='administrador'?await sql`SELECT rol,COUNT(*)::int AS total FROM portal_usuarios WHERE es_demo=TRUE GROUP BY rol ORDER BY rol`:[];
 res.json({modulos:summary,roles});
}));
app.get('/api/gestion/solicitudes',auth,wrap(async(req,res)=>{
 let items;
 if(req.user.rol==='administrador'){
  items=req.user.es_demo
    ?await sql`SELECT x.id,x.modulo,x.codigo,x.datos,x.estado,x.creado_en,x.asignado_a,u.nombre AS autor FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id WHERE u.es_demo=TRUE ORDER BY x.id DESC LIMIT 200`
    :await sql`SELECT x.id,x.modulo,x.codigo,x.datos,x.estado,x.creado_en,x.asignado_a,u.nombre AS autor FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id ORDER BY x.id DESC LIMIT 200`;
 }else if(req.user.rol==='operador'){
  items=req.user.es_demo
    ?await sql`SELECT x.id,x.modulo,x.codigo,x.datos,x.estado,x.creado_en,x.asignado_a,u.nombre AS autor FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id WHERE u.es_demo=TRUE AND x.modulo IN (SELECT modulo FROM portal_staff_modulos WHERE usuario_id=${req.user.id}) ORDER BY x.id DESC LIMIT 200`
    :await sql`SELECT x.id,x.modulo,x.codigo,x.datos,x.estado,x.creado_en,x.asignado_a,u.nombre AS autor FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id WHERE x.modulo IN(SELECT modulo FROM portal_staff_modulos WHERE usuario_id=${req.user.id}) ORDER BY x.id DESC LIMIT 200`;
 }else{
  items=await sql`SELECT x.id,x.modulo,x.codigo,x.datos,x.estado,x.creado_en,x.asignado_a,u.nombre AS autor FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id WHERE x.usuario_id=${req.user.id} ORDER BY x.id DESC LIMIT 200`;
 }
 const modulo=String(req.query.modulo||'todos');
 if(modulo!=='todos'&&!modules.has(modulo))return res.status(400).json({error:'Módulo incorrecto'});
 res.json(modulo==='todos'?items:items.filter(x=>x.modulo===modulo));
}));
app.patch('/api/gestion/solicitudes/:id',auth,wrap(async(req,res)=>{
 if(!['operador','administrador'].includes(req.user.rol))return res.status(403).json({error:'No puedes tramitar solicitudes'});
 const id=Number(req.params.id),estado=String(req.body?.estado||'');
 if(!Number.isSafeInteger(id)||id<1||!['registrado','en_revision','atendido'].includes(estado))return res.status(400).json({error:'Estado o ID inválido'});
 const [old]=await sql`SELECT x.modulo,x.estado,u.es_demo AS propietario_demo FROM portal_modulo_items x JOIN portal_usuarios u ON u.id=x.usuario_id WHERE x.id=${id}`;
 if(!old)return res.status(404).json({error:'Solicitud inexistente'});
 if(req.user.es_demo&&!old.propietario_demo)return res.status(403).json({error:'Solo puedes atender registros ficticios'});
 if(!await allowedModule(req.user,old.modulo))return res.status(403).json({error:'No tienes permiso en este módulo'});
 const [result]=await sql`UPDATE portal_modulo_items SET estado=${estado},asignado_a=${req.user.id},actualizado_en=NOW() WHERE id=${id} RETURNING id,codigo,modulo,estado,asignado_a`;
 await logAudit(req.user.id,'actualizar_estado',old.modulo,id,{anterior:old.estado,nuevo:estado});
 res.json(result);
}));
app.get('/api/gestion/usuarios',auth,wrap(async(req,res)=>{
 if(req.user.rol!=='administrador')return res.status(403).json({error:'Solo administradores'});
 // El panel académico no expone ni edita cuentas que no son de demostración.
 const usuarios=await sql`SELECT u.id,u.nombre,u.correo,u.rol,u.activo,u.es_demo,ARRAY(SELECT sm.modulo FROM portal_staff_modulos sm WHERE sm.usuario_id=u.id ORDER BY sm.modulo) AS modulos FROM portal_usuarios u WHERE u.es_demo=TRUE ORDER BY u.id LIMIT 100`;
 res.json(usuarios);
}));
app.patch('/api/gestion/usuarios/:id',auth,wrap(async(req,res)=>{
 if(req.user.rol!=='administrador')return res.status(403).json({error:'Solo administradores'});
 const id=Number(req.params.id);
 if(!Number.isSafeInteger(id)||id<1||id===req.user.id)return res.status(400).json({error:'Usuario inválido o cuenta propia'});
 const [u]=await sql`SELECT id,rol,activo,es_demo FROM portal_usuarios WHERE id=${id}`;
 if(!u||!u.es_demo)return res.status(404).json({error:'Solo se administran cuentas ficticias'});
 const rol=req.body?.rol===undefined?u.rol:String(req.body.rol);
 const activo=req.body?.activo===undefined?u.activo:req.body.activo;
 const modulos=req.body?.modulos===undefined?[]:req.body.modulos;
 if(!['cliente','operador','administrador'].includes(rol)||typeof activo!=='boolean'||!Array.isArray(modulos)||modulos.length>4||modulos.some(m=>!modules.has(m)))return res.status(400).json({error:'Datos de permisos inválidos'});
 if(rol==='operador'&&modulos.length<1)return res.status(400).json({error:'Asigna al menos un módulo al empleado'});
 await sql`UPDATE portal_usuarios SET rol=${rol},activo=${activo} WHERE id=${id} AND es_demo=TRUE`;
 await sql`DELETE FROM portal_staff_modulos WHERE usuario_id=${id}`;
 if(rol==='operador')for(const modulo of new Set(modulos)){await sql`INSERT INTO portal_staff_modulos(usuario_id,modulo) VALUES (${id},${modulo}) ON CONFLICT DO NOTHING`}
 await logAudit(req.user.id,'actualizar_cuenta_demo',null,id,{rol,activo,modulos:rol==='operador'?modulos:[]});
 res.json({id,rol,activo,modulos:rol==='operador'?[...new Set(modulos)]:[]});
}));
app.get('/api/gestion/auditoria',auth,wrap(async(req,res)=>{
 if(req.user.rol!=='administrador')return res.status(403).json({error:'Solo administradores'});
 const rows=req.user.es_demo
  ?await sql`SELECT a.id,a.accion,a.modulo,a.entidad_id,a.detalles,a.creado_en,COALESCE(u.nombre,'Sistema') AS actor FROM portal_auditoria a LEFT JOIN portal_usuarios u ON u.id=a.actor_id WHERE u.es_demo=TRUE ORDER BY a.id DESC LIMIT 100`
  :await sql`SELECT a.id,a.accion,a.modulo,a.entidad_id,a.detalles,a.creado_en,COALESCE(u.nombre,'Sistema') AS actor FROM portal_auditoria a LEFT JOIN portal_usuarios u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100`;
 res.json(rows);
}));

app.get('/',(req,res)=>res.json({servicio:'Portal360 API',estado:'online',salud:'/api/health',frontend:'https://portal360-web.vercel.app'}));
app.use((req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
app.listen(process.env.PORT||4000,()=>console.log(`Portal disponible en http://localhost:${process.env.PORT||4000}`));
