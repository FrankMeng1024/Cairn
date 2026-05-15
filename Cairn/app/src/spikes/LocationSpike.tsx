import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import * as Location from 'expo-location';

export function LocationSpike() {
  const [permission, setPermission] = useState<string>('unknown');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackPoints, setTrackPoints] = useState<{ lat: number; lng: number; acc: number; time: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      if (subRef.current) subRef.current.remove();
    };
  }, []);

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startTracking = async () => {
    try {
      setTrackPoints([]);
      setTracking(true);
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 2,
        },
        (loc) => {
          setLocation(loc);
          setTrackPoints((prev) => [
            ...prev,
            {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              acc: loc.coords.accuracy ?? 0,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }
      );
    } catch (e: any) {
      setError(e.message);
      setTracking(false);
    }
  };

  const stopTracking = () => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    setTracking(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.title}>SPIKE-002: GPS Background Tracking</Text>

      <TouchableOpacity style={styles.btn} onPress={requestPermission}>
        <Text style={styles.btnText}>Request Location Permission</Text>
      </TouchableOpacity>
      <Text style={styles.status}>Permission: {permission}</Text>

      {location && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Location</Text>
          <Text style={styles.mono}>Lat: {location.coords.latitude.toFixed(6)}</Text>
          <Text style={styles.mono}>Lng: {location.coords.longitude.toFixed(6)}</Text>
          <Text style={styles.mono}>Accuracy: {location.coords.accuracy?.toFixed(1)}m</Text>
          <Text style={styles.mono}>Altitude: {location.coords.altitude?.toFixed(1)}m</Text>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, tracking && styles.btnDisabled]}
          onPress={startTracking}
          disabled={tracking || permission !== 'granted'}
        >
          <Text style={styles.btnText}>Start Tracking (3s interval)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={stopTracking}
          disabled={!tracking}
        >
          <Text style={styles.btnText}>Stop</Text>
        </TouchableOpacity>
      </View>

      {trackPoints.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Track Points ({trackPoints.length})</Text>
          {trackPoints.slice(-10).map((p, i) => (
            <Text key={i} style={styles.mono}>
              {p.time} | {p.lat.toFixed(5)}, {p.lng.toFixed(5)} | ±{p.acc.toFixed(0)}m
            </Text>
          ))}
          {trackPoints.length > 10 && (
            <Text style={styles.more}>...showing last 10 of {trackPoints.length}</Text>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>Error: {error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },
  title: { fontSize: 18, fontWeight: '700', color: '#2d2a26', marginBottom: 16 },
  status: { fontSize: 13, color: '#8c7e72', marginBottom: 12 },
  btn: { backgroundColor: '#5d7c46', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginBottom: 8 },
  btnDisabled: { opacity: 0.5 },
  btnDanger: { backgroundColor: '#c53d2e' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginVertical: 8, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#2d2a26', marginBottom: 6 },
  mono: { fontSize: 11, fontFamily: 'monospace', color: '#5c5650' },
  more: { fontSize: 11, color: '#8c7e72', marginTop: 4 },
  error: { fontSize: 12, color: '#c53d2e', marginTop: 8 },
});
