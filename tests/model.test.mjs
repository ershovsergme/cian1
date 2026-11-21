import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, validateStep, needsConsultant, monthlyPayment, callDays, applicationData, amount } from '../src/model.mjs';

const now = new Date('2026-11-21T10:00:00Z');
const valid = () => ({ ...initialState('profile', now), timing: 'three', property: 'searching', help: 'yes', income: '120 000', credits: 'no', time: '12:00' });

test('предзаполненный сценарий проходит все шаги, пустой требует имя и почту', () => {
  for (let step = 0; step <= 4; step++) assert.deepEqual(validateStep(valid(), step, now), {});
  assert.deepEqual(Object.keys(validateStep(initialState('empty', now), 1)), ['name', 'email']);
  assert.equal(initialState('empty', now).phone, initialState('profile', now).phone);
});
test('ошибочные контакты не проходят, имя без отчества допустимо', () => {
  const state = valid();
  state.name = 'Анна'; state.email = 'anna@';
  assert.deepEqual(Object.keys(validateStep(state, 1)), ['name', 'email']);
  state.name = 'Петрова Анна'; state.email = 'anna@example.com';
  assert.deepEqual(validateStep(state, 1), {});
});
test('помощь с подбором обязательна только для семейной ипотеки на новостройку', () => {
  for (const program of ['family', 'standard']) for (const propertyType of ['new', 'resale']) {
    const state = { ...valid(), program, propertyType, help: '' };
    const expected = program === 'family' && propertyType === 'new';
    assert.equal(needsConsultant(state), expected);
    assert.equal(Boolean(validateStep(state, 2).help), expected);
    assert.equal('consultant' in applicationData(state).plans, expected);
  }
});
test('отрицательный доход и пустой платёж по кредитам не проходят', () => {
  const state = { ...valid(), income: '-100', credits: 'yes', payment: '' };
  assert.deepEqual(Object.keys(validateStep(state, 3)), ['income', 'payment']);
  state.income = '120 000'; state.payment = '15 000';
  assert.deepEqual(validateStep(state, 3), {});
  assert.equal(applicationData(state).finances.monthlyCreditPayment, 15000);
});
test('скрытый старый платёж по кредитам исключается из заявки и валидации', () => {
  const state = { ...valid(), credits: 'no', payment: '-25000' };
  assert.deepEqual(validateStep(state, 3), {});
  assert.equal('monthlyCreditPayment' in applicationData(state).finances, false);
});
test('согласие на рекламу не требуется; ранее данное не теряется', () => {
  const state = valid();
  assert.equal(applicationData(state).consents.marketing, false);
  assert.deepEqual(validateStep(state, 4, now), {});
  state.marketing = true;
  assert.equal(applicationData(state).consents.marketing, true);
  state.marketing = false; state.priorMarketing = true;
  assert.equal(applicationData(state).consents.marketing, true);
  assert.equal(applicationData(state).consents.marketingPreviouslyGiven, true);
});
test('слоты — три следующих дня по Москве, включая смену месяца и года', () => {
  assert.deepEqual(callDays(now).map(day => day.id), ['2026-11-22', '2026-11-23', '2026-11-24']);
  assert.deepEqual(callDays(new Date('2026-12-31T21:30:00Z')).map(day => day.id), ['2027-01-02', '2027-01-03', '2027-01-04']);
});
test('нельзя отправить без времени, с прошедшей датой или неизвестным слотом', () => {
  const state = { ...valid(), day: '2026-11-20', time: '' };
  assert.deepEqual(Object.keys(validateStep(state, 4, now)), ['day', 'time']);
  state.day = '2026-11-22'; state.time = '03:00';
  assert.deepEqual(Object.keys(validateStep(state, 4, now)), ['time']);
});
test('калькулятор считает аннуитет, нулевую ставку и проверяет границы', () => {
  assert.equal(Math.round(monthlyPayment(8000000, 2400000, 25, 6)), 36081);
  assert.equal(monthlyPayment(1200000, 0, 10, 0), 10000);
  assert.equal(monthlyPayment(8000000, 8000000, 25, 6), null);
  const state = { ...valid(), price: '8 000 000', down: '9 000 000' };
  assert.ok(validateStep(state, 0).down);
  assert.ok(validateStep({ ...state, price: 'не число' }, 0).price);
  assert.equal(amount('120\u00a0000'), 120000);
});
