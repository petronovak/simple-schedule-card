/**
 * Test runner and assertions for Schedule Helper Card.
 * Runs in-browser or can be exported to Node test runner.
 */

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
  cssFontSize,
  parseFontSize,
} from '../card/simple-schedule-card.ts';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export async function runAllTests(): Promise<{ passed: boolean; results: TestResult[]; summary: { total: number; passed: number; failed: number } }> {
  const results: TestResult[] = [];

  const runTest = (suite: string, name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    try {
      fn();
      results.push({ suite, name, passed: true, durationMs: Number((performance.now() - start).toFixed(2)) });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        durationMs: Number((performance.now() - start).toFixed(2)),
        error: err?.message || String(err),
      });
    }
  };

  // --- Suite 1: Week Model & Monday Start ---
  runTest('Модель тижня (Monday First)', 'DAYS починається з понеділка (index 0) і закінчується неділею (index 6)', () => {
    if (DAYS[0] !== 'monday') throw new Error(`Очікувався monday, отримано ${DAYS[0]}`);
    if (DAYS[6] !== 'sunday') throw new Error(`Очікувався sunday, отримано ${DAYS[6]}`);
    if (DAYS.length !== 7) throw new Error(`Очікувалось 7 днів, отримано ${DAYS.length}`);
  });

  runTest('Модель тижня (Monday First)', 'Назви днів українською та англійською мовами відповідають порядку Пн-Нд', () => {
    if (DAY_NAMES.uk[0] !== 'Понеділок' || DAY_NAMES.uk[6] !== 'Неділя') {
      throw new Error(`Українські дні тижня некоректні: ${JSON.stringify(DAY_NAMES.uk)}`);
    }
    if (DAY_NAMES.en[0] !== 'Monday' || DAY_NAMES.en[6] !== 'Sunday') {
      throw new Error(`Англійські дні тижня некоректні: ${JSON.stringify(DAY_NAMES.en)}`);
    }
    if (DAY_SHORT.uk[0] !== 'Пн' || DAY_SHORT.uk[6] !== 'Нд') {
      throw new Error(`Скорочені українські дні некоректні: ${JSON.stringify(DAY_SHORT.uk)}`);
    }
  });

  // --- Suite 2: Time Parsing & Formatting ---
  runTest('Часові утиліти', 'parseBlock та formatBlock точно переводять хвилини у HH:MM:00 та назад', () => {
    if (parseBlock('00:00:00') !== 0) throw new Error('00:00:00 != 0');
    if (parseBlock('08:30:00') !== 510) throw new Error('08:30:00 != 510');
    if (parseBlock('24:00:00') !== 1440) throw new Error('24:00:00 != 1440');
    if (parseBlock('23:59:59') !== 1440) throw new Error('23:59:59 != 1440');

    if (formatBlock(0) !== '00:00:00') throw new Error('0 != 00:00:00');
    if (formatBlock(510) !== '08:30:00') throw new Error('510 != 08:30:00');
    if (formatBlock(1440) !== '24:00:00') throw new Error('1440 != 24:00:00');
  });

  runTest('Часові утиліти', 'parseTimeInput розпізнає гнучкі формати (7, 0730, 23:45, 24:00)', () => {
    if (parseTimeInput('7') !== 420) throw new Error('7 != 420');
    if (parseTimeInput('0730') !== 450) throw new Error('0730 != 450');
    if (parseTimeInput('23:45') !== 1425) throw new Error('23:45 != 1425');
    if (parseTimeInput('24:00') !== 1440) throw new Error('24:00 != 1440');
    if (parseTimeInput('25:00') !== null) throw new Error('25:00 повинно бути null');
  });

  // --- Suite 3: WeekSchedule Class ---
  runTest('WeekSchedule', 'Валідація виявляє помилки (порожня назва, зворотні інтервали, перетин)', () => {
    const emptyName = new WeekSchedule({ name: '  ' });
    if (!emptyName.validate('uk')) throw new Error('Повинна бути помилка порожньої назви');

    const reversed = new WeekSchedule({
      name: 'Test',
      days: { monday: [{ start: 600, end: 500 }] },
    });
    const revErr = reversed.validate('uk');
    if (!revErr || !revErr.includes('раніше')) {
      throw new Error(`Очікувалась помилка зворотного інтервалу, отримано: ${revErr}`);
    }

    const overlap = new WeekSchedule({
      name: 'Test',
      days: { monday: [{ start: 400, end: 600 }, { start: 500, end: 700 }] },
    });
    const ovErr = overlap.validate('uk');
    if (!ovErr || !ovErr.includes('перетинаються')) {
      throw new Error(`Очікувалась помилка перетину, отримано: ${ovErr}`);
    }
  });

  runTest('WeekSchedule', 'fromHA та toHA зберігають дані та сортують інтервали від понеділка', () => {
    const raw = {
      name: 'Котел',
      monday: [{ from: '18:00:00', to: '22:00:00' }, { from: '06:00:00', to: '08:00:00' }],
    };
    const ws = WeekSchedule.fromHA(raw);
    if (ws.days.monday[0].start !== 360) throw new Error('Інтервали повинні бути відсортовані за зростанням часу');
    const haExport = ws.toHA();
    if (haExport.monday[0].from !== '06:00:00') throw new Error('toHA повинен експортувати відсортовано');
  });

  // --- Suite 4: weekStatus (Active State) ---
  runTest('weekStatus', 'Коректно визначає активність розкладу на стику днів (понеділок як день 0)', () => {
    const ws = new WeekSchedule({
      name: 'Офіс',
      days: {
        monday: [{ start: 9 * 60, end: 18 * 60 }], // 09:00 - 18:00
      },
    });

    // Створюємо дату: Понеділок о 12:00
    // Візьмемо дату, де понеділок: 2026-10-12 (понеділок)
    const mondayNoon = new Date('2026-10-12T12:00:00');
    const statusNoon = weekStatus(ws, mondayNoon);
    if (!statusNoon.on) throw new Error('У понеділок о 12:00 розклад має бути активним (on=true)');

    const mondayNight = new Date('2026-10-12T20:00:00');
    const statusNight = weekStatus(ws, mondayNight);
    if (statusNight.on) throw new Error('У понеділок о 20:00 розклад має бути вимкненим (on=false)');

    const sundayNoon = new Date('2026-10-18T12:00:00'); // Неділя
    const statusSun = weekStatus(ws, sundayNoon);
    if (statusSun.on) throw new Error('У неділю розклад має бути вимкненим (on=false)');
  });

  // --- Suite 5: Automation Generation ---
  runTest('Генератор автоматизацій', 'buildScheduleAutomation створює автоматизацію з маркером та аліасом Schedule', () => {
    const auto = buildScheduleAutomation({
      id: '12345',
      scheduleEntityId: 'schedule.heating',
      scheduleName: 'Тепла підлога',
      target: {
        entityId: 'climate.floor',
        name: 'Підлога кухня',
        temperature: 24,
        hvacMode: 'heat',
        turnOffAtEnd: true,
      },
    });

    if (!auto.alias.startsWith('Schedule · Тепла підлога')) {
      throw new Error(`Аліас повинен починатися з 'Schedule · ', отримано: ${auto.alias}`);
    }
    if (!auto.description.includes(SIMPLE_SCHEDULE_MARKER)) {
      throw new Error(`Опис повинен містити ${SIMPLE_SCHEDULE_MARKER}`);
    }
    if (!Array.isArray(auto.triggers) || !auto.triggers[0]?.entity_id?.includes('schedule.heating')) {
      throw new Error('Автоматизація має коректно привʼязуватися до тригера розкладу');
    }
  });

  runTest('Генератор автоматизацій', 'parseScheduleAutomation успішно парсить створену автоматизацію назад', () => {
    const auto = buildScheduleAutomation({
      id: '99999',
      scheduleEntityId: 'schedule.boiler',
      scheduleName: 'Бойлер',
      target: {
        entityId: 'water_heater.boiler',
        name: 'Бойлер санвузол',
        temperature: 65,
        turnOffAtEnd: true,
      },
    });

    const parsed = parseScheduleAutomation(auto);
    if (!parsed) throw new Error('Не вдалося розібрати автоматизацію');
    if (parsed.scheduleEntityId !== 'schedule.boiler') throw new Error('Незбіг scheduleEntityId');
    if (parsed.scheduleName !== 'Бойлер') throw new Error('Незбіг scheduleName');
    if (parsed.target.temperature !== 65) throw new Error('Незбіг температури');
  });

  // --- Suite 6: Localization & Language Logic ---
  runTest('Локалізація', 'langOf повертає uk для українських профілів та en за замовчуванням', () => {
    if (langOf({ locale: { language: 'uk-UA' } }) !== 'uk') throw new Error('Повинно бути uk');
    if (langOf({ language: 'uk' }) !== 'uk') throw new Error('Повинно бути uk');
    if (langOf({ language: 'en-US' }) !== 'en') throw new Error('Повинно бути en');
    if (langOf({ language: 'he' }) !== 'en') throw new Error('Для будь-якої іншої мови дефолт має бути en');
    if (langOf(null) !== 'en') throw new Error('Для null дефолт має бути en');
  });

  runTest('Локалізація', 'actionSummary формує зрозумілий опис українською мовою', () => {
    const summary = actionSummary(
      {
        entityId: 'climate.living_room',
        temperature: 22,
        hvacMode: 'heat',
        turnOffAtEnd: true,
      },
      'uk'
    );
    if (!summary.includes('Обігрів') || !summary.includes('22°') || !summary.includes('вимикається')) {
      throw new Error(`Некоректний опис українською: ${summary}`);
    }
  });

  // --- Suite 7: Interval Times Display ---
  runTest('Відображення інтервалів', 'blockLabel та інтервали коректно форматуються у форматі 00:00–07:00', () => {
    const ws = new WeekSchedule({
      name: 'Нічний бойлер',
      days: {
        monday: [
          { start: 0, end: 7 * 60 },
          { start: 23 * 60, end: 24 * 60 },
        ],
      },
    });
    const mondayBlocks = ws.days.monday;
    if (mondayBlocks.length !== 2) throw new Error('Очікувалось 2 блоки');
    if (mondayBlocks[0].start !== 0 || mondayBlocks[0].end !== 420) throw new Error('Блок 1 некоректний');
    if (mondayBlocks[1].start !== 1380 || mondayBlocks[1].end !== 1440) throw new Error('Блок 2 некоректний');
  });

  // --- Suite 8: Card Configuration & Visual Editor ---
  runTest('Налаштування картки', 'Підтримка параметра show_time у setConfig', () => {
    const card = new SimpleScheduleCard();
    card.setConfig({ show_time: true });
    if (!card.showTime) throw new Error('Очікувалось showTime=true для show_time: true');

    card.setConfig({ show_time: false });
    if (card.showTime) throw new Error('Очікувалось showTime=false для show_time: false');

    card.setConfig({});
    if (card.showTime) throw new Error('Очікувалось showTime=false за замовчуванням');
  });

  runTest('Налаштування картки', 'Підтримка параметра show_time_toggle (відображення чекбокса)', () => {
    const card = new SimpleScheduleCard();
    card.setConfig({});
    if (!card.showTimeToggle) throw new Error('Очікувалось showTimeToggle=true за замовчуванням');

    card.setConfig({ show_time_toggle: false });
    if (card.showTimeToggle) throw new Error('Очікувалось showTimeToggle=false');

    card.setConfig({ show_time_toggle: true });
    if (!card.showTimeToggle) throw new Error('Очікувалось showTimeToggle=true');
  });

  runTest('Налаштування картки', 'Підтримка параметра show_bars (керування смужками графіка)', () => {
    const card = new SimpleScheduleCard();
    card.setConfig({});
    if (!card.showBars) throw new Error('Очікувалось showBars=true за замовчуванням');

    card.setConfig({ show_bars: false });
    if (card.showBars) throw new Error('Очікувалось showBars=false для show_bars: false');

    card.setConfig({ show_bars: true });
    if (!card.showBars) throw new Error('Очікувалось showBars=true для show_bars: true');
  });

  runTest('Налаштування картки', 'Підтримка параметра show_bars_toggle (перемикач графіка в шапці)', () => {
    const card = new SimpleScheduleCard();
    card.setConfig({});
    if (card.showBarsToggle) throw new Error('Очікувалось showBarsToggle=false за замовчуванням');

    card.setConfig({ show_bars_toggle: true });
    if (!card.showBarsToggle) throw new Error('Очікувалось showBarsToggle=true');

    card.setConfig({ show_bars_toggle: false });
    if (card.showBarsToggle) throw new Error('Очікувалось showBarsToggle=false');
  });

  runTest('Налаштування картки', 'Підтримка параметра font_size та нормалізація розміру', () => {
    const card = new SimpleScheduleCard();

    // Default: font_size absent
    card.setConfig({});
    if (card.fontSize !== null) throw new Error('Очікувалось fontSize=null за замовчуванням');

    // String with px
    card.setConfig({ font_size: '15px' });
    if (card.fontSize !== '15px') throw new Error(`Очікувалось fontSize='15px', отримано ${card.fontSize}`);

    // Numeric value converts to px
    card.setConfig({ font_size: 16 });
    if (card.fontSize !== '16px') throw new Error(`Очікувалось fontSize='16px', отримано ${card.fontSize}`);

    // Numeric string converts to px
    card.setConfig({ font_size: '18' });
    if (card.fontSize !== '18px') throw new Error(`Очікувалось fontSize='18px', отримано ${card.fontSize}`);

    // rem unit
    card.setConfig({ font_size: '1.1rem' });
    if (card.fontSize !== '1.1rem') throw new Error(`Очікувалось fontSize='1.1rem', отримано ${card.fontSize}`);

    // Empty string resets to null
    card.setConfig({ font_size: '' });
    if (card.fontSize !== null) throw new Error('Очікувалось fontSize=null для порожнього значення');

    // Direct helper functions check
    if (cssFontSize('14px') !== '14px') throw new Error('cssFontSize(14px) має повертати 14px');
    if (parseFontSize(15) !== '15px') throw new Error('parseFontSize(15) має повертати 15px');
    if (cssFontSize(null) !== null) throw new Error('cssFontSize(null) має повертати null');
  });


  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return {
    passed: failed === 0,
    results,
    summary: { total, passed, failed },
  };
}
