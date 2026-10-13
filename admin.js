'use strict';
// Clave PUBLICA del proyecto: nunca incluir service_role ni secretos en GitHub.
const SUPABASE_URL='https://nxdimgzcsjnjjdfdpatp.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_4LbyNm4vT3qBh6v6OIjB4Q_IDb4OpRB';
let client;
const $=id=>document.getElementById(id);
const pages={
 inicio:'Inicio',negocios:'Negocios',suscripciones:'Suscripciones',pagos:'Pagos',planes:'Planes y precios'
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
function etiquetaEstado(estado){const css=({ACTIVA:'ok',PRUEBA:'trial',VENCIDA:'late',SUSPENDIDA:'off',PENDIENTE:'neutral'})[String(estado).toUpperCase()]||'neutral';return `<span class="va-badge ${css}">${escapeHtml(estado)}</span>`;}
function pintarNegocios(){
 const q=($('busquedaNegocios')?.value||'').trim().toLocaleLowerCase('es');
 const rows=negociosActuales.filter(n=>[n.id_negocio,n.nombre,n.responsable,n.email,n.telefono,estadoNegocio(n)].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));
 $('conteoNegocios').textContent=`Mostrando ${rows.length} de ${negociosActuales.length} negocios`;
 $('tablaNegocios').innerHTML=rows.length?rows.map(n=>{const s=n.suscripcion;return `<tr><td><strong>${escapeHtml(n.nombre)}</strong><small>${escapeHtml(n.id_negocio)}</small></td><td>${escapeHtml(n.responsable||'—')}</td><td>${escapeHtml(n.email||'—')}</td><td>${escapeHtml(s?.plan||'—')}</td><td>${etiquetaEstado(estadoNegocio(n))}</td><td>${fechaAR(s?.vencimiento)}</td><td><button class="va-detail-btn" data-negocio="${escapeHtml(n.id_negocio)}">Ver ficha</button></td></tr>`}).join(''):'<tr><td colspan="7" class="va-empty">No se encontraron negocios.</td></tr>';
 $('tablaNegocios').querySelectorAll('[data-negocio]').forEach(b=>b.addEventListener('click',()=>verFichaNegocio(b.dataset.negocio)));
}
function puedeIniciarPrueba(s){return !!s && ['PENDIENTE','VENCIDA'].includes(s.estado) && !s.fecha_inicio_prueba && !s.fecha_fin_prueba && !s.fecha_inicio_pago && !s.proximo_vencimiento && !s.id_suscripcion_mp;}
function puedeExtenderPrueba(s){
 if(!s)return false;
 // El RPC de listado puede devolver estado_vigente y vencimiento,
 // sin exponer fecha_inicio_prueba ni fecha_fin_prueba.
 // En ese caso habilitamos la solicitud solo si figura PRUEBA.
 // La función SQL vuelve a comprobar el historial antes de escribir.
 const estado=String(s.estado||s.estado_vigente||'').toUpperCase();
 if(estado==='PRUEBA')return !s.fecha_inicio_pago && !s.proximo_vencimiento && !s.id_suscripcion_mp;
 if(estado==='VENCIDA')return !!s.fecha_inicio_prueba && !!s.fecha_fin_prueba && !s.fecha_inicio_pago && !s.proximo_vencimiento && !s.id_suscripcion_mp;
 return false;
}
function cerrarDialogos(){document.querySelectorAll('.va-overlay').forEach(x=>x.remove());}
function verFichaNegocio(id){
 const n=negociosActuales.find(x=>x.id_negocio===id);if(!n)return;
 const s=n.suscripcion;
 const field=(label,value)=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value??'—')}</strong></div>`;
 cerrarDialogos();
 const dialog=document.createElement('div');dialog.className='va-overlay';
 dialog.innerHTML=`<section class="va-dialog" role="dialog" aria-modal="true" aria-label="Ficha del negocio"><header><h3>${escapeHtml(n.nombre)}</h3><button type="button" class="va-close" aria-label="Cerrar">×</button></header><div class="va-ficha">${field('ID de negocio',n.id_negocio)}${field('Responsable',n.responsable)}${field('Correo electrónico',n.email)}${field('Teléfono',n.telefono)}${field('Estado del negocio',n.estado)}${field('Fecha de alta',fechaAR(n.creado_en))}${field('Sistema',s?.sistema)}${field('Plan',s?.plan)}<div><small>Estado de suscripción</small>${etiquetaEstado(estadoNegocio(n))}</div>${field('Modalidad de pago',s?.modalidad_pago)}${field('Vencimiento / fin de prueba',fechaAR(s?.vencimiento))}${field('ID de suscripción',s?.id_suscripcion)}</div><div class="va-admin-actions"><h4>Administrar prueba gratuita</h4><p>Los cambios se validan en Supabase y requieren confirmación.</p><div class="va-admin-buttons"><button type="button" id="vaStartTrial" ${puedeIniciarPrueba(s)?'':'disabled'}>Iniciar prueba</button><button type="button" id="vaExtendTrial" ${puedeExtenderPrueba(s)?'':'disabled'}>Extender prueba</button></div><p class="va-admin-help">${!s?'Este negocio no tiene una suscripción para administrar.':(!puedeIniciarPrueba(s)&&!puedeExtenderPrueba(s))?'Las acciones no están disponibles para esta suscripción según su estado e historial.':'Duración permitida: de 1 a 30 días. La fecha de fin es exclusiva.'}</p></div><div class="va-admin-actions"><h4>Pagos y renovación</h4><p>Un pago confirmado renueva la suscripción por un mes.</p><div class="va-admin-buttons"><button type="button" id="vaPayManual" ${s?.id_suscripcion && estadoNegocio(n)!=='SUSPENDIDA' ?'':'disabled'}>Registrar pago manual</button></div></div><div class="va-admin-actions"><h4>Estado de la suscripción</h4><p>La suspensión conserva los datos y las fechas de vencimiento. Reactivar no agrega días.</p><div class="va-admin-buttons"><button type="button" id="vaSuspend" ${s?.id_suscripcion && estadoNegocio(n)!=='SUSPENDIDA' && estadoNegocio(n)!=='PENDIENTE' ?'':'disabled'} class="va-danger-btn">Suspender</button><button type="button" id="vaReactivate" ${s?.id_suscripcion && estadoNegocio(n)==='SUSPENDIDA' ?'':'disabled'}>Reactivar</button></div><p class="va-admin-help">La suspensión administrativa no cancela cobros automáticos de Mercado Pago. El acceso comercial debe verificar la suscripción en el servidor.</p></div><footer>Las operaciones requieren permisos administrativos.</footer></section>`;
 dialog.querySelector('.va-close').addEventListener('click',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
 dialog.querySelector('#vaStartTrial').addEventListener('click',()=>pedirDiasPrueba(n,'iniciar'));
 dialog.querySelector('#vaExtendTrial').addEventListener('click',()=>pedirDiasPrueba(n,'extender'));
  dialog.querySelector('#vaPayManual').addEventListener('click',()=>pedirPagoManual(n));
  dialog.querySelector('#vaSuspend').addEventListener('click',()=>confirmarEstadoSuscripcion(n,'suspender'));
  dialog.querySelector('#vaReactivate').addEventListener('click',()=>confirmarEstadoSuscripcion(n,'reactivar'));
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
   dialog.remove();if(document.querySelector('.nav.active')?.dataset.page==='suscripciones'){await cargarSuscripciones();}else{await cargarNegocios();}
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


// PASO 9: tablero de vencimientos (solo lectura, sin modificar suscripciones).
// Reutiliza vicora_admin_negocios y su vencimiento calculado en Supabase.
function fechaHoyArgentina(){
 const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=Object.fromEntries(partes.map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
function diasEntreFechas(fecha,hoy){
 const f=String(fecha||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return null;
 const a=Date.parse(f+'T00:00:00Z'),b=Date.parse(hoy+'T00:00:00Z');
 return Number.isFinite(a)?Math.round((a-b)/86400000):null;
}
function telefonoWhatsapp(telefono){
 let t=String(telefono||'').replace(/\D/g,'');
 if(t.startsWith('00'))t=t.slice(2);
 // Números argentinos: convertir formato nacional a internacional móvil.
 if(t.startsWith('0'))t=t.slice(1);
 if(t.startsWith('54')&&!t.startsWith('549'))t='549'+t.slice(2).replace(/^15/,'');
 if(!t.startsWith('54')&&t.length>=9&&t.length<=11)t='549'+t.replace(/^15/,'');
 return t.length>=11&&t.length<=15?t:'';
}
function pintarVencimientos(){
 const tabla=$('tablaVencimientos');if(!tabla)return;
 const hoy=fechaHoyArgentina();
 const filtro=$('filtroVencimientos')?.value||'TODOS';
 const busqueda=($('buscarVencimientos')?.value||'').trim().toLocaleLowerCase('es');
 const registros=suscripcionesActuales.map(n=>{
  const s=n.suscripcion||{};
  const estado=estadoNegocio(n).toUpperCase();
  const dias=diasEntreFechas(s.vencimiento,hoy);
  let grupo='OTROS';
  if(estado!=='SUSPENDIDA'&&estado!=='PENDIENTE'&&dias!==null){
   if(dias<0)grupo='VENCIDOS';
   else if(dias===0)grupo='HOY';
   else if(dias<=7)grupo='PROXIMOS';
  }
  return {n,s,estado,dias,grupo};
 });
 const cantidad=g=>registros.filter(r=>r.grupo===g).length;
 $('resumenVencimientos').innerHTML=
  `<div class="va-sub-stat"><span>Próximos 7 días</span><strong>${cantidad('PROXIMOS')}</strong></div>`+
  `<div class="va-sub-stat"><span>Vencen hoy</span><strong>${cantidad('HOY')}</strong></div>`+
  `<div class="va-sub-stat"><span>Vencidos</span><strong>${cantidad('VENCIDOS')}</strong></div>`;
 const filtrados=registros.filter(r=>r.grupo!=='OTROS'&&(filtro==='TODOS'||r.grupo===filtro)&&
  [r.n.nombre,r.n.id_negocio,r.n.responsable,r.n.email,r.n.telefono].some(v=>String(v||'').toLocaleLowerCase('es').includes(busqueda)))
  .sort((a,b)=>(a.dias??999999)-(b.dias??999999));
 $('conteoVencimientos').textContent=`Mostrando ${filtrados.length} negocios con vencimiento próximo o vencido`;
 tabla.innerHTML=filtrados.length?filtrados.map(r=>{
  const texto=r.dias<0?`Hace ${Math.abs(r.dias)} día${Math.abs(r.dias)===1?'':'s'}`:
   r.dias===0?'Hoy':r.dias===1?'Mañana':`En ${r.dias} días`;
  const tel=telefonoWhatsapp(r.n.telefono);
  const mensaje=`Hola, ${r.n.responsable||r.n.nombre}. Te contactamos de VICORA por la suscripción de ${r.n.nombre}. `+
   (r.dias<0?`Registramos un vencimiento el ${fechaAR(r.s.vencimiento)}.`:
   `Tu próximo vencimiento es el ${fechaAR(r.s.vencimiento)}.`)+
   ' Si ya realizaste el pago, por favor avisános. ¿Querés que te indiquemos cómo renovar?';
  const link=tel?`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`:'';
  return `<tr><td><strong>${escapeHtml(r.n.nombre)}</strong><small>${escapeHtml(r.n.id_negocio)}</small></td>`+
   `<td>${escapeHtml(r.n.responsable||'—')}</td><td>${fechaAR(r.s.vencimiento)}</td>`+
   `<td>${escapeHtml(texto)}</td><td>${etiquetaEstado(r.estado)}</td><td>`+
   (link?`<a class="va-detail-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:
   '<span title="Falta un teléfono válido">Sin teléfono</span>')+
   `</td></tr>`;
 }).join(''):'<tr><td colspan="6" class="va-empty">No hay vencimientos para este filtro.</td></tr>';
}

// PASO 5: vista de suscripciones. Solo lectura; reutiliza el RPC seguro existente.
let suscripcionesActuales=[];
function pintarSuscripciones(){
 const q=($('busquedaSuscripciones')?.value||'').trim().toLocaleLowerCase('es');
 const filtro=$('filtroSuscripciones')?.value||'TODAS';
 const rows=suscripcionesActuales.filter(n=>{
  const s=n.suscripcion||{};const estado=estadoNegocio(n).toUpperCase();
  return (filtro==='TODAS'||estado===filtro)&&[n.nombre,n.id_negocio,n.responsable,s.plan,s.sistema,s.id_suscripcion,estado].some(v=>String(v||'').toLocaleLowerCase('es').includes(q));
 });
 $('conteoSuscripciones').textContent=`Mostrando ${rows.length} de ${suscripcionesActuales.length} suscripciones del listado actual`;
 $('tablaSuscripciones').innerHTML=rows.length?rows.map(n=>{const s=n.suscripcion;return `<tr><td><strong>${escapeHtml(n.nombre)}</strong><small>${escapeHtml(n.id_negocio)}</small></td><td>${escapeHtml(s.sistema||'—')}</td><td>${escapeHtml(s.plan||'—')}</td><td>${etiquetaEstado(estadoNegocio(n))}</td><td>${fechaAR(s.vencimiento)}</td><td>${escapeHtml(s.modalidad_pago||'—')}</td><td><button type="button" class="va-detail-btn" data-subnegocio="${escapeHtml(n.id_negocio)}">Ver ficha</button></td></tr>`;}).join(''):'<tr><td colspan="7" class="va-empty">No hay suscripciones para este filtro.</td></tr>';
 $('tablaSuscripciones').querySelectorAll('[data-subnegocio]').forEach(b=>b.addEventListener('click',()=>verFichaNegocio(b.dataset.subnegocio)));
}
async function cargarSuscripciones(){
 $('pageContent').innerHTML='<section class="panel"><p>Cargando suscripciones desde Supabase…</p></section>';
 const {data,error}=await client.rpc('vicora_admin_negocios');
 if(error){$('pageContent').innerHTML=`<section class="panel"><h3>No se pudieron cargar las suscripciones</h3><p>${escapeHtml(error.message)}</p><button type="button" class="va-refresh" id="retrySubs">Reintentar</button></section>`;$('retrySubs').addEventListener('click',cargarSuscripciones);return;}
 negociosActuales=Array.isArray(data)?data:[];
 suscripcionesActuales=negociosActuales.filter(n=>n.suscripcion&&n.suscripcion.id_suscripcion);
 const estados=['ACTIVA','PRUEBA','VENCIDA','SUSPENDIDA','PENDIENTE'];
 const counts=Object.fromEntries(estados.map(e=>[e,suscripcionesActuales.filter(n=>estadoNegocio(n).toUpperCase()===e).length]));
 $('pageContent').innerHTML=`<section class="va-business"><div class="va-business-head"><div><h3>Suscripciones</h3><p>Estados y vencimientos consultados en Supabase.</p></div><button type="button" class="va-refresh" id="actualizarSuscripciones">Actualizar</button></div>
 <div class="va-business-head"><div><h3>Control de vencimientos</h3><p>Vencimientos reales según Supabase, con fecha de Argentina. Los contactos por WhatsApp se abren sin enviar mensajes automáticamente.</p></div></div>
  <div id="resumenVencimientos" class="va-sub-summary"></div>
  <div class="va-sub-filters"><input id="buscarVencimientos" type="search" placeholder="Buscar negocio o responsable…" aria-label="Buscar vencimientos"><select id="filtroVencimientos" aria-label="Filtrar vencimientos"><option value="TODOS">Todos los vencimientos</option><option value="PROXIMOS">Próximos 7 días</option><option value="HOY">Vencen hoy</option><option value="VENCIDOS">Vencidos</option></select></div>
  <p id="conteoVencimientos" class="va-count"></p>
  <div class="va-table-scroll"><table class="va-table"><thead><tr><th>Negocio</th><th>Responsable</th><th>Fecha</th><th>Restan</th><th>Estado</th><th>Contacto</th></tr></thead><tbody id="tablaVencimientos"></tbody></table></div>
  <hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb">
  <div class="va-sub-summary">${estados.map(e=>`<div class="va-sub-stat">${etiquetaEstado(e)}<strong>${counts[e]}</strong></div>`).join('')}</div>
 <div class="va-sub-filters"><input id="busquedaSuscripciones" type="search" placeholder="Buscar negocio, plan, sistema o ID…" aria-label="Buscar suscripciones"><select id="filtroSuscripciones" aria-label="Filtrar estado"><option value="TODAS">Todos los estados</option>${estados.map(e=>`<option value="${e}">${e}</option>`).join('')}</select></div>
 <p id="conteoSuscripciones" class="va-count"></p><div class="va-table-scroll"><table class="va-table"><thead><tr><th>Negocio</th><th>Sistema</th><th>Plan</th><th>Estado</th><th>Vencimiento</th><th>Modalidad</th><th>Acciones</th></tr></thead><tbody id="tablaSuscripciones"></tbody></table></div>
 <p class="va-sub-note">Esta primera vista utiliza el listado administrativo existente, que devuelve una suscripción por negocio. Cuando agreguemos otros sistemas a VICORA, ampliaremos la consulta para mostrar todas las suscripciones de cada negocio. Pagos, renovaciones y suspensiones se incorporarán con funciones seguras específicas.</p></section>`;
 $('busquedaSuscripciones').addEventListener('input',pintarSuscripciones);
 $('filtroSuscripciones').addEventListener('change',pintarSuscripciones);
 $('actualizarSuscripciones').addEventListener('click',cargarSuscripciones);
 $('buscarVencimientos').addEventListener('input',pintarVencimientos);
 $('filtroVencimientos').addEventListener('change',pintarVencimientos);
 pintarVencimientos();
 pintarSuscripciones();
}


// PASO 6: registrar pagos mediante función transaccional protegida en Supabase.
function pedirPagoManual(n){
 const s=n.suscripcion;if(!s?.id_suscripcion)return;
 cerrarDialogos();
 const dialog=document.createElement('div');dialog.className='va-overlay';
 dialog.innerHTML=`<section class="va-dialog va-confirm" role="dialog" aria-modal="true" aria-label="Registrar pago manual"><header><h3>Registrar pago manual</h3><button class="va-close" type="button" aria-label="Cerrar">×</button></header>
 <p class="va-admin-intro">Negocio: <strong>${escapeHtml(n.nombre)}</strong></p>
 <p class="va-admin-help">Esta operación registra un pago real y renueva un mes. Verificá el importe antes de confirmar. VICORA generará automáticamente una referencia única.</p>
 <div class="va-pay-form"><label>Importe en pesos (ARS)<input id="vaPayAmount" type="number" min="0.01" step="0.01" required placeholder="Ej.: 15000"></label>
 <label>Medio de pago<select id="vaPayMethod"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="DEPOSITO">Depósito</option><option value="TARJETA">Tarjeta</option><option value="OTRO">Otro</option></select></label>
 <label>Número de comprobante bancario (opcional)<input id="vaPayReference" type="text" maxlength="120" placeholder="Ej.: 00213456"></label><p class="va-admin-help">Referencia VIC-PAG: se genera automáticamente al confirmar y aparece en el historial.</p></div>
 <p id="vaPayError" class="va-trial-error" role="alert"></p><p id="vaPayConfirm" class="va-inline-confirm" hidden></p><div class="va-admin-buttons"><button type="button" class="va-cancel">Cancelar</button><button type="button" class="va-accept">Confirmar pago y renovar</button></div></section>`;
 dialog.querySelector('.va-close').addEventListener('click',()=>dialog.remove());
 dialog.querySelector('.va-cancel').addEventListener('click',()=>dialog.remove());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove();});
  dialog.querySelectorAll('#vaPayAmount,#vaPayMethod,#vaPayReference').forEach(el=>el.addEventListener('input',()=>{
   dialog.querySelector('#vaPayConfirm').hidden=true;
   dialog.querySelector('.va-accept').textContent='Confirmar pago y renovar';
  }));
  dialog.querySelector('.va-accept').addEventListener('click',async()=>{
   const importe=Number(dialog.querySelector('#vaPayAmount').value);
  const metodo=dialog.querySelector('#vaPayMethod').value;
  const referencia=dialog.querySelector('#vaPayReference').value.trim();
  const errorEl=dialog.querySelector('#vaPayError');
  if(!Number.isFinite(importe)||importe<=0||importe>999999999||!/^\d+(\.\d{1,2})?$/.test(String(importe))){errorEl.textContent='Ingresá un importe válido mayor que cero, con hasta 2 decimales.';return;}
   const aviso=dialog.querySelector('#vaPayConfirm');
   if(aviso.hidden){
    aviso.textContent=`Confirmá el pago de $ ${importe.toLocaleString('es-AR')} para ${n.nombre}. Comprobante: ${referencia||"sin comprobante"}. VICORA generará la referencia automáticamente. Se renovará por un mes. Volvé a presionar para confirmar.`;
    aviso.hidden=false;
    dialog.querySelector('.va-accept').textContent='Sí, registrar el pago';
    return;
   }
  const btn=dialog.querySelector('.va-accept');btn.disabled=true;btn.textContent='Registrando…';errorEl.textContent='';
  try{
   const {data,error}=await client.rpc('vicora_admin_registrar_pago_manual',{
    p_id_suscripcion:s.id_suscripcion,p_importe:importe,p_metodo:metodo,p_referencia:referencia,p_fecha_pago:null
   });
   if(error)throw error;
   if(data?.ok!==true)throw Error('Supabase no confirmó el pago.');
   dialog.remove();
   const pagina=document.querySelector('.nav.active')?.dataset.page;
   if(pagina==='suscripciones')await cargarSuscripciones();else if(pagina==='pagos')await cargarPagos();else await cargarNegocios();
   const notice=document.createElement('div');notice.className='va-success-message';notice.setAttribute('role','status');
   notice.textContent=`Pago ${data.referencia||data.id_pago} registrado. Nuevo vencimiento: ${fechaAR(data.proximo_vencimiento)}.`;
   $('pageContent').prepend(notice);
  }catch(err){errorEl.textContent=err.message||String(err);btn.disabled=false;btn.textContent='Confirmar pago y renovar';}
 });
 document.body.append(dialog);dialog.querySelector('#vaPayAmount').focus();
}

async function cargarPagos(){
 $('pageContent').innerHTML='<section class="panel"><p>Cargando historial de pagos…</p></section>';
 const {data,error}=await client.rpc('vicora_admin_historial_pagos');
 if(error){$('pageContent').innerHTML=`<section class="panel"><h3>No se pudo cargar Pagos</h3><p>${escapeHtml(error.message)}</p><p>Primero ejecutá el SQL del Paso 6 en Supabase.</p><button class="va-refresh" id="retryPagos">Reintentar</button></section>`;$('retryPagos').addEventListener('click',cargarPagos);return;}
 const pagos=Array.isArray(data)?data:[];
 $('pageContent').innerHTML=`<section class="va-business"><div class="va-business-head"><div><h3>Historial de pagos</h3><p>Pagos reales registrados en Supabase.</p></div><button class="va-refresh" id="refreshPagos">Actualizar</button></div><input id="searchPagos" type="search" placeholder="Buscar negocio, referencia o medio…" aria-label="Buscar pagos"><p class="va-count" id="countPagos"></p><div class="va-table-scroll"><table class="va-table"><thead><tr><th>Fecha</th><th>Negocio</th><th>Importe</th><th>Medio</th><th>Estado</th><th>Referencia VICORA</th><th>Período</th></tr></thead><tbody id="rowsPagos"></tbody></table></div></section>`;
 const fmt=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
 const pintar=()=>{const q=$('searchPagos').value.trim().toLowerCase();const rows=pagos.filter(p=>[p.negocio,p.id_negocio,p.referencia,p.comprobante_bancario,p.metodo,p.estado].some(v=>String(v||'').toLowerCase().includes(q)));
 $('countPagos').textContent=`Mostrando ${rows.length} de ${pagos.length} pagos`;
 $('rowsPagos').innerHTML=rows.length?rows.map(p=>`<tr><td>${fechaAR(p.fecha_pago)}</td><td>${escapeHtml(p.negocio||p.id_negocio)}</td><td>${escapeHtml(fmt.format(Number(p.importe||0)))}</td><td>${escapeHtml(p.metodo)}</td><td>${etiquetaEstado(p.estado)}</td><td>${escapeHtml(p.referencia||'—')}</td><td>${fechaAR(p.periodo_desde)} a ${fechaAR(p.periodo_hasta)}</td></tr>`).join(''):'<tr><td colspan="7" class="va-empty">Todavía no hay pagos para mostrar.</td></tr>';};
 $('searchPagos').addEventListener('input',pintar);$('refreshPagos').addEventListener('click',cargarPagos);pintar();
}


// PASO 7: notificaciones modernas y acciones administrativas protegidas.
function mostrarAviso(mensaje,tipo='ok'){
 let cont=document.getElementById('vaToastArea');
 if(!cont){cont=document.createElement('div');cont.id='vaToastArea';cont.className='va-toast-area';cont.setAttribute('aria-live','polite');document.body.append(cont);}
 const item=document.createElement('div');item.className='va-toast '+(tipo==='error'?'va-toast-error':'va-toast-ok');
 const texto=document.createElement('span');texto.textContent=mensaje;
 const cerrar=document.createElement('button');cerrar.type='button';cerrar.setAttribute('aria-label','Cerrar notificación');cerrar.textContent='×';cerrar.addEventListener('click',()=>item.remove());
 item.append(texto,cerrar);cont.append(item);setTimeout(()=>item.remove(),6500);
}
function confirmarEstadoSuscripcion(n,accion){
 const s=n.suscripcion;if(!s?.id_suscripcion)return;
 const suspender=accion==='suspender';
 cerrarDialogos();
 const dialog=document.createElement('div');dialog.className='va-overlay';
 const titulo=suspender?'Suspender suscripción':'Reactivar suscripción';
 dialog.innerHTML=`<section class="va-dialog va-confirm" role="dialog" aria-modal="true" aria-label="${titulo}"><header><h3>${titulo}</h3><button type="button" class="va-close" aria-label="Cerrar">×</button></header><p class="va-admin-intro">Negocio: <strong>${escapeHtml(n.nombre)}</strong></p><p class="va-inline-confirm">${suspender?'La suscripción pasará a SUSPENDIDA. No se eliminan datos ni se detienen cobros automáticos del proveedor.':'Se restaurará PRUEBA o ACTIVA solo si aún está vigente; de lo contrario quedará VENCIDA. No se extiende el plazo.'}</p><p class="va-trial-error" id="vaStatusError" role="alert"></p><div class="va-admin-buttons"><button type="button" class="va-cancel">Cancelar</button><button type="button" class="va-accept ${suspender?'va-danger-btn':''}">${suspender?'Sí, suspender':'Sí, reactivar'}</button></div></section>`;
 const close=()=>dialog.remove();
 dialog.querySelector('.va-close').addEventListener('click',close);
 dialog.querySelector('.va-cancel').addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 dialog.querySelector('.va-accept').addEventListener('click',async()=>{
  const btn=dialog.querySelector('.va-accept');btn.disabled=true;btn.textContent='Guardando…';
  try{
   const rpc=suspender?'vicora_admin_suspender':'vicora_admin_reactivar';
   const {data,error}=await client.rpc(rpc,{p_id_suscripcion:s.id_suscripcion});
   if(error)throw error;
   if(data?.ok!==true)throw Error('Supabase no confirmó la operación.');
   close();
   const page=document.querySelector('.nav.active')?.dataset.page;
   if(page==='suscripciones')await cargarSuscripciones();else await cargarNegocios();
   mostrarAviso(`${titulo} completada. Estado: ${data.estado}.`);
  }catch(err){dialog.querySelector('#vaStatusError').textContent=err.message||String(err);btn.disabled=false;btn.textContent=suspender?'Sí, suspender':'Sí, reactivar';}
 });
 document.body.append(dialog);dialog.querySelector('.va-cancel').focus();
}


// PASO 8: planes por sistema. Acceso y escrituras solo mediante RPC de administrador.
let planesActuales=[];
const formatoPrecio=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2});
async function cargarPlanes(){
 $('pageContent').innerHTML='<section class="panel"><p>Cargando sistemas y planes…</p></section>';
 const {data,error}=await client.rpc('vicora_admin_listar_planes');
 if(error){$('pageContent').innerHTML=`<section class="panel"><h3>No se pudieron cargar los planes</h3><p>${escapeHtml(error.message)}</p><p>Ejecutá primero el SQL del Paso 8.</p><button class="va-refresh" id="retryPlanes">Reintentar</button></section>`;$('retryPlanes').addEventListener('click',cargarPlanes);return;}
 const datos=data||{};planesActuales=Array.isArray(datos.planes)?datos.planes:[];
 const sistemas=Array.isArray(datos.sistemas)?datos.sistemas:[];
 $('pageContent').innerHTML=`<section class="va-business"><div class="va-business-head"><div><h3>Planes y precios</h3><p>Cada sistema tiene sus propios planes. Los cambios se guardan en Supabase.</p></div><button class="va-refresh" id="refreshPlanes">Actualizar</button></div><div class="va-admin-buttons"><button type="button" class="va-refresh" id="crearPlan">+ Nuevo plan</button></div><div class="va-table-scroll"><table class="va-table"><thead><tr><th>Sistema</th><th>Plan</th><th>Precio mensual</th><th>Prueba</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rowsPlanes"></tbody></table></div><p class="va-sub-note">Modificar un precio no altera los pagos ya registrados. La tarifa publicada debe coincidir con la que comunicás a tus clientes.</p></section>`;
 $('refreshPlanes').addEventListener('click',cargarPlanes);
 $('crearPlan').addEventListener('click',()=>editarPlan(null,sistemas));
 $('rowsPlanes').innerHTML=planesActuales.length?planesActuales.map(p=>`<tr><td>${escapeHtml(p.sistema)}</td><td><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(p.id_plan)}</small></td><td>${escapeHtml(formatoPrecio.format(Number(p.precio_mensual||0)))}</td><td>${escapeHtml(p.dias_prueba)} días</td><td>${etiquetaEstado(p.estado==='ACTIVO'?'ACTIVA':'SUSPENDIDA')}</td><td><button type="button" class="va-detail-btn" data-plan="${escapeHtml(p.id_plan)}">Editar</button></td></tr>`).join(''):'<tr><td colspan="6" class="va-empty">No hay planes registrados.</td></tr>';
 $('rowsPlanes').querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>editarPlan(planesActuales.find(p=>p.id_plan===b.dataset.plan),sistemas)));
}
function editarPlan(plan,sistemas){
 cerrarDialogos();
 const esNuevo=!plan;
 const dialog=document.createElement('div');dialog.className='va-overlay';
 const opts=sistemas.map(s=>`<option value="${escapeHtml(s.id_sistema)}" ${s.id_sistema===plan?.id_sistema?'selected':''}>${escapeHtml(s.nombre)}</option>`).join('');
 dialog.innerHTML=`<section class="va-dialog va-confirm" role="dialog" aria-modal="true" aria-label="${esNuevo?'Nuevo plan':'Editar plan'}"><header><h3>${esNuevo?'Crear plan':'Editar plan'}</h3><button type="button" class="va-close">×</button></header><div class="va-pay-form"><label>Sistema<select id="pSistema" ${esNuevo?'':'disabled'}>${opts}</select></label><label>Nombre del plan<input id="pNombre" maxlength="80" value="${escapeHtml(plan?.nombre||'')}" placeholder="Ej.: Plan mensual"></label><label>Precio mensual (ARS)<input id="pPrecio" type="number" min="0" step="0.01" value="${escapeHtml(plan?.precio_mensual??20000)}"></label><label>Días de prueba gratuita<input id="pPrueba" type="number" min="0" max="365" step="1" value="${escapeHtml(plan?.dias_prueba??7)}"></label><label>Estado<select id="pEstado"><option value="ACTIVO" ${plan?.estado!=='INACTIVO'?'selected':''}>Activo</option><option value="INACTIVO" ${plan?.estado==='INACTIVO'?'selected':''}>Inactivo</option></select></label></div><p class="va-admin-help">Período de facturación: mensual. Los planes inactivos se conservan para mantener el historial.</p><p id="pError" class="va-trial-error" role="alert"></p><div class="va-admin-buttons"><button type="button" class="va-cancel">Cancelar</button><button type="button" class="va-accept">Guardar plan</button></div></section>`;
 dialog.querySelector('.va-close').onclick=()=>dialog.remove();dialog.querySelector('.va-cancel').onclick=()=>dialog.remove();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.remove()});
 dialog.querySelector('.va-accept').addEventListener('click',async()=>{
  const nombre=dialog.querySelector('#pNombre').value.trim(),precio=Number(dialog.querySelector('#pPrecio').value),dias=Number(dialog.querySelector('#pPrueba').value),estado=dialog.querySelector('#pEstado').value,sistema=dialog.querySelector('#pSistema').value;
  const err=dialog.querySelector('#pError');
  if(!sistema||!nombre||nombre.length>80||!Number.isFinite(precio)||precio<0||precio>999999999||!Number.isInteger(dias)||dias<0||dias>365){err.textContent='Revisá el sistema, el nombre, el precio y los días de prueba.';return;}
  const b=dialog.querySelector('.va-accept');b.disabled=true;b.textContent='Guardando…';err.textContent='';
  try{const {data,error}=await client.rpc('vicora_admin_guardar_plan',{p_id_plan:plan?.id_plan||null,p_id_sistema:sistema,p_nombre:nombre,p_precio_mensual:precio,p_dias_prueba:dias,p_estado:estado});if(error)throw error;if(data?.ok!==true)throw Error('Supabase no confirmó la operación.');dialog.remove();await cargarPlanes();mostrarAviso('Plan guardado correctamente.');}
  catch(e){err.textContent=e.message||String(e);b.disabled=false;b.textContent='Guardar plan';}
 });
 document.body.append(dialog);dialog.querySelector('#pNombre').focus();
}

function showPage(key){key=pages[key]?key:'inicio';$('pageTitle').textContent=pages[key];document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===key));if(key==='inicio'){cargarInicio();return;}if(key==='negocios'){cargarNegocios();return;}if(key==='suscripciones'){cargarSuscripciones();return;}if(key==='pagos'){cargarPagos();return;}if(key==='planes'){cargarPlanes();return;}
 const descriptions={negocios:'Próxima etapa: listado de negocios y suscripciones, con operaciones administrativas seguras.',suscripciones:'Próxima etapa: planes, precios, renovaciones y suspensiones.',pagos:'Próxima etapa: historial detallado de pagos y filtros.'};
 $('pageContent').innerHTML=`<section class="panel"><span class="status">Acceso verificado</span><h3>${escapeHtml(pages[key])}</h3><p>${escapeHtml(descriptions[key])}</p></section>`;
}
async function verifyAccess(){screen('loading');try{const {data:{session},error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;if(!session){screen('login');return;}const {data,error}=await client.rpc('vicora_es_admin');if(error)throw error;if(data!==true){await client.auth.signOut();screen('login');$('loginMessage').textContent='Esta cuenta no tiene autorización para ingresar a VICORA ADMIN.';return;}$('adminEmail').textContent=session.user.email||'Administrador';screen('app');showPage('inicio');}catch(err){screen('login');$('loginMessage').textContent='No se pudo verificar el permiso administrativo: '+(err.message||String(err));}}
async function login(ev){ev.preventDefault();$('loginMessage').textContent='';$('loginButton').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await verifyAccess();}catch(err){$('loginMessage').textContent='No se pudo iniciar sesión: '+(err.message||String(err));}finally{$('loginButton').disabled=false;}}
async function logout(){await client.auth.signOut();$('password').value='';$('loginMessage').textContent='';screen('login');}
window.addEventListener('DOMContentLoaded',async()=>{try{if(!window.supabase?.createClient)throw Error('No se pudo cargar la biblioteca de Supabase.');client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce',storageKey:'vicora-admin-auth'}});$('loginForm').addEventListener('submit',login);$('logoutButton').addEventListener('click',logout);document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));await verifyAccess();}catch(err){screen('login');$('loginMessage').textContent=err.message||String(err);}});