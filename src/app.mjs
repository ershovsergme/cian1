import { initialState, validateStep, needsConsultant, monthlyPayment, callDays, TIMES, money, amount, applicationData } from './model.mjs';

const app = document.querySelector('#app');
const sheet = document.querySelector('#sheet');
const STORAGE = 'cian-mortgage-draft-v1';
const routes = ['calculator', 'contacts', 'plans', 'finances', 'callback', 'success'];
const stepNames = ['Контакты', 'Планы', 'Финансы', 'Звонок'];
const icons = {
  back: '<path d="m14 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2m0 3v.1"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-7h6v7"/>',
  phone: '<path d="M8 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-4l-5-2-2 3a15 15 0 0 1-7-7l3-2-2-5Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 5h3m4 0h3"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = initialState();
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE));
  if (saved && Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= 5) state = { ...state, ...saved };
} catch { /* Storage can be disabled in a private window. */ }
let errors = {};
let attempted = false;
let sending = false;
let returnToReview = false;
const save = () => { try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch { /* The form still works without persistence. */ } };

function errorSlot(name) { return `<p class="field-error" id="error-${name}" hidden></p>`; }
function input(name, label, options = {}) {
  const { hint = '', readonly = false, type = 'text', suffix = '', autocomplete = 'off', numeric = false } = options;
  return `<div class="field" data-field="${name}">
    <label for="${name}">${label}</label>
    <div class="input-wrap ${readonly ? 'readonly' : ''}"><input id="${name}" name="${name}" type="${type}" value="${esc(state[name])}" ${readonly ? 'readonly aria-readonly="true"' : ''} ${numeric ? 'inputmode="decimal"' : ''} autocomplete="${autocomplete}" maxlength="${numeric ? 14 : 120}" aria-describedby="error-${name}${hint ? ` hint-${name}` : ''}" />${readonly ? icon('lock') : suffix ? `<span class="input-suffix">${suffix}</span>` : ''}</div>
    ${hint ? `<p class="field-hint" id="hint-${name}">${hint}</p>` : ''}${errorSlot(name)}</div>`;
}
function radios(name, items, style = 'choice-list') {
  return `<div class="${style}">${items.map(item => `<label class="choice"><input type="radio" name="${name}" value="${item.value}" ${state[name] === item.value ? 'checked' : ''} aria-describedby="error-${name}"/><span class="choice-label">${item.label}${item.detail ? `<small>${item.detail}</small>` : ''}</span><span class="radio-indicator" aria-hidden="true"></span></label>`).join('')}</div>${errorSlot(name)}`;
}
function header() {
  if (state.step === 0) return `<header class="app-header calculator-header"><div class="brand"><span class="brand-mark" aria-hidden="true"><span></span></span><span>циан</span></div><span class="header-divider"></span><span class="header-title">Ипотека</span><button type="button" class="icon-button" data-action="about" aria-label="Как работает подбор ипотеки">${icon('help')}</button></header>`;
  if (state.step === 5) return `<header class="app-header success-header"><div class="brand"><span class="brand-mark" aria-hidden="true"><span></span></span><span>циан</span></div><span class="done-label">${icon('check')} Заявка отправлена</span></header>`;
  return `<header class="form-header"><div class="app-header"><button type="button" class="icon-button back-button" data-action="back" aria-label="Назад">${icon('back')}</button><span class="header-title">${stepNames[state.step - 1]}</span><span class="step-count">${state.step}<span> / 4</span></span></div><div class="progress" aria-label="Шаг ${state.step} из 4">${stepNames.map((_, i) => `<span class="${i < state.step ? 'filled' : ''}"></span>`).join('')}</div></header>`;
}
function intro(title, description = '') { return `<div class="intro"><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ''}</div>`; }
function calculator() {
  return `${intro('Рассчитайте ипотеку', 'Узнайте платёж и обсудите условия с экспертом.')}
    <fieldset class="calc-program"><legend class="sr-only">Ипотечная программа</legend>${radios('program', [{ value: 'family', label: 'Семейная' }, { value: 'standard', label: 'Рыночная' }], 'segment')}</fieldset>
    <fieldset class="property-kind"><legend>Какую квартиру ищете?</legend>${radios('propertyType', [{ value: 'new', label: 'Новостройка' }, { value: 'resale', label: 'Вторичное жильё' }], 'pills')}</fieldset>
    <div class="calculator-fields">
      <div class="calc-field">${input('price', 'Стоимость квартиры', { numeric: true, suffix: '₽' })}<input class="range" type="range" name="priceRange" aria-label="Стоимость квартиры, ползунок" min="3000000" max="30000000" step="100000" value="${amount(state.price)}"/><div class="range-captions"><span>3 млн</span><span>30 млн</span></div></div>
      <div class="calc-field">${input('down', 'Первоначальный взнос', { numeric: true, suffix: '<span id="down-percent"></span> ₽' })}<input class="range" type="range" name="downRange" aria-label="Первоначальный взнос, проценты" min="0" max="90" step="1" value="${Math.round(amount(state.down) / amount(state.price) * 100)}"/></div>
      <div class="term-field"><div><label for="years">Срок кредита</label><output for="years" id="years-value">${state.years} лет</output></div><input class="range" id="years" name="years" type="range" min="1" max="30" value="${state.years}"/><div class="range-captions"><span>1 год</span><span>30 лет</span></div>${errorSlot('years')}</div>
    </div>
    <p class="calculation-note">Предварительный расчёт, не предложение банка. <button type="button" class="text-link" data-action="calculation">Как считаем</button></p>`;
}
function contacts() {
  return `${intro('Давайте познакомимся', 'Эксперт свяжется с вами и поможет с ипотекой. Проверьте данные из профиля.')}
    <div class="profile-note"><span class="avatar">${icon('user')}</span><div><strong>Ваш профиль Циана</strong><span>Номер телефона подтверждён</span></div>${icon('check')}</div>
    ${input('name', 'Фамилия, имя и отчество', { autocomplete: 'name', hint: 'Отчество — если есть' })}
    ${input('phone', 'Телефон', { readonly: true, type: 'tel', hint: 'Номер привязан к вашему профилю' })}
    ${input('email', 'Электронная почта', { type: 'email', autocomplete: 'email', hint: 'Для информации по вашей заявке' })}
    <div class="soft-note">${icon('shield')}<p>Паспорт и документы сейчас не нужны. Детали обсудите с экспертом.</p></div>`;
}
function plans() {
  return `${intro('Расскажите о планах', 'Так эксперт сможет предложить подходящий следующий шаг.')}
    <fieldset><legend>Когда планируете покупку?</legend>${radios('timing', [{ value: 'month', label: 'В течение месяца' }, { value: 'three', label: 'Через 1–3 месяца' }, { value: 'six', label: 'Через 3–6 месяцев' }, { value: 'exploring', label: 'Просто изучаю' }], 'choice-grid')}</fieldset>
    <fieldset><legend>Уже нашли квартиру?</legend>${radios('property', [{ value: 'found', label: 'Да, объект уже есть' }, { value: 'searching', label: 'Нет, пока выбираю' }, { value: 'budget', label: 'Сначала хочу понять бюджет' }])}</fieldset>
    ${needsConsultant(state) ? `<fieldset class="consultant-field"><legend>Помочь с подбором квартиры?</legend><p class="group-hint">Для новостройки с семейной ипотекой</p>${radios('help', [{ value: 'yes', label: 'Да, нужна помощь' }, { value: 'no', label: 'Нет, выберу сам(а)' }], 'choice-grid')}</fieldset>` : ''}`;
}
function finances() {
  return `${intro('Оценим возможности', 'Укажите примерные суммы. Справки о доходах не понадобятся.')}
    ${input('income', 'Ваш доход в месяц на руки', { numeric: true, suffix: '₽', hint: 'Можно учесть зарплату и другие доходы' })}
    <div class="quick-values" role="group" aria-label="Быстрый выбор дохода">${[80000, 120000, 180000].map(value => `<button type="button" data-income="${value}" aria-pressed="${amount(state.income) === value}">${money(value)} ₽</button>`).join('')}</div>
    <fieldset class="credits-field"><legend>Есть действующие кредиты?</legend>${radios('credits', [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }], 'choice-grid')}</fieldset>
    <div id="credit-payment" ${state.credits !== 'yes' ? 'hidden' : ''}>${input('payment', 'Платежи по всем кредитам в месяц', { numeric: true, suffix: '₽', hint: 'Включая кредитные карты и рассрочки' })}</div>
    <div class="soft-note finance-note">${icon('info')}<p>Эти суммы помогут эксперту оценить комфортный платёж. Это ещё не заявка в банк.</p></div>`;
}
function callback() {
  return `${intro('Когда вам позвонить?', 'Ипотечный эксперт партнёра ответит на вопросы и расскажет, что делать дальше.')}
    <fieldset class="date-field"><legend>Выберите день</legend>${radios('day', callDays().map(day => ({ value: day.id, label: day.label, detail: day.weekday })), 'dates')}</fieldset>
    <fieldset class="time-field"><legend>Удобное время <span class="legend-note">По Москве</span></legend>${radios('time', TIMES.map(time => ({ value: time, label: time })), 'times')}</fieldset>
    <div class="call-summary"><span class="summary-icon">${icon('phone')}</span><div><span>Позвоним на ваш номер</span><strong>${esc(state.phone)}</strong></div><button type="button" class="icon-button" data-action="edit-contact" aria-label="Проверить контактные данные">${icon('edit')}</button></div>
    ${!state.priorMarketing ? `<label class="checkbox-label"><input type="checkbox" name="marketing" ${state.marketing ? 'checked' : ''}/><span class="checkbox-visual" aria-hidden="true">${icon('check')}</span><span>Хочу получать новости и предложения Циана <small>Необязательно</small></span></label>` : ''}
    <div id="submission-error" class="submission-error" role="alert" hidden></div>`;
}
function success() {
  const day = callDays().find(item => item.id === state.day);
  const dateText = day?.full || new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(state.day + 'T12:00:00+03:00'));
  return `<div class="success-intro"><div class="success-art" aria-hidden="true"><div class="success-orbit"></div><div class="success-check">${icon('check')}</div><span class="success-spark spark-one"></span><span class="success-spark spark-two"></span></div>${intro('Первый шаг сделан', 'Заявка у нас. Ипотечный эксперт партнёра позвонит в выбранное время.')}</div>
    <section class="appointment-card">${icon('calendar')}<span>Ваш звонок с экспертом</span><strong>${esc(dateText)}, ${esc(state.time)}</strong><small>По московскому времени</small><div>${icon('phone')} ${esc(state.phone)}</div></section>
    <div class="next-explanation"><h2>Что будет дальше</h2><p>Обсудите ваши планы, доступные программы и комфортный платёж. Эксперт подскажет, какие документы понадобятся для банка.</p></div>
    <p class="success-note">Пока ничего готовить не нужно.<br>Просто будьте на связи.</p>`;
}
function footer() {
  if (state.step === 0) return `<footer class="action-footer calculator-footer"><section class="payment-card" aria-label="Результат расчёта"><div class="payment-heading"><span>Платёж в месяц</span><span class="rate-badge">Ставка <b id="rate-value"></b></span></div><div class="payment-number"><span id="monthly-payment"></span><span> ₽</span></div><span id="loan-value" class="sr-only"></span></section><button type="submit" class="primary">Подобрать ипотеку ${icon('arrow')}</button><p>Короткая анкета — около 2 минут</p></footer>`;
  if (state.step === 5) return `<footer class="action-footer"><button type="button" data-action="restart" class="secondary">Вернуться к расчёту</button></footer>`;
  return `<footer class="action-footer">${state.step === 4 ? `<p class="consent-text">Нажимая «Отправить заявку», вы принимаете <button type="button" data-action="consents" class="text-link">согласия для подбора ипотеки</button>.</p>` : ''}<button type="submit" class="primary">${state.step === 4 ? 'Отправить заявку' : returnToReview && state.step === 1 ? 'Сохранить и вернуться' : 'Продолжить'}${state.step !== 4 ? icon('arrow') : ''}</button>${state.step === 1 ? `<p>${icon('lock')} Можно поправить данные на любом шаге</p>` : ''}</footer>`;
}
function render(focus = true) {
  app.innerHTML = `<form id="mortgage-form" class="screen" novalidate>${header()}<main class="screen-content ${state.step === 0 ? 'calculator-content' : state.step === 5 ? 'success-content' : ''}" id="screen-content">${[calculator, contacts, plans, finances, callback, success][state.step]()}</main>${footer()}</form>`;
  document.title = `${state.step === 0 ? 'Расчёт ипотеки' : state.step === 5 ? 'Заявка отправлена' : stepNames[state.step - 1]} · Циан`;
  if (state.step === 0) updateCalculation();
  applyErrors();
  if (focus) app.querySelector('h1')?.focus({ preventScroll: true });
}
function go(step, replace = false) {
  state.step = step;
  errors = {}; attempted = false;
  document.querySelector('#announcement').textContent = '';
  save();
  history[replace ? 'replaceState' : 'pushState']({ mortgageStep: step }, '', `#${routes[step]}`);
  render();
}
function applyErrors(focus = false) {
  app.querySelectorAll('.field-error').forEach(el => {
    const name = el.id.replace('error-', '');
    el.textContent = errors[name] || '';
    el.hidden = !errors[name];
  });
  app.querySelectorAll('[name]').forEach(el => {
    if (errors[el.name]) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
  if (focus && Object.keys(errors).length) {
    document.querySelector('#announcement').textContent = 'Проверьте данные. ' + Object.values(errors).join('. ');
    const first = app.querySelector(`[name="${Object.keys(errors)[0]}"]`);
    first?.focus({ preventScroll: true });
    first?.closest('.field, fieldset')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
function updateCalculation() {
  const rate = state.program === 'family' ? 6 : 18;
  const price = amount(state.price), down = amount(state.down);
  const payment = Object.keys(validateStep(state, 0)).length ? null : monthlyPayment(price, down, state.years, rate);
  document.querySelector('#monthly-payment').textContent = payment ? money(payment) : '—';
  document.querySelector('#loan-value').textContent = payment ? `${money(price - down)} ₽` : '—';
  document.querySelector('#rate-value').textContent = `${rate}%`;
  document.querySelector('#down-percent').textContent = Number.isFinite(down / price) ? `${Math.round(down / price * 100)}% · ` : '';
  const yearWord = state.years % 10 === 1 && state.years !== 11 ? 'год' : [2, 3, 4].includes(state.years % 10) && ![12, 13, 14].includes(state.years) ? 'года' : 'лет';
  document.querySelector('#years-value').textContent = `${state.years} ${yearWord}`;
  app.querySelectorAll('.range').forEach(range => {
    range.style.setProperty('--range-progress', `${(range.value - range.min) / (range.max - range.min) * 100}%`);
  });
}
function updateConditionalFields() {
  if (state.step === 3) {
    const payment = document.querySelector('#credit-payment');
    payment.hidden = state.credits !== 'yes';
    payment.querySelector('input').disabled = state.credits !== 'yes';
    app.querySelectorAll('[data-income]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.income) === amount(state.income))));
  }
}
app.addEventListener('input', event => {
  const target = event.target;
  if (!target.name) return;
  state.submitted = false;
  const name = target.name;
  if (name === 'priceRange') { state.price = money(Number(target.value)); document.querySelector('#price').value = state.price; }
  else if (name === 'downRange') { state.down = money(Math.round(amount(state.price) * Number(target.value) / 100)); document.querySelector('#down').value = state.down; }
  else if (name === 'years') state.years = Number(target.value);
  else if (name === 'marketing') state.marketing = target.checked;
  else if (name !== 'phone') state[name] = target.value;
  if (state.step === 0) {
    if (name === 'price') app.querySelector('[name="priceRange"]').value = amount(state.price);
    if (['down', 'price', 'priceRange'].includes(name)) app.querySelector('[name="downRange"]').value = amount(state.down) / amount(state.price) * 100;
    updateCalculation();
  }
  updateConditionalFields();
  if (attempted) { errors = validateStep(state); applyErrors(); }
  save();
});
app.addEventListener('focusout', event => {
  const target = event.target;
  if (['price', 'down', 'income', 'payment'].includes(target.name) && target.value.trim() && Number.isFinite(amount(target.value))) {
    state[target.name] = money(amount(target.value)); target.value = state[target.name]; save();
  }
});
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || state.step === 5) return;
  attempted = true; errors = validateStep(state); applyErrors(true);
  if (Object.keys(errors).length) return;
  if (state.step < 4) {
    if (returnToReview && state.step === 1) { returnToReview = false; go(4); }
    else go(state.step + 1);
    return;
  }
  // Recheck all steps so an expired date or changed earlier selection cannot bypass validation.
  for (let step = 0; step <= 4; step++) {
    const earlierErrors = validateStep(state, step);
    if (Object.keys(earlierErrors).length) { go(step); attempted = true; errors = earlierErrors; applyErrors(true); return; }
  }
  sending = true;
  const submit = app.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Отправляем заявку';
  submit.setAttribute('aria-busy', 'true');
  app.querySelector('[data-action="back"]').disabled = true;
  app.querySelector('main').inert = true;
  document.querySelector('#demo-button').disabled = true;
  document.querySelector('#announcement').textContent = 'Отправляем заявку';
  const version = state;
  await new Promise(resolve => setTimeout(resolve, 700));
  sending = false;
  document.querySelector('#demo-button').disabled = false;
  if (state !== version || state.step !== 4) return;
  if (state.failNext) {
    state.failNext = false; save(); render(false);
    const error = document.querySelector('#submission-error');
    error.hidden = false;
    error.innerHTML = `${icon('info')}<div><strong>Не получилось отправить</strong><p>Данные сохранились. Попробуйте ещё раз.</p></div>`;
    document.querySelector('#announcement').textContent = 'Не получилось отправить заявку. Данные сохранились. Попробуйте ещё раз.';
    error.scrollIntoView({ block: 'nearest' });
    app.querySelector('[type="submit"]').focus({ preventScroll: true });
    return;
  }
  // Build the application locally. The prototype never transmits personal data.
  applicationData(state);
  state.submitted = true;
  go(5);
  document.querySelector('#announcement').textContent = 'Заявка отправлена. Эксперт позвонит в выбранное время.';
});

function openSheet(kind) {
  const body = {
    about: `<h2 id="sheet-title">Поможем с первым шагом</h2><p>Заполните короткую анкету и выберите время звонка.</p><ol class="explanation-list"><li><strong>Расскажите о себе</strong><span>Контакты, планы и примерный доход.</span></li><li><strong>Обсудите варианты</strong><span>Эксперт партнёра ответит на вопросы об ипотеке.</span></li><li><strong>Решите, что дальше</strong><span>Когда будете готовы, эксперт поможет с заявкой в банк.</span></li></ol><button type="button" class="primary" data-close>Понятно</button>`,
    calculation: `<h2 id="sheet-title">Как устроен расчёт</h2><p>Платёж рассчитан равными ежемесячными частями на выбранный срок.</p><p>Для демонстрации используются ставки 6% для семейной программы и 18% для рыночной. Это учебные значения, не предложения банков.</p><p>Страховка и дополнительные расходы не учтены. Реальные условия и доступность программы нужно уточнять у банка.</p><button type="button" class="primary" data-close>Понятно</button>`,
    consents: `<h2 id="sheet-title">Согласия для подбора ипотеки</h2><p>В реальном сервисе для обработки заявки потребуется согласие на обработку контактных и анкетных данных и их передачу ипотечному партнёру для связи с вами.</p><div class="sheet-note">Это учебный прототип: данные никуда не отправляются. Название партнёра, сроки обработки и полные юридические документы должны быть добавлены перед запуском сервиса.</div><p>Получение рекламы — отдельный, необязательный выбор. Он не влияет на отправку заявки.</p><button type="button" class="primary" data-close>Понятно</button>`,
    demo: `<span class="sheet-eyebrow">Проверка прототипа</span><h2 id="sheet-title">Демо-сценарии</h2><p>Выбор сценария начнёт анкету заново. Все данные вымышленные.</p><div class="scenario-list">${[
      ['profile', 'Данные из профиля', 'Имя и почта заполнены. Согласие на рекламу не дано.'],
      ['empty', 'Пустые поля', 'Заполните имя и почту, проверьте ошибки. Телефон подтверждён.'],
      ['consented', 'Согласие уже дано', 'На последнем шаге нет повторного вопроса о рекламе.'],
      ['failure', 'Ошибка отправки', 'Первая отправка не проходит. Повторная — успешна.'],
    ].map(([value, label, description]) => `<button type="button" data-scenario="${value}" class="scenario ${state.scenario === value ? 'selected' : ''}"><span><strong>${label}</strong><small>${description}</small></span>${state.scenario === value ? icon('check') : icon('arrow')}</button>`).join('')}</div><p class="sheet-footnote">Черновик сохраняется в этой вкладке. Отправки в банк или партнёру нет.</p>`,
  }[kind];
  sheet.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div><button type="button" data-close class="icon-button sheet-close" aria-label="Закрыть">${icon('close')}</button><div class="sheet-content">${body}</div>`;
  sheet.showModal();
}
document.querySelector('#demo-button').addEventListener('click', () => openSheet('demo'));
sheet.addEventListener('click', event => {
  if (event.target.closest('[data-close]')) sheet.close();
  const scenario = event.target.closest('[data-scenario]');
  if (scenario) { state = initialState(scenario.dataset.scenario); returnToReview = false; sheet.close(); go(0); }
  if (event.target === sheet) {
    const rect = sheet.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) sheet.close();
  }
});
app.addEventListener('click', event => {
  const quick = event.target.closest('[data-income]');
  if (quick) {
    state.submitted = false;
    state.income = money(Number(quick.dataset.income));
    document.querySelector('#income').value = state.income;
    updateConditionalFields();
    if (attempted) { errors = validateStep(state); applyErrors(); }
    save(); return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action || sending) return;
  if (['about', 'calculation', 'consents'].includes(action)) openSheet(action);
  if (action === 'back') { returnToReview = false; go(Math.max(0, state.step - 1)); }
  if (action === 'edit-contact') { returnToReview = true; go(1); }
  if (action === 'restart') { const calculatorValues = { program: state.program, propertyType: state.propertyType, price: state.price, down: state.down, years: state.years }; state = { ...initialState(state.scenario), ...calculatorValues }; returnToReview = false; go(0); }
});
window.addEventListener('popstate', event => {
  if (sheet.open) sheet.close();
  const step = event.state?.mortgageStep;
  if (Number.isInteger(step) && step >= 0 && step <= 5) {
    if (step === 5 && !state.submitted) { go(0, true); return; }
    state.step = step; returnToReview = false; errors = {}; attempted = false; save(); render();
  }
});
history.replaceState({ mortgageStep: state.step }, '', `#${routes[state.step]}`);
render(false);
