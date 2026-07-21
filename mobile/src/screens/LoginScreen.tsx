import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react-native';
import { RootStackNavigationProp } from '../navigation/types';
import { useAuth } from '../lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const navigation = useNavigation<RootStackNavigationProp<'Login'>>();
  const { requestOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(email);
      setStage('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft size={20} color="#0D1F16" />
      </Pressable>

      <View style={styles.hero}>
        <ShieldCheck size={40} color="#259F56" />
        <Text style={styles.title}>{stage === 'email' ? 'Log in to NearCart' : 'Enter the code'}</Text>
        <Text style={styles.subtitle}>
          {stage === 'email' ? "We'll email you a one-time code to verify it's you." : `Sent to ${email}`}
        </Text>
      </View>

      {stage === 'email' ? (
        <>
          <View style={styles.inputRow}>
            <Mail size={16} color="#64748B" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholderTextColor="#94A3B8"
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={handleSendOtp}
            disabled={loading || !EMAIL_RE.test(email)}
            style={[styles.button, (loading || !EMAIL_RE.test(email)) && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.inputRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor="#94A3B8"
              maxLength={6}
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={handleVerify}
            disabled={loading || code.length < 4}
            style={[styles.button, (loading || code.length < 4) && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
          </Pressable>
          <Pressable onPress={() => setStage('email')} style={styles.linkButton}>
            <Text style={styles.linkText}>Change email</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  hero: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1F16',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0D1F16',
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 10,
  },
  button: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#259F56',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#259F56',
  },
});
