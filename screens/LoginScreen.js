import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { FONTS, SIZES, SHADOWS } from '../constants/theme';
import { GOOGLE_WEB_CLIENT_ID, getGoogleDeveloperErrorMessage } from '../constants/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export default function LoginScreen({ navigation }) {
  const { login, socialLogin } = useAuth();
  const { colors: COLORS, theme } = useSettings();
  const styles = useMemo(() => createStyles(COLORS, theme), [COLORS, theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mật khẩu yếu', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setLoading(true);
      const user = await login({ email, password });
      setLoading(false);
      navigation.replace('Home', { userName: user.name || email.split('@')[0] });
    } catch (error) {
      setLoading(false);
      Alert.alert('Đăng nhập thất bại', error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut();
      }

      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      const user = await socialLogin('google', idToken, {
        name: userInfo.data?.user?.name || '',
        email: userInfo.data?.user?.email || '',
        avatar: userInfo.data?.user?.photo || null,
      });

      navigation.replace('Home', { userName: user.name });
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return;
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Lỗi', 'Google Play Services không khả dụng trên thiết bị này.');
      } else if (String(error.message || '').includes('DEVELOPER_ERROR')) {
        Alert.alert('Lỗi cấu hình Google', getGoogleDeveloperErrorMessage());
      } else {
        Alert.alert('Lỗi đăng nhập', error.message || 'Không thể đăng nhập bằng Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="card" size={38} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Quản lý tài chính</Text>
            <Text style={styles.tagline}>Quản lý tài chính thông minh</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Đăng nhập</Text>
            <Text style={styles.formSubtitle}>Chào mừng trở lại!</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập địa chỉ email"
                  placeholderTextColor={COLORS.lightGray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={COLORS.lightGray}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnPrimaryText}>Đăng nhập</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.btnSocial, googleLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Ionicons name="logo-google" size={20} color="#4285F4" />
              )}
              <Text style={styles.btnSocialText}>Tiếp tục với Google</Text>
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS, theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { flexGrow: 1, paddingBottom: 32 },
    header: {
      backgroundColor: COLORS.white,
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 24,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      ...SHADOWS.sm,
    },
    logoBox: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      ...SHADOWS.lg,
    },
    appName: { fontSize: SIZES.xl, fontWeight: FONTS.extraBold, color: COLORS.dark, marginBottom: 4 },
    tagline: { fontSize: SIZES.sm, color: COLORS.gray, fontWeight: FONTS.regular },
    formCard: {
      margin: 20,
      backgroundColor: COLORS.white,
      borderRadius: 24,
      padding: 24,
      ...SHADOWS.md,
    },
    formTitle: { fontSize: SIZES.xxl, fontWeight: FONTS.extraBold, color: COLORS.dark, marginBottom: 4 },
    formSubtitle: { fontSize: SIZES.md, color: COLORS.gray, marginBottom: 24 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 8 },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: COLORS.border,
      borderRadius: 12,
      backgroundColor: theme === 'dark' ? '#181C27' : COLORS.bg,
      paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 8 },
    input: {
      flex: 1,
      height: 50,
      fontSize: SIZES.md,
      color: COLORS.dark,
      fontWeight: FONTS.regular,
    },
    eyeBtn: { padding: 4 },
    forgotRow: { alignItems: 'flex-end', marginBottom: 20, marginTop: -4 },
    forgotText: { fontSize: SIZES.sm, color: COLORS.primary, fontWeight: FONTS.medium },
    btnPrimary: {
      height: 52,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.lg,
    },
    btnPrimaryText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.white, letterSpacing: 0.5 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { marginHorizontal: 12, fontSize: SIZES.sm, color: COLORS.gray, fontWeight: FONTS.medium },
    btnSocial: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: COLORS.white,
      gap: 10,
      marginBottom: 10,
    },
    btnSocialText: { fontSize: SIZES.md, fontWeight: FONTS.medium, color: COLORS.dark },
    registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
    registerText: { fontSize: SIZES.sm, color: COLORS.gray },
    registerLink: { fontSize: SIZES.sm, color: COLORS.primary, fontWeight: FONTS.bold },
  });
