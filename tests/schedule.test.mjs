import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAYS,
  DAY_NAMES,
  DAY_SHORT,
  parseBlock,
  formatBlock,
  parseTimeInput,
  WeekSchedule,
  weekStatus,
  buildScheduleAutomation,
  parseScheduleAutomation,
  langOf,
  actionSummary,
  SIMPLE_SCHEDULE_MARKER,
  SimpleScheduleCard,
  SimpleScheduleCardEditor,
  cssFontSize,
  parseFontSize,
} from '../src/card/simple-schedule-card.ts';

test('DAYS has 7 days starting with Monday and ending with Sunday', () => {
  assert.equal(DAYS[0], 'monday');
  assert.equal(DAYS[6], 'sunday');
  assert.equal(DAYS.length, 7);
});

test('Ukrainian day names and short names match Monday to Sunday order', () => {
  assert.equal(DAY_NAMES.uk[0], 'Понеділок');
  assert.equal(DAY_NAMES.uk[6], 'Неділя');
  assert.equal(DAY_SHORT.uk[0], 'Пн');
  assert.equal(DAY_SHORT.uk[6], 'Нд');
});

test('parseBlock & formatBlock time conversions', () => {
  assert.equal(parseBlock('00:00:00'), 0);
  assert.equal(parseBlock('08:30:00'), 510);
  assert.equal(parseBlock('24:00:00'), 1440);
  assert.equal(parseBlock('23:59:59'), 1440);

  assert.equal(formatBlock(0), '00:00:00');
  assert.equal(formatBlock(510), '08:30:00');
  assert.equal(formatBlock(1440), '24:00:00');
});

test('parseTimeInput parses 24h formats', () => {
  assert.equal(parseTimeInput('7'), 420);
  assert.equal(parseTimeInput('0730'), 450);
  assert.equal(parseTimeInput('23:45'), 1425);
  assert.equal(parseTimeInput('24:00'), 1440);
  assert.equal(parseTimeInput('25:00'), null);
});

test('WeekSchedule validation in Ukrainian', () => {
  const empty = new WeekSchedule({ name: ' ' });
  assert.ok(empty.validate('uk')?.includes('назву'));

  const reversed = new WeekSchedule({
    name: 'Test',
    days: { monday: [{ start: 600, end: 500 }] },
  });
  assert.ok(reversed.validate('uk')?.includes('раніше'));

  const overlap = new WeekSchedule({
    name: 'Test',
    days: { monday: [{ start: 400, end: 600 }, { start: 500, end: 700 }] },
  });
  assert.ok(overlap.validate('uk')?.includes('перетинаються'));
});

test('WeekSchedule toHA serializes Monday to Sunday', () => {
  const ws = new WeekSchedule({
    name: 'Опалення',
    days: { monday: [{ start: 360, end: 480 }] },
  });
  const ha = ws.toHA();
  assert.equal(ha.name, 'Опалення');
  assert.equal(ha.monday[0].from, '06:00:00');
  assert.equal(ha.monday[0].to, '08:00:00');
});

test('weekStatus accurately computes active state for Monday (day 0)', () => {
  const ws = new WeekSchedule({
    name: 'Робота',
    days: {
      monday: [{ start: 9 * 60, end: 18 * 60 }],
    },
  });

  const mondayNoon = new Date('2026-10-12T12:00:00'); // Monday
  assert.equal(weekStatus(ws, mondayNoon).on, true);

  const mondayEvening = new Date('2026-10-12T20:00:00');
  assert.equal(weekStatus(ws, mondayEvening).on, false);

  const sundayNoon = new Date('2026-10-18T12:00:00'); // Sunday
  assert.equal(weekStatus(ws, sundayNoon).on, false);
});

test('buildScheduleAutomation produces clean standard automation with marker and triggers', () => {
  const auto = buildScheduleAutomation({
    id: '123',
    scheduleEntityId: 'schedule.heat',
    scheduleName: 'Котел',
    target: {
      entityId: 'climate.boiler',
      name: 'Котел опалення',
      temperature: 22,
      hvacMode: 'heat',
    },
  });

  assert.equal(auto.alias, 'Schedule · Котел');
  assert.ok(auto.description.includes(SIMPLE_SCHEDULE_MARKER));
  assert.equal(auto.triggers[0].trigger, 'state');
  assert.deepEqual(auto.triggers[0].entity_id, ['schedule.heat']);
});

test('parseScheduleAutomation decodes target', () => {
  const auto = buildScheduleAutomation({
    id: '456',
    scheduleEntityId: 'schedule.temp',
    scheduleName: 'Температура',
    target: {
      entityId: 'climate.living_room',
      name: 'Вітальня',
      temperature: 21.5,
    },
  });

  const parsed = parseScheduleAutomation(auto);
  assert.ok(parsed);
  assert.equal(parsed.scheduleName, 'Температура');
  assert.equal(parsed.target.temperature, 21.5);
});

test('langOf selects uk for ukrainian locale and en otherwise', () => {
  assert.equal(langOf({ locale: { language: 'uk-UA' } }), 'uk');
  assert.equal(langOf({ language: 'uk' }), 'uk');
  assert.equal(langOf({ language: 'en-US' }), 'en');
  assert.equal(langOf({ language: 'he' }), 'en');
  assert.equal(langOf(null), 'en');
});

test('actionSummary prints Ukrainian description', () => {
  const desc = actionSummary(
    {
      entityId: 'climate.ac',
      temperature: 23,
      hvacMode: 'cool',
      turnOffAtEnd: true,
    },
    'uk'
  );
  assert.ok(desc.includes('Охолодження'));
  assert.ok(desc.includes('23°'));
  assert.ok(desc.includes('вимикається'));
});

test('blockLabel formats 24h ranges and showTimes string exists', () => {
  const b1 = { start: 0, end: 420 };
  const b2 = { start: 1380, end: 1440 };
  assert.equal(`${formatBlock(b1.start).slice(0, 5)}–${formatBlock(b1.end).slice(0, 5)}`, '00:00–07:00');
  assert.equal(`${formatBlock(b2.start).slice(0, 5)}–${formatBlock(b2.end).slice(0, 5)}`, '23:00–24:00');
});

test('SimpleScheduleCard.setConfig correctly accepts show_time and ignores deprecated show_times', () => {
  const card = new SimpleScheduleCard();

  // Test show_time: true
  card.setConfig({ show_time: true });
  assert.equal(card.showTime, true);

  // Test show_time: false
  card.setConfig({ show_time: false });
  assert.equal(card.showTime, false);

  // Default omitted
  card.setConfig({});
  assert.equal(card.showTime, false);

  // Verify deprecated show_times is ignored
  card.setConfig({ show_times: true });
  assert.equal(card.showTime, false);
});

test('SimpleScheduleCard.setConfig correctly handles show_time_toggle', () => {
  const card = new SimpleScheduleCard();

  // Default true
  card.setConfig({});
  assert.equal(card.showTimeToggle, true);

  // Explicit false
  card.setConfig({ show_time_toggle: false });
  assert.equal(card.showTimeToggle, false);

  // Explicit true
  card.setConfig({ show_time_toggle: true });
  assert.equal(card.showTimeToggle, true);
});

test('SimpleScheduleCard.setConfig correctly handles show_bars and show_bars_toggle', () => {
  const card = new SimpleScheduleCard();

  // Default values: show_bars is true, show_bars_toggle is false
  card.setConfig({});
  assert.equal(card.showBars, true);
  assert.equal(card.showBarsToggle, false);

  // Custom values
  card.setConfig({ show_bars: false, show_bars_toggle: true });
  assert.equal(card.showBars, false);
  assert.equal(card.showBarsToggle, true);

  // Re-enable show_bars
  card.setConfig({ show_bars: true, show_bars_toggle: false });
  assert.equal(card.showBars, true);
  assert.equal(card.showBarsToggle, false);
});

test('SimpleScheduleCardEditor._emit preserves title and clean properties', () => {
  const editor = new SimpleScheduleCardEditor();
  let emittedConfig = null;
  editor.dispatchEvent = (ev) => {
    if (ev.type === 'config-changed') {
      emittedConfig = ev.detail.config;
    }
  };

  editor._emit({
    title: 'Тестовий розклад',
    show_time: true,
    show_time_toggle: false,
    show_bars: false,
    show_bars_toggle: true,
    font_size: '15px',
  });
  assert.deepEqual(emittedConfig, {
    title: 'Тестовий розклад',
    show_time: true,
    show_time_toggle: false,
    show_bars: false,
    show_bars_toggle: true,
    font_size: '15px',
  });

  // Empty font_size should be removed from config
  editor._emit({ title: 'Тестовий розклад', font_size: '' });
  assert.deepEqual(emittedConfig, {
    title: 'Тестовий розклад',
  });
});

test('SimpleScheduleCard.setConfig and cssFontSize normalize font_size', () => {
  const card = new SimpleScheduleCard();

  // Default null
  card.setConfig({});
  assert.equal(card.fontSize, null);

  // '15px' preserved
  card.setConfig({ font_size: '15px' });
  assert.equal(card.fontSize, '15px');

  // number 16 converts to '16px'
  card.setConfig({ font_size: 16 });
  assert.equal(card.fontSize, '16px');

  // string number '17' converts to '17px'
  card.setConfig({ font_size: '17' });
  assert.equal(card.fontSize, '17px');

  // rem unit
  card.setConfig({ font_size: '1.15rem' });
  assert.equal(card.fontSize, '1.15rem');

  // empty or whitespace string resets to null
  card.setConfig({ font_size: '   ' });
  assert.equal(card.fontSize, null);

  // Helper assertions
  assert.equal(cssFontSize('14px'), '14px');
  assert.equal(parseFontSize(18), '18px');
  assert.equal(cssFontSize(undefined), null);
});

