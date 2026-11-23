import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL || !process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < 32) {
  throw new Error('Configure DATABASE_URL y TOKEN_SECRET (32 caracteres mínimo) en backend/.env');
}
const sql = neon(process.env.DATABASE_URL);
const app = express();
app.disable('x-powered-by');
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
const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
app.use(express.static(publicDir));
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
 const user=match?readToken(match[1]):null;
 if(!user||!Number.isSafeInteger(user.id))return res.status(401).json({error:'Inicia sesión para continuar'});
 req.user=user;next();
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
 const [u]=await sql`SELECT id,nombre,correo,rol,password_hash FROM portal_usuarios WHERE correo=${correo}`;
 if(!u||!passwordMatches(pwd,u.password_hash))return res.status(401).json({error:'Credenciales incorrectas'});
 res.json({usuario:{id:u.id,nombre:u.nombre,correo:u.correo,rol:u.rol},token:sign({id:Number(u.id),rol:u.rol,nombre:u.nombre})});
}));
app.get('/api/registros',auth,wrap(async(req,res)=>{
 const modulo=String(req.query.modulo||'');if(!modules.has(modulo))return res.status(400).json({error:'Módulo inválido'});
 const rows=req.user.rol==='cliente'
 ?await sql`SELECT id,modulo,titulo,detalle,estado,creado_en FROM portal_registros WHERE modulo=${modulo} AND usuario_id=${req.user.id} ORDER BY creado_en DESC LIMIT 100`
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
 const [row]=await sql`UPDATE portal_registros SET estado=${estado},actualizado_en=NOW() WHERE id=${id} RETURNING id,estado`;
 if(!row)return res.status(404).json({error:'Registro no encontrado'});res.json(row);
}));
app.get('*',(req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.listen(process.env.PORT||4000,()=>console.log(`Portal disponible en http://localhost:${process.env.PORT||4000}`));
