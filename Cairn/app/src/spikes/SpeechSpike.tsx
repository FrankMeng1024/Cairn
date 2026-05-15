import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';

const TEST_PHRASES = [
  { label: 'Short alert', text: 'Caution. Slippery surface ahead.' },
  { label: 'Direction', text: 'Turn left at the next junction.' },
  { label: 'Friend marker', text: 'Friend marker: Alex noted water source 200 meters ahead.' },
  { label: 'Off route', text: 'You are off route. Return to trail on your right.' },
];

export function SpeechSpike() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 20));
  };

  const loadVoices = async () => {
    const v = await Speech.getAvailableVoicesAsync();
    setVoices(v);
    addLog(`Found ${v.length} voices. EN voices: ${v.filter(x => x.language.startsWith('en')).length}`);
  };

  const speak = (text: string, label: string) => {
    setSpeaking(true);
    addLog(`Speaking: "${label}"`);
    const startTime = Date.now();

    Speech.speak(text, {
      language: 'en-NZ',
      rate: 1.0,
      pitch: 1.0,
      // Note: Audio ducking behavior depends on iOS AVAudioSession configuration
      // expo-speech uses the default "duck others" behavior on iOS
      onStart: () => {
        const delay = Date.now() - startTime;
        addLog(`Started (delay: ${delay}ms)`);
      },
      onDone: () => {
        setSpeaking(false);
        const duration = Date.now() - startTime;
        addLog(`Done (total: ${duration}ms)`);
      },
      onError: (e) => {
        setSpeaking(false);
        addLog(`Error: ${JSON.stringify(e)}`);
      },
    });
  };

  const stopSpeech = () => {
    Speech.stop();
    setSpeaking(false);
    addLog('Stopped manually');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.title}>SPIKE-003: TTS + Audio Ducking</Text>

      <Text style={styles.info}>
        Test voice announcements. Play music on your phone first,{'\n'}
        then trigger speech to verify audio ducking behavior.
      </Text>

      <TouchableOpacity style={styles.btn} onPress={loadVoices}>
        <Text style={styles.btnText}>Load Available Voices</Text>
      </TouchableOpacity>

      {voices.length > 0 && (
        <Text style={styles.status}>
          EN-NZ: {voices.filter(v => v.language === 'en-NZ').length} |
          EN-AU: {voices.filter(v => v.language === 'en-AU').length} |
          EN-US: {voices.filter(v => v.language === 'en-US').length}
        </Text>
      )}

      <Text style={styles.sectionTitle}>Test Phrases:</Text>
      {TEST_PHRASES.map((phrase, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.phraseBtn, speaking && styles.btnDisabled]}
          onPress={() => speak(phrase.text, phrase.label)}
          disabled={speaking}
        >
          <Text style={styles.phraseName}>{phrase.label}</Text>
          <Text style={styles.phraseText}>{phrase.text}</Text>
        </TouchableOpacity>
      ))}

      {speaking && (
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={stopSpeech}>
          <Text style={styles.btnText}>Stop Speaking</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Log:</Text>
      <View style={styles.logBox}>
        {log.map((entry, i) => (
          <Text key={i} style={styles.logEntry}>{entry}</Text>
        ))}
        {log.length === 0 && <Text style={styles.logEntry}>No events yet</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spike Checklist</Text>
        <Text style={styles.checkItem}>⬜ TTS speaks in English (NZ/AU voice)</Text>
        <Text style={styles.checkItem}>⬜ Speech delay {'<'} 500ms from trigger</Text>
        <Text style={styles.checkItem}>⬜ Music volume ducks during speech</Text>
        <Text style={styles.checkItem}>⬜ Music volume recovers after speech</Text>
        <Text style={styles.checkItem}>⬜ Music does NOT pause/stop</Text>
        <Text style={styles.checkItem}>⬜ All test phrases complete in {'<'} 5s</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },
  title: { fontSize: 18, fontWeight: '700', color: '#2d2a26', marginBottom: 8 },
  info: { fontSize: 13, color: '#8c7e72', marginBottom: 16, lineHeight: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#2d2a26', marginTop: 16, marginBottom: 8 },
  status: { fontSize: 12, color: '#5d7c46', marginBottom: 8 },
  btn: { backgroundColor: '#5d7c46', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginBottom: 8 },
  btnDisabled: { opacity: 0.5 },
  btnDanger: { backgroundColor: '#c53d2e' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  phraseBtn: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#ece6de' },
  phraseName: { fontSize: 13, fontWeight: '600', color: '#5d7c46' },
  phraseText: { fontSize: 12, color: '#5c5650', marginTop: 2 },
  logBox: { backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 4, maxHeight: 200 },
  logEntry: { fontSize: 11, fontFamily: 'monospace', color: '#5c5650' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#2d2a26', marginBottom: 4 },
  checkItem: { fontSize: 13, color: '#2d2a26' },
});
