import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { useMarkerStore } from './src/store/useMarkerStore';

// Must run at app entry — handles Google OAuth popup redirect on web
WebBrowser.maybeCompleteAuthSession();

function AppRoot() {
  const hydrate = useAppStore(s => s.hydrate);
  const hydrated = useAppStore(s => s.hydrated);
  const hydrateMarkers = useMarkerStore(s => s.hydrate);
  useEffect(() => {
    // hydrate() handles both auth restore AND per-user session fetch from backend.
    // hydrateSessions() (localStorage) must NOT run in parallel — it would overwrite
    // the backend-fetched sessions with the previous user's cached data.
    // useAppStore.hydrate() calls useSessionStore.hydrate() itself when not logged in.
    hydrate();
    hydrateMarkers();
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
