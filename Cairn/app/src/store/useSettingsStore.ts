/**
 * useSettingsStore — App-wide user preferences (persisted via MMKV).
 *
 * Consumed by: SettingsScreen (read/write), HikingScreen (read broadcast/deviation),
 * RunningScreen (read broadcast), BroadcastService (read voiceBroadcasts/dangerAlerts).
 */
import { create } from 'zustand';
import { storage } from './storage';

export interface Settings {
  // Emergency
  tripSharing: boolean;

  // Broadcasts
  voiceBroadcasts: boolean;
  dangerAlerts: boolean;
  routeDeviation: boolean;

  // Feedback
  hapticFeedback: boolean;
  soundEffects: boolean;
  edgeWarningGlow: boolean;

  // Social
  shareAfterAdd: boolean;
  locationShare: boolean;

  // Display
  nightMode: boolean;

  // Voice guidance
  broadcastEnabled: boolean;
}

const STORAGE_KEY = 'cairn_settings';

const DEFAULTS: Settings = {
  tripSharing: true,
  voiceBroadcasts: true,
  dangerAlerts: true,
  routeDeviation: true,
  hapticFeedback: true,
  soundEffects: true,
  edgeWarningGlow: true,
  shareAfterAdd: true,
  locationShare: false,
  nightMode: false,
  broadcastEnabled: true,
};

interface SettingsState extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveAll: (patch: Partial<Settings>) => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,

  updateSetting: (key, value) => {
    set({ [key]: value } as Partial<Settings>);
    const next = { ...get(), [key]: value };
    storage.setItem(STORAGE_KEY, JSON.stringify(pick(next)));
  },

  saveAll: (patch) => {
    set(patch);
    const next = { ...get(), ...patch };
    storage.setItem(STORAGE_KEY, JSON.stringify(pick(next)));
  },

  hydrate: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<Settings> = JSON.parse(raw);
        set({ ...DEFAULTS, ...saved });
      }
    } catch {
      // Use defaults on parse error
    }
  },
}));

// Extract only Settings fields (strip Zustand methods)
function pick(state: SettingsState): Settings {
  const { updateSetting: _, saveAll: __, hydrate: ___, ...settings } = state;
  return settings as Settings;
}
