'use strict';
// Clave PUBLICA del proyecto: nunca incluir service_role ni secretos en GitHub.
const SUPABASE_URL='https://nxdimgzcsjnjjdfdpatp.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_4LbyNm4vT3qBh6v6OIjB4Q_IDb4OpRB';
let client;
const $=id=>document.getElementById(id);
const pages={
 inicio:'Inicio',negocios:'Negocios',suscripciones:'Suscripciones',pagos:'Pagos'
};
function screen(which){$('login').hidden=which!=='login';$('loading').hidden=which!=='loading';$('app').hidden=which!=='app';}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function metric(label,value,extra=''){return `<article class="va-metric"><div class="va-metric-label">${escapeHtml(label)}</div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(extra)}</small></article>`;}
function renderInicio(d){
 const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(d.importe_mes||0));
 $('pageContent').innerHTML=`<div class="va-metrics">
 ${metric('Negocios registrados',d.negocios,'Total en VICORA')}
 ${metric('Suscripciones activas',d.activas,'Con vigencia actual')}
 ${metric('Pruebas gratuitas',d.pruebas,'Dentro del plazo')}
 ${metric('Vencidas',d.vencidas,'Incluye plazos cumplidos')}
 ${metric('Próximos 7 días',d.proximos_7_dias,'Vencimientos por atender')}
 ${metric('Suspendidas',d.suspendidas,'Suspensión administrativa')}
 ${metric('Pagos del mes',d.pagos_mes,'Estados acreditados / confirmados')}
 ${metric('Importe del mes',money,'Pagos registrados en la tabla pagos')}
 </div><section class="panel"><h3>Resumen actualizado</h3><p>Fecha de referencia: ${escapeHtml(d.fecha_consulta)} (Argentina). Los vencimientos se calculan por fecha real, incluso cuando el estado almacenado todavía no se actualizó.</p><button type="button" id="refreshSummary" class="va-refresh">Actualizar datos</button></section>`;
 $('refreshSummary').addEventListener('click',cargarInicio);
}
async function cargarInicio(){
 $('pageContent').innerHTML='<section class="panel"><p>Consultando información real de Supabase…</p></section>';
 const {data,error}=await client.rpc('vicora_admin_resumen');
 if(error){$('pageContent').innerHTML=`<section class="panel"><h3>No se pudo cargar el resumen</h3><p>${escapeHtml(error.message)}</p><p>Verificá que hayas ejecutado el archivo SQL del Paso 2 en Supabase.</p><button type="button" class="va-refresh" id="retrySummary">Reintentar</button></section>`;$('retrySummary').addEventListener('click',cargarInicio);return;}
 renderInicio(data||{});
}

let negociosActuales=[];
function fechaAR(valor){if(!valor)return '—';const [y,m,d]=String(valor).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:String(valor);}
function estadoNegocio(n){const s=n.suscripcion;return s?String(s.estado_vigente||s.estado||'SIN ESTADO'):'SIN SUSCRIPCIÓN';}
function etiquetaEstado(estado){const css=['ACTIVA','PRUEBA'].includes(estado)?'ok':estado==='SUSPENDIDA'?'off':estado==='VENCIDA'?'late':'neutral';return `<span class="va-badge ${css}">${escapeHtml(estado)}</span>`;}
function pintarNegocios(){
 const q=($('busquedaNegocios')?.value||'').trim().toLocaleLowerCase('es');
 const rows=negociosActuales.filter(n=>[n.id_negocio,n.nombre,n.responsable,n.email,n.telefono,estadoNegocio(n)].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));
 $('conteoNegocios').textContent=`Mostrando ${rows.length} de ${negociosActuales.length} negocios`;
 $('tablaNegocios').innerHTML=rows.length?rows.map(n=>{const s=n.suscripcion;return `<tr><td><strong>${escapeHtml(n.nombre)}</strong><small>${escapeHtml(n.id_negocio)}</small></td><td>${escapeHtml(n.responsable||'—')}</td><td>${escapeHtml(n.email||'—')}</td><td>${escapeHtml(s?.plan||'—')}</td><td>${etiquetaEstado(estadoNegocio(n))}</td><td>${fechaAR(s?.vencimiento)}</td><td><button class="va-detail-btn" data-negocio="${escapeHtml(n.id_negocio)}">Ver ficha</button></td></tr>`}).join(''):'<tr><td colspan="7" class="va-empty">No se encontraron negocios.</td></tr>';
 $('tablaNegocios').querySelectorAll('[data-negocio]').forEach(b=>b.addEventListener('click',()=>verFichaNegocio(b.dataset.negocio)));
}
function puedeIniciarPrueba(s){return !!s && ['PENDIENTE','VENCIDA'].includes(s.estado) && !s.fecha_inicio_prueba && !s.fecha_fin_prueba && !s.fecha_inicio_pago && !s.proximo_vencimiento && !s.id_suscripcion_mp;}
function puedeExtenderPrueba(s){return !!s && ['PRUEBA','VENCIDA'].includes(s.estado) && !!s.fecha_inicio_prueba && !!s.fecha_fin_prueba && !s.fecha_inicio_pago && !s.proximo_vencimiento && !s.id_suscripcion_mp;}
function cerrarDialogos(){document.querySelectorAll('.va-overlay').forEach(x=>x.remove());}
function verFichaNegocio(id){
 const n=negociosActuales.find(x=>x.id_negocio===id);if(!n)return;
 const s=n.suscripcion;
 const field=(label,value)=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value??'—')}</strong></div>`;
 cerrarDialogos();
 const dialog=document.createElement('div');dialog.className='va-overlay';
 dialog.innerHTML=`<section class="va-dialog" role="dialog" aria-modal="true" aria-label="Ficha del negocio"><header><h3>${escapeHtml(n.nombre)}</h3><button type="button" class="va-close" aria-label="Cerrar">×</button></header><div class="va-ficha">${field('ID de negocio',n.id_negocio)}${field('Responsable',n.responsable)}${field('Correo electrónico',n.email)}${field('Teléfono',n.telefono)}${field('Estado del negocio',n.estado)}${field('Fecha de alta',fechaAR(n.creado_en))}${field('Sistema',s?.sistema)}${field('Plan',s?.plan)}${field('Estado de suscripción',estadoNegocio(n))}${field('Modalidad de pago',s?.modalidad_pago)}${field('Vencimiento / fin de prueba',fechaAR(s?.vencimiento))}${field('ID de suscripción',s?.id_suscripcion)}</div><div class="va-admin-actions"><h4>Administrar prueba gratuita</h4><p>Los cambios se validan en Supabase y requieren confirmación.</p><div class="va-admin-buttons"><button type="button" id="vaStartTrial" ${puedeIniciarPrueba(s)?'':'disabled'}>Iniciar prueba</button><button type="button" id="vaExtendTrial" ${puedeExtenderPrueba(s)?'':'disabled'}>Extender prueba</button></div><p class="va-admin-help">${!s?'Este negocio no tiene una suscripción para administrar.':(!puedeIniciarPrueba(s)&&!puedeExtenderPrueba(s))?'Las acciones no están disponibles para esta suscripción según su estado e historial.':'Duración permitida: de 1 a 30 días. La fecha de fin es exclusiva.'}</p></div><footer>Las operaciones requieren permisos administrativos.</footer></section>`;
 dialog.querySelector('.va-close').addEventListener('click',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
 dialog.querySelector('#vaStartTrial').addEventListener('click',()=>pedirDiasPrueba(n,'iniciar'));
 dialog.querySelector('#vaExtendTrial').addEventListener('click',()=>pedirDiasPrueba(n,'extender'));
 document.body.append(dialog);dialog.querySelector('.va-close').focus();
}
function pedirDiasPrueba(n,accion){
 const s=n.suscripcion;if(!s?.id_suscripcion)return;
 cerrarDialogos();
 const dialog=document.createElement('div');dialog.className='va-overlay';
 const titulo=accion==='iniciar'?'Iniciar prueba gratuita':'Extender prueba gratuita';
 dialog.innerHTML=`<section class="va-dialog va-confirm" role="dialog" aria-modal="true" aria-label="${titulo}"><header><h3>${titulo}</h3><button class="va-close" type="button" aria-label="Cerrar">×</button></header><p class="va-admin-intro">Negocio: <strong>${escapeHtml(n.nombre)}</strong></p><label class="va-days-label" for="vaTrialDays">Cantidad de días (1 a 30)</label><input id="vaTrialDays" type="number" min="1" max="30" step="1" value="${accion==='iniciar'?7:7}" required><p class="va-admin-help">${accion==='extender'?'La extensión se calcula desde la fecha de vencimiento o desde hoy, la que sea posterior.':'La prueba empieza hoy. El día de vencimiento ya no se considera vigente.'}</p><p id="vaTrialError" class="va-trial-error" role="alert"></p><div class="va-admin-buttons"><button type="button" class="va-cancel">Cancelar</button><button type="button" class="va-accept">Confirmar operación</button></div></section>`;
 dialog.querySelector('.va-close').addEventListener('click',()=>dialog.remove());dialog.querySelector('.va-cancel').addEventListener('click',()=>dialog.remove());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
 dialog.querySelector('.va-accept').addEventListener('click',async()=>{
  const dias=Number(dialog.querySelector('#vaTrialDays').value);
  if(!Number.isInteger(dias)||dias<1||dias>30){dialog.querySelector('#vaTrialError').textContent='Ingresá un número entero de 1 a 30.';return;}
  const boton=dialog.querySelector('.va-accept');boton.disabled=true;boton.textContent='Guardando…';dialog.querySelector('#vaTrialError').textContent='';
  try{
   const funcion=accion==='iniciar'?'vicora_admin_iniciar_prueba':'vicora_admin_extender_prueba';
   const {data,error}=await client.rpc(funcion,{p_id_suscripcion:s.id_suscripcion,p_dias:dias});
   if(error)throw error;
   if(data?.ok!==true)throw Error('Supabase no confirmó la operación.');
   dialog.remove();await cargarNegocios();
   const notice=document.createElement('div');notice.className='va-success-message';notice.setAttribute('role','status');notice.textContent=`${titulo} realizada correctamente. Datos actualizados.`;
   $('pageContent').prepend(notice);setTimeout(()=>notice.remove(),6500);
  }catch(err){dialog.querySelector('#vaTrialError').textContent=err.message||String(err);boton.disabled=false;boton.textContent='Confirmar operación';}
 });
 document.body.append(dialog);dialog.querySelector('#vaTrialDays').focus();dialog.querySelector('#vaTrialDays').select();
}
async function cargarNegocios(){
 $('pageContent').innerHTML='<section class="panel"><p>Cargando negocios desde Supabase…</p></section>';
 const {data,error}=await client.rpc('vicora_admin_negocios');
 if(error){$('pageContent').innerHTML=`<section class="panel"><h3>No se pudo cargar Negocios</h3><p>${escapeHtml(error.message)}</p><p>Verificá que el SQL del Paso 3 se haya ejecutado correctamente.</p><button type="button" class="va-refresh" id="reintentarNegocios">Reintentar</button></section>`;$('reintentarNegocios').addEventListener('click',cargarNegocios);return;}
 negociosActuales=Array.isArray(data)?data:[];
 $('pageContent').innerHTML=`<section class="va-business"><div class="va-business-head"><div><h3>Negocios registrados</h3><p>Información real de VICORA. Sin cambios en los datos.</p></div><button class="va-refresh" id="actualizarNegocios">Actualizar</button></div><input id="busquedaNegocios" type="search" placeholder="Buscar negocio, responsable, correo o estado…" aria-label="Buscar negocios"><p id="conteoNegocios" class="va-count"></p><div class="va-table-scroll"><table class="va-table"><thead><tr><th>Negocio</th><th>Responsable</th><th>Correo</th><th>Plan</th><th>Suscripción</th><th>Vencimiento</th><th>Acciones</th></tr></thead><tbody id="tablaNegocios"></tbody></table></div></section>`;
 $('busquedaNegocios').addEventListener('input',pintarNegocios);$('actualizarNegocios').addEventListener('click',cargarNegocios);pintarNegocios();
}

function showPage(key){key=pages[key]?key:'inicio';$('pageTitle').textContent=pages[key];document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===key));if(key==='inicio'){cargarInicio();return;}if(key==='negocios'){cargarNegocios();return;}
 const descriptions={negocios:'Próxima etapa: listado de negocios y suscripciones, con operaciones administrativas seguras.',suscripciones:'Próxima etapa: planes, precios, renovaciones y suspensiones.',pagos:'Próxima etapa: historial detallado de pagos y filtros.'};
 $('pageContent').innerHTML=`<section class="panel"><span class="status">Acceso verificado</span><h3>${escapeHtml(pages[key])}</h3><p>${escapeHtml(descriptions[key])}</p></section>`;
}
async function verifyAccess(){screen('loading');try{const {data:{session},error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;if(!session){screen('login');return;}const {data,error}=await client.rpc('vicora_es_admin');if(error)throw error;if(data!==true){await client.auth.signOut();screen('login');$('loginMessage').textContent='Esta cuenta no tiene autorización para ingresar a VICORA ADMIN.';return;}$('adminEmail').textContent=session.user.email||'Administrador';screen('app');showPage('inicio');}catch(err){screen('login');$('loginMessage').textContent='No se pudo verificar el permiso administrativo: '+(err.message||String(err));}}
async function login(ev){ev.preventDefault();$('loginMessage').textContent='';$('loginButton').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await verifyAccess();}catch(err){$('loginMessage').textContent='No se pudo iniciar sesión: '+(err.message||String(err));}finally{$('loginButton').disabled=false;}}
async function logout(){await client.auth.signOut();$('password').value='';$('loginMessage').textContent='';screen('login');}
window.addEventListener('DOMContentLoaded',async()=>{try{if(!window.supabase?.createClient)throw Error('No se pudo cargar la biblioteca de Supabase.');client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce',storageKey:'vicora-admin-auth'}});$('loginForm').addEventListener('submit',login);$('logoutButton').addEventListener('click',logout);document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));await verifyAccess();}catch(err){screen('login');$('loginMessage').textContent=err.message||String(err);}});
