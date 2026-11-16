/* ===== Типы содержимого и их поля ===== */
const TYPES = {
  url:   { name: 'Ссылка на сайт', fields: [{ id: 'url', label: 'Адрес сайта', ph: 'https://example.com' }] },
  image: { name: 'Картинка', fields: [{ id: 'img', label: 'Ссылка на изображение', ph: 'https://site.com/photo.jpg' }] },
  text:  { name: 'Текст', fields: [{ id: 'text', label: 'Ваш текст', area: true, ph: 'Любое сообщение...' }] },
  email: { name: 'E-mail', fields: [
    { id: 'mail', label: 'Адрес почты', ph: 'name@mail.com' },
    { id: 'subj', label: 'Тема', ph: 'Тема письма' },
    { id: 'body', label: 'Текст письма', area: true, ph: '' }] },
  phone: { name: 'Телефон', fields: [{ id: 'tel', label: 'Номер телефона', ph: '+49 123 456789' }] },
  wifi:  { name: 'Wi-Fi', fields: [
    { id: 'ssid', label: 'Название сети', ph: 'MyWiFi' },
    { id: 'pass', label: 'Пароль', ph: '' },
    { id: 'enc', label: 'Защита', select: ['WPA', 'WEP', 'nopass'] }] },
};

const DOTS = { square: 'Квадраты', dots: 'Круги', rounded: 'Скруглённые', 'extra-rounded': 'Очень круглые', classy: 'Классика', 'classy-rounded': 'Классика круглая' };
const CORNERS = { square: 'Квадрат', dot: 'Круг', 'extra-rounded': 'Скруглённый' };
const CDOTS = { square: 'Квадрат', dot: 'Круг' };

const DEFAULTS = { type: 'url', fg: '#1a1a2e', bg: '#ffffff', size: '300', ec: 'M',
  dot: 'square', corner: 'square', cdot: 'square', grad: false, fg2: '#7c3aed', logo: null };

let draft = { ...DEFAULTS };   // то, что выбирает пользователь
let vals = {};                 // значения полей ввода
let qr = null;                 // текущий QR
let current = null;            // последний сгенерированный (данные + настройки)

const $ = (s) => document.querySelector(s);
const HKEY = 'qr-studio-history';

/* ===== Вспомогательные ===== */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const withProto = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u);

function buildData(type, v) {
  const g = (k) => (v[k] || '').trim();
  switch (type) {
    case 'url': return g('url') ? withProto(g('url')) : '';
    case 'image': return g('img') ? withProto(g('img')) : '';
    case 'text': return g('text');
    case 'phone': return g('tel') ? 'tel:' + g('tel') : '';
    case 'email': return g('mail')
      ? `mailto:${g('mail')}?subject=${encodeURIComponent(g('subj'))}&body=${encodeURIComponent(g('body'))}` : '';
    case 'wifi': return g('ssid')
      ? `WIFI:T:${v.enc || 'WPA'};S:${g('ssid')};P:${g('pass')};;` : '';
  }
}

/* ===== Отрисовка редактора ===== */
function chips(el, items, key, onPick) {
  el.innerHTML = '';
  Object.entries(items).forEach(([val, name]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (draft[key] === val ? ' active' : ''); b.textContent = name;
    b.onclick = () => { draft[key] = val; chips(el, items, key, onPick); onPick && onPick(); };
    el.appendChild(b);
  });
}

function renderFields() {
  const box = $('#fields'); box.innerHTML = '';
  TYPES[draft.type].fields.forEach((f) => {
    const l = document.createElement('label'); l.className = 'lbl'; l.textContent = f.label;
    let inp;
    if (f.select) {
      inp = document.createElement('select');
      f.select.forEach((o) => inp.add(new Option(o, o)));
    } else {
      inp = document.createElement(f.area ? 'textarea' : 'input');
      if (!f.area) inp.type = 'text';
      inp.placeholder = f.ph || '';
    }
    inp.value = vals[f.id] || (f.select ? f.select[0] : '');
    inp.oninput = inp.onchange = () => (vals[f.id] = inp.value);
    box.append(l, inp);
  });
}

function syncControls() {
  $('#fg').value = draft.fg; $('#bg').value = draft.bg; $('#size').value = draft.size;
  $('#ec').value = draft.ec; $('#grad').checked = draft.grad; $('#fg2').value = draft.fg2;
  $('#gradRow').hidden = !draft.grad;
  chips($('#typeChips'), Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.name])), 'type', renderFields);
  chips($('#dotChips'), DOTS, 'dot');
  chips($('#cornerChips'), CORNERS, 'corner');
  chips($('#cdotChips'), CDOTS, 'cdot');
  renderFields();
}

/* ===== Генерация ===== */
function qrOptions(data, s) {
  const color = s.grad
    ? { gradient: { type: 'linear', rotation: Math.PI / 4, colorStops: [{ offset: 0, color: s.fg }, { offset: 1, color: s.fg2 }] } }
    : { color: s.fg };
  return {
    width: +s.size, height: +s.size, type: 'canvas', data, margin: 12,
    qrOptions: { errorCorrectionLevel: s.ec },
    dotsOptions: { type: s.dot, ...color },
    cornersSquareOptions: { type: s.corner, color: s.fg },
    cornersDotOptions: { type: s.cdot, color: s.fg },
    backgroundOptions: { color: s.bg },
    image: s.logo || undefined,
    imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.35 },
  };
}

function render(data, s) {
  const opts = qrOptions(data, s);
  if (qr) qr.update(opts);
  else { qr = new QRCodeStyling(opts); qr.append($('#preview')); }
  $('#placeholder').hidden = true;
  current = { data, type: s.type, settings: { ...s } };
}

function generate() {
  const data = buildData(draft.type, vals);
  if (!data) return toast('Заполните данные для QR-кода');
  render(data, draft);
  saveHistory();
  toast('QR-код создан ✨');
}

/* ===== Сохранение и открытие ===== */
function save(ext) {
  if (!qr) return toast('Сначала сгенерируйте QR-код');
  qr.download({ name: 'qr-code', extension: ext });
  toast('Сохранено в ' + ext.toUpperCase());
}

function openContent() {
  if (!current) return toast('Сначала сгенерируйте QR-код');
  if (current.type === 'url' || current.type === 'image') return window.open(current.data, '_blank', 'noopener');
  $('#contentText').textContent = current.data.replace(/^(tel:)/, '');
  $('#contentDlg').showModal();
}

/* ===== История ===== */
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; } };

function saveHistory() {
  let list = loadHistory();
  list.unshift({ id: Date.now(), data: current.data, type: current.type, settings: current.settings, vals: { ...vals } });
  list = list.slice(0, 20);
  try { localStorage.setItem(HKEY, JSON.stringify(list)); }
  catch { // не влезло (обычно из-за логотипа) — сохраняем без него
    list.forEach((i) => (i.settings.logo = null));
    try { localStorage.setItem(HKEY, JSON.stringify(list)); } catch {}
  }
}

function renderHistory() {
  const list = loadHistory(), box = $('#historyList'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty">История пока пуста</div>'; return; }
  list.forEach((it) => {
    const d = document.createElement('div'); d.className = 'hist-item';
    d.innerHTML = `<div class="info"><b></b><small>${TYPES[it.type].name} · ${new Date(it.id).toLocaleString('ru-RU')}</small></div>
      <button data-a="use">Открыть</button><button data-a="del">✕</button>`;
    d.querySelector('b').textContent = it.data;
    d.querySelector('[data-a=use]').onclick = () => {
      draft = { ...it.settings }; vals = { ...it.vals }; syncControls();
      render(it.data, draft); $('#historyDlg').close(); toast('Восстановлено из истории');
    };
    d.querySelector('[data-a=del]').onclick = () => {
      localStorage.setItem(HKEY, JSON.stringify(loadHistory().filter((x) => x.id !== it.id))); renderHistory();
    };
    box.appendChild(d);
  });
}

/* ===== События ===== */
$('#fg').oninput = (e) => (draft.fg = e.target.value);
$('#bg').oninput = (e) => (draft.bg = e.target.value);
$('#fg2').oninput = (e) => (draft.fg2 = e.target.value);
$('#size').onchange = (e) => (draft.size = e.target.value);
$('#ec').onchange = (e) => (draft.ec = e.target.value);
$('#grad').onchange = (e) => { draft.grad = e.target.checked; $('#gradRow').hidden = !draft.grad; };
$('#logo').onchange = (e) => {
  const f = e.target.files[0]; if (!f) { draft.logo = null; return; }
  const r = new FileReader(); r.onload = () => { draft.logo = r.result; if (draft.ec !== 'H') { draft.ec = 'H'; $('#ec').value = 'H'; } };
  r.readAsDataURL(f);
};

$('#genBtn').onclick = generate;
$('#resetBtn').onclick = () => { draft = { ...DEFAULTS }; $('#logo').value = ''; syncControls(); toast('Настройки сброшены'); };
$('#styleBtn').onclick = () => $('#styleDlg').showModal();
$('#historyBtn').onclick = () => { renderHistory(); $('#historyDlg').showModal(); };
$('#clearHist').onclick = () => { localStorage.removeItem(HKEY); renderHistory(); };
$('#openBtn').onclick = openContent;
$('#copyBtn').onclick = () => { navigator.clipboard.writeText($('#contentText').textContent); toast('Скопировано'); };

$('#saveMain').onclick = () => save('png');
$('#saveArrow').onclick = (e) => {
  e.stopPropagation();
  const m = $('#saveMenu'); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-expanded', !m.hidden);
};
$('#saveMenu').onclick = (e) => { const x = e.target.dataset.ext; if (x) { save(x); $('#saveMenu').hidden = true; } };
document.addEventListener('click', () => ($('#saveMenu').hidden = true));

document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

syncControls();
