/**
 * Home Assistant Schedule Card Studio & Customizer
 * Monday-first (Mon–Sun), Ukrainian & English localization, pure scheduler.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Download,
  FileText,
  Languages,
  Moon,
  Play,
  RotateCcw,
  Sliders,
  Sun,
  Thermometer,
  Zap,
} from 'lucide-react';
import { MockHassManager } from './simulator/mockHass.ts';
import { runAllTests, TestResult } from './tests/testSuite.ts';
import { CLEAN_SCHEDULE_CARD_JS } from './card/sourceCode.ts';

// Import custom card definition to register custom elements in the browser DOM
import './card/simple-schedule-card.ts';

type ActiveTab = 'preview' | 'tests' | 'code' | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [cardLang, setCardLang] = useState<'uk' | 'en'>('uk');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);

  // Mock Home Assistant manager
  const [hassManager] = useState(() => new MockHassManager('uk'));
  const [hassState, setHassState] = useState(() => hassManager.getHassObject());

  // Test suite state
  const [testResults, setTestResults] = useState<{
    passed: boolean;
    results: TestResult[];
    summary: { total: number; passed: number; failed: number };
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Reference for the custom element host
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [cardConfig, setCardConfig] = useState<any>({
    title: 'Розклади розумного дому',
    show_add: true,
    show_time: true,
    show_time_toggle: true,
  });

  // Subscribe to Hass updates
  useEffect(() => {
    const unsub = hassManager.subscribe((newHass) => {
      setHassState(newHass);
    });
    return unsub;
  }, [hassManager]);

  // Update language in mock Hass
  const handleLanguageChange = (lang: 'uk' | 'en') => {
    setCardLang(lang);
    hassManager.setLanguage(lang);
    setCardConfig((prev: any) => ({
      ...prev,
      title: lang === 'uk' ? 'Розклади розумного дому' : 'Home Schedules',
    }));
  };

  // Mount and update <simple-schedule-card> in the preview container
  useEffect(() => {
    if (activeTab !== 'preview' || !cardContainerRef.current) return;
    const container = cardContainerRef.current;
    let cardEl = container.querySelector('simple-schedule-card') as any;

    if (!cardEl) {
      container.innerHTML = '';
      cardEl = document.createElement('simple-schedule-card');
      container.appendChild(cardEl);
    }

    cardEl.setConfig(cardConfig);
    cardEl.hass = hassState;
  }, [activeTab, hassState, cardConfig]);

  // Mount and update <simple-schedule-card-editor> in the visual editor container
  useEffect(() => {
    if (!showVisualEditor || !editorContainerRef.current) return;
    const container = editorContainerRef.current;
    let editorEl = container.querySelector('simple-schedule-card-editor') as any;

    if (!editorEl) {
      container.innerHTML = '';
      editorEl = document.createElement('simple-schedule-card-editor');
      editorEl.addEventListener('config-changed', (e: any) => {
        setCardConfig(e.detail.config);
      });
      container.appendChild(editorEl);
    }

    editorEl.setConfig(cardConfig);
    editorEl.hass = hassState;
  }, [showVisualEditor, hassState, cardConfig]);

  // Run tests automatically on mount
  useEffect(() => {
    executeTests();
  }, []);

  const executeTests = async () => {
    setIsRunningTests(true);
    // Short delay for natural UI feel
    await new Promise((r) => setTimeout(r, 150));
    const res = await runAllTests();
    setTestResults(res);
    setIsRunningTests(false);
  };

  const handleDownloadJs = () => {
    const blob = new Blob([CLEAN_SCHEDULE_CARD_JS], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'simple-schedule-card.js';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(CLEAN_SCHEDULE_CARD_JS);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const yamlExample = `views:
  - title: Головна
    path: home
    cards:
      - type: custom:simple-schedule-card
        title: Розклади опалення та освітлення
        show_add: true
        show_time: true
        # Опційні параметри:
        # show_time_toggle: false # приховати чекбокс перемикання з шапки
        # font_size: 15px         # розмір шрифту: 14px, 15px, 16px, 1rem тощо
        # height: 450px
        # device_domains:
        #   - climate
        #   - water_heater
        #   - light
        #   - switch`;

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yamlExample);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2500);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDarkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar (3-Zone Contract) */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isDarkTheme ? 'bg-slate-950/85 border-slate-800' : 'bg-white/85 border-slate-200'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="font-semibold text-base sm:text-lg tracking-tight whitespace-nowrap">
              Simple Schedule Studio
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'preview'
                  ? isDarkTheme
                    ? 'bg-slate-800 text-sky-400'
                    : 'bg-slate-100 text-sky-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Картка та емулятор</span>
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'tests'
                  ? isDarkTheme
                    ? 'bg-slate-800 text-sky-400'
                    : 'bg-slate-100 text-sky-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Тести ({testResults?.summary.passed || 0}/{testResults?.summary.total || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'code'
                  ? isDarkTheme
                    ? 'bg-slate-800 text-sky-400'
                    : 'bg-slate-100 text-sky-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Вихідний код JS</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'guide'
                  ? isDarkTheme
                    ? 'bg-slate-800 text-sky-400'
                    : 'bg-slate-100 text-sky-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Інструкція та YAML</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Language toggle */}
            <button
              onClick={() => handleLanguageChange(cardLang === 'uk' ? 'en' : 'uk')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                isDarkTheme
                  ? 'border-slate-800 hover:bg-slate-900 text-slate-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Перемкнути мову інтерфейсу"
            >
              <Languages className="w-3.5 h-3.5 text-sky-400" />
              <span className="uppercase font-semibold tracking-wider">{cardLang}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className={`p-2 rounded-lg border transition-colors ${
                isDarkTheme
                  ? 'border-slate-800 hover:bg-slate-900 text-slate-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Перемкнути світлу / темну тему"
            >
              {isDarkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Download JS */}
            <button
              onClick={handleDownloadJs}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Завантажити JS</span>
              <span className="sm:hidden">JS</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className="md:hidden flex overflow-x-auto px-4 py-2 gap-2 border-t border-slate-800/60 scrollbar-none">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'preview' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400'
            }`}
          >
            Емулятор
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'tests' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400'
            }`}
          >
            Тести
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'code' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400'
            }`}
          >
            Код JS
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'guide' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400'
            }`}
          >
            YAML
          </button>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'preview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Live HA Card Preview */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Живе превʼю картки Home Assistant</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Понеділок – перший день тижня · Повна українська локалізація · Чисті розклади
                  </p>
                </div>
                <button
                  onClick={() => setShowVisualEditor((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all font-medium ${
                    showVisualEditor
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                      : isDarkTheme
                      ? 'border-slate-800 hover:bg-slate-900 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Тестувати візуальний редактор картки (GUI)"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showVisualEditor ? 'Приховати редактор' : 'Візуальний редактор (GUI)'}</span>
                </button>
              </div>

              {/* Visual Editor Tester Frame */}
              {showVisualEditor && (
                <div
                  className={`rounded-2xl border p-4 sm:p-5 transition-colors shadow-sm ${
                    isDarkTheme
                      ? 'bg-[#1c1c1e] border-slate-800 text-slate-100'
                      : 'bg-[#fafafa] border-slate-200 text-slate-900'
                  }`}
                  style={
                    {
                      '--primary-color': '#0288d1',
                      '--primary-text-color': isDarkTheme ? '#f1f5f9' : '#1e293b',
                      '--secondary-text-color': isDarkTheme ? '#94a3b8' : '#64748b',
                      '--divider-color': isDarkTheme ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-slate-700/40 text-xs">
                    <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" />
                      Візуальний редактор конфігурації Lovelace
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">&lt;simple-schedule-card-editor&gt;</span>
                  </div>
                  <div ref={editorContainerRef} />
                </div>
              )}

              {/* Lovelace Dashboard Frame with CSS variables mimicking HA theme */}
              <div
                className={`rounded-2xl border p-4 sm:p-6 transition-colors shadow-sm ${
                  isDarkTheme
                    ? 'bg-[#1c1c1e] border-slate-800 text-slate-100'
                    : 'bg-[#fafafa] border-slate-200 text-slate-900'
                }`}
                style={
                  {
                    '--ha-card-background': isDarkTheme ? '#242426' : '#ffffff',
                    '--card-background-color': isDarkTheme ? '#242426' : '#ffffff',
                    '--secondary-background-color': isDarkTheme ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    '--primary-color': '#0288d1',
                    '--primary-text-color': isDarkTheme ? '#f1f5f9' : '#1e293b',
                    '--secondary-text-color': isDarkTheme ? '#94a3b8' : '#64748b',
                    '--divider-color': isDarkTheme ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    '--ha-card-border-radius': '16px',
                    '--ha-card-border-color': isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    '--success-color': '#22c55e',
                    '--error-color': '#ef4444',
                    '--warning-color': '#f59e0b',
                  } as React.CSSProperties
                }
              >
                {/* Simulated Home Assistant Lovelace Header bar */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-700/40 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-medium text-slate-300">Lovelace Dashboard Simulator</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>Тиждень: Пн–Нд</span>
                    <span>·</span>
                    <span className="uppercase font-mono">{cardLang}</span>
                  </div>
                </div>

                {/* Host container for the custom element */}
                <div ref={cardContainerRef} className="w-full">
                  {/* <simple-schedule-card> will be injected and bound here */}
                </div>
              </div>

              {/* Instructions banner */}
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                  isDarkTheme ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="p-1 rounded-md bg-sky-500/10 text-sky-400 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <strong className="font-semibold text-slate-200 block mb-0.5">Як перевірити роботу:</strong>
                  Натисніть на будь-який рядок розкладу або кнопку <strong>«+ Новий розклад»</strong> всередині картки вище.
                  Відкриється повнофункціональне вікно редактора з днями від понеділка до неділі, вибором пристроїв,
                  налаштуванням годин та збереженням у стан Home Assistant.
                </div>
              </div>
            </div>

            {/* Right: Device & Entity Simulator Panel */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Стан тестових пристроїв</h2>
                  <p className="text-xs text-slate-400">Сутності, якими керують розклади</p>
                </div>
                <button
                  onClick={() => {
                    const fresh = new MockHassManager(cardLang);
                    setHassState(fresh.getHassObject());
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                    isDarkTheme
                      ? 'border-slate-800 hover:bg-slate-900 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Скинути до початкового стану"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Скинути</span>
                </button>
              </div>

              <div
                className={`rounded-2xl border divide-y overflow-hidden ${
                  isDarkTheme
                    ? 'bg-slate-900/40 border-slate-800 divide-slate-800'
                    : 'bg-white border-slate-200 divide-slate-100'
                }`}
              >
                {/* Entity Item 1 */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                      <Thermometer className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">Термостат вітальні</div>
                      <div className="text-xs text-slate-400 font-mono">climate.living_room</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold font-mono tabular-nums text-orange-400">
                      {hassState.states['climate.living_room']?.attributes?.temperature}°C
                    </div>
                    <div className="text-xs text-slate-400 capitalize">
                      {hassState.states['climate.living_room']?.state}
                    </div>
                  </div>
                </div>

                {/* Entity Item 2 */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">Бойлер (Нічний тариф)</div>
                      <div className="text-xs text-slate-400 font-mono">water_heater.boiler</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold font-mono tabular-nums text-amber-400">
                      {hassState.states['water_heater.boiler']?.attributes?.temperature}°C
                    </div>
                    <div className="text-xs text-emerald-400 font-medium">Активний</div>
                  </div>
                </div>

                {/* Entity Item 3 */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">Люстра вітальні</div>
                      <div className="text-xs text-slate-400 font-mono">light.living_room_ceiling</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Увімкнено (80%)
                    </span>
                  </div>
                </div>

                {/* Entity Item 4 */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">Штори вітальні</div>
                      <div className="text-xs text-slate-400 font-mono">cover.living_room_blinds</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium text-slate-400">Відкрито 100%</span>
                  </div>
                </div>
              </div>

              {/* What changed summary */}
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2.5 ${
                  isDarkTheme ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Виконані зміни у вашій версії картки:</span>
                </div>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                  <li>
                    <strong className="text-slate-300">Перший день тижня:</strong> Понеділок (Пн–Нд замість неділі).
                  </li>
                  <li>
                    <strong className="text-slate-300">Мови:</strong> Повна українська локалізація (<span className="text-sky-400">UK</span>) та англійська (<span className="text-sky-400">EN</span>) за дефолтом.
                  </li>
                  <li>
                    <strong className="text-slate-300">Проста та чиста структура:</strong> Чистий універсальний планувальник для будь-яких розумних пристроїв без зайвих залежностей.
                  </li>
                  <li>
                    <strong className="text-slate-300">Маркери:</strong> Автоматизації створюються як <code className="text-slate-300">Schedule · Назва</code>.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Automated Tests */}
        {activeTab === 'tests' && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Автоматичні тести (Test Suite)</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Перевірка моделі тижня, розрахунку понеділка, 24-годинних інтервалів, генератора автоматизацій та локалізації
                </p>
              </div>
              <button
                onClick={executeTests}
                disabled={isRunningTests}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningTests ? 'Перевірка...' : 'Перезапустити тести'}</span>
              </button>
            </div>

            {/* Test Summary Cards */}
            {testResults && (
              <div className="grid grid-cols-3 gap-4">
                <div
                  className={`p-4 rounded-xl border ${
                    isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-400 font-medium">Всього тестів</div>
                  <div className="text-2xl font-bold font-mono mt-1">{testResults.summary.total}</div>
                </div>
                <div
                  className={`p-4 rounded-xl border ${
                    isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-emerald-400 font-medium">Успішно пройдено</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {testResults.summary.passed}
                  </div>
                </div>
                <div
                  className={`p-4 rounded-xl border ${
                    isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xs text-rose-400 font-medium">Помилок</div>
                  <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                    {testResults.summary.failed}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed test list */}
            <div
              className={`rounded-2xl border divide-y overflow-hidden ${
                isDarkTheme
                  ? 'bg-slate-900/40 border-slate-800 divide-slate-800'
                  : 'bg-white border-slate-200 divide-slate-100'
              }`}
            >
              {testResults?.results.map((r, i) => (
                <div key={i} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {r.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">
                          ✕
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{r.suite}</div>
                      <div className="text-sm font-medium text-slate-200 mt-0.5">{r.name}</div>
                      {r.error && (
                        <div className="text-xs font-mono text-rose-400 mt-1.5 bg-rose-500/10 p-2 rounded-md border border-rose-500/20">
                          {r.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-500 shrink-0 tabular-nums">{r.durationMs}ms</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Clean JS Source Code */}
        {activeTab === 'code' && (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Чистий вихідний код simple-schedule-card.js</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Готовий файл для збереження в <code className="text-sky-400">/config/www/simple-schedule-card.js</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    isDarkTheme
                      ? 'border-slate-800 hover:bg-slate-900 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Скопійовано!' : 'Копіювати код'}</span>
                </button>
                <button
                  onClick={handleDownloadJs}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Завантажити файл</span>
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDarkTheme ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-700'
              }`}
            >
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>simple-schedule-card.js (Vanilla ES Module)</span>
                <span>v1.0.0</span>
              </div>
              <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-slate-300 max-h-[620px] scrollbar-thin">
                <code>{CLEAN_SCHEDULE_CARD_JS}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: Guide & Lovelace YAML */}
        {activeTab === 'guide' && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Інструкція встановлення в Home Assistant</h1>
              <p className="text-xs text-slate-400 mt-0.5">Кроки для додавання картки на ваш дашборд</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-5 rounded-2xl border flex flex-col gap-2 ${
                  isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="font-semibold text-sm">Збережіть файл</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Завантажте файл <code className="text-sky-400">simple-schedule-card.js</code> та скопіюйте його на ваш
                  сервер Home Assistant у папку:
                  <br />
                  <code className="text-slate-200 font-mono text-[11px] block mt-1 bg-slate-950/60 p-1 rounded">
                    /config/www/simple-schedule-card.js
                  </code>
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border flex flex-col gap-2 ${
                  isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="font-semibold text-sm">Підключіть ресурс</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  У Home Assistant відкрийте:
                  <br />
                  <strong>Налаштування → Панелі керування → Ресурси</strong>
                  <br />
                  Додайте новий ресурс:
                  <code className="text-slate-200 font-mono text-[11px] block mt-1 bg-slate-950/60 p-1 rounded">
                    /local/simple-schedule-card.js?v=1.0.0
                  </code>
                  Тип: <strong>JavaScript Module</strong>
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border flex flex-col gap-2 ${
                  isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="font-semibold text-sm">Додайте картку на панель</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Натисніть «Редагувати панель» → «Додати картку» → виберіть «Вручну» або знайдіть
                  <strong> Simple Schedule Card</strong> у списку.
                </p>
              </div>
            </div>

            {/* YAML Snippet Box */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold">Приклад конфігурації YAML</span>
                <button
                  onClick={handleCopyYaml}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    isDarkTheme
                      ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedYaml ? 'Скопійовано!' : 'Копіювати YAML'}</span>
                </button>
              </div>
              <pre className="p-5 overflow-x-auto text-xs font-mono leading-relaxed text-sky-400 bg-slate-950/60">
                <code>{yamlExample}</code>
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-6 text-xs text-center transition-colors ${
          isDarkTheme ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-400'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Simple Schedule Card v1.0.0 · Нативний планувальник Home Assistant</span>
          <span>Понеділок – Неділя · Українська локалізація · Чистий код</span>
        </div>
      </footer>
    </div>
  );
}
