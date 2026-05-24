import { Platform } from 'react-native';
import Constants from 'expo-constants';

function extractHostFromExpo() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.manifest?.debuggerHost,
  ].filter(Boolean);

  for (const value of candidates) {
    const host = String(value).split(':')[0];
    if (host) return host;
  }

  return null;
}

function buildCandidates() {
  const manual = process.env.EXPO_PUBLIC_API_BASE_URL;
  const expoHost = extractHostFromExpo();
  const candidates = [];

  if (manual) candidates.push(manual);

  if (Platform.OS === 'android') {
    candidates.push('http://10.0.2.2:3001');
    if (expoHost) candidates.push(`http://${expoHost}:3001`);
    candidates.push('http://127.0.0.1:3001');
    candidates.push('http://localhost:3001');
    return candidates;
  }

  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    candidates.push(`http://${host}:3001`);
    candidates.push('http://localhost:3001');
    return candidates;
  }

  if (expoHost) candidates.push(`http://${expoHost}:3001`);
  candidates.push('http://localhost:3001');
  return candidates;
}

export const API_BASE_URL = buildCandidates()[0];

export async function apiRequest(path, options = {}) {
  const candidates = buildCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Không thể kết nối máy chủ.');
      }

      return data;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      const isNetworkError =
        message.includes('Network request failed') ||
        message.includes('fetch failed') ||
        message.includes('NetworkError');

      if (!isNetworkError) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối máy chủ.');
}
