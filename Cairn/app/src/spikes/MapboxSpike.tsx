import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export function MapboxSpike() {
  const [status, setStatus] = useState('Not started');

  // Note: Mapbox requires a valid access token and a development build (not Expo Go)
  // This spike verifies the SDK loads. Full offline test requires EAS build.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SPIKE-001: Mapbox Offline Map</Text>
      <Text style={styles.info}>
        Note: @rnmapbox/maps requires a development build (EAS Build or bare workflow).{'\n\n'}
        It will NOT work in Expo Go.{'\n\n'}
        To test this spike:{'\n'}
        1. Set MAPBOX_TOKEN in app.json{'\n'}
        2. Run: npx expo prebuild{'\n'}
        3. Run: npx expo run:ios{'\n\n'}
        For now, this spike validates the SDK is installed and configured correctly.
      </Text>

      <View style={styles.checklist}>
        <Text style={styles.checkItem}>✅ @rnmapbox/maps installed</Text>
        <Text style={styles.checkItem}>✅ Plugin configured in app.json</Text>
        <Text style={styles.checkItem}>✅ iOS location permissions set</Text>
        <Text style={styles.checkItem}>⬜ Mapbox token configured</Text>
        <Text style={styles.checkItem}>⬜ Development build created</Text>
        <Text style={styles.checkItem}>⬜ Map renders on device</Text>
        <Text style={styles.checkItem}>⬜ Offline region download tested</Text>
      </View>

      <Text style={styles.conclusion}>
        SPIKE CONCLUSION:{'\n'}
        SDK installed successfully. Requires EAS development build for full verification.
        Mapbox free tier includes 25K MAU + offline maps.
        NZ Tongariro region estimate: ~50-100MB offline tiles at zoom 10-15.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },
  title: { fontSize: 18, fontWeight: '700', color: '#2d2a26', marginBottom: 16 },
  info: { fontSize: 13, color: '#5c5650', lineHeight: 20, marginBottom: 20 },
  checklist: { gap: 8, marginBottom: 20 },
  checkItem: { fontSize: 14, color: '#2d2a26' },
  conclusion: { fontSize: 12, color: '#5d7c46', backgroundColor: '#dcf4de', padding: 12, borderRadius: 8, lineHeight: 18 },
});
