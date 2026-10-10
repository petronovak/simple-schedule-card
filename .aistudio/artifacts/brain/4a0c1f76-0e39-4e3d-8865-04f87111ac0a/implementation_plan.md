# Schedule Helper Card: Повна переробка (Пн–Нд, UK/EN, Тести та Інтерактивна студія)

Повна модернізація та адаптація форку проєкту `schedule-helper-card`: повне видалення релігійних режимів Shabbat/Chag та івриту, понеділок як перший день тижня, повноцінна українська локалізація (англійська за замовчуванням), оновлений набір тестів (`node --test`) та інтерактивна візуальна студія для тестування картки.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> На основі структури репозиторію (`dist/schedule-helper-card.js`, `tests/fake-hass.mjs`, `tests/schedule.test.mjs`, `tests/ops.test.mjs`, `tests/ui-logic.test.mjs`), ми реалізуємо повну екосистему:
> 1. Чистий файл картки `schedule-helper-card.js` без Shabbat/Chag та івриту.
> 2. Повний набір юніт-тестів, адаптований під понеділок і нову локалізацію, з можливістю запуску через `node --test`.
> 3. Інтерактивну веб-студію з реальною карткою Home Assistant, симулятором пристроїв, запуском тестів та кнопкою швидкого завантаження готового файлу.

- **Картка (`schedule-helper-card.js`)**:
  - `DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']`.
  - Мови: `uk` (Українська) та `en` (English, дефолтна). Іврит (`he`) повністю видалено.
  - Повністю вирізано код `ScheduleHelperShabbatCard`, еврейський календар (`Hebcal`, `Jewish Calendar`), сенсори свічок, авдали, чіпи та мітки режимів.
  - Очищено маркери автоматизацій: `Schedule · <name>` замість `Beit · <name>`.
- **Набір тестів (`tests/`)**:
  - `tests/schedule.test.mjs`: перевірка розбору часу, валідації тижня, розрахунку `weekStatus` для понеділка як дня 0, експорту в формат Home Assistant.
  - `tests/ops.test.mjs`: перевірка генерації автоматизацій для клімату, бойлерів, освітлення, реле, штор.
  - `tests/ui-logic.test.mjs`: перевірка українських описів дій (`actionSummary`), групування кімнат та списку пристроїв.
- **Інтерактивна студія**:
  - Живе відображення Web Component `<schedule-helper-card>` у симуляторі Home Assistant (світла/темна тема).
  - Модальне вікно редактора розкладів з понеділком як першим днем, вибором пристроїв, введенням інтервалів.
  - Панель швидкого експорту: завантаження готового `schedule-helper-card.js`, копіювання коду та Lovelace YAML.
  - Панель статусу тестів.

---

### 1. Overview & Core Concept

- **What It Does**: Очищена, високопродуктивна версія кастомної картки Home Assistant для керування вбудованими планувальниками (`schedule`) та пов'язаними автоматизаціями для розумного дому.
- **Перший день тижня**: Понеділок (Пн–Нд). Усі часові шкали, дні в редакторі, копіювання («Будні» = Пн–Пт) та математика активності розраховуються від понеділка.
- **Мова**: Автоматичне визначення української мови (`uk`) або англійської (`en`) за замовчуванням.

---

### 2. User Experience & Visual Design

- **Головний екран студії**:
  1. **Панель навігації**: перемикання між вкладками:
     - 📱 **Прев'ю картки (Live Card)**: реальний відрендерений веб-компонент у симуляторі Home Assistant.
     - 🧪 **Тести (Test Suite)**: статус та результати проходження юніт-тестів.
     - 📄 **Вихідний код (Clean Code)**: готовий файл `schedule-helper-card.js` із підсвічуванням синтаксису, кнопками «Завантажити файл» та «Копіювати».
     - ⚙️ **Lovelace YAML**: готові конфігурації для дашборду Home Assistant.
  2. **Інтерактивність картки**:
     - Створення нових розкладів через діалог картки.
     - Додавання часових інтервалів (наприклад, 07:00–09:00 та 18:00–23:00).
     - Копіювання на інші дні тижня.
     - Зміна цільових пристроїв (термостат із температурою, бойлер, смарт-лампа з яскравістю).
     - Перемикання мови картки (UK / EN) на льоту.

---

### 3. Key Technical Decisions & Changes in Code

- **Рефакторинг тижневої моделі**:
  ```javascript
  export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  export const DAY_NAMES = {
    uk: ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'],
    en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  };
  export const DAY_SHORT = {
    uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
    en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  };
  ```
- **Розрахунок активного часу (`weekStatus`)**:
  ```javascript
  // В JS 0 - неділя, 1 - понеділок. Для нашої моделі понеділок = 0, неділя = 6:
  const dayIndex = (now.getDay() + 6) % 7;
  const t = dayIndex * 1440 + now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  ```
- **Пресети копіювання**:
  - `weekdays`: `[0, 1, 2, 3, 4]` (Понеділок – П'ятниця).
  - `wholeWeek`: `[0, 1, 2, 3, 4, 5, 6]` (Понеділок – Неділя).
- **Визначення мови**:
  ```javascript
  export const langOf = (hass) => (/^uk\b/i.test(String(hass?.locale?.language || hass?.language || '')) ? 'uk' : 'en');
  ```
- **Очищення автоматизацій**:
  - Заміна `BEIT_MARKER` на `SCHEDULE_HELPER_MARKER = 'Created by Schedule Helper Card'`.
  - Префікс `scheduleAlias = (name) => 'Schedule · ' + name`.
  - Видалення всіх обробників міток Шабату та автоматичного вимикання після закінчення Шабату.

---

### 4. Technical Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Schedule Helper Card Studio                          │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│    Live Preview     │        Test Runner       │    Export & Lovelace  │
│  • <schedule-       │  • week model tests      │  • schedule-helper-   │
│    helper-card>     │  • weekStatus Monday     │    card.js download   │
│  • Visual timeline  │  • UK/EN validation      │  • resources YAML     │
│  • Editor dialog    │  • automation builder    │  • dashboard config   │
└──────────┬──────────┴─────────────┬────────────┴───────────┬───────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Clean Card Core Engine (ES Module)                   │
│  • DAYS: Monday → Sunday (0..6)                                        │
│  • Strings: Ukrainian (uk) + English (en, default)                     │
│  • HA Native Schedule & Automation objects                             │
│  • Zero Shabbat/Chag/Hebrew dependencies                               │
└────────────────────────────────────────────────────────────────────────┘
```
