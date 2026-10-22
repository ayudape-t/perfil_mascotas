/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Comportamiento de restablecer el PIN (recuperar.html). Va después de js/comun.js */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const token = new URLSearchParams(location.search).get('t') || '';

function error(texto) {
  const el = $('msg');
  el.textContent = texto;
  el.classList.remove('hidden');
}

if (!token) { $('paso-form').classList.add('hidden'); error('Enlace incompleto. Pide uno nuevo al bot de Telegram con /recuperar.'); }

async function cambiarPIN() {
  $('msg').classList.add('hidden');
  const p1 = $('pin1').value.trim(), p2 = $('pin2').value.trim();
  if (!/^[0-9]{4}$/.test(p1)) return error('El PIN debe tener 4 números.');
  if (p1 !== p2) return error('Los PIN no coinciden.');
  if (pinFacil(p1)) return error(MSG_PIN_FACIL);

  $('btn').disabled = true;
  const { data, error: err } = await sb.rpc('canjear_token_pin', { p_token: token, p_nuevo_pin: p1 });
  $('btn').disabled = false;

  if (err || !data) return error('Error de conexión. Intenta de nuevo.');
  if (data.estado === 'token_invalido') {
    return error('El enlace venció o ya fue usado. Escribe /recuperar al bot para recibir uno nuevo.');
  }
  if (data.estado === 'pin_debil') return error(MSG_PIN_FACIL);
  if (data.estado !== 'ok') return error('No se pudo cambiar el PIN.');

  // El enlace llegó al Telegram del dueño: este celular queda como suyo y entra directo
  try {
    if (data.id && data.dispositivo) localStorage.setItem(`disp_${data.id}`, data.dispositivo);
    if (data.id && data.sesion) sessionStorage.setItem(`pin_${data.id}`, data.sesion);
    if (data.id) localStorage.setItem(`dueno_${data.id}`, '1');
  } catch (e) {}
  if (data.id) $('ir-panel').href = `registro.html?id=${encodeURIComponent(data.id)}`;
  else $('ir-panel').classList.add('hidden');
  $('pet-nombre').textContent = data.pet || '';
  $('paso-form').classList.add('hidden');
  $('paso-ok').classList.remove('hidden');
  history.replaceState(null, '', location.pathname); // quita el token de la barra de direcciones
}

// Onda que nace donde se tocó el botón (se apaga con «reducir movimiento», como todas las animaciones de CSS)
ondaAlTocar('.btn');

// ---- Botones ----
alEnter('pin2', cambiarPIN);
alClic('btn', cambiarPIN);
