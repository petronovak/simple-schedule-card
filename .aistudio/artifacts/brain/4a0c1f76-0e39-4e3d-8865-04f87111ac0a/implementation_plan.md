# Повне видалення `show_times` та перехід на `show_time` і `show_time_toggle`

План повного припинення підтримки застарілого параметра `show_times` (зворотної сумісності) у кодовій базі Simple Schedule Card, щоб у конфігурації, візуальному редакторі, тестах та документації використовувалися виключно чисті параметри `show_time` та `show_time_toggle`.

### User Review & Critical Decisions

> [!IMPORTANT]
> Підтверджено користувачем: повне видалення зворотної сумісності для `show_times`. Усі сценарії читання, запису та синхронізації будуть орієнтовані суворо на `show_time` та `show_time_toggle`.

- **Підтверджене рішення**: Прибрати будь-які перевірки та фолбеки на `show_times`.
- **Основні параметри**:
  - `show_time` (boolean, за замовчуванням `false`) — числове відображення інтервалів годин.
  - `show_time_toggle` (boolean, за замовчуванням `true`) — відображення перемикача часу в шапці картки.

---

### 1. Overview & Core Concept

- **Мета**: Спростити конфігураційну модель картки, усунувши дублювання та застарілі найменування (`show_times`). Забезпечити єдиний передбачуваний стандарт налаштування.
- **Цільова аудиторія**: Користувачі та розробники дашбордів Home Assistant Lovelace.
- **Ключова цінність**: Чистий API конфігурації без плутанини між одниною та множиною, менший розмір бандла та суворіша типізація.

---

### 2. User Experience & Visual Design

- **Візуальний редактор (Visual Editor)**:
  - Відображає чекбокси для опцій:
    - «Показувати час інтервалів цифрами» (`show_time`)
    - «Показувати перемикач часу в шапці картки» (`show_time_toggle`)
  - Збереження у YAML генерує виключно поле `show_time`.
- **Шапка картки (Card Header)**:
  - Якщо `show_time_toggle: true` (або опущено) — відображається інтерактивний чекбокс із підписом «Показувати час».
  - Якщо `show_time_toggle: false` — чекбокс повністю приховується з шапки.

---

### 3. Key Product Decisions & Trade-Offs

- **Видалення зворотної сумісності**:
  - *Обраний підхід*: Повне видалення читання `config.show_times`. Конфігурації тепер приймають виключно `show_time`.
  - *Чому*: Попереджує розсинхронізацію значень у візуальному редакторі та спрощує логіку читання/збереження конфігурації.
- **Очищення геттерів та коду картки**:
  - Картка використовуватиме геттер `showTime` для читання поточного стану відображення часу.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Home Assistant Lovelace                   │
│                                                             │
│  YAML Config / Editor:                                      │
│  - show_time: boolean                                       │
│  - show_time_toggle: boolean                                │
└──────────────────────────────┬──────────────────────────────┘
                               │ setConfig()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SimpleScheduleCard                       │
│                                                             │
│  - this._showTimes = Boolean(config.show_time ?? false)     │
│  - this._showTimeToggle = config.show_time_toggle !== false │
│  - get showTime() => boolean                                │
└──────────────────────────────┬──────────────────────────────┘
                               │ render()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Shadow DOM                           │
│                                                             │
│  - Header toggle: renders if _showTimeToggle is true        │
│  - Timeline bars: renders interval time text if _showTimes  │
└─────────────────────────────────────────────────────────────┘
```

#### Заплановані зміни:
1. **`src/card/simple-schedule-card.ts`**:
   - У `setConfig`: видалити фолбек на `config?.show_times`, використовувати лише `config?.show_time`.
   - У `SimpleScheduleCardEditor`:
     - Очистити `isShowTime = Boolean(c.show_time ?? false)`.
     - У слухачах `_attachListeners`: обробляти лише `key === 'show_time'`, прибрати логіку видалення `show_times`.
     - У `syncFormValues`: шукати лише селектор `[data-bool="show_time"]`.
2. **`src/tests/testSuite.ts` та `tests/schedule.test.mjs`**:
   - Оновити тести: замінити перевірки зворотної сумісності `show_times` на чітке тестування `show_time` та `show_time_toggle`.
3. **`README.md`**:
   - Видалити згадки про застарілий `show_times` із таблиці параметрів.
4. **Збірка та верифікація**:
   - Виконати `npm run build:card`, `npm test` та `compile_applet`.
