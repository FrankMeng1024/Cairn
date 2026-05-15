import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';

function AppRoot() {
  const hydrate = useAppStore(s => s.hydrate);
  useEffect(() => { hydrate(); }, []);
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
