/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Comportamiento de el registro del veterinario (vet.html). Va después de js/comun.js */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const petId = new URLSearchParams(location.search).get('id') || '';
let codigoOk = '';
let espera = null; // { timer, id, token, hasta }

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$('f-fecha').value = hoy();
$('f-fecha').max = hoy();

const ERRORES = {
  sin_codigo: 'Este paciente no tiene un código activo. Pídele al dueño que genere uno o solicita autorización.',
  incorrecto: 'Código incorrecto.',
  expirado: 'El código venció. Pídele al dueño uno nuevo o solicita autorización.',
  bloqueado: 'Demasiados intentos. Espera 15 minutos.',
  limite: 'Este código ya alcanzó su límite de 5 registros. Pide uno nuevo.',
  datos_invalidos: 'Revisa los datos: fecha (no futura), veterinaria y motivo son obligatorios; la próxima cita no puede ser anterior a la visita.'
};
const ERRORES_SOLICITUD = {
  sin_telegram: 'El dueño no tiene Telegram vinculado. Pídele el código directamente.',
  espera: 'Ya enviaste una solicitud hace un momento. Espera un par de minutos.',
  limite: 'Demasiadas solicitudes. Pídele el código directamente al dueño.',
  no_existe: 'No se encontró la placa. Revisa el enlace.',
  datos_invalidos: 'Escribe tu nombre o el de tu veterinaria.'
};

function msg(texto, ok) {
  const el = $('msg');
  el.textContent = texto;
  el.className = 'msg ' + (ok ? 'ok' : 'error');
}

async function validarCodigo(codigoManual) {
  if (!petId) return msg('Falta el ID de la placa en el enlace (?id=...).', false);
  const cod = (typeof codigoManual === 'string' ? codigoManual : $('codigo').value).trim();
  if (cod.replace(/[^A-Za-z0-9]/g, '').length < 6) return msg('El código tiene 6 caracteres.', false);
  const btn = $('btn-validar'); btn.disabled = true;
  const { data, error } = await sb.rpc('vet_validar_codigo', { p_id: petId, p_codigo: cod });
  btn.disabled = false;
  if (error || !data) return msg('Error de conexión. Intenta de nuevo.', false);
  if (data.estado !== 'ok') return msg(ERRORES[data.estado] || 'No se pudo validar.', false);
  codigoOk = cod;
  $('pac-nombre').textContent = data.mascota || '';
  $('pac-raza').textContent = data.raza ? ' · ' + data.raza : '';
  $('paso-codigo').classList.add('hidden');
  $('paso-espera').classList.add('hidden');
  $('paso-form').classList.remove('hidden');
  $('msg').classList.add('hidden');
}

// ---- Solicitar autorización al dueño (llega a su Telegram) ----
async function solicitarAutorizacion() {
  if (!petId) return msg('Falta el ID de la placa en el enlace (?id=...).', false);
  const nombre = $('vet-nombre').value.trim();
  if (!nombre) return msg(ERRORES_SOLICITUD.datos_invalidos, false);
  $('btn-solicitar').disabled = true;
  const { data, error } = await sb.rpc('solicitar_autorizacion_vet', { p_id: petId, p_vet: nombre });
  $('btn-solicitar').disabled = false;
  if (error || !data) return msg('Error de conexión. Intenta de nuevo.', false);
  if (data.estado !== 'ok') return msg(ERRORES_SOLICITUD[data.estado] || 'No se pudo enviar la solicitud.', false);

  $('f-vet').value = nombre;
  espera = { id: data.solicitud, token: data.token, hasta: Date.now() + 10 * 60 * 1000, timer: null };
  $('paso-codigo').classList.add('hidden');
  $('paso-espera').classList.remove('hidden');
  $('msg').classList.add('hidden');
  consultarSolicitud();
}

// Consulta cada 5 s, solo mientras se espera la respuesta (máx. 10 min)
async function consultarSolicitud() {
  if (!espera) return;
  const { data } = await sb.rpc('estado_solicitud_vet', { p_id: espera.id, p_token: espera.token });
  const estado = data && data.estado;
  if (estado === 'aceptada' && data.codigo) { terminarEspera(); return validarCodigo(data.codigo); }
  if (estado === 'rechazada') { terminarEspera(true); return msg('El dueño rechazó la solicitud.', false); }
  if (estado === 'expirada' || estado === 'no_existe' || Date.now() > espera.hasta) {
    terminarEspera(true); return msg('La solicitud venció sin respuesta. Puedes enviarla de nuevo.', false);
  }
  espera.timer = setTimeout(consultarSolicitud, 5000);
}
function terminarEspera(volver) {
  if (espera && espera.timer) clearTimeout(espera.timer);
  espera = null;
  if (volver) { $('paso-espera').classList.add('hidden'); $('paso-codigo').classList.remove('hidden'); }
}
function cancelarEspera() { terminarEspera(true); $('msg').classList.add('hidden'); }

async function guardarRegistro() {
  const btn = $('btn-guardar'); btn.disabled = true;
  const v = id => $(id).value.trim() || null;
  const { data, error } = await sb.rpc('vet_agregar_registro', {
    p_id: petId, p_codigo: codigoOk,
    p_fecha: v('f-fecha'), p_vet: $('f-vet').value.trim(), p_motivo: $('f-motivo').value.trim(),
    p_diagnostico: v('f-diag'), p_receta: v('f-receta'), p_proxima: v('f-proxima')
  });
  btn.disabled = false;
  if (error || !data) return msg('Error de conexión. Intenta de nuevo.', false);
  if (data.estado !== 'ok') return msg(ERRORES[data.estado] || 'No se pudo guardar.', false);
  msg(`✅ Registro guardado. Te quedan ${data.restantes} con esta autorización.`, true);
  btn.classList.add('ok');   // el botón confirma con un check un momento
  btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Guardado!`;
  setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar en historial`; }, 1800);
  ['f-motivo', 'f-diag', 'f-receta', 'f-proxima'].forEach(id => $(id).value = '');
}

// Onda que nace donde se tocó el botón (se apaga con «reducir movimiento», como todas las animaciones de CSS)
ondaAlTocar('.btn');

// ---- Botones ----
alEnter('codigo', validarCodigo);
alClic('btn-validar', validarCodigo);
alClic('btn-solicitar', solicitarAutorizacion);
alClic('btn-cancelar', cancelarEspera);
alClic('btn-guardar', guardarRegistro);
