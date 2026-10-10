/**
 * Mock Home Assistant implementation for interactive browser preview.
 * Simulates callWS, callApi, callService and live states.
 */

export interface MockEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
}

export function createInitialStates(): Record<string, MockEntity> {
  const now = new Date().toISOString();
  return {
    'climate.living_room': {
      entity_id: 'climate.living_room',
      state: 'heat',
      attributes: {
        friendly_name: 'Термостат вітальні',
        temperature: 21.5,
        min_temp: 16,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ['heat', 'cool', 'auto'],
        current_temperature: 21.0,
      },
      last_updated: now,
    },
    'climate.bedroom': {
      entity_id: 'climate.bedroom',
      state: 'heat',
      attributes: {
        friendly_name: 'Клімат спальні',
        temperature: 19.0,
        min_temp: 16,
        max_temp: 28,
        target_temp_step: 0.5,
        hvac_modes: ['heat', 'cool', 'auto'],
        current_temperature: 18.5,
      },
      last_updated: now,
    },
    'water_heater.boiler': {
      entity_id: 'water_heater.boiler',
      state: 'on',
      attributes: {
        friendly_name: 'Бойлер (Нічний тариф)',
        temperature: 60,
        min_temp: 35,
        max_temp: 75,
        target_temp_step: 1,
        operation_mode: 'eco',
      },
      last_updated: now,
    },
    'light.living_room_ceiling': {
      entity_id: 'light.living_room_ceiling',
      state: 'on',
      attributes: {
        friendly_name: 'Люстра вітальні',
        brightness: 204, // 80%
        supported_color_modes: ['brightness', 'color_temp'],
      },
      last_updated: now,
    },
    'light.kitchen_strip': {
      entity_id: 'light.kitchen_strip',
      state: 'off',
      attributes: {
        friendly_name: 'LED підсвітка кухні',
        brightness: 128,
        supported_color_modes: ['brightness'],
      },
      last_updated: now,
    },
    'switch.towel_dryer': {
      entity_id: 'switch.towel_dryer',
      state: 'off',
      attributes: {
        friendly_name: 'Сушарка для рушників',
        icon: 'mdi:radiator',
      },
      last_updated: now,
    },
    'switch.irrigation_pump': {
      entity_id: 'switch.irrigation_pump',
      state: 'off',
      attributes: {
        friendly_name: 'Насос автополиву',
        icon: 'mdi:sprinkler',
      },
      last_updated: now,
    },
    'cover.living_room_blinds': {
      entity_id: 'cover.living_room_blinds',
      state: 'open',
      attributes: {
        friendly_name: 'Штори вітальні',
        current_position: 100,
      },
      last_updated: now,
    },
    'valve.water_main': {
      entity_id: 'valve.water_main',
      state: 'open',
      attributes: {
        friendly_name: 'Головний кран води',
      },
      last_updated: now,
    },
    // Schedules:
    'schedule.heating_schedule': {
      entity_id: 'schedule.heating_schedule',
      state: 'on',
      attributes: {
        friendly_name: 'Опалення (Будні та вихідні)',
        editable: true,
        next_event: new Date(Date.now() + 3600 * 1000 * 3).toISOString(),
      },
      last_updated: now,
    },
    'schedule.boiler_night': {
      entity_id: 'schedule.boiler_night',
      state: 'off',
      attributes: {
        friendly_name: 'Бойлер (Нічний тариф 23:00–07:00)',
        editable: true,
        next_event: new Date(Date.now() + 3600 * 1000 * 6).toISOString(),
      },
      last_updated: now,
    },
    'schedule.evening_light': {
      entity_id: 'schedule.evening_light',
      state: 'off',
      attributes: {
        friendly_name: 'Вечірнє підсвічування фасаду',
        editable: true,
        next_event: new Date(Date.now() + 3600 * 1000 * 8).toISOString(),
      },
      last_updated: now,
    },
    // Automations:
    'automation.heating_schedule': {
      entity_id: 'automation.heating_schedule',
      state: 'on',
      attributes: {
        id: '1710000001',
        friendly_name: 'Schedule · Опалення (Будні та вихідні)',
      },
      last_updated: now,
    },
    'automation.boiler_night': {
      entity_id: 'automation.boiler_night',
      state: 'on',
      attributes: {
        id: '1710000002',
        friendly_name: 'Schedule · Бойлер (Нічний тариф 23:00–07:00)',
      },
      last_updated: now,
    },
  };
}

export function createInitialSchedulesList() {
  return [
    {
      id: 'heating_schedule',
      name: 'Опалення (Будні та вихідні)',
      monday: [
        { from: '06:30:00', to: '08:30:00' },
        { from: '17:30:00', to: '22:30:00' },
      ],
      tuesday: [
        { from: '06:30:00', to: '08:30:00' },
        { from: '17:30:00', to: '22:30:00' },
      ],
      wednesday: [
        { from: '06:30:00', to: '08:30:00' },
        { from: '17:30:00', to: '22:30:00' },
      ],
      thursday: [
        { from: '06:30:00', to: '08:30:00' },
        { from: '17:30:00', to: '22:30:00' },
      ],
      friday: [
        { from: '06:30:00', to: '08:30:00' },
        { from: '16:00:00', to: '23:00:00' },
      ],
      saturday: [{ from: '08:00:00', to: '23:30:00' }],
      sunday: [{ from: '08:00:00', to: '22:30:00' }],
    },
    {
      id: 'boiler_night',
      name: 'Бойлер (Нічний тариф 23:00–07:00)',
      monday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      tuesday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      wednesday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      thursday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      friday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      saturday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
      sunday: [{ from: '23:00:00', to: '24:00:00' }, { from: '00:00:00', to: '07:00:00' }],
    },
    {
      id: 'evening_light',
      name: 'Вечірнє підсвічування фасаду',
      monday: [{ from: '19:00:00', to: '23:30:00' }],
      tuesday: [{ from: '19:00:00', to: '23:30:00' }],
      wednesday: [{ from: '19:00:00', to: '23:30:00' }],
      thursday: [{ from: '19:00:00', to: '23:30:00' }],
      friday: [{ from: '19:00:00', to: '24:00:00' }],
      saturday: [{ from: '19:00:00', to: '24:00:00' }],
      sunday: [{ from: '19:00:00', to: '23:30:00' }],
    },
  ];
}

export class MockHassManager {
  states: Record<string, MockEntity>;
  schedules: any[];
  automationsConfig: Record<string, any>;
  language: string;
  listeners: ((hass: any) => void)[] = [];

  constructor(lang = 'uk') {
    this.language = lang;
    this.states = createInitialStates();
    this.schedules = createInitialSchedulesList();
    this.automationsConfig = {
      '1710000001': {
        id: '1710000001',
        alias: 'Schedule · Опалення (Будні та вихідні)',
        description: 'Created by Simple Schedule Card — Термостат вітальні (schedule.heating_schedule)',
        triggers: [
          { trigger: 'state', entity_id: ['schedule.heating_schedule'], to: ['on'], id: 'schedule_on' },
          { trigger: 'state', entity_id: ['schedule.heating_schedule'], to: ['off'], id: 'schedule_off' },
        ],
        actions: [
          {
            choose: [
              {
                conditions: [{ condition: 'trigger', id: 'schedule_on' }],
                sequence: [
                  {
                    action: 'climate.set_temperature',
                    target: { entity_id: 'climate.living_room' },
                    data: { temperature: 22, hvac_mode: 'heat' },
                  },
                ],
              },
              {
                conditions: [{ condition: 'trigger', id: 'schedule_off' }],
                sequence: [{ action: 'climate.turn_off', target: { entity_id: 'climate.living_room' } }],
              },
            ],
          },
        ],
      },
      '1710000002': {
        id: '1710000002',
        alias: 'Schedule · Бойлер (Нічний тариф 23:00–07:00)',
        description: 'Created by Simple Schedule Card — Бойлер (Нічний тариф) (schedule.boiler_night)',
        triggers: [
          { trigger: 'state', entity_id: ['schedule.boiler_night'], to: ['on'], id: 'schedule_on' },
          { trigger: 'state', entity_id: ['schedule.boiler_night'], to: ['off'], id: 'schedule_off' },
        ],
        actions: [
          {
            choose: [
              {
                conditions: [{ condition: 'trigger', id: 'schedule_on' }],
                sequence: [
                  {
                    action: 'water_heater.turn_on',
                    target: { entity_id: 'water_heater.boiler' },
                  },
                  {
                    action: 'water_heater.set_temperature',
                    target: { entity_id: 'water_heater.boiler' },
                    data: { temperature: 65 },
                  },
                ],
              },
              {
                conditions: [{ condition: 'trigger', id: 'schedule_off' }],
                sequence: [{ action: 'water_heater.turn_off', target: { entity_id: 'water_heater.boiler' } }],
              },
            ],
          },
        ],
      },
    };
  }

  setLanguage(lang: string) {
    this.language = lang;
    this.notify();
  }

  subscribe(listener: (hass: any) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    const hass = this.getHassObject();
    this.listeners.forEach((l) => l(hass));
  }

  getHassObject() {
    const self = this;
    return {
      states: self.states,
      language: self.language,
      locale: { language: self.language },
      user: { is_admin: true, name: 'Admin' },
      callWS: async (msg: any) => self.handleWS(msg),
      callApi: async (method: string, path: string, data?: any) => self.handleApi(method, path, data),
      callService: async (domain: string, service: string, serviceData: any, target: any) =>
        self.handleService(domain, service, serviceData, target),
    };
  }

  async handleWS(msg: any): Promise<any> {
    switch (msg.type) {
      case 'schedule/list':
        return [...this.schedules];

      case 'schedule/create': {
        const id = 'sch_' + Math.random().toString(36).slice(2, 8);
        const newSched = { id, ...msg };
        this.schedules.push(newSched);

        const entityId = `schedule.${id}`;
        this.states[entityId] = {
          entity_id: entityId,
          state: 'off',
          attributes: { friendly_name: msg.name || 'Розклад', editable: true },
          last_updated: new Date().toISOString(),
        };
        setTimeout(() => this.notify(), 50);
        return { id };
      }

      case 'schedule/update': {
        const id = msg.schedule_id;
        const index = this.schedules.findIndex((s) => s.id === id);
        if (index >= 0) {
          this.schedules[index] = { ...this.schedules[index], ...msg };
        }
        const entityId = `schedule.${id}`;
        if (this.states[entityId]) {
          this.states[entityId] = {
            ...this.states[entityId],
            attributes: { ...this.states[entityId].attributes, friendly_name: msg.name },
            last_updated: new Date().toISOString(),
          };
        }
        setTimeout(() => this.notify(), 50);
        return { success: true };
      }

      case 'schedule/delete': {
        const id = msg.schedule_id;
        this.schedules = this.schedules.filter((s) => s.id !== id);
        delete this.states[`schedule.${id}`];
        setTimeout(() => this.notify(), 50);
        return { success: true };
      }

      case 'config/area_registry/list':
        return [
          { area_id: 'living_room', name: 'Вітальня' },
          { area_id: 'bedroom', name: 'Спальня' },
          { area_id: 'kitchen', name: 'Кухня' },
          { area_id: 'bathroom', name: 'Ванна кімната' },
        ];

      case 'config/device_registry/list':
        return [
          { id: 'dev_climate_1', area_id: 'living_room', name: 'Smart Thermostat' },
          { id: 'dev_climate_2', area_id: 'bedroom', name: 'Bedroom AC' },
          { id: 'dev_boiler', area_id: 'bathroom', name: 'Atlantic Boiler' },
          { id: 'dev_light_1', area_id: 'living_room', name: 'Philips Hue' },
        ];

      case 'config/entity_registry/list_for_display':
        return {
          entities: [
            { ei: 'climate.living_room', di: 'dev_climate_1', ai: 'living_room' },
            { ei: 'climate.bedroom', di: 'dev_climate_2', ai: 'bedroom' },
            { ei: 'water_heater.boiler', di: 'dev_boiler', ai: 'bathroom' },
            { ei: 'light.living_room_ceiling', di: 'dev_light_1', ai: 'living_room' },
            { ei: 'light.kitchen_strip', ai: 'kitchen' },
            { ei: 'switch.towel_dryer', ai: 'bathroom' },
            { ei: 'cover.living_room_blinds', ai: 'living_room' },
            { ei: 'valve.water_main', ai: 'bathroom' },
          ],
        };

      case 'config/entity_registry/get': {
        const id = msg.entity_id;
        if (id.startsWith('schedule.')) {
          const rawId = id.slice('schedule.'.length);
          return { platform: 'schedule', unique_id: rawId };
        }
        return { platform: 'unknown' };
      }

      case 'search/related': {
        if (msg.item_type === 'entity') {
          const matched = Object.keys(this.states).filter(
            (id) => id.startsWith('automation.') && id.includes(msg.item_id.slice('schedule.'.length))
          );
          return { automation: matched };
        }
        return {};
      }

      case 'automation/config': {
        const id = msg.entity_id;
        const cfgId = this.states[id]?.attributes?.id || '1710000001';
        return { config: this.automationsConfig[cfgId] || null };
      }

      case 'lovelace/dashboards/list':
        return [{ url_path: 'schedules', title: 'Розклади' }];

      default:
        return {};
    }
  }

  async handleApi(method: string, path: string, data?: any): Promise<any> {
    if (path.startsWith('config/automation/config/')) {
      const id = path.slice('config/automation/config/'.length);
      if (method === 'POST') {
        this.automationsConfig[id] = data;
        const autoEntityId = `automation.schedule_${id}`;
        this.states[autoEntityId] = {
          entity_id: autoEntityId,
          state: 'on',
          attributes: { id, friendly_name: data.alias || `Schedule · ${id}` },
          last_updated: new Date().toISOString(),
        };
        setTimeout(() => this.notify(), 50);
        return { success: true };
      } else if (method === 'DELETE') {
        delete this.automationsConfig[id];
        delete this.states[`automation.schedule_${id}`];
        setTimeout(() => this.notify(), 50);
        return { success: true };
      }
    }
    return { success: true };
  }

  async handleService(domain: string, service: string, serviceData: any, target: any): Promise<any> {
    const targets = target?.entity_id ? (Array.isArray(target.entity_id) ? target.entity_id : [target.entity_id]) : [];
    for (const id of targets) {
      if (this.states[id]) {
        if (service === 'turn_on') {
          this.states[id] = { ...this.states[id], state: 'on', last_updated: new Date().toISOString() };
        } else if (service === 'turn_off') {
          this.states[id] = { ...this.states[id], state: 'off', last_updated: new Date().toISOString() };
        }
      }
    }
    setTimeout(() => this.notify(), 50);
    return { success: true };
  }
}
