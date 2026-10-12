'use strict';
// Solo se utiliza la clave pública de Supabase. Nunca incluir service_role ni secretos aquí.
const SUPABASE_URL='https://nxdimgzcsjnjjdfdpatp.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_4LbyNm4vT3qBh6v6OIjB4Q_IDb4OpRB';
let client;
const $=id=>document.getElementById(id);
const pages={
  inicio:['Inicio','<h3>Acceso administrativo autorizado</h3><p>La autenticación y la comprobación de propietario están funcionando. En la siguiente etapa conectaremos el resumen real de negocios, suscripciones, vencimientos y pagos mediante una función segura de Supabase.</p>'],
  negocios:['Negocios','<h3>Negocios</h3><p>Próximamente: listado y gestión de pruebas y suscripciones. Las consultas se realizarán exclusivamente mediante funciones administrativas autorizadas.</p>'],
  suscripciones:['Suscripciones','<h3>Suscripciones</h3><p>Próximamente: planes, precios, renovaciones y suspensiones con validación del servidor.</p>'],
  pagos:['Pagos','<h3>Pagos</h3><p>Próximamente: historial de pagos manuales e integración segura con Mercado Pago.</p>']
};
function screen(which){$('login').hidden=which!=='login';$('loading').hidden=which!=='loading';$('app').hidden=which!=='app';}
function showPage(key){const p=pages[key]||pages.inicio;$('pageTitle').textContent=p[0];$('pageContent').innerHTML='<section class="panel"><span class="status">Acceso verificado</span>'+p[1]+'</section>';document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===key));}
async function verifyAccess(){screen('loading');try{const {data:{session},error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;if(!session){screen('login');return;}const {data,error}=await client.rpc('vicora_es_admin');if(error)throw error;if(data!==true){await client.auth.signOut();screen('login');$('loginMessage').textContent='Esta cuenta no tiene autorización para ingresar a VICORA ADMIN.';return;}$('adminEmail').textContent=session.user.email||'Administrador';showPage('inicio');screen('app');}catch(err){screen('login');$('loginMessage').textContent='No se pudo verificar el permiso administrativo: '+(err.message||String(err));}}
async function login(ev){ev.preventDefault();$('loginMessage').textContent='';$('loginButton').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await verifyAccess();}catch(err){$('loginMessage').textContent='No se pudo iniciar sesión: '+(err.message||String(err));}finally{$('loginButton').disabled=false;}}
async function logout(){await client.auth.signOut();$('password').value='';$('loginMessage').textContent='';screen('login');}
window.addEventListener('DOMContentLoaded',async()=>{try{if(!window.supabase?.createClient)throw Error('No se pudo cargar la biblioteca de Supabase.');client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce',storageKey:'vicora-admin-auth'}});$('loginForm').addEventListener('submit',login);$('logoutButton').addEventListener('click',logout);document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));await verifyAccess();}catch(err){screen('login');$('loginMessage').textContent=err.message||String(err);}});
