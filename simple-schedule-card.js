const VERSION = "1.0.0";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_NAMES = {
  uk: ["\u041F\u043E\u043D\u0435\u0434\u0456\u043B\u043E\u043A", "\u0412\u0456\u0432\u0442\u043E\u0440\u043E\u043A", "\u0421\u0435\u0440\u0435\u0434\u0430", "\u0427\u0435\u0442\u0432\u0435\u0440", "\u041F\u02BC\u044F\u0442\u043D\u0438\u0446\u044F", "\u0421\u0443\u0431\u043E\u0442\u0430", "\u041D\u0435\u0434\u0456\u043B\u044F"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
};
const DAY_SHORT = {
  uk: ["\u041F\u043D", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041F\u0442", "\u0421\u0431", "\u041D\u0434"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
};
function parseBlock(hms) {
  const p = String(hms).split(":").map((x) => parseInt(x, 10));
  const minutes = p[0] * 60 + (p[1] || 0);
  return p.length > 2 && p[2] === 59 && minutes === 1439 ? 1440 : minutes;
}
function formatBlock(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
}
function parseTimeInput(text) {
  const v = String(text ?? "").trim().replace(/[.,;]/g, ":");
  let m = v.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) {
    const digits = v.match(/^(\d{3,4})$/)?.[1];
    if (digits) m = [digits, digits.slice(0, -2), digits.slice(-2)];
  }
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === void 0 ? 0 : Number(m[2]);
  if (h > 24 || min > 59 || h === 24 && min !== 0) return null;
  return h * 60 + min;
}
const hm = (m) => formatBlock(m).slice(0, 5);
const blockLabel = (b) => `${hm(b.start)}\u2013${hm(b.end)}`;
const byStart = (a, b) => a.start - b.start;
class WeekSchedule {
  constructor({ name = "", days = {} } = {}) {
    this.name = name;
    this.days = {};
    for (const d of DAYS) {
      this.days[d] = (days[d] || []).map((b) => ({ ...b }));
    }
  }
  /** From a `schedule/list` item (or anything with the day keys). */
  static fromHA(j) {
    const days = {};
    for (const d of DAYS) {
      days[d] = (j?.[d] || []).map((b) => ({
        start: parseBlock(b.from),
        end: parseBlock(b.to),
        ...b.data ? { data: b.data } : {}
      })).sort(byStart);
    }
    return new WeekSchedule({ name: j?.name ?? "", days });
  }
  /** The body HA's `schedule/create` and `schedule/update` expect (minus the id). Days go out Monday first, sorted. */
  toHA() {
    const out = { name: this.name.trim() };
    for (const d of DAYS) {
      out[d] = [...this.days[d] || []].sort(byStart).map((b) => ({
        from: formatBlock(b.start),
        to: formatBlock(b.end),
        ...b.data ? { data: b.data } : {}
      }));
    }
    return out;
  }
  get isEmpty() {
    return DAYS.every((d) => !(this.days[d] || []).length);
  }
  clone() {
    return new WeekSchedule({ name: this.name, days: this.days });
  }
  /** Why HA would reject this week, in words; null when it is valid. */
  validate(lang = "uk") {
    const t = STRINGS[lang] || STRINGS.en;
    if (!this.name.trim()) return t.errName;
    for (let i = 0; i < DAYS.length; i++) {
      const d = DAYS[i];
      const blocks = [...this.days[d] || []].sort(byStart);
      const day = (DAY_NAMES[lang] || DAY_NAMES.en)[i];
      for (let k = 0; k < blocks.length; k++) {
        if (blocks[k].end <= blocks[k].start) return t.errReversed(day);
        if (k > 0 && blocks[k].start < blocks[k - 1].end) return t.errOverlap(day);
      }
    }
    return null;
  }
}
const SIMPLE_SCHEDULE_MARKER = "Created by Simple Schedule Card";
const LEGACY_MARKERS = [
  "Created by Simple Schedule Card",
  "Created by Schedule Helper Card",
  "\u043D\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443",
  "\u05E0\u05D5\u05E6\u05E8 \u05D1\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D9\u05EA Beit"
];
const domainOf = (entityId) => String(entityId).split(".")[0];
const given = (v) => v !== null && v !== void 0;
function onActions(target) {
  const domain = domainOf(target.entityId);
  const t = { entity_id: target.entityId };
  switch (domain) {
    case "climate":
      if (given(target.temperature)) {
        const data = { temperature: target.temperature };
        if (given(target.hvacMode)) data.hvac_mode = target.hvacMode;
        return [{ action: "climate.set_temperature", target: t, data }];
      }
      return [{ action: "climate.set_hvac_mode", target: t, data: { hvac_mode: target.hvacMode ?? "cool" } }];
    case "water_heater":
      return [
        { action: "water_heater.turn_on", target: t },
        ...given(target.temperature) ? [{ action: "water_heater.set_temperature", target: t, data: { temperature: target.temperature } }] : []
      ];
    case "light":
      return [
        {
          action: "light.turn_on",
          target: t,
          ...given(target.brightnessPct) ? { data: { brightness_pct: target.brightnessPct } } : {}
        }
      ];
    case "cover":
      return [{ action: "cover.open_cover", target: t }];
    case "valve":
      return [{ action: "valve.open_valve", target: t }];
    default:
      return [{ action: `${domain}.turn_on`, target: t }];
  }
}
function offActions(target) {
  if (target.turnOffAtEnd === false) return [];
  const domain = domainOf(target.entityId);
  const t = { entity_id: target.entityId };
  switch (domain) {
    case "cover":
      return [{ action: "cover.close_cover", target: t }];
    case "valve":
      return [{ action: "valve.close_valve", target: t }];
    case "media_player":
      return [{ action: "media_player.media_pause", target: t }];
    default:
      return [{ action: `${domain}.turn_off`, target: t }];
  }
}
const scheduleAlias = (scheduleName) => `Schedule \xB7 ${scheduleName}`;
function buildScheduleAutomation({
  id,
  scheduleEntityId,
  scheduleName,
  target
}) {
  const notFrom = ["unavailable", "unknown"];
  const off = offActions(target);
  const trigger = (to, tid) => ({
    trigger: "state",
    entity_id: [scheduleEntityId],
    to: [to],
    not_from: notFrom,
    id: tid
  });
  const branch = (tid, sequence) => ({
    conditions: [{ condition: "trigger", id: tid }],
    sequence
  });
  return {
    id,
    alias: scheduleAlias(scheduleName),
    description: `${SIMPLE_SCHEDULE_MARKER} \u2014 ${target.name ?? target.entityId} (${scheduleEntityId})`,
    triggers: [trigger("on", "schedule_on"), ...off.length ? [trigger("off", "schedule_off")] : []],
    conditions: [],
    actions: [
      {
        choose: [
          branch("schedule_on", onActions(target)),
          ...off.length ? [branch("schedule_off", off)] : []
        ]
      }
    ],
    mode: "queued"
  };
}
const isOurs = (config) => {
  const desc = String(config?.description ?? "");
  return LEGACY_MARKERS.some((m) => desc.includes(m));
};
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
const sameConfig = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function parseScheduleAutomation(config) {
  if (!isOurs(config)) return null;
  const choose = config.actions?.[0]?.choose;
  const on = choose?.[0]?.sequence;
  const scheduleEntityId = config.triggers?.[0]?.entity_id?.[0];
  const first = on?.[0];
  const entityId = first?.target?.entity_id;
  const alias = String(config.alias ?? "");
  const isScheduleAlias = alias.startsWith("Schedule \xB7 ") || alias.startsWith("Beit \xB7 ");
  if (!scheduleEntityId || typeof entityId !== "string" || !isScheduleAlias) return null;
  const data = first.data || {};
  const nameMatch = String(config.description).match(/ — (.*) \((schedule\.[a-z0-9_]+)\)$/) || String(config.description).match(/ — (.*) לפי schedule\.[a-z0-9_]+$/);
  const name = nameMatch?.[1] ?? entityId;
  const target = {
    entityId,
    name,
    hvacMode: data.hvac_mode ?? null,
    temperature: data.temperature ?? on[1]?.data?.temperature ?? null,
    brightnessPct: data.brightness_pct ?? null,
    turnOffAtEnd: (choose?.length ?? 0) > 1
  };
  const prefixLen = alias.startsWith("Schedule \xB7 ") ? "Schedule \xB7 ".length : "Beit \xB7 ".length;
  const scheduleName = alias.slice(prefixLen);
  return { scheduleEntityId, scheduleName, target };
}
function schedulesIn(config, states = null) {
  const ids = [...new Set(JSON.stringify(config ?? {}).match(/schedule\.[a-z0-9_]+/g) || [])];
  return states ? ids.filter((id) => id in states) : ids;
}
const MINUTES_PER_WEEK = 7 * 1440;
function weekStatus(week, now = /* @__PURE__ */ new Date()) {
  const ranges = [];
  DAYS.forEach((d, i) => {
    for (const b of week.days[d] || []) {
      ranges.push([i * 1440 + b.start, i * 1440 + b.end]);
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  if (!merged.length) return { on: false, next: null };
  if (merged.length === 1 && merged[0][0] === 0 && merged[0][1] === MINUTES_PER_WEEK) {
    return { on: true, next: null };
  }
  if (merged.length > 1 && merged.at(-1)[1] === MINUTES_PER_WEEK && merged[0][0] === 0) {
    const tail = merged.pop();
    merged[0] = [tail[0], merged[0][1] + MINUTES_PER_WEEK];
  }
  const dayIndex = (now.getDay() + 6) % 7;
  const t = dayIndex * 1440 + now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const inside = (r, x) => x >= r[0] && x < r[1];
  const on = merged.find((r) => inside(r, t) || inside(r, t + MINUTES_PER_WEEK));
  let delta;
  if (on) {
    delta = inside(on, t) ? on[1] - t : on[1] - (t + MINUTES_PER_WEEK);
  } else {
    delta = Math.min(...merged.map((r) => ((r[0] - t) % MINUTES_PER_WEEK + MINUTES_PER_WEEK) % MINUTES_PER_WEEK));
  }
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + Math.round(delta + now.getSeconds() / 60));
  return { on: !!on, next };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errorText = (err) => err?.body?.message || err?.message || typeof err?.error === "string" && err.error || (typeof err === "string" ? err : JSON.stringify(err));
async function waitForEntity(hass, test, { tries = 40, every = 150 } = {}) {
  for (let i = 0; i < tries; i++) {
    const hit = Object.values(hass.states || {}).find(test);
    if (hit) return hit;
    await sleep(every);
  }
  throw new Error("Home Assistant did not report the new entity");
}
async function scheduleIdsOf(hass, entityIds) {
  const pairs = await Promise.all(
    entityIds.map(async (id) => {
      const e = await hass.callWS({ type: "config/entity_registry/get", entity_id: id }).catch(() => null);
      return [id, e?.platform === "schedule" && e.unique_id ? String(e.unique_id) : null];
    })
  );
  return Object.fromEntries(pairs.filter(([, u]) => u));
}
async function scheduleEntityFor(hass, scheduleId, { tries = 40, every = 150 } = {}) {
  const re = new RegExp(`^schedule\\.${scheduleId}(_\\d+)?$`);
  for (let i = 0; i < tries; i++) {
    const candidates = Object.keys(hass.states || {}).filter((id) => re.test(id));
    if (candidates.length) {
      const ids = await scheduleIdsOf(hass, candidates);
      const hit = candidates.find((c) => ids[c] === scheduleId);
      if (hit) return hit;
    }
    await sleep(every);
  }
  throw new Error("Home Assistant did not report the new schedule");
}
async function listSchedules(hass) {
  const list = await hass.callWS({ type: "schedule/list" });
  return Object.fromEntries((list || []).map((s) => [s.id, WeekSchedule.fromHA(s)]));
}
async function readSchedules(hass, entityIds) {
  if (!entityIds.length) return {};
  const res = await hass.callService("schedule", "get_schedule", {}, { entity_id: entityIds }, false, true);
  const weeks = res?.response ?? {};
  return Object.fromEntries(
    Object.entries(weeks).map(([id, days]) => [id, WeekSchedule.fromHA({ ...days, name: "" })])
  );
}
const updateSchedule = (hass, id, week) => hass.callWS({ type: "schedule/update", schedule_id: id, ...week.toHA() });
async function automationsFor(hass, entityId) {
  const r = await hass.callWS({ type: "search/related", item_type: "entity", item_id: entityId });
  return r?.automation || [];
}
async function automationConfig(hass, automationEntityId) {
  const r = await hass.callWS({ type: "automation/config", entity_id: automationEntityId });
  return r?.config ?? null;
}
async function createScheduleWithAutomation(hass, week, target, { waitOptions } = {}) {
  const created = await hass.callWS({ type: "schedule/create", ...week.toHA() });
  let scheduleEntityId;
  try {
    scheduleEntityId = await scheduleEntityFor(hass, created.id, waitOptions);
  } catch (err) {
    await hass.callWS({ type: "schedule/delete", schedule_id: created.id });
    throw err;
  }
  const automationId = String(Date.now());
  try {
    await hass.callApi(
      "POST",
      `config/automation/config/${automationId}`,
      buildScheduleAutomation({ id: automationId, scheduleEntityId, scheduleName: week.name.trim(), target })
    );
  } catch (err) {
    await hass.callWS({ type: "schedule/delete", schedule_id: created.id });
    throw err;
  }
  return scheduleEntityId;
}
async function deleteSchedule(hass, scheduleEntityId, scheduleId = scheduleEntityId.slice("schedule.".length)) {
  const kept = [];
  for (const a of await automationsFor(hass, scheduleEntityId)) {
    const cfg = await automationConfig(hass, a);
    if (isOurs(cfg) && cfg?.id != null) {
      await hass.callApi("DELETE", `config/automation/config/${cfg.id}`);
    } else {
      kept.push(hass.states?.[a]?.attributes?.friendly_name || a);
    }
  }
  await hass.callWS({ type: "schedule/delete", schedule_id: scheduleId });
  return kept;
}
async function rewriteScheduleAutomation(hass, config, { scheduleName, target }) {
  const parsed = parseScheduleAutomation(config);
  if (!parsed) throw new Error("\u0426\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u0431\u0443\u043B\u0430 \u0437\u043C\u0456\u043D\u0435\u043D\u0430 \u0432\u0440\u0443\u0447\u043D\u0443; \u0440\u0435\u0434\u0430\u0433\u0443\u0439\u0442\u0435 \u0457\u0457 \u0432 Home Assistant");
  const next = buildScheduleAutomation({
    id: config.id,
    scheduleEntityId: parsed.scheduleEntityId,
    scheduleName: (scheduleName ?? parsed.scheduleName).trim(),
    target: target ?? parsed.target
  });
  if (sameConfig(next, config)) return false;
  await hass.callApi("POST", `config/automation/config/${config.id}`, next);
  return true;
}
async function renameScheduleAutomations(hass, automationEntityIds, oldName, newName) {
  const renamed = [];
  if (oldName.trim() === newName.trim()) return renamed;
  for (const id of automationEntityIds) {
    const cfg = await automationConfig(hass, id);
    if (!isOurs(cfg) || cfg.id == null) continue;
    const oldAlias = scheduleAlias(oldName.trim());
    const legacyOldAlias = `Beit \xB7 ${oldName.trim()}`;
    if (cfg.alias !== oldAlias && cfg.alias !== legacyOldAlias) continue;
    await hass.callApi("POST", `config/automation/config/${cfg.id}`, {
      ...cfg,
      alias: scheduleAlias(newName.trim())
    });
    renamed.push(id);
  }
  return renamed;
}
const setAutomationEnabled = (hass, automationEntityId, enabled) => hass.callService("automation", enabled ? "turn_on" : "turn_off", {}, { entity_id: automationEntityId });
const PICKABLE_DOMAINS = [
  "climate",
  "water_heater",
  "light",
  "switch",
  "fan",
  "cover",
  "valve",
  "input_boolean",
  "media_player",
  "vacuum",
  "siren"
];
function deviceSections({
  states,
  display,
  devices = [],
  areas = [],
  domains = null,
  only = null
}, query = "", noAreaTitle = "\u0411\u0435\u0437 \u043A\u0456\u043C\u043D\u0430\u0442\u0438", lang = "uk") {
  const meta = Object.fromEntries((display?.entities || []).map((e) => [e.ei, e]));
  const deviceArea = Object.fromEntries(devices.map((d) => [d.id, d.area_id]));
  const q = query.trim().toLowerCase();
  const byArea = /* @__PURE__ */ new Map();
  for (const e of Object.values(states || {})) {
    const domain = domainOf(e.entity_id);
    if (!PICKABLE_DOMAINS.includes(domain)) continue;
    if (domains?.length && !domains.includes(domain)) continue;
    if (only && domain !== only) continue;
    const m = meta[e.entity_id];
    if (m && (m.hb || m.ec !== void 0 && m.ec !== null)) continue;
    const areaId = m?.ai ?? (m?.di ? deviceArea[m.di] : null) ?? null;
    if (!byArea.has(areaId)) byArea.set(areaId, []);
    byArea.get(areaId).push(e);
  }
  const order = (e) => PICKABLE_DOMAINS.indexOf(domainOf(e.entity_id));
  const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name, lang));
  const sections = [
    ...sorted.map((a) => ({ areaId: a.area_id, title: a.name })),
    { areaId: null, title: noAreaTitle }
  ];
  return sections.map((sec) => ({
    ...sec,
    entities: (byArea.get(sec.areaId) || []).filter(
      (e) => !q || entityName(e).toLowerCase().includes(q) || sec.title.toLowerCase().includes(q) || e.entity_id.includes(q)
    ).sort((a, b) => order(a) - order(b) || entityName(a).localeCompare(entityName(b), lang))
  })).filter((sec) => sec.entities.length);
}
const VERBS = {
  uk: {
    on: "\u0432\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F",
    open: "\u0432\u0456\u0434\u043A\u0440\u0438\u0432\u0430\u0454\u0442\u044C\u0441\u044F",
    close: "\u0437\u0430\u043A\u0440\u0438\u0432\u0430\u0454\u0442\u044C\u0441\u044F",
    off: "\u0432\u0438\u043C\u0438\u043A\u0430\u0454\u0442\u044C\u0441\u044F",
    pause: "\u043F\u0440\u0438\u0437\u0443\u043F\u0438\u043D\u044F\u0454\u0442\u044C\u0441\u044F",
    stays: "\u0437\u0430\u043B\u0438\u0448\u0430\u0454\u0442\u044C\u0441\u044F \u0431\u0435\u0437 \u0437\u043C\u0456\u043D",
    play: "\u0432\u0456\u0434\u0442\u0432\u043E\u0440\u044E\u0454\u0442\u044C\u0441\u044F"
  },
  en: {
    on: "turns on",
    open: "opens",
    close: "closes",
    off: "turns off",
    pause: "pauses",
    stays: "stays as it is",
    play: "turns on"
  }
};
function actionSummary(target, lang = "uk") {
  const t = STRINGS[lang] || STRINGS.en;
  const v = VERBS[lang] || VERBS.en;
  const domain = domainOf(target.entityId);
  const details = [
    target.hvacMode && domain === "climate" ? t.hvac[target.hvacMode] || target.hvacMode : null,
    given(target.temperature) ? `${target.temperature}\xB0` : null,
    given(target.brightnessPct) ? `${target.brightnessPct}%` : null
  ].filter(Boolean);
  const start = (domain === "cover" || domain === "valve" ? v.open : domain === "media_player" ? v.play : v.on) + (details.length ? ` (${details.join(", ")})` : "");
  const end = target.turnOffAtEnd === false ? v.stays : domain === "cover" || domain === "valve" ? v.close : domain === "media_player" ? v.pause : v.off;
  return `${t.atStart}: ${start} \xB7 ${t.atEnd}: ${end}`;
}
function actionOptions(st) {
  const domain = domainOf(st.entity_id);
  const a = st.attributes || {};
  const hvacModes = domain === "climate" ? (a.hvac_modes || []).filter((m) => m !== "off") : [];
  const temp = domain === "climate" || domain === "water_heater" ? {
    min: Number(a.min_temp ?? 16),
    max: Number(a.max_temp ?? 30),
    step: Number(a.target_temp_step) > 0 ? Number(a.target_temp_step) : 1,
    initial: Number(a.temperature ?? Math.round(((a.min_temp ?? 16) + (a.max_temp ?? 30)) / 2))
  } : null;
  const brightness = domain === "light" && (a.supported_color_modes || []).some((m) => m !== "onoff");
  return {
    domain,
    hvacModes,
    defaultHvac: hvacModes.includes("heat") ? "heat" : hvacModes[0] ?? null,
    temp,
    brightness
  };
}
const STRINGS = {
  uk: {
    errName: "\u0412\u043A\u0430\u0436\u0456\u0442\u044C \u043D\u0430\u0437\u0432\u0443 \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443",
    errReversed: (day) => `${day}: \u0447\u0430\u0441 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u044F \u0440\u0430\u043D\u0456\u0448\u0435 \u0437\u0430 \u0447\u0430\u0441 \u043F\u043E\u0447\u0430\u0442\u043A\u0443`,
    errOverlap: (day) => `${day}: \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0438 \u043F\u0435\u0440\u0435\u0442\u0438\u043D\u0430\u044E\u0442\u044C\u0441\u044F \u043C\u0456\u0436 \u0441\u043E\u0431\u043E\u044E`,
    showTimes: "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0447\u0430\u0441",
    edShowTime: "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0447\u0430\u0441 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0456\u0432 \u0446\u0438\u0444\u0440\u0430\u043C\u0438",
    edShowTimeToggle: "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0447 \u0447\u0430\u0441\u0443 \u0432 \u0448\u0430\u043F\u0446\u0456 \u043A\u0430\u0440\u0442\u043A\u0438",
    schedules: "\u0420\u043E\u0437\u043A\u043B\u0430\u0434\u0438",
    newSchedule: "\u041D\u043E\u0432\u0438\u0439 \u0440\u043E\u0437\u043A\u043B\u0430\u0434",
    onNow: "\u041F\u0440\u0430\u0446\u044E\u0454 \u0437\u0430\u0440\u0430\u0437",
    offNow: "\u0412\u0438\u043C\u043A\u043D\u0435\u043D\u043E",
    starts: "\u043F\u043E\u0447\u0438\u043D\u0430\u0454\u0442\u044C\u0441\u044F",
    ends: "\u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0454\u0442\u044C\u0441\u044F",
    today: "\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456",
    tomorrow: "\u0437\u0430\u0432\u0442\u0440\u0430",
    onDay: (day) => `\u0443 ${day}`,
    at: (when, time) => `${when} \u043E ${time}`,
    yaml: "\u041D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E \u0432 YAML \u2014 \u0442\u0456\u043B\u044C\u043A\u0438 \u0447\u0438\u0442\u0430\u043D\u043D\u044F",
    noSchedules: "\u041D\u0435\u043C\u0430\u0454 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u0438\u0445 \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0456\u0432",
    loading: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F\u2026",
    readOnly: "\u0422\u0456\u043B\u044C\u043A\u0438 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434 \u2014 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043D\u043D\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0435 \u043B\u0438\u0448\u0435 \u0430\u0434\u043C\u0456\u043D\u0456\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430\u043C",
    editSchedule: "\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043D\u043D\u044F \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443",
    name: "\u041D\u0430\u0437\u0432\u0430 \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443",
    device: "\u0426\u0456\u043B\u044C\u043E\u0432\u0438\u0439 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439",
    chooseDevice: "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439",
    changeDevice: "\u0417\u043C\u0456\u043D\u0438\u0442\u0438",
    searchDevice: "\u041F\u043E\u0448\u0443\u043A \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E \u0430\u0431\u043E \u043A\u0456\u043C\u043D\u0430\u0442\u0438",
    noArea: "\u0411\u0435\u0437 \u043A\u0456\u043C\u043D\u0430\u0442\u0438",
    noDevices: "\u041F\u0440\u0438\u0441\u0442\u0440\u043E\u0457\u0432 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
    whileActive: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438 \u0432 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u043F\u0435\u0440\u0456\u043E\u0434",
    whatItDoes: "\u0429\u043E \u0432\u0438\u043A\u043E\u043D\u0443\u0454\u0442\u044C\u0441\u044F",
    handEdited: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u0431\u0443\u043B\u0430 \u0437\u043C\u0456\u043D\u0435\u043D\u0430 \u0432\u0440\u0443\u0447\u043D\u0443 \u0432 Home Assistant.",
    setTemp: "\u0412\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    brightness: "\u042F\u0441\u043A\u0440\u0430\u0432\u0456\u0441\u0442\u044C",
    turnOffAtEnd: "\u0412\u0438\u043C\u0438\u043A\u0430\u0442\u0438 \u043F\u0456\u0441\u043B\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u044F",
    closeAtEnd: "\u0417\u0430\u043A\u0440\u0438\u0432\u0430\u0442\u0438 \u043F\u0456\u0441\u043B\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u044F",
    drives: "\u041A\u0435\u0440\u0443\u0454 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0454\u043C",
    autoOn: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0430",
    autoOff: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u0430",
    drivesNothing: "\u0416\u043E\u0434\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u043D\u0435 \u043F\u0440\u0438\u0432\u02BC\u044F\u0437\u0430\u043D\u0430 \u0434\u043E \u0446\u044C\u043E\u0433\u043E \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443.",
    hours: "\u0410\u043A\u0442\u0438\u0432\u043D\u0456 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0438",
    addRange: "\u0406\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    from: "\u0417",
    to: "\u0414\u043E",
    midnightHint: "24-\u0433\u043E\u0434\u0438\u043D\u043D\u0438\u0439 \u0444\u043E\u0440\u043C\u0430\u0442; 00:00 \u0430\u0431\u043E 24:00 = \u0434\u043E \u043F\u0456\u0432\u043D\u043E\u0447\u0456",
    errTime: "\u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 \u0447\u0430\u0441. \u0412\u0432\u0435\u0434\u0456\u0442\u044C, \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 07:30 \u0430\u0431\u043E 2330",
    ok: "OK",
    cancel: "\u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438",
    copyTo: (day) => `\u0421\u043A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 ${day} \u043D\u0430\u2026`,
    weekdays: "\u0411\u0443\u0434\u043D\u0456 \u0434\u043D\u0456 (\u041F\u043D\u2013\u041F\u0442)",
    wholeWeek: "\u0412\u0435\u0441\u044C \u0442\u0438\u0436\u0434\u0435\u043D\u044C (\u041F\u043D\u2013\u041D\u0434)",
    copy: "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438",
    copyDays: "\u041A\u043E\u043F\u0456\u044E\u0432\u0430\u0442\u0438 \u043D\u0430 \u0456\u043D\u0448\u0456 \u0434\u043D\u0456",
    clearAll: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u0438 \u0432\u0441\u0435",
    save: "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438",
    delete: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438",
    close: "\u0417\u0430\u043A\u0440\u0438\u0442\u0438",
    back: "\u041D\u0430\u0437\u0430\u0434",
    deleteQ: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0446\u0435\u0439 \u0440\u043E\u0437\u043A\u043B\u0430\u0434?",
    deleteText: "\u0421\u0442\u0432\u043E\u0440\u0435\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u044F \u0442\u0430\u043A\u043E\u0436 \u0431\u0443\u0434\u0435 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0430 \u0437 Home Assistant.",
    kept: (list) => `\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0456\u0457, \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u0456 \u0432\u0440\u0443\u0447\u043D\u0443, \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E: ${list}`,
    saveFailed: (e) => `\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F: ${e}`,
    deleteFailed: (e) => `\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043D\u044F: ${e}`,
    errEmpty: "\u0414\u043E\u0434\u0430\u0439\u0442\u0435 \u0445\u043E\u0447\u0430 \u0431 \u043E\u0434\u0438\u043D \u0447\u0430\u0441\u043E\u0432\u0438\u0439 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    errDevice: "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439, \u044F\u043A\u0438\u043C \u043A\u0435\u0440\u0443\u0432\u0430\u0442\u0438\u043C\u0435 \u0440\u043E\u0437\u043A\u043B\u0430\u0434",
    errRange: "\u0427\u0430\u0441 \u0437\u0430\u043A\u0456\u043D\u0447\u0435\u043D\u043D\u044F \u0440\u0430\u043D\u0456\u0448\u0435 \u0437\u0430 \u0447\u0430\u0441 \u043F\u043E\u0447\u0430\u0442\u043A\u0443",
    editRange: "\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    removeRange: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    hvac: {
      cool: "\u041E\u0445\u043E\u043B\u043E\u0434\u0436\u0435\u043D\u043D\u044F",
      heat: "\u041E\u0431\u0456\u0433\u0440\u0456\u0432",
      heat_cool: "\u0410\u0432\u0442\u043E",
      auto: "\u0410\u0432\u0442\u043E",
      dry: "\u041E\u0441\u0443\u0448\u0435\u043D\u043D\u044F",
      fan_only: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0456\u044F"
    },
    saved: "\u0420\u043E\u0437\u043A\u043B\u0430\u0434 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E",
    created: "\u0420\u043E\u0437\u043A\u043B\u0430\u0434 \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u043E",
    namePlaceholder: "\u0417\u0430\u043F\u043E\u0432\u043D\u0438\u0442\u044C\u0441\u044F \u0437 \u043D\u0430\u0437\u0432\u0438 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E",
    atStart: "\u041D\u0430 \u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0443",
    atEnd: "\u043D\u0430\u043F\u0440\u0438\u043A\u0456\u043D\u0446\u0456",
    edGeneral: "\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0456",
    edTitle: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
    edShowAdd: '\u041A\u043D\u043E\u043F\u043A\u0430 "\u041D\u043E\u0432\u0438\u0439 \u0440\u043E\u0437\u043A\u043B\u0430\u0434"',
    edDeviceDomains: "\u0422\u0438\u043F\u0438 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0457\u0432 \u0434\u043B\u044F \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0443",
    edDeviceDomainsHint: "\u041B\u0438\u0448\u0435 \u043F\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0456 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u0457 \u0432\u0456\u0434\u043E\u0431\u0440\u0430\u0436\u0430\u0442\u0438\u043C\u0443\u0442\u044C\u0441\u044F \u0443 \u0432\u0438\u0431\u043E\u0440\u0456 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0457\u0432.",
    allTypes: "\u0412\u0441\u0456 \u0442\u0438\u043F\u0438",
    domainName: {
      climate: "\u041A\u043B\u0456\u043C\u0430\u0442 / \u0422\u0435\u0440\u043C\u043E\u0441\u0442\u0430\u0442\u0438",
      water_heater: "\u0412\u043E\u0434\u043E\u043D\u0430\u0433\u0440\u0456\u0432\u0430\u0447\u0456 / \u0411\u043E\u0439\u043B\u0435\u0440\u0438",
      light: "\u041E\u0441\u0432\u0456\u0442\u043B\u0435\u043D\u043D\u044F",
      switch: "\u0412\u0438\u043C\u0438\u043A\u0430\u0447\u0456 \u0442\u0430 \u0440\u043E\u0437\u0435\u0442\u043A\u0438",
      fan: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440\u0438",
      cover: "\u0428\u0442\u043E\u0440\u0438 \u0442\u0430 \u0436\u0430\u043B\u044E\u0437\u0456",
      valve: "\u041A\u043B\u0430\u043F\u0430\u043D\u0438 \u0442\u0430 \u043A\u0440\u0430\u043D\u0438",
      input_boolean: "\u0412\u0456\u0440\u0442\u0443\u0430\u043B\u044C\u043D\u0456 \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u0447\u0456",
      vacuum: "\u0420\u043E\u0431\u043E\u0442\u0438-\u043F\u0438\u043B\u043E\u0441\u043E\u0441\u0438",
      media_player: "\u041C\u0435\u0434\u0456\u0430\u043F\u043B\u0435\u0454\u0440\u0438",
      siren: "\u0421\u0438\u0440\u0435\u043D\u0438"
    },
    edSchedules: "\u0420\u043E\u0437\u043A\u043B\u0430\u0434\u0438 \u043D\u0430 \u043A\u0430\u0440\u0442\u0446\u0456",
    edSchedulesHint: "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u0440\u043E\u0437\u043A\u043B\u0430\u0434\u0438 \u0434\u043B\u044F \u0432\u0456\u0434\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044F.",
    edAll: "\u0412\u0441\u0456",
    edNone: "\u0416\u043E\u0434\u043D\u043E\u0433\u043E",
    edHeight: "\u0412\u0438\u0441\u043E\u0442\u0430 \u043A\u0430\u0440\u0442\u043A\u0438",
    edHeightHint: "\u0410\u0432\u0442\u043E \u0430\u0431\u043E \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434 450px \u0430\u0431\u043E 50vh (\u0432\u043C\u0456\u0441\u0442 \u0441\u043A\u0440\u043E\u043B\u0438\u0442\u044C\u0441\u044F)",
    edFontSize: "\u0420\u043E\u0437\u043C\u0456\u0440 \u0448\u0440\u0438\u0444\u0442\u0443",
    edFontSizeHint: "CSS-\u0440\u043E\u0437\u043C\u0456\u0440 (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, 14px, 15px, 16px, 1rem)"
  },
  en: {
    errName: "The schedule needs a name",
    errReversed: (day) => `${day}: end time is before start time`,
    errOverlap: (day) => `${day}: ranges overlap with each other`,
    showTimes: "Show time",
    edShowTime: "Show time intervals as text",
    edShowTimeToggle: "Show time checkbox in card header",
    schedules: "Schedules",
    newSchedule: "New schedule",
    onNow: "On now",
    offNow: "Off",
    starts: "starts",
    ends: "ends",
    today: "today",
    tomorrow: "tomorrow",
    onDay: (day) => `on ${day}`,
    at: (when, time) => `${when} at ${time}`,
    yaml: "Defined in YAML \u2014 read only",
    noSchedules: "No schedules to show",
    loading: "Loading\u2026",
    readOnly: "View only \u2014 only an administrator can edit",
    editSchedule: "Edit schedule",
    name: "Schedule name",
    device: "Target device",
    chooseDevice: "Choose a device",
    changeDevice: "Change",
    searchDevice: "Search a device or room",
    noArea: "No room",
    noDevices: "No devices found",
    whileActive: "Mode while active",
    whatItDoes: "What it does",
    handEdited: "This schedule's automation was edited by hand in Home Assistant.",
    setTemp: "Set temperature",
    brightness: "Brightness",
    turnOffAtEnd: "Turn off at the end",
    closeAtEnd: "Close at the end",
    drives: "Controls device",
    autoOn: "Automation active",
    autoOff: "Automation disabled",
    drivesNothing: "No automation uses this schedule.",
    hours: "Active hours",
    addRange: "Range",
    from: "From",
    to: "To",
    midnightHint: "24-hour clock; an end of 00:00 or 24:00 means until midnight",
    errTime: "Not a valid time. Type e.g. 07:30 or 2330",
    ok: "OK",
    cancel: "Cancel",
    copyTo: (day) => `Copy ${day} to\u2026`,
    weekdays: "Weekdays (Mo\u2013Fr)",
    wholeWeek: "Whole week (Mo\u2013Su)",
    copy: "Copy",
    copyDays: "Copy to other days",
    clearAll: "Clear all",
    save: "Save",
    delete: "Delete",
    close: "Close",
    back: "Back",
    deleteQ: "Delete this schedule?",
    deleteText: "The linked automation will also be deleted from Home Assistant.",
    kept: (list) => `Manual automations were preserved: ${list}`,
    saveFailed: (e) => `Saving failed: ${e}`,
    deleteFailed: (e) => `Deleting failed: ${e}`,
    errEmpty: "Add at least one range of hours",
    errDevice: "Choose the device this schedule drives",
    errRange: "The range ends before it starts",
    editRange: "Edit range",
    removeRange: "Remove range",
    hvac: {
      cool: "Cool",
      heat: "Heat",
      heat_cool: "Auto",
      auto: "Auto",
      dry: "Dry",
      fan_only: "Fan"
    },
    saved: "Schedule saved",
    created: "Schedule created",
    namePlaceholder: "Filled in from the device's name",
    atStart: "When a range starts",
    atEnd: "when it ends",
    edGeneral: "General",
    edTitle: "Title",
    edShowAdd: '"New schedule" button',
    edDeviceDomains: "Device types to schedule",
    edDeviceDomainsHint: "Only the selected types appear when choosing a device.",
    allTypes: "All types",
    domainName: {
      climate: "Thermostats & AC",
      water_heater: "Water heaters & Boilers",
      light: "Lighting",
      switch: "Switches & sockets",
      fan: "Fans",
      cover: "Blinds & covers",
      valve: "Valves",
      input_boolean: "Virtual toggles",
      vacuum: "Robot vacuums",
      media_player: "Media players",
      siren: "Sirens"
    },
    edSchedules: "Schedules on the card",
    edSchedulesHint: "Tick the schedules to show.",
    edAll: "All",
    edNone: "None",
    edHeight: "Height",
    edHeightHint: "Auto or e.g. 450px or 50vh (content scrolls)",
    edFontSize: "Font size",
    edFontSizeHint: "CSS size (e.g. 14px, 15px, 16px, 1rem)"
  }
};
function cssHeight(value) {
  if (value === void 0 || value === null || String(value).trim() === "") return null;
  const v = String(value).trim();
  return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}
function cssFontSize(value) {
  if (value === void 0 || value === null || String(value).trim() === "") return null;
  const v = String(value).trim();
  return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}
const parseFontSize = cssFontSize;
const langOf = (hass) => /^uk\b/i.test(String(hass?.locale?.language || hass?.language || "")) ? "uk" : "en";
function formatWhen(date, now = /* @__PURE__ */ new Date(), lang = "uk") {
  const t = STRINGS[lang] || STRINGS.en;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(date) - midnight(now)) / 864e5);
  const dayIndex = (date.getDay() + 6) % 7;
  const when = days === 0 ? t.today : days === 1 ? t.tomorrow : t.onDay((DAY_NAMES[lang] || DAY_NAMES.en)[dayIndex]);
  return t.at(when, time);
}
const entityName = (st) => st?.attributes?.friendly_name || st?.entity_id || "";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ICONS = {
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  delete: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  copy: "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  clock: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  minus: "M19,13H5V11H19V13Z",
  back: "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z",
  calendar: "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"
};
const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const switchHtml = ({
  checked = false,
  partial = false,
  disabled = false,
  label = "",
  attrs = ""
} = {}) => `<span class="switch ${partial ? "partial" : ""}"><input type="checkbox" role="switch" ${checked ? "checked" : ""}
    aria-checked="${partial ? "mixed" : checked}" ${disabled ? "disabled" : ""} aria-label="${esc(label)}" ${attrs}>
    <span class="track"></span><span class="knob"></span></span>`;
const BASE_STYLE = `
  :host { display: block; font-family: var(--ha-font-family, system-ui, -apple-system, sans-serif); font-size: var(--card-font-size, 15px); }
  ha-card { overflow: hidden; background: var(--ha-card-background, var(--card-background-color, #ffffff)); border-radius: var(--ha-card-border-radius, 16px); border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(127,127,127,0.18))); box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,0.06)); transition: all 0.2s ease; font-size: var(--card-font-size, 15px); }
  * { box-sizing: border-box; }
  .ic { width: 20px; height: 20px; fill: currentColor; flex: none; }
  button { font: inherit; color: inherit; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 20px; cursor: pointer;
    border: 1px solid var(--divider-color, rgba(127,127,127,0.25)); background: transparent; color: var(--primary-color, #0288d1); font-size: calc(var(--card-font-size, 15px) * 1.035); font-weight: 500; transition: all 0.15s ease; }
  .btn.primary { background: var(--primary-color, #0288d1); color: var(--text-primary-color, #ffffff); border-color: var(--primary-color, #0288d1); }
  .btn.danger { color: var(--error-color, #e53935); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;
    border: 0; background: transparent; cursor: pointer; color: var(--secondary-text-color, #757575); flex: none; transition: background 0.15s; }
  .icon-btn:hover, .btn:hover { background: color-mix(in srgb, var(--primary-color, #0288d1) 12%, transparent); }
  .btn.primary:hover { filter: brightness(1.06); background: var(--primary-color, #0288d1); }
  :focus-visible { outline: 2px solid var(--primary-color, #0288d1); outline-offset: 2px; }
  ha-card.fixed { display: flex; flex-direction: column; overflow: hidden; }
  ha-card.fixed .body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  ha-card.fixed .header { flex: none; }
  ha-card.fixed .scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .header { display: flex; align-items: center; gap: 12px; padding: 18px 20px 12px; }
  .header h2 { margin: 0; flex: 1; font-size: calc(var(--card-font-size, 15px) * 1.428); font-weight: 600; color: var(--ha-card-header-color, var(--primary-text-color, #212121)); letter-spacing: -0.01em; }
  .muted { color: var(--secondary-text-color, #757575); }
  .small { font-size: calc(var(--card-font-size, 15px) * 0.857); }
  .hint { color: var(--secondary-text-color, #757575); font-size: calc(var(--card-font-size, 15px) * 1); padding: 8px 20px 16px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--disabled-text-color, #9e9e9e); flex: none; transition: background 0.2s; }
  .dot.on { background: var(--success-color, #2e7d32); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success-color, #2e7d32) 20%, transparent); }
  .switch { position: relative; display: inline-block; width: 38px; height: 22px; flex: none; }
  .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .switch .track { position: absolute; inset: 2px 0; border-radius: 10px; background: var(--switch-unchecked-track-color, #9e9e9e); opacity: 0.45; transition: 0.2s; }
  .switch .knob { position: absolute; top: 1px; inset-inline-start: 1px; width: 20px; height: 20px; border-radius: 50%;
    background: var(--switch-unchecked-button-color, #fafafa); box-shadow: 0 1px 4px rgba(0,0,0,0.3); transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
  .switch input:checked ~ .track { background: var(--switch-checked-track-color, var(--primary-color, #0288d1)); opacity: 0.65; }
  .switch input:checked ~ .knob { inset-inline-start: 17px; background: var(--switch-checked-button-color, var(--primary-color, #0288d1)); }
  .switch input:disabled { cursor: default; }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1000; max-width: min(540px, calc(100vw - 32px));
    background: var(--primary-text-color, #212121); color: var(--card-background-color, #ffffff); padding: 12px 20px; border-radius: 12px; font-size: calc(var(--card-font-size, 15px) * 1);
    box-shadow: 0 4px 16px rgba(0,0,0,0.25); animation: toastFade 0.2s ease-out; }
  @keyframes toastFade { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
  .toast[hidden] { display: none; }
`;
const SCHEDULE_STYLE = `
  .list { padding: 2px 4px 6px; }
  .row { padding: 4px 6px; border-top: 1px solid var(--divider-color, rgba(127,127,127,0.12)); border-radius: 8px; transition: background 0.15s ease; }
  .row:first-child { border-top: 0; }
  .row.editable { cursor: pointer; }
  .row.editable:hover { background: color-mix(in srgb, var(--primary-color, #0288d1) 6%, transparent); }
  .line { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .name { font-size: calc(var(--card-font-size, 15px) * 1.143); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--primary-text-color, #212121); }
  .spacer { flex: 1; }
  .state { font-size: calc(var(--card-font-size, 15px) * 1); color: var(--secondary-text-color, #757575); white-space: nowrap; }
  .state.on { color: var(--success-color, #2e7d32); font-weight: 600; }
  .when { margin: 3px 20px 0; font-size: calc(var(--card-font-size, 15px) * 0.9); }
  .bars { margin: 8px 10px 2px; display: flex; flex-direction: column; gap: 4px; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-day { width: 24px; font-size: calc(var(--card-font-size, 15px) * 0.9); font-weight: 500; color: var(--secondary-text-color, #757575); text-align: start; flex: none; }
  .bar { position: relative; flex: 1; height: 6px; border-radius: 4px; background: color-mix(in srgb, var(--divider-color, #757575) 40%, transparent); overflow: hidden; }
  .bar i { position: absolute; top: 0; bottom: 0; background: var(--primary-color, #0288d1); border-radius: 3px; }
  .bar-times { font-size: calc(var(--card-font-size, 15px) * 0.9); font-variant-numeric: tabular-nums; color: var(--primary-text-color, #212121); min-width: 105px; max-width: 220px; text-align: end; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; opacity: 0.85; flex: none; }
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .toggle-times { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: calc(var(--card-font-size, 15px) * 1); color: var(--secondary-text-color, #757575); user-select: none; }
  .toggle-times input { width: 16px; height: 16px; accent-color: var(--primary-color, #0288d1); cursor: pointer; margin: 0; }
  .toggle-times:hover { color: var(--primary-text-color, #212121); }
  @media (max-width: 520px) {
    .header-actions { gap: 8px; }
    .bar-times { min-width: 80px; max-width: 130px; font-size: calc(var(--card-font-size, 15px) * 0.9); }
  }
`;
const EDITOR_STYLE = `
  dialog.editor { padding: 0; border: 0; border-radius: var(--ha-card-border-radius, 18px); width: min(620px, calc(100vw - 32px));
    max-height: calc(100vh - 48px); background: var(--ha-card-background, var(--card-background-color, #ffffff)); color: var(--primary-text-color, #212121);
    box-shadow: 0 12px 48px rgba(0,0,0,0.3); overflow: hidden; font-size: 14px; }
  dialog.editor[open] { display: flex; flex-direction: column; }
  dialog.editor::backdrop { background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); }
  @media (max-width: 600px) {
    dialog.editor { width: 100vw; max-width: 100vw; height: 100vh; height: 100dvh; max-height: 100dvh; border-radius: 0; margin: 0; }
  }
  .dlg-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.18)); flex: none; }
  .dlg-head h3 { flex: 1; margin: 0 6px; font-size: 19px; font-weight: 600; }
  .dlg-body { overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 20px; overscroll-behavior: contain; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span, .label { font-size: 13.5px; color: var(--secondary-text-color, #757575); font-weight: 500; }
  .field input, .search input, .times input { font: inherit; color: inherit; padding: 10px 14px; border-radius: 10px;
    border: 1px solid var(--divider-color, rgba(127,127,127,0.22)); background: var(--secondary-background-color, rgba(127,127,127,0.06)); transition: border-color 0.15s; }
  .field input:focus, .times input:focus, .search input:focus { border-color: var(--primary-color, #0288d1); outline: none; }
  .field input { font-size: 15px; }
  .section { display: flex; flex-direction: column; gap: 10px; }
  .row-between { display: flex; align-items: center; justify-content: space-between; }
  .link { font: inherit; font-size: 13.5px; color: var(--primary-color, #0288d1); background: none; border: 0; padding: 0; cursor: pointer; font-weight: 500; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .choice { padding: 6px 14px; border-radius: 16px; border: 1px solid var(--divider-color, rgba(127,127,127,0.25)); background: transparent; cursor: pointer; font-size: 13.5px; transition: all 0.15s; }
  .choice[aria-checked="true"] { background: color-mix(in srgb, var(--primary-color, #0288d1) 18%, transparent); border-color: var(--primary-color, #0288d1); font-weight: 600; color: var(--primary-color, #0288d1); }
  .device { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; border-radius: 10px; cursor: pointer; text-align: start;
    border: 1px dashed var(--divider-color, rgba(127,127,127,0.3)); background: transparent; color: var(--primary-color, #0288d1); font-size: 14.5px; }
  .device .dname { color: var(--primary-text-color, #212121); font-weight: 500; }
  .opt { display: flex; align-items: center; gap: 10px; min-height: 40px; }
  .summary { padding: 4px 0; font-size: 13.5px; }
  .opt input[type=range] { flex: 1; accent-color: var(--primary-color, #0288d1); }
  .grow, .spacer { flex: 1; min-width: 0; }
  .check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--primary-color, #0288d1); margin: 0; }
  .stepper { display: inline-flex; align-items: center; gap: 4px; margin-inline-start: auto; }
  .stepper b { min-width: 44px; text-align: center; font-size: 16px; font-variant-numeric: tabular-nums; }
  .warn, .error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; }
  .warn { background: color-mix(in srgb, var(--warning-color, #f57c00) 16%, transparent); }
  .error { background: color-mix(in srgb, var(--error-color, #d32f2f) 14%, transparent); color: var(--error-color, #d32f2f); }
  .days { display: flex; flex-direction: column; }
  .day { border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.12)); padding: 8px 0; }
  .day:last-child { border-bottom: 0; }
  .day-line { display: flex; align-items: center; gap: 10px; }
  .day-line .dname { width: 92px; flex: none; font-size: 14.5px; font-weight: 500; }
  .ranges { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
  .range { display: inline-flex; align-items: center; border-radius: 16px; background: color-mix(in srgb, var(--primary-color, #0288d1) 16%, transparent); }
  .range button { border: 0; background: transparent; cursor: pointer; padding: 5px 6px 5px 12px; font-size: 13.5px; font-variant-numeric: tabular-nums; font-weight: 500; }
  .range .x { padding: 4px 8px 4px 2px; display: inline-flex; color: var(--secondary-text-color, #757575); }
  .range .x .ic { width: 16px; height: 16px; }
  .add { display: inline-flex; align-items: center; gap: 3px; padding: 5px 12px; border-radius: 16px; font-size: 13.5px; cursor: pointer;
    border: 1px dashed var(--divider-color, rgba(127,127,127,0.3)); background: transparent; color: var(--primary-color, #0288d1); font-weight: 500; }
  .add .ic { width: 16px; height: 16px; }
  .icon-space { width: 36px; flex: none; }
  .panel { margin: 8px 0 4px; padding: 14px; border-radius: 12px; background: var(--secondary-background-color, rgba(127,127,127,0.08));
    display: flex; flex-direction: column; gap: 12px; }
  .times { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .times label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--secondary-text-color, #757575); }
  .times input { font-size: 16px; color: var(--primary-text-color, #212121); background: var(--card-background-color, #ffffff); width: 6.5em;
    text-align: center; font-variant-numeric: tabular-nums; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; }
  .copy-days { display: flex; flex-wrap: wrap; gap: 8px 18px; }
  .picker-top { position: sticky; top: -18px; background: var(--ha-card-background, var(--card-background-color, #ffffff)); padding: 6px 0 10px; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
  .search { display: flex; align-items: center; gap: 8px; background: var(--card-background-color, #ffffff); }
  .chips.types { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
  .chips.types .choice { white-space: nowrap; font-size: 13px; padding: 5px 14px; }
  .search input { flex: 1; font-size: 15px; }
  .picker-list { display: flex; flex-direction: column; }
  .area { font-size: 13px; font-weight: 600; color: var(--secondary-text-color, #757575); padding: 14px 4px 6px; }
  .pick { display: flex; align-items: center; gap: 10px; padding: 10px 10px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; text-align: start; font-size: 15px; }
  .pick:hover { background: color-mix(in srgb, var(--primary-color, #0288d1) 10%, transparent); }
  .btn.danger-fill { background: var(--error-color, #d32f2f); border-color: var(--error-color, #d32f2f); color: #fff; }
  .spinner { width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
function weekBarsHtml(week, lang, showTimes = false) {
  const names = DAY_NAMES[lang] || DAY_NAMES.en;
  const shortNames = DAY_SHORT[lang] || DAY_SHORT.en;
  return `<div class="bars ${showTimes ? "with-times" : ""}" dir="ltr">${DAYS.map((d, i) => {
    const blocks = week.days[d] || [];
    const timesStr = blocks.map(blockLabel).join(", ");
    return `
    <div class="bar-row" title="${esc(names[i])}: ${esc(timesStr || "\u2014")}">
      <span class="bar-day">${esc(shortNames[i])}</span>
      <span class="bar">${blocks.map((b) => `<i style="left:${(b.start / 14.4).toFixed(2)}%;width:${((b.end - b.start) / 14.4).toFixed(2)}%"></i>`).join("")}</span>
      ${showTimes ? `<span class="bar-times" title="${esc(timesStr)}">${esc(timesStr || "\u2014")}</span>` : ""}
    </div>`;
  }).join("")}</div>`;
}
const Base = globalThis.HTMLElement || class {
};
class SimpleScheduleCard extends Base {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._h = null;
    this._weeks = null;
    this._readWeeks = null;
    this._ids = {};
    this._idsSig = "";
    this._weeksSig = "";
    this._sig = null;
    this._showTimes = false;
    this._showTimeToggle = true;
    this._fontSize = null;
    this._opening = false;
    this._editor = null;
    this._clock = null;
    this._toastTimer = null;
    this._pickerCache = null;
    const self = this;
    this._h = {
      callWS: (m) => self._hass.callWS(m),
      callApi: (...a) => self._hass.callApi(...a),
      callService: (...a) => self._hass.callService(...a),
      get states() {
        return self._hass?.states || {};
      }
    };
  }
  static getStubConfig() {
    return { show_add: true, show_time: false, show_time_toggle: true };
  }
  static getConfigElement() {
    return document.createElement("simple-schedule-card-editor");
  }
  get _lang() {
    return langOf(this._hass);
  }
  get _t() {
    return STRINGS[this._lang] || STRINGS.en;
  }
  get _isAdmin() {
    return this._hass?.user?.is_admin !== false;
  }
  _root() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    return this.shadowRoot;
  }
  setConfig(config) {
    if (config?.entities && !Array.isArray(config.entities)) throw new Error("entities must be a list");
    if (config?.hide_entities && !Array.isArray(config.hide_entities)) throw new Error("hide_entities must be a list");
    if (config?.device_domains && !Array.isArray(config.device_domains)) throw new Error("device_domains must be a list");
    this._config = { show_add: true, ...config };
    this._showTimes = Boolean(config?.show_time ?? false);
    this._showTimeToggle = config?.show_time_toggle !== false;
    this._fontSize = cssFontSize(config?.font_size);
    this._sig = null;
    this._render();
  }
  get showTime() {
    return this._showTimes;
  }
  get showTimeToggle() {
    return this._showTimeToggle;
  }
  get fontSize() {
    return this._fontSize;
  }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._loadWeeks();
    } else {
      if (this._weeksSig !== this._scheduleSig()) this._loadWeeks();
    }
    this._render();
    this._editor?.onHass();
  }
  get hass() {
    return this._hass;
  }
  getCardSize() {
    return 2 + this._visible().length * 2;
  }
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }
  connectedCallback() {
    this._clock = setInterval(() => this._render(), 6e4);
  }
  disconnectedCallback() {
    clearInterval(this._clock);
    this._editor?.dlg?.close();
    this._editor?.destroy();
  }
  _scheduleSig() {
    return Object.values(this._hass?.states || {}).filter((e) => e.entity_id.startsWith("schedule.")).map((e) => `${e.entity_id}@${e.last_updated}`).join("|");
  }
  async _loadWeeks() {
    this._weeksSig = this._scheduleSig();
    const entities = Object.keys(this._hass?.states || {}).filter((id) => id.startsWith("schedule."));
    if (this._isAdmin) {
      try {
        this._weeks = await listSchedules(this._h);
      } catch {
        this._weeks ??= {};
      }
      const sig = entities.slice().sort().join("|");
      if (sig !== this._idsSig) {
        this._idsSig = sig;
        this._ids = await scheduleIdsOf(this._h, entities).catch(() => ({}));
      }
    }
    const rest = entities.filter((id) => !this._weeks?.[this._idOf(id)]);
    try {
      this._readWeeks = await readSchedules(this._h, rest);
    } catch {
      this._readWeeks ??= {};
    }
    this._render(true);
  }
  _idOf(entityId) {
    return this._ids?.[entityId] ?? entityId.slice("schedule.".length);
  }
  _visible() {
    const c = this._config || {};
    const only = c.entities;
    const hide = c.hide_entities || [];
    return Object.values(this._hass?.states || {}).filter((e) => e.entity_id.startsWith("schedule.")).filter((e) => (!only || only.includes(e.entity_id)) && !hide.includes(e.entity_id)).sort((a, b) => entityName(a).localeCompare(entityName(b), this._lang));
  }
  _toast(text, ms = 5e3) {
    const root = this._root();
    const host = root.querySelector("dialog[open]") || root;
    let el = [...host.children].find((c) => c.classList.contains("toast"));
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      host.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.hidden = true;
    }, ms);
  }
  _render(force = false) {
    if (!this._config || !this._hass) return;
    const visible = this._visible();
    const sig = JSON.stringify([
      this._lang,
      this._isAdmin,
      this._config,
      this._showTimes,
      (/* @__PURE__ */ new Date()).toDateString(),
      (/* @__PURE__ */ new Date()).getHours(),
      visible.map((e) => [e.entity_id, e.last_updated]),
      !!this._weeks,
      Object.keys(this._readWeeks || {}).length
    ]);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    const t = this._t;
    const root = this._root();
    if (!root.querySelector("ha-card")) {
      root.innerHTML = `<style>${BASE_STYLE}${SCHEDULE_STYLE}${EDITOR_STYLE}</style><ha-card><div class="body"></div></ha-card><div class="toast" hidden role="status"></div>`;
      root.addEventListener("click", (e) => this._onClick(e));
      root.addEventListener("change", (e) => {
        if (e.target?.dataset?.act === "toggleTimes") {
          this._showTimes = e.target.checked;
          this._render(true);
        }
      });
      root.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".row[data-id]")) {
          e.preventDefault();
          this._onClick(e);
        }
      });
    }
    const canEdit = this._isAdmin;
    const now = /* @__PURE__ */ new Date();
    const rows = visible.map((e) => this._rowHtml(e, now, canEdit)).join("");
    const header = `
      <div class="header">
        <h2>${esc(this._config.title ?? t.schedules)}</h2>
        <div class="header-actions">
          ${this._showTimeToggle ? `
          <label class="toggle-times" title="${esc(t.edShowTime)}">
            <input type="checkbox" data-act="toggleTimes" ${this._showTimes ? "checked" : ""}>
            <span>${esc(t.showTimes)}</span>
          </label>` : ""}
          ${canEdit && this._config.show_add !== false ? `<button class="btn primary" data-act="new">+ ${esc(t.newSchedule)}</button>` : ""}
        </div>
      </div>`;
    const content = `
      ${canEdit ? "" : `<div class="hint">${esc(t.readOnly)}</div>`}
      <div class="list" role="list">${rows || `<div class="hint">${esc(this._weeks || !canEdit ? t.noSchedules : t.loading)}</div>`}</div>`;
    const card = root.querySelector("ha-card");
    const height = cssHeight(this._config.height);
    card.classList.toggle("fixed", !!height);
    card.style.height = height || "";
    if (this._fontSize) {
      card.style.setProperty("--card-font-size", this._fontSize);
      card.style.fontSize = this._fontSize;
    } else {
      card.style.removeProperty("--card-font-size");
      card.style.fontSize = "";
    }
    const body = root.querySelector(".body");
    const top = body.querySelector(".scroll")?.scrollTop ?? 0;
    body.innerHTML = `${header}<div class="scroll">${content}</div>`;
    const scrollEl = body.querySelector(".scroll");
    if (scrollEl) scrollEl.scrollTop = top;
  }
  _rowHtml(e, now, canEdit) {
    const t = this._t;
    const id = this._idOf(e.entity_id);
    const editableWeek = this._weeks?.[id];
    const week = editableWeek || this._readWeeks?.[e.entity_id];
    const yaml = e.attributes?.editable === false || this._weeks && !week;
    const on = e.state === "on";
    const next = e.attributes?.next_event ? new Date(e.attributes.next_event) : null;
    const editable = canEdit && !yaml && !!editableWeek;
    const when = next && !isNaN(next.getTime()) ? `${on ? t.ends : t.starts} ${formatWhen(next, now, this._lang)}` : "";
    return `
      <div class="row ${editable ? "editable" : ""}" role="listitem" ${editable ? `data-id="${esc(e.entity_id)}" tabindex="0"` : ""}
        aria-label="${esc(entityName(e))}">
        <div class="line">
          <span class="dot ${on ? "on" : ""}" title="${esc(on ? t.onNow : t.offNow)}"></span>
          <span class="name">${esc(entityName(e))}</span>
          <span class="spacer"></span>
          <span class="state ${on ? "on" : ""}">${esc(on ? t.onNow : t.offNow)}</span>
        </div>
        ${when ? `<div class="when muted small">${esc(when)}</div>` : ""}
        ${yaml ? `<div class="muted small">${esc(t.yaml)}</div>` : ""}
        ${week ? weekBarsHtml(week, this._lang, this._showTimes) : ""}
      </div>`;
  }
  _onClick(e) {
    const act = e.target.closest?.("[data-act]")?.dataset.act;
    if (act === "new") return this._openEditor(null);
    const row = e.target.closest?.(".row[data-id]");
    if (row) this._openEditor(row.dataset.id);
  }
  async _openEditor(entityId) {
    if (!this._isAdmin || this._editor || this._opening) return;
    if (entityId) {
      this._opening = true;
      try {
        this._weeks = await listSchedules(this._h);
      } catch {
      } finally {
        this._opening = false;
      }
      this._render(true);
      if (!this._weeks?.[this._idOf(entityId)] || this._editor) return;
    }
    this._editor = new ScheduleEditor(this, entityId);
    this._editor.open();
  }
  _afterWrite() {
    this._loadWeeks();
  }
  async _pickerData() {
    this._pickerCache ??= Promise.all([
      this._h.callWS({ type: "config/area_registry/list" }),
      this._h.callWS({ type: "config/device_registry/list" }),
      this._h.callWS({ type: "config/entity_registry/list_for_display" })
    ]).then(([areas, devices, display]) => ({ areas, devices, display }));
    try {
      return await this._pickerCache;
    } catch (err) {
      this._pickerCache = null;
      throw err;
    }
  }
}
class ScheduleEditor {
  constructor(card, entityId) {
    this.device = null;
    this.hvacMode = null;
    this.temperature = null;
    this.brightness = null;
    this.turnOffAtEnd = true;
    this.automations = null;
    this.driven = null;
    this.handEdited = false;
    this.rangeEdit = null;
    this.copyFrom = null;
    this.query = "";
    this.picker = null;
    this.saving = false;
    this.error = "";
    this.dlg = null;
    this.focusPanel = false;
    this._panelFor = null;
    this.automationsReady = null;
    this.oursAutomations = [];
    this.domainFilter = null;
    this._linkedSig = null;
    this.card = card;
    this.entityId = entityId;
    this.isNew = !entityId;
    this.id = entityId ? card._idOf(entityId) : null;
    this.week = entityId && card._weeks[this.id] ? card._weeks[this.id].clone() : new WeekSchedule({ name: "" });
    this.originalName = this.week.name;
    this.view = "main";
  }
  get t() {
    return this.card._t;
  }
  get lang() {
    return this.card._lang;
  }
  open() {
    const root = this.card._root();
    const dlg = document.createElement("dialog");
    dlg.className = "editor";
    dlg.setAttribute("aria-labelledby", "dlg-title");
    root.appendChild(dlg);
    this.dlg = dlg;
    dlg.addEventListener("click", (e) => this.onClick(e));
    dlg.addEventListener("change", (e) => this.onChange(e));
    dlg.addEventListener("input", (e) => this.onInput(e));
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.target.id === "from" || e.target.id === "to")) {
        e.preventDefault();
        this.dlg?.querySelector("[data-act=rangeOk]")?.click();
      }
    });
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.back();
    });
    dlg.addEventListener("close", () => this.destroy());
    this.render();
    dlg.showModal();
    if (this.isNew) {
      this.card._pickerData().then(
        (d) => {
          this.picker = d;
          if (this.view === "picker") this.render();
        },
        (err) => {
          this.error = errorText(err);
          this.render();
        }
      );
    } else {
      this.automationsReady = automationsFor(this.card._h, this.entityId).then(
        (a) => {
          this.automations = a;
          this.renderLinked();
          return this.loadDriven(a);
        },
        () => {
          this.automations = [];
          this.renderLinked();
        }
      );
    }
  }
  async loadDriven(automations) {
    const h = this.card._h;
    const ours = [];
    for (const a of automations) {
      const config = await automationConfig(h, a).catch(() => null);
      if (isOurs(config)) ours.push({ automation: a, config, parsed: parseScheduleAutomation(config) });
    }
    this.oursAutomations = ours.map((o) => o.automation);
    const editable = ours.filter((o) => o.parsed && o.parsed.scheduleEntityId === this.entityId);
    if (editable.length === 1) {
      this.driven = editable[0];
      const tgt = this.driven.parsed.target;
      this.device = (this.card.hass.states || {})[tgt.entityId] || {
        entity_id: tgt.entityId,
        state: "unavailable",
        attributes: { friendly_name: tgt.name }
      };
      this.hvacMode = tgt.hvacMode;
      this.temperature = tgt.temperature;
      this.brightness = tgt.brightnessPct;
      this.turnOffAtEnd = tgt.turnOffAtEnd !== false;
    } else {
      this.handEdited = ours.some((o) => !o.parsed);
    }
    if (this.view === "main" && (this.driven || this.handEdited)) {
      this.syncName();
      this.render();
    }
  }
  currentTarget() {
    const d = this.device;
    const keepName = this.driven && this.driven.parsed.target.entityId === d.entity_id;
    return {
      entityId: d.entity_id,
      name: keepName ? this.driven.parsed.target.name : entityName(d),
      hvacMode: domainOf(d.entity_id) === "climate" ? this.hvacMode : null,
      temperature: this.temperature,
      brightnessPct: this.brightness,
      turnOffAtEnd: this.turnOffAtEnd
    };
  }
  close() {
    if (this.saving) return;
    if (this.dlg?.open) this.dlg.close();
    else this.destroy();
  }
  destroy() {
    this.dlg?.remove();
    if (this.card._editor === this) this.card._editor = null;
  }
  back() {
    if (this.saving) return;
    if (this.view !== "main") {
      this.view = "main";
      this.render();
    } else if (this.rangeEdit || this.copyFrom) {
      this.rangeEdit = this.copyFrom = null;
      this.render();
    } else {
      this.close();
    }
  }
  onHass() {
    if (this.view === "main" && !this.isNew) this.renderLinked();
  }
  render() {
    if (!this.dlg) return;
    if (this.rangeEdit && this._panelFor === this.rangeEdit && this.dlg.querySelector("#from")) {
      this.rangeEdit.from = this.dlg.querySelector("#from").value;
      this.rangeEdit.to = this.dlg.querySelector("#to").value;
    }
    const t = this.t;
    const root = this.card._root();
    const focusKey = root.activeElement?.dataset?.focus;
    const scroller = this.dlg.querySelector(".dlg-body");
    const scrollTop = scroller?.scrollTop ?? 0;
    const title = this.view === "picker" ? t.chooseDevice : this.isNew ? t.newSchedule : t.editSchedule;
    const head = this.view === "main" ? `<button class="icon-btn" data-act="close" aria-label="${esc(t.close)}" data-focus="close" ${this.saving ? "disabled" : ""}>${icon("close")}</button>
           <h3 id="dlg-title">${esc(title)}</h3>
           ${this.isNew ? "" : `<button class="icon-btn" data-act="askDelete" aria-label="${esc(t.delete)}" title="${esc(t.delete)}" ${this.saving ? "disabled" : ""}>${icon("delete")}</button>`}
           <button class="btn primary" data-act="save" ${this.saving ? "disabled" : ""}>${this.saving ? '<span class="spinner"></span>' : ""}${esc(t.save)}</button>` : `<button class="icon-btn" data-act="back" aria-label="${esc(t.back)}" data-focus="back">${icon("back")}</button><h3 id="dlg-title">${esc(this.view === "picker" ? title : t.deleteQ)}</h3>`;
    const body = this.view === "picker" ? this.pickerHtml() : this.view === "confirmDelete" ? this.confirmHtml() : this.mainHtml();
    this.dlg.innerHTML = `<div class="dlg-head">${head}</div><div class="dlg-body">${body}</div>`;
    const again = this.dlg.querySelector(".dlg-body");
    if (this.view === "main" && again) again.scrollTop = scrollTop;
    if (this.focusPanel) {
      this.focusPanel = false;
      const panel = this.dlg.querySelector(".panel");
      panel?.closest(".day")?.scrollIntoView({ block: "nearest" });
      const field = panel?.querySelector("[data-autofocus]");
      field?.focus();
      field?.select?.();
      return;
    }
    const focus = focusKey && this.dlg.querySelector(`[data-focus="${focusKey}"]`) || this.dlg.querySelector("[data-autofocus]");
    focus?.focus();
  }
  mainHtml() {
    const t = this.t;
    return `
      ${this.error ? `<div class="error" role="alert"><span>${esc(this.error)}</span></div>` : ""}
      ${this.isNew ? this.targetHtml() : ""}
      <label class="field"><span>${esc(t.name)}</span>
        <input id="name" data-focus="name" value="${esc(this.week.name)}" autocomplete="off"
          ${this.isNew ? `placeholder="${esc(t.namePlaceholder)}"` : ""}></label>
      ${this.isNew ? "" : `<div class="section linked">${this.linkedHtml()}</div>
        ${this.driven ? this.targetHtml(t.whatItDoes) : this.handEdited ? `<div class="muted small">${esc(t.handEdited)}</div>` : ""}`}
      <div class="section">
        <div class="label row-between"><span>${esc(t.hours)}</span>
          <button class="link" data-act="clear" data-focus="clear">${esc(t.clearAll)}</button></div>
        <div class="muted small">${esc(t.midnightHint)}</div>
        <div class="days">${DAYS.map((_, i) => this.dayHtml(i)).join("")}</div>
      </div>`;
  }
  targetHtml(title = this.t.device) {
    const t = this.t;
    const d = this.device;
    let options = "";
    if (d) {
      const o = actionOptions(d);
      if (o.hvacModes.length) {
        options += `<div class="label">${esc(t.whileActive)}</div><div class="chips" role="radiogroup" aria-label="${esc(t.whileActive)}">
          ${o.hvacModes.map((m) => `<button class="choice" role="radio" aria-checked="${this.hvacMode === m}" data-act="hvac" data-v="${esc(m)}"
            data-focus="hvac-${esc(m)}">${esc(t.hvac[m] || m)}</button>`).join("")}</div>`;
      }
      if (o.temp) {
        options += `<div class="opt"><label class="check"><input type="checkbox" data-field="useTemp" data-focus="useTemp" ${this.temperature != null ? "checked" : ""}>
          <span>${esc(t.setTemp)}</span></label>
          ${this.temperature != null ? `<span class="stepper" dir="ltr">
            <button class="icon-btn" data-act="temp" data-v="-1" aria-label="\u2212" data-focus="temp-">${icon("minus")}</button>
            <b aria-live="polite">${esc(this.temperature)}\xB0</b>
            <button class="icon-btn" data-act="temp" data-v="1" aria-label="+" data-focus="temp+">${icon("plus")}</button></span>` : ""}</div>`;
      }
      if (o.brightness) {
        options += `<div class="opt"><label class="check"><input type="checkbox" data-field="useBrightness" data-focus="useBrightness" ${this.brightness != null ? "checked" : ""}>
          <span>${esc(t.brightness)}</span></label>
          ${this.brightness != null ? `<input type="range" min="1" max="100" value="${this.brightness}" data-field="brightness" data-focus="brightness"
            aria-label="${esc(t.brightness)}"><b class="bval">${this.brightness}%</b>` : ""}</div>`;
      }
      options += `<div class="muted small summary">${esc(actionSummary(this.currentTarget(), this.lang))}</div>`;
      options += `<div class="opt"><span>${esc(o.domain === "cover" ? t.closeAtEnd : t.turnOffAtEnd)}</span><span class="spacer"></span>
        ${switchHtml({ checked: this.turnOffAtEnd, label: o.domain === "cover" ? t.closeAtEnd : t.turnOffAtEnd, attrs: 'data-field="turnOff" data-focus="turnOff"' })}</div>`;
    }
    return `<div class="section">
      <div class="label">${esc(title)}</div>
      <button class="device" data-act="pick" data-focus="pick">
        ${d ? `<span class="dname">${esc(entityName(d))}</span><span class="muted small" dir="ltr">${esc(d.entity_id)}</span><span class="spacer"></span><span class="link">${esc(t.changeDevice)}</span>` : `<span>${esc(t.chooseDevice)}</span>`}
      </button>
      ${options}
    </div>`;
  }
  linkedHtml() {
    const t = this.t;
    const autos = this.automations;
    const states = this.card.hass?.states || {};
    let inner;
    if (autos === null) {
      inner = `<div class="muted small">${esc(t.loading)}</div>`;
    } else if (!autos.length) {
      inner = `<div class="warn"><span>${esc(t.drivesNothing)}</span></div>`;
    } else {
      inner = autos.map((a) => {
        const on = states[a]?.state === "on";
        return `<div class="opt"><div class="grow"><div>${esc(entityName(states[a]) || a)}</div>
          <div class="muted small">${esc(on ? t.autoOn : t.autoOff)}</div></div>
          ${switchHtml({ checked: on, label: entityName(states[a]) || a, attrs: `data-field="auto" data-id="${esc(a)}" data-focus="auto-${esc(a)}"` })}</div>`;
      }).join("");
    }
    return `<div class="label">${esc(t.drives)}</div>${inner}`;
  }
  renderLinked() {
    const el = this.dlg?.querySelector(".linked");
    if (!el) return;
    const sig = JSON.stringify([this.automations, (this.automations || []).map((a) => this.card.hass?.states?.[a]?.state)]);
    if (sig === this._linkedSig) return;
    this._linkedSig = sig;
    const focusKey = this.card._root().activeElement?.dataset?.focus;
    el.innerHTML = this.linkedHtml();
    if (focusKey) el.querySelector(`[data-focus="${focusKey}"]`)?.focus();
  }
  dayHtml(i) {
    const t = this.t;
    const name = (DAY_NAMES[this.lang] || DAY_NAMES.en)[i];
    const blocks = this.week.days[DAYS[i]] || [];
    const chips = blocks.map(
      (b, k) => `<span class="range"><button data-act="edit" data-day="${i}" data-index="${k}" dir="ltr"
        aria-label="${esc(`${t.editRange} ${name} ${blockLabel(b)}`)}" data-focus="edit-${i}-${k}">${esc(blockLabel(b))}</button><button
        class="x" data-act="remove" data-day="${i}" data-index="${k}" aria-label="${esc(`${t.removeRange} ${blockLabel(b)}`)}">${icon("close")}</button></span>`
    ).join("");
    let panel = "";
    if (this.rangeEdit?.day === i) {
      this._panelFor = this.rangeEdit;
      const b = this.rangeEdit.index != null ? blocks[this.rangeEdit.index] : { start: 8 * 60, end: 17 * 60 };
      panel = `<div class="panel" role="group" aria-label="${esc(t.editRange)}">
        <div class="times" dir="ltr">
          <label><span>${esc(t.from)}</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="HH:MM" id="from" data-focus="from"
            value="${esc(this.rangeEdit.from ?? hm(b.start))}" data-autofocus></label>
          <span aria-hidden="true">\u2013</span>
          <label><span>${esc(t.to)}</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="HH:MM" id="to" data-focus="to"
            value="${esc(this.rangeEdit.to ?? hm(b.end))}"></label>
        </div>
        ${this.rangeEdit.error ? `<div class="error small" role="alert">${esc(this.rangeEdit.error)}</div>` : ""}
        <div class="actions"><button class="btn" data-act="rangeCancel">${esc(t.cancel)}</button><button class="btn primary" data-act="rangeOk">${esc(t.ok)}</button></div>
      </div>`;
    } else if (this.copyFrom?.day === i) {
      const chosen = this.copyFrom.chosen;
      panel = `<div class="panel" role="group" aria-label="${esc(t.copyTo(name))}">
        <div class="label">${esc(t.copyTo(name))}</div>
        <div class="chips"><button class="choice" data-act="copyPreset" data-v="weekdays" data-autofocus>${esc(t.weekdays)}</button>
          <button class="choice" data-act="copyPreset" data-v="week">${esc(t.wholeWeek)}</button></div>
        <div class="copy-days">${DAYS.map((_, k) => k === i ? "" : `<label class="check"><input type="checkbox" data-field="copyDay" data-v="${k}" ${chosen.has(k) ? "checked" : ""}>
          <span>${esc((DAY_NAMES[this.lang] || DAY_NAMES.en)[k])}</span></label>`).join("")}</div>
        <div class="actions"><button class="btn" data-act="copyCancel">${esc(t.cancel)}</button><button class="btn primary" data-act="copyOk">${esc(t.copy)}</button></div>
      </div>`;
    }
    return `<div class="day">
      <div class="day-line">
        <span class="dname">${esc(name)}</span>
        <div class="ranges">${chips}<button class="add" data-act="add" data-day="${i}" data-focus="add-${i}" aria-label="${esc(`${t.addRange} ${name}`)}">+ ${esc(t.addRange)}</button></div>
        ${blocks.length ? `<button class="icon-btn" data-act="copyOpen" data-day="${i}" aria-label="${esc(`${t.copyDays} (${name})`)}" title="${esc(t.copyDays)}" data-focus="copy-${i}">${icon("copy")}</button>` : '<span class="icon-space"></span>'}
      </div>
      ${panel}
    </div>`;
  }
  pickerHtml() {
    const t = this.t;
    if (!this.picker) return `<div class="muted">${esc(t.loading)}</div>`;
    const present = new Set(deviceSections(this.pickerData()).flatMap((sec) => sec.entities.map((e) => domainOf(e.entity_id))));
    const types = PICKABLE_DOMAINS.filter((d) => present.has(d));
    const chip = (v, label) => `<button class="choice" role="radio" aria-checked="${(this.domainFilter ?? null) === v}" data-act="domain"
      data-v="${esc(v ?? "")}" data-focus="domain-${esc(v ?? "all")}">${esc(label)}</button>`;
    return `<div class="picker-top"><label class="search"><input type="search" id="q" data-focus="q" data-autofocus placeholder="${esc(t.searchDevice)}"
      aria-label="${esc(t.searchDevice)}" value="${esc(this.query)}"></label>
      ${types.length > 1 ? `<div class="chips types" role="radiogroup" aria-label="${esc(t.device)}">${chip(null, t.allTypes)}${types.map((d) => chip(d, t.domainName[d] || d)).join("")}</div>` : ""}</div>
      <div class="picker-list">${this.pickerListHtml()}</div>`;
  }
  pickerData(only = null) {
    return {
      states: this.card.hass?.states || {},
      ...this.picker,
      domains: this.card._config?.device_domains,
      only
    };
  }
  pickerListHtml() {
    const t = this.t;
    const sections = deviceSections(this.pickerData(this.domainFilter), this.query, t.noArea, this.lang);
    if (!sections.length) return `<div class="muted">${esc(t.noDevices)}</div>`;
    return sections.map(
      (sec) => `<div class="area">${esc(sec.title)}</div>${sec.entities.map(
        (e) => `
      <button class="pick" data-act="choose" data-id="${esc(e.entity_id)}"><span class="grow">${esc(entityName(e))}</span>
        <span class="muted small" dir="ltr">${esc(e.entity_id)}</span></button>`
      ).join("")}`
    ).join("");
  }
  confirmHtml() {
    const t = this.t;
    return `<p>${esc(t.deleteText)}</p>
      ${this.error ? `<div class="error" role="alert"><span>${esc(this.error)}</span></div>` : ""}
      <div class="actions"><button class="btn" data-act="back" ${this.saving ? "disabled" : ""}>${esc(t.cancel)}</button>
        <button class="btn primary danger-fill" data-act="doDelete" data-autofocus ${this.saving ? "disabled" : ""}>${this.saving ? '<span class="spinner"></span>' : ""}${esc(t.delete)}</button></div>`;
  }
  onClick(e) {
    if (e.target === this.dlg) return;
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const day = el.dataset.day != null ? Number(el.dataset.day) : null;
    const index = el.dataset.index != null ? Number(el.dataset.index) : null;
    const w = this.week;
    switch (act) {
      case "close":
        return this.close();
      case "back":
        return this.back();
      case "save":
        return this.save();
      case "askDelete":
        this.view = "confirmDelete";
        this.error = "";
        break;
      case "doDelete":
        return this.remove();
      case "pick":
        this.view = "picker";
        this.query = "";
        if (!this.picker) {
          this.card._pickerData().then(
            (d) => {
              this.picker = d;
              if (this.view === "picker") this.render();
            },
            (err) => {
              this.error = errorText(err);
              this.view = "main";
              this.render();
            }
          );
        }
        break;
      case "choose": {
        const d = (this.card.hass?.states || {})[el.dataset.id];
        if (!d) return;
        this.device = d;
        const o = actionOptions(d);
        this.hvacMode = o.defaultHvac;
        this.temperature = null;
        this.brightness = null;
        if (!this.nameInput().trim()) this.week.name = entityName(d);
        this.view = "main";
        break;
      }
      case "hvac":
        this.hvacMode = el.dataset.v;
        break;
      case "domain":
        this.domainFilter = el.dataset.v || null;
        break;
      case "temp": {
        const o = actionOptions(this.device);
        if (o.temp) {
          const step = o.temp.step;
          const next = Math.round(((this.temperature || o.temp.initial) + Number(el.dataset.v) * step) / step) * step;
          this.temperature = Math.min(o.temp.max, Math.max(o.temp.min, Number(next.toFixed(1))));
        }
        break;
      }
      case "clear":
        for (const d of DAYS) w.days[d] = [];
        this.rangeEdit = this.copyFrom = null;
        break;
      case "add":
        this.rangeEdit = { day, index: null };
        this.copyFrom = null;
        this.focusPanel = true;
        break;
      case "edit":
        this.rangeEdit = { day, index };
        this.copyFrom = null;
        this.focusPanel = true;
        break;
      case "remove":
        w.days[DAYS[day]] = (w.days[DAYS[day]] || []).filter((_, k) => k !== index);
        this.rangeEdit = null;
        break;
      case "rangeCancel":
        this.rangeEdit = null;
        break;
      case "rangeOk": {
        const from = this.dlg.querySelector("#from").value;
        const to = this.dlg.querySelector("#to").value;
        Object.assign(this.rangeEdit, { from, to });
        const start = parseTimeInput(from);
        let end = parseTimeInput(to);
        if (end === 0) end = 1440;
        if (start == null || end == null || start >= 1440) {
          this.rangeEdit.error = this.t.errTime;
          this.focusPanel = true;
          break;
        }
        if (end <= start) {
          this.rangeEdit.error = this.t.errRange;
          this.focusPanel = true;
          break;
        }
        const d = DAYS[this.rangeEdit.day];
        const old = this.rangeEdit.index != null ? w.days[d][this.rangeEdit.index] : null;
        const next = (w.days[d] || []).filter((_, k) => k !== this.rangeEdit.index);
        next.push({ ...old?.data ? { data: old.data } : {}, start, end });
        w.days[d] = next.sort(byStart);
        this.rangeEdit = null;
        break;
      }
      case "copyOpen":
        this.copyFrom = { day, chosen: /* @__PURE__ */ new Set() };
        this.rangeEdit = null;
        this.focusPanel = true;
        break;
      case "copyPreset":
        for (const k of el.dataset.v === "weekdays" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]) {
          this.copyFrom.chosen.add(k);
        }
        break;
      case "copyCancel":
        this.copyFrom = null;
        break;
      case "copyOk": {
        const from = w.days[DAYS[this.copyFrom.day]] || [];
        for (const k of this.copyFrom.chosen) {
          if (k !== this.copyFrom.day) w.days[DAYS[k]] = from.map((b) => ({ ...b }));
        }
        this.copyFrom = null;
        break;
      }
      default:
        return;
    }
    this.syncName();
    this.render();
  }
  onChange(e) {
    const f = e.target.dataset?.field;
    if (!f) return;
    if (f === "auto") {
      const id = e.target.dataset.id;
      setAutomationEnabled(this.card._h, id, e.target.checked).then(() => {
        this._linkedSig = null;
        this.renderLinked();
      });
      return;
    }
    if (f === "copyDay") {
      const k = Number(e.target.dataset.v);
      if (e.target.checked) this.copyFrom.chosen.add(k);
      else this.copyFrom.chosen.delete(k);
      return;
    }
    if (f === "useTemp") {
      this.temperature = e.target.checked ? actionOptions(this.device).temp?.initial ?? 21 : null;
    } else if (f === "useBrightness") {
      this.brightness = e.target.checked ? 80 : null;
    } else if (f === "turnOff") {
      this.turnOffAtEnd = e.target.checked;
    } else if (f === "brightness") {
      this.brightness = Number(e.target.value);
    } else return;
    this.syncName();
    this.render();
  }
  onInput(e) {
    if (e.target.id === "name") this.week.name = e.target.value;
    else if (e.target.id === "q") {
      this.query = e.target.value;
      const listEl = this.dlg?.querySelector(".picker-list");
      if (listEl) listEl.innerHTML = this.pickerListHtml();
    } else if (e.target.dataset?.field === "brightness") {
      this.brightness = Number(e.target.value);
      const b = this.dlg?.querySelector(".bval");
      if (b) b.textContent = `${this.brightness}%`;
    }
  }
  nameInput() {
    return this.dlg?.querySelector("#name")?.value ?? this.week.name;
  }
  syncName() {
    const el = this.dlg?.querySelector("#name");
    if (el) this.week.name = el.value;
  }
  async save() {
    const t = this.t;
    this.syncName();
    const problem = this.week.validate(this.lang) ?? (this.week.isEmpty ? t.errEmpty : null) ?? (this.isNew && !this.device ? t.errDevice : null);
    if (problem) {
      this.error = problem;
      this.render();
      const scroller = this.dlg?.querySelector(".dlg-body");
      if (scroller) scroller.scrollTop = 0;
      return;
    }
    this.error = "";
    this.saving = true;
    this.rangeEdit = this.copyFrom = null;
    this.render();
    const h = this.card._h;
    try {
      if (this.isNew) {
        await createScheduleWithAutomation(h, this.week, this.currentTarget());
      } else {
        await this.automationsReady;
        await updateSchedule(h, this.id, this.week);
        if (this.driven) {
          const followsName = this.driven.config.alias === scheduleAlias(this.originalName.trim()) || this.driven.config.alias === `Beit \xB7 ${this.originalName.trim()}`;
          await rewriteScheduleAutomation(h, this.driven.config, {
            scheduleName: followsName ? this.week.name : void 0,
            target: this.currentTarget()
          });
        }
        await renameScheduleAutomations(h, this.automations || [], this.originalName, this.week.name);
      }
      this.saving = false;
      this.card._afterWrite();
      this.close();
      this.card._toast(this.isNew ? t.created : t.saved, 3e3);
    } catch (err) {
      this.saving = false;
      this.error = t.saveFailed(errorText(err));
      if (!this.dlg?.isConnected) return this.card._toast(this.error, 1e4);
      this.render();
      const scroller = this.dlg?.querySelector(".dlg-body");
      if (scroller) scroller.scrollTop = 0;
    }
  }
  async remove() {
    const t = this.t;
    this.saving = true;
    this.render();
    try {
      const kept = await deleteSchedule(this.card._h, this.entityId, this.id);
      this.saving = false;
      this.card._afterWrite();
      this.close();
      if (kept.length) this.card._toast(t.kept(kept.join(", ")), 1e4);
    } catch (err) {
      this.saving = false;
      this.error = t.deleteFailed(errorText(err));
      if (!this.dlg?.isConnected) return this.card._toast(this.error, 1e4);
      this.render();
    }
  }
}
class SimpleScheduleCardEditor extends Base {
  constructor() {
    super(...arguments);
    this._hass = null;
    this._config = null;
    this._emitted = null;
    this._built = false;
    this._lang = "";
    this._schedulesSig = "";
    this._debounceTimer = null;
  }
  setConfig(config) {
    if (this._emitted && JSON.stringify(config) === this._emitted) return;
    this._config = { ...config };
    if (!this._built) {
      this._build();
    } else {
      this._syncFormValues();
    }
  }
  set hass(hass) {
    const prevLang = this._lang;
    this._hass = hass;
    this._lang = langOf(hass);
    if (!this._built || prevLang && prevLang !== this._lang) {
      this._build();
      return;
    }
    this._updateSchedulesList();
  }
  get _t() {
    return STRINGS[langOf(this._hass)] || STRINGS.en;
  }
  _emit(config) {
    const next = { ...config };
    for (const [k, v] of Object.entries(next)) {
      if (v === "" || v === void 0 || Array.isArray(v) && !v.length) delete next[k];
    }
    this._config = next;
    this._emitted = JSON.stringify(next);
    if (typeof this.dispatchEvent === "function") {
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
    }
  }
  _build() {
    if (!this._config) return;
    if (typeof this.attachShadow === "function" && !this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    if (!this.shadowRoot) return;
    this._built = true;
    const t = this._t;
    const c = this._config;
    const isShowTime = Boolean(c.show_time ?? false);
    const isShowTimeToggle = c.show_time_toggle !== false;
    this.shadowRoot.innerHTML = `
      <style>
        .ed { display: flex; flex-direction: column; gap: 16px; color: var(--primary-text-color, #212121); font-size: 14px; }
        section { display: flex; flex-direction: column; gap: 8px; }
        h3 { margin: 0; font-size: 15px; font-weight: 600; }
        .hint, small { color: var(--secondary-text-color, #757575); font-size: 12px; margin: 0; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field span { font-size: 12px; color: var(--secondary-text-color, #757575); }
        .field input { font: inherit; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: transparent; color: inherit; }
        .chk { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .chk input { width: 16px; height: 16px; margin: 0; accent-color: var(--primary-color, #0288d1); }
        .list { display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; border: 1px solid var(--divider-color, rgba(127,127,127,0.25)); border-radius: 8px; }
        .row { padding: 6px 10px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.12)); }
        .types { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px 10px; }
        .actions { display: flex; gap: 12px; }
        .actions button { font: inherit; font-size: 12px; color: var(--primary-color, #0288d1); background: none; border: 0; padding: 0; cursor: pointer; }
      </style>
      <div class="ed">
        <section>
          <h3>${esc(t.edGeneral)}</h3>
          <label class="field"><span>${esc(t.edTitle)}</span><input data-key="title" value="${esc(c.title ?? "")}" placeholder="${esc(t.schedules)}"></label>
          <label class="field"><span>${esc(t.edFontSize)}</span><input data-key="font_size" value="${esc(c.font_size ?? "")}" placeholder="${esc(t.edFontSizeHint)}"></label>
          <label class="field"><span>${esc(t.edHeight)}</span><input data-key="height" value="${esc(c.height ?? "")}" placeholder="${esc(t.edHeightHint)}"></label>
          <label class="chk"><input type="checkbox" data-bool="show_add" ${c.show_add !== false ? "checked" : ""}><span>${esc(t.edShowAdd)}</span></label>
          <label class="chk"><input type="checkbox" data-bool="show_time" ${isShowTime ? "checked" : ""}><span>${esc(t.edShowTime)}</span></label>
          <label class="chk"><input type="checkbox" data-bool="show_time_toggle" ${isShowTimeToggle ? "checked" : ""}><span>${esc(t.edShowTimeToggle)}</span></label>
        </section>
        <section>
          <h3>${esc(t.edDeviceDomains)}</h3>
          <p class="hint">${esc(t.edDeviceDomainsHint)}</p>
          <div class="types">${PICKABLE_DOMAINS.map((d) => `<label class="chk"><input type="checkbox" data-domain="${esc(d)}"
            ${!c.device_domains?.length || c.device_domains.includes(d) ? "checked" : ""}><span>${esc(t.domainName[d] || d)}</span></label>`).join("")}</div>
        </section>
        <section>
          <h3>${esc(t.edSchedules)}</h3>
          <p class="hint">${esc(t.edSchedulesHint)}</p>
          <div class="actions"><button data-all>${esc(t.edAll)}</button><button data-none>${esc(t.edNone)}</button></div>
          <div class="list"></div>
        </section>
      </div>`;
    const root = this.shadowRoot;
    this._attachListeners(root);
    this._updateSchedulesList(true);
  }
  _attachListeners(root) {
    const handleKeyUpdate = (el, immediate = false) => {
      const key = el.dataset.key;
      const val = el.value;
      this._config = { ...this._config, [key]: val };
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (immediate) {
        this._emit({ ...this._config, [key]: val.trim() });
      } else {
        this._debounceTimer = setTimeout(() => {
          this._emit({ ...this._config, [key]: val.trim() });
        }, 250);
      }
    };
    root.querySelectorAll("[data-key]").forEach((el) => {
      el.addEventListener("input", () => handleKeyUpdate(el, false));
      el.addEventListener("change", () => handleKeyUpdate(el, true));
    });
    root.querySelectorAll("[data-bool]").forEach(
      (el) => el.addEventListener("change", () => {
        const key = el.dataset.bool;
        const checked = el.checked;
        const config = { ...this._config };
        if (key === "show_add") {
          if (checked) delete config.show_add;
          else config.show_add = false;
        } else if (key === "show_time") {
          if (checked) {
            config.show_time = true;
          } else {
            delete config.show_time;
          }
        } else if (key === "show_time_toggle") {
          if (checked) {
            delete config.show_time_toggle;
          } else {
            config.show_time_toggle = false;
          }
        } else {
          config[key] = checked;
        }
        this._emit(config);
      })
    );
    root.querySelector(".types")?.addEventListener("change", () => {
      const ticked = [...root.querySelectorAll("[data-domain]")].filter((b) => b.checked).map((b) => b.dataset.domain);
      const config = { ...this._config, device_domains: ticked };
      if (ticked.length === PICKABLE_DOMAINS.length) delete config.device_domains;
      this._emit(config);
    });
    root.querySelector(".list")?.addEventListener("change", () => this._saveSchedules());
    root.querySelector("[data-all]")?.addEventListener("click", () => {
      root.querySelectorAll("[data-schedule]").forEach((b) => b.checked = true);
      this._saveSchedules();
    });
    root.querySelector("[data-none]")?.addEventListener("click", () => {
      root.querySelectorAll("[data-schedule]").forEach((b) => b.checked = false);
      this._saveSchedules();
    });
  }
  _syncFormValues() {
    const root = this.shadowRoot;
    if (!root || !this._config) return;
    const c = this._config;
    const titleInput = root.querySelector('[data-key="title"]');
    if (titleInput && root.activeElement !== titleInput) {
      titleInput.value = c.title ?? "";
    }
    const fontSizeInput = root.querySelector('[data-key="font_size"]');
    if (fontSizeInput && root.activeElement !== fontSizeInput) {
      fontSizeInput.value = c.font_size ?? "";
    }
    const heightInput = root.querySelector('[data-key="height"]');
    if (heightInput && root.activeElement !== heightInput) {
      heightInput.value = c.height ?? "";
    }
    const showAdd = root.querySelector('[data-bool="show_add"]');
    if (showAdd) {
      showAdd.checked = c.show_add !== false;
    }
    const showTime = root.querySelector('[data-bool="show_time"]');
    if (showTime) {
      showTime.checked = Boolean(c.show_time ?? false);
    }
    const showTimeToggle = root.querySelector('[data-bool="show_time_toggle"]');
    if (showTimeToggle) {
      showTimeToggle.checked = c.show_time_toggle !== false;
    }
    root.querySelectorAll("[data-domain]").forEach((b) => {
      const d = b.dataset.domain;
      b.checked = !c.device_domains?.length || c.device_domains.includes(d);
    });
    const whitelist = Array.isArray(c.entities);
    root.querySelectorAll("[data-schedule]").forEach((b) => {
      const id = b.dataset.schedule;
      b.checked = whitelist ? c.entities.includes(id) : !(c.hide_entities || []).includes(id);
    });
  }
  _updateSchedulesList(force = false) {
    const root = this.shadowRoot;
    if (!root) return;
    const listEl = root.querySelector(".list");
    if (!listEl) return;
    const t = this._t;
    const c = this._config || {};
    const schedules = Object.values(this._hass?.states || {}).filter((e) => e.entity_id?.startsWith("schedule.")).sort((a, b) => entityName(a).localeCompare(entityName(b), this._lang));
    const sig = schedules.map((e) => `${e.entity_id}:${entityName(e)}`).join("|");
    if (!force && sig === this._schedulesSig) {
      const whitelist2 = Array.isArray(c.entities);
      listEl.querySelectorAll("[data-schedule]").forEach((b) => {
        const id = b.dataset.schedule;
        b.checked = whitelist2 ? c.entities.includes(id) : !(c.hide_entities || []).includes(id);
      });
      return;
    }
    this._schedulesSig = sig;
    const whitelist = Array.isArray(c.entities);
    const shown = (id) => whitelist ? c.entities.includes(id) : !(c.hide_entities || []).includes(id);
    listEl.innerHTML = schedules.length ? schedules.map(
      (e) => `<label class="chk row"><input type="checkbox" data-schedule="${esc(e.entity_id)}" ${shown(e.entity_id) ? "checked" : ""}>
              <span>${esc(entityName(e))}</span><small dir="ltr">${esc(e.entity_id)}</small></label>`
    ).join("") : `<div class="hint" style="padding: 12px;">${esc(t.noSchedules)}</div>`;
  }
  _saveSchedules() {
    const boxes = [...this.shadowRoot.querySelectorAll("[data-schedule]")];
    const config = { ...this._config };
    if (Array.isArray(config.entities)) {
      config.entities = boxes.filter((b) => b.checked).map((b) => b.dataset.schedule);
    } else {
      config.hide_entities = boxes.filter((b) => !b.checked).map((b) => b.dataset.schedule);
    }
    this._emit(config);
  }
}
if (typeof customElements !== "undefined") {
  const define = (name, cls) => {
    if (!customElements.get(name)) customElements.define(name, cls);
  };
  define("simple-schedule-card", SimpleScheduleCard);
  define("simple-schedule-card-editor", SimpleScheduleCardEditor);
  const w = window;
  w.customCards = w.customCards || [];
  if (!w.customCards.some((c) => c.type === "simple-schedule-card")) {
    w.customCards.push({
      type: "simple-schedule-card",
      name: "Simple Schedule Card",
      description: "Clean weekly schedules for any device in Home Assistant (Monday\u2013Sunday, Ukrainian & English).",
      preview: false
    });
  }
}
export {
  DAYS,
  DAY_NAMES,
  DAY_SHORT,
  LEGACY_MARKERS,
  PICKABLE_DOMAINS,
  SIMPLE_SCHEDULE_MARKER,
  STRINGS,
  SimpleScheduleCard,
  SimpleScheduleCardEditor,
  VERSION,
  WeekSchedule,
  actionOptions,
  actionSummary,
  automationConfig,
  automationsFor,
  blockLabel,
  buildScheduleAutomation,
  byStart,
  createScheduleWithAutomation,
  cssFontSize,
  cssHeight,
  deleteSchedule,
  deviceSections,
  entityName,
  errorText,
  formatBlock,
  formatWhen,
  hm,
  isOurs,
  langOf,
  listSchedules,
  offActions,
  onActions,
  parseBlock,
  parseFontSize,
  parseScheduleAutomation,
  parseTimeInput,
  readSchedules,
  renameScheduleAutomations,
  rewriteScheduleAutomation,
  sameConfig,
  scheduleAlias,
  scheduleIdsOf,
  schedulesIn,
  setAutomationEnabled,
  updateSchedule,
  waitForEntity,
  weekStatus
};
