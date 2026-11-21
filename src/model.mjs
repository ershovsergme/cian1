export const TIMINGS = ['month', 'three', 'six', 'exploring'];
export const PROPERTIES = ['found', 'searching', 'budget'];
export const TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
export const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
export const amount = value => Number(String(value).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));

export function callDays(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  const noon = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00+03:00`);
  return [1, 2, 3].map(offset => {
    const date = new Date(noon.getTime() + offset * 86400000);
    return {
      id: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
      label: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short' }).format(date).replace('.', ''),
      weekday: offset === 1 ? 'Завтра' : new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short' }).format(date),
      full: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(date),
    };
  });
}

export function initialState(scenario = 'profile', now = new Date()) {
  return {
    step: 0, scenario, submitted: false,
    program: 'family', propertyType: 'new', price: '8 000 000', down: '2 400 000', years: 25,
    name: scenario === 'empty' ? '' : 'Петрова Анна Сергеевна',
    phone: '+7 999 123-45-67', email: scenario === 'empty' ? '' : 'anna.petrova@example.com',
    timing: '', property: '', help: '', income: '', credits: '', payment: '',
    day: callDays(now)[0].id, time: '', marketing: false,
    priorMarketing: scenario === 'consented', failNext: scenario === 'failure',
  };
}

export function needsConsultant(state) { return state.program === 'family' && state.propertyType === 'new'; }
export function monthlyPayment(price, down, years, rate) {
  const principal = price - down;
  const months = years * 12;
  if (principal <= 0 || months <= 0 || !Number.isFinite(principal) || !Number.isFinite(months)) return null;
  if (rate === 0) return principal / months;
  const interest = rate / 1200;
  return principal * interest / (1 - (1 + interest) ** -months);
}
export function validateStep(state, step = state.step, now = new Date()) {
  const errors = {};
  if (step === 0) {
    if (!Number.isFinite(amount(state.price)) || amount(state.price) < 3000000 || amount(state.price) > 30000000) errors.price = 'Укажите стоимость от 3 до 30 млн ₽';
    if (!String(state.down).trim() || !Number.isFinite(amount(state.down)) || amount(state.down) < 0 || amount(state.down) >= amount(state.price)) errors.down = 'Взнос должен быть меньше стоимости квартиры';
    if (state.years < 1 || state.years > 30) errors.years = 'Выберите срок от 1 до 30 лет';
  }
  if (step === 1) {
    if (!/^[\p{L}][\p{L}\s’'\-]+$/u.test(state.name.trim()) || state.name.trim().split(/\s+/).length < 2) errors.name = 'Укажите фамилию и имя';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.email.trim())) errors.email = 'Проверьте почту, например anna@mail.ru';
  }
  if (step === 2) {
    if (!TIMINGS.includes(state.timing)) errors.timing = 'Выберите, когда планируете покупку';
    if (!PROPERTIES.includes(state.property)) errors.property = 'Укажите, есть ли уже объект';
    if (needsConsultant(state) && !['yes', 'no'].includes(state.help)) errors.help = 'Выберите, нужна ли помощь с подбором';
  }
  if (step === 3) {
    if (!Number.isFinite(amount(state.income)) || amount(state.income) <= 0 || amount(state.income) > 100000000) errors.income = 'Укажите ваш ежемесячный доход';
    if (!['yes', 'no'].includes(state.credits)) errors.credits = 'Укажите, есть ли действующие кредиты';
    if (state.credits === 'yes' && (!Number.isFinite(amount(state.payment)) || amount(state.payment) <= 0 || amount(state.payment) > 100000000)) errors.payment = 'Укажите общий платёж по кредитам в месяц';
  }
  if (step === 4) {
    if (!callDays(now).some(day => day.id === state.day)) errors.day = 'Выберите актуальную дату звонка';
    if (!TIMES.includes(state.time)) errors.time = 'Выберите удобное время звонка';
  }
  return errors;
}

export function applicationData(state) {
  return {
    contact: { name: state.name.trim(), email: state.email.trim(), phone: state.phone },
    mortgage: { program: state.program, propertyType: state.propertyType, price: amount(state.price), down: amount(state.down), years: state.years },
    plans: { timing: state.timing, property: state.property, ...(needsConsultant(state) ? { consultant: state.help === 'yes' } : {}) },
    finances: { income: amount(state.income), credits: state.credits === 'yes', ...(state.credits === 'yes' ? { monthlyCreditPayment: amount(state.payment) } : {}) },
    callback: { date: state.day, time: state.time, timeZone: 'Europe/Moscow' },
    consents: { service: true, marketing: state.priorMarketing || state.marketing, marketingPreviouslyGiven: state.priorMarketing },
  };
}
