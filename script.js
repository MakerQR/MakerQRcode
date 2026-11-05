const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const canvas = $('#qrCanvas');
const placeholder = $('#qrPlaceholder');

const DEFAULTS = {
  type: 'text',
  text: '', url: '', image: '',
  wifi: { ssid: '', pass: '', enc: 'WPA', hidden: false },
  dot: '#000000', bg: '#ffffff',
  size: 512, ecc: 'M', margin: 2
};

let state = loadState() || structuredClone(DEFAULTS);
let lastPayload = null;

/* ---------- Хранилище ---------- */
function loadState(){ try { return JSON.parse(localStorage.getItem('qr_state')); } catch { return null; } }
function saveState(){ localStorage.setItem('qr_state', JSON.stringify(state)); }
function loadHistory(){ try { return JSON.parse(localStorage.getItem('qr_history')) || []; } catch { return []; } }
function saveHistory(h){ localStorage.setItem('qr_history', JSON.stringify(h)); }

/* ---------- Синхронизация UI со state ---------- */
function syncUI(){
  $$('#typeTabs button').forEach(b => b.classList.toggle('active', b.dataset.type === state.type));
  $$('.field').forEach(f => f.classList.toggle('hidden', f.dataset.field !== state.type));

  $('#fieldText').value = state.text;
  $('#fieldUrl').value = state.url;
  $('#fieldImage').value = state.image;
  $('#wifiSsid').value = state.wifi.ssid;
  $('#wifiPass').value = state.wifi.pass;
  $('#wifiEnc').value = state.wifi.enc;
  $('#wifiHidden').checked = state.wifi.hidden;

  $('#dotColor').value = state.dot;
  $('#bgColor').value = state.bg;
  $('#size').value = state.size;
  $('#sizeVal').textContent = state.size;
  $('#ecc').value = state.ecc;
  $('#margin').value = state.margin;
}

/* ---------- Сбор содержимого ---------- */
function buildPayload(){
  switch (state.type) {
    case 'text':  return state.text.trim();
    case 'url': {
      let u = state.url.trim();
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      return u;
    }
    case 'image': return state.image.trim();
    case 'wifi': {
      const w = state.wifi;
      if (!w.ssid.trim()) return '';
      return `WIFI:T:${w.enc};S:${w.ssid};P:${w.pass}${w.hidden ? ';H:true' : ''};;`;
    }
  }
}

/* ---------- Генерация ---------- */
$('#generateBtn').addEventListener('click', () => {
  const payload = buildPayload();
  if (!payload) return toast('Сначала заполните содержимое кода', true);

  QRCode.toCanvas(canvas, payload, {
    width: state.size,
    margin: state.margin,
    errorCorrectionLevel: state.ecc,
    color: { dark: state.dot, light: state.bg }
  }, err => {
    if (err) return toast('Не удалось создать код: ' + err.message, true);
    lastPayload = payload;
    placeholder.classList.add('hidden');
    saveState();
    addHistory(payload);
    toast('QR-код сгенерирован');
  });
});

/* ---------- История ---------- */
function makeThumb(){
  const t = document.createElement('canvas');
  t.width = t.height = 96;
  t.getContext('2d').drawImage(canvas, 0, 0, 96, 96);
  return t.toDataURL('image/png');
}

function addHistory(payload){
  let h = loadHistory();
  h.unshift({
    id: Date.now(),
    payload,
    settings: structuredClone(state),
    thumb: makeThumb(),
    date: new Date().toLocaleString('ru-RU')
  });
  saveHistory(h.slice(0, 12));
}

function renderHistory(){
  const list = $('#historyList');
  const h = loadHistory();
  if (!h.length) {
    list.innerHTML = '<div class="empty">Пока пусто — сгенерируйте первый код</div>';
    return;
  }
  list.innerHTML = '';
  h.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <img src="${item.thumb}" alt="">
      <div class="info">
        <b>${escapeHtml(item.payload.slice(0, 60))}${item.payload.length > 60 ? '…' : ''}</b>
        <span>${item.date} · ${item.settings.size}px · ${item.settings.ecc}</span>
      </div>`;
    el.addEventListener('click', () => {
      state = structuredClone(item.settings);
      lastPayload = item.payload;
      syncUI();
      saveState();
      generateFromState();
      closeModal('historyModal');
    });
    list.appendChild(el);
  });
}

function generateFromState(){
  QRCode.toCanvas(canvas, lastPayload, {
    width: state.size, margin: state.margin,
    errorCorrectionLevel: state.ecc,
    color: { dark: state.dot, light: state.bg }
  }, () => placeholder.classList.add('hidden'));
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

$('#historyBtn').addEventListener('click', () => {
  renderHistory();
  openModal('historyModal');
});
$('#clearHistory').addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
  toast('История очищена');
});

/* ---------- Сохранение в форматах ---------- */
const formatMenu = $('#formatMenu');
$('#saveBtn').addEventListener('click', e => {
  e.stopPropagation();
  if (!lastPayload) return toast('Сначала сгенерируйте код', true);
  formatMenu.classList.toggle('hidden');
});
document.addEventListener('click', e => {
  if (!formatMenu.contains(e.target)) formatMenu.classList.add('hidden');
});
formatMenu.addEventListener('click', e => {
  const btn = e.target.closest('button[data-fmt]');
  if (!btn) return;
  const fmt = btn.dataset.fmt;
  const mime = 'image/' + fmt;
  const a = document.createElement('a');
  a.download = `qr-${Date.now()}.${fmt === 'jpeg' ? 'jpg' : fmt}`;
  a.href = canvas.toDataURL(mime, 0.92);
  a.click();
  formatMenu.classList.add('hidden');
  toast(`Сохранено в формате ${fmt.toUpperCase()}`);
});

/* ---------- Открыть содержимое ---------- */
$('#openContentBtn').addEventListener('click', () => {
  if (!lastPayload) return toast('Сначала сгенерируйте код', true);
  $('#contentText').textContent = lastPayload;
  openModal('contentModal');
});
$('#copyContent').addEventListener('click', () => {
  navigator.clipboard.writeText(lastPayload).then(() => toast('Скопировано'));
});

/* ---------- События редактора ---------- */
$$('#typeTabs button').forEach(b => b.addEventListener('click', () => {
  state.type = b.dataset.type;
  syncUI(); saveState();
}));

$('#fieldText').addEventListener('input', e => { state.text = e.target.value; saveState(); });
$('#fieldUrl').addEventListener('input', e => { state.url = e.target.value; saveState(); });
$('#fieldImage').addEventListener('input', e => { state.image = e.target.value; saveState(); });
$('#wifiSsid').addEventListener('input', e => { state.wifi.ssid = e.target.value; saveState(); });
$('#wifiPass').addEventListener('input', e => { state.wifi.pass = e.target.value; saveState(); });
$('#wifiEnc').addEventListener('change', e => { state.wifi.enc = e.target.value; saveState(); });
$('#wifiHidden').addEventListener('change', e => { state.wifi.hidden = e.target.checked; saveState(); });

$('#dotColor').addEventListener('input', e => { state.dot = e.target.value; saveState(); });
$('#bgColor').addEventListener('input', e => { state.bg = e.target.value; saveState(); });
$('#swapColors').addEventListener('click', () => {
  [state.dot, state.bg] = [state.bg, state.dot];
  syncUI(); saveState();
});

$('#size').addEventListener('input', e => {
  state.size = +e.target.value;
  $('#sizeVal').textContent = state.size;
  saveState();
});
$('#ecc').addEventListener('change', e => { state.ecc = e.target.value; saveState(); });
$('#margin').addEventListener('change', e => { state.margin = +e.target.value; saveState(); });

/* ---------- Сброс ---------- */
$('#resetBtn').addEventListener('click', () => {
  state = structuredClone(DEFAULTS);
  lastPayload = null;
  syncUI(); saveState();
  placeholder.classList.remove('hidden');
  canvas.width = canvas.height = 0;
  toast('Настройки сброшены');
});

/* ---------- Модалки / тост ---------- */
function openModal(id){ $('#' + id).classList.remove('hidden'); }
function closeModal(id){ $('#' + id).classList.add('hidden'); }
$$('.close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
$$('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) m.classList.add('hidden');
}));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal').forEach(m => m.classList.add('hidden'));
});

let toastTimer;
function toast(msg, isError = false){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.remove('hidden');
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 2500);
}

/* ---------- Старт ---------- */
syncUI();
