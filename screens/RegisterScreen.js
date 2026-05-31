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

function getPasswordStrength(password, COLORS) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: '', color: COLORS.border, width: '0%' },
    { label: 'Rất yếu', color: COLORS.danger, width: '20%' },
    { label: 'Yếu', color: '#FF8C00', width: '40%' },
    { label: 'Trung bình', color: COLORS.warning, width: '60%' },
    { label: 'Mạnh', color: COLORS.success, width: '80%' },
    { label: 'Rất mạnh', color: '#00C851', width: '100%' },
  ];

  return password.length === 0 ? levels[0] : levels[Math.min(score, 5)];
}

function InputField({ label, icon, placeholder, value, onChangeText, keyboardType, autoCapitalize, colors, styles }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={18} color={colors.gray} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.lightGray}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
        />
      </View>
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const { register, socialLogin } = useAuth();
  const { colors: COLORS, theme } = useSettings();
  const styles = useMemo(() => createStyles(COLORS, theme), [COLORS, theme]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const strength = getPasswordStrength(password, COLORS);

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên.');
    if (!email.trim() || !email.includes('@')) return Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email.');
    if (!phone.trim() || phone.length < 9) return Alert.alert('SĐT không hợp lệ', 'Vui lòng nhập số điện thoại hợp lệ.');
    if (password.length < 6) return Alert.alert('Mật khẩu yếu', 'Mật khẩu phải có ít nhất 6 ký tự.');
    if (password !== confirm) return Alert.alert('Không khớp', 'Mật khẩu xác nhận không khớp.');
    if (!agreed) return Alert.alert('Điều khoản', 'Vui lòng đồng ý với điều khoản sử dụng.');

    try {
      setLoading(true);
      const user = await register({ name, email, phone, password });
      setLoading(false);
      Alert.alert('Thành công!', 'Tài khoản đã được lưu trên MongoDB Atlas.', [
        { text: 'OK', onPress: () => navigation.replace('Home', { userName: user.name }) },
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert('Đăng ký thất bại', error.message);
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
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Lỗi', 'Google Play Services không khả dụng.');
      } else if (String(error.message || '').includes('DEVELOPER_ERROR')) {
        Alert.alert('Lỗi cấu hình Google', getGoogleDeveloperErrorMessage());
      } else {
        Alert.alert('Lỗi', error.message || 'Không thể đăng nhập bằng Google.');
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
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Tạo tài khoản</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="person-add" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.heroTitle}>Tạo tài khoản</Text>
            <Text style={styles.heroSub}>Bắt đầu hành trình quản lý tài chính thông minh</Text>
          </View>

          <View style={styles.formCard}>
            <InputField
              label="Họ và tên"
              icon="person-outline"
              placeholder="Nhập họ và tên của bạn"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              colors={COLORS}
              styles={styles}
            />

            <InputField
              label="Email"
              icon="mail-outline"
              placeholder="Nhập địa chỉ email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              colors={COLORS}
              styles={styles}
            />

            <InputField
              label="Số điện thoại"
              icon="call-outline"
              placeholder="Nhập số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              colors={COLORS}
              styles={styles}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Tạo mật khẩu"
                  placeholderTextColor={COLORS.lightGray}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
              {password.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <View style={styles.strengthBar}>
                    <View style={[styles.strengthFill, { width: strength.width, backgroundColor: strength.color }]} />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nhập lại mật khẩu</Text>
              <View style={[styles.inputBox, confirm && confirm !== password && { borderColor: COLORS.danger }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Xác nhận lại mật khẩu"
                  placeholderTextColor={COLORS.lightGray}
                  secureTextEntry={!showCf}
                  value={confirm}
                  onChangeText={setConfirm}
                />
                <TouchableOpacity onPress={() => setShowCf(!showCf)} style={styles.eyeBtn}>
                  <Ionicons name={showCf ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
              {confirm.length > 0 && confirm !== password && (
                <Text style={[styles.strengthLabel, { color: COLORS.danger }]}>Mật khẩu không khớp</Text>
              )}
              {confirm.length > 0 && confirm === password && (
                <Text style={[styles.strengthLabel, { color: COLORS.success }]}>Mật khẩu khớp</Text>
              )}
            </View>

            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
              <Text style={styles.termsText}>
                Tôi đồng ý với <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
                <Text style={styles.termsLink}>Chính sách bảo mật</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.75 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnPrimaryText}>Đăng ký</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC ĐĂNG KÝ BẰNG</Text>
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

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Đăng nhập ngay</Text>
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
    scroll: { flexGrow: 1, paddingBottom: 40 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.white,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.primary },
    hero: { alignItems: 'center', paddingVertical: 28, backgroundColor: COLORS.white },
    heroIcon: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: `${COLORS.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    heroTitle: { fontSize: SIZES.xxl, fontWeight: FONTS.extraBold, color: COLORS.dark, marginBottom: 6 },
    heroSub: { fontSize: SIZES.sm, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 40 },
    formCard: {
      margin: 16,
      backgroundColor: COLORS.white,
      borderRadius: 24,
      padding: 24,
      ...SHADOWS.md,
    },
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
    input: { flex: 1, height: 50, fontSize: SIZES.md, color: COLORS.dark },
    eyeBtn: { padding: 4 },
    strengthBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, marginTop: 4 },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    termsText: { flex: 1, fontSize: SIZES.sm, color: COLORS.gray, lineHeight: 20 },
    termsLink: { color: COLORS.primary, fontWeight: FONTS.semiBold },
    btnPrimary: {
      height: 52,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.lg,
    },
    btnPrimaryText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.white },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { marginHorizontal: 8, fontSize: 10, color: COLORS.gray, fontWeight: FONTS.semiBold },
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
    loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
    loginText: { fontSize: SIZES.sm, color: COLORS.gray },
    loginLink: { fontSize: SIZES.sm, color: COLORS.primary, fontWeight: FONTS.bold },
  });
