import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { useSettingsStore } from './src/store/useSettingsStore';

// Must run at app entry — handles Google OAuth popup redirect on web
WebBrowser.maybeCompleteAuthSession();

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
