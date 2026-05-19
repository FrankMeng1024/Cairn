import { useEffect, useRef } from 'react';
import { View, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { useTrackingStore } from './src/store/useTrackingStore';
import { initMapbox } from './src/config/mapbox';
import { debugLogger } from './src/services/debugLogger';
import { registerBackgroundTask } from './src/services/backgroundLocationTask';
import { telemetryUploader } from './src/services/telemetryUploader';
import { networkMonitor } from './src/services/networkMonitor';
import { DebugAnnotationFAB } from './src/components/DebugAnnotationFAB';

// Must run at app entry — handles Google OAuth popup redirect on web
WebBrowser.maybeCompleteAuthSession();

// Initialize Mapbox token (native + web) before any MapView renders
initMapbox();

// Pre-register background location TaskManager handler (no-op on web).
// MUST run at module load before any startLocationUpdatesAsync call.
registerBackgroundTask().catch(() => {});

// Best-effort: clean up any orphaned background location task left over from
// a previous app instance that was killed mid-session. Without this, a user
// who killed the app mid-tramp would have iOS continuing to deliver fixes
// to the JS task forever, draining battery.
(async () => {
  try {
    const Location = await import('expo-location');
    const TaskManager = await import('expo-task-manager');
    const { BACKGROUND_LOCATION_TASK } = await import('./src/services/backgroundLocationTask');
    if (TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (running) {
        // Will be re-started by useTrackingStore.startTracking when user begins.
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    }
  } catch {
    // expo-location/task-manager unavailable (web/Expo Go). Ignore.
  }
})();

// On web: the React Navigation native stack renders a wrapper div with
// background-color: rgb(242,242,242). During screen transitions this wrapper
// is briefly visible, causing a grey/white flash. Override it to match the
// app's background color so the flash is invisible.
if (Platform.OS === 'web') {
  // Use MutationObserver to find and patch the navigator wrapper as soon as it mounts
  const observer = new MutationObserver(() => {
    const divs = document.querySelectorAll<HTMLDivElement>('div');
    divs.forEach(div => {
      const bg = div.style.backgroundColor;
      if (bg === 'rgb(242, 242, 242)' || bg === '#f2f2f2') {
        div.style.backgroundColor = '#faf7f2';
      }
    });
  });
  // Start observing once DOM is ready
  const startObserver = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    // Also patch immediately in case body already has children
    const divs = document.querySelectorAll<HTMLDivElement>('div');
    divs.forEach(div => {
      if (div.style.backgroundColor === 'rgb(242, 242, 242)') {
        div.style.backgroundColor = '#faf7f2';
      }
    });
  };
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
}

function AppRoot() {
  const hydrate = useAppStore(s => s.hydrate);
  const hydrated = useAppStore(s => s.hydrated);
  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const lastAppState = useRef<string>(AppState.currentState);

  useEffect(() => {
    hydrateSettings();
    // hydrate() handles auth restore, per-user session fetch from backend,
    // and marker isolation. Do NOT call hydrateMarkers/hydrateSessions in
    // parallel — they would overwrite backend data with previous user's cache.
    hydrate();

    // Configure debug logger device info + start network monitor
    debugLogger.configure({ deviceInfo: telemetryUploader.getDeviceInfo() });
    networkMonitor.start().catch(() => {});
    telemetryUploader.init();

    // App state change listener for debug logger
    const sub = AppState.addEventListener('change', (next) => {
      const prev = lastAppState.current;
      lastAppState.current = next;
      const trackingActive = useTrackingStore.getState().status === 'tracking';
      const norm = (s: string): 'active' | 'background' | 'inactive' | 'unknown' =>
        s === 'active' ? 'active' :
        s === 'background' ? 'background' :
        s === 'inactive' ? 'inactive' : 'unknown';
      debugLogger.log({
        ts: Date.now(),
        event: 'app_state_change',
        from: norm(prev),
        to: norm(next),
        tracking_active: trackingActive,
      });
    });
    return () => sub.remove();
  }, []);
  if (!hydrated) return <View style={{ flex: 1 }} />;
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
      <DebugAnnotationFAB />
    </SafeAreaProvider>
  );
}
