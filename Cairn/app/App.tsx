import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { initMapbox } from './src/config/mapbox';

// Must run at app entry — handles Google OAuth popup redirect on web
WebBrowser.maybeCompleteAuthSession();

// Initialize Mapbox token (native + web) before any MapView renders
initMapbox();

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
  useEffect(() => {
    hydrateSettings();
    // hydrate() handles auth restore, per-user session fetch from backend,
    // and marker isolation. Do NOT call hydrateMarkers/hydrateSessions in
    // parallel — they would overwrite backend data with previous user's cache.
    hydrate();
  }, []);
  if (!hydrated) return <View style={{ flex: 1 }} />;
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
