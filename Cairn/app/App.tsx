import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { useMarkerStore } from './src/store/useMarkerStore';
import { useSessionStore } from './src/store/useSessionStore';

// Must run at app entry — handles Google OAuth popup redirect on web
WebBrowser.maybeCompleteAuthSession();

function AppRoot() {
  const hydrate = useAppStore(s => s.hydrate);
  const hydrated = useAppStore(s => s.hydrated);
  const hydrateMarkers = useMarkerStore(s => s.hydrate);
  const hydrateSessions = useSessionStore(s => s.hydrate);
  useEffect(() => {
    hydrate();
    hydrateMarkers();
    hydrateSessions();
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
