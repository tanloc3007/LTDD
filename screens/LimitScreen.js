import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';
import AppBottomNav from '../components/AppBottomNav';

function currentMonthLabel() {
  const now = new Date();
  return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function parseDate(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}


export default function LimitScreen({ navigation }) {
  const { token } = useAuth();
  const { transactions } = useFinance();
  const { colors: COLORS, formatCurrency } = useSettings();
  const s = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [globalLimit, setGlobalLimit] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [limitInput, setLimitInput] = useState('');
  const [saving, setSaving] = useState(false);

  const monthKey = currentMonthKey();

  const fetchData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [lRes, nRes] = await Promise.all([
        apiRequest(`/limits?month=${monthKey}`, { headers: authHeaders }),
        apiRequest('/notifications', { headers: authHeaders }),
      ]);
      setGlobalLimit(lRes.limit || null);
      setNotifications(nRes.notifications || []);
    } catch (_) {
      setGlobalLimit(null);
    } finally {
      setLoading(false);
    }
  }, [token, monthKey]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const totalSpent = useMemo(() => {
    const now = new Date();
    let sum = 0;
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const d = parseDate(tx.date);
      if (!d) continue;
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
      sum += Number(tx.amount || 0);
    }
    return sum;
  }, [transactions]);

  const limitAmount = globalLimit ? globalLimit.limitAmount : 0;
  const totalPct = limitAmount > 0 ? (totalSpent / limitAmount) * 100 : 0;
  const totalRemain = limitAmount - totalSpent;
  const isOver = totalSpent > limitAmount;

  const barColor = isOver ? COLORS.danger : totalPct >= 80 ? COLORS.warning : COLORS.success;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) { }
  };

  const handleSaveLimit = async () => {
    const amt = Number(String(limitInput).replace(/\D/g, ''));
    if (!amt || amt <= 0) return Alert.alert('Thông báo', 'Vui lòng nhập số tiền hợp lệ.');
    setSaving(true);
    try {
      await apiRequest('/limits', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          limitAmount: amt,
          month: monthKey,
        }),
      });
      setShowEditModal(false);
      setLimitInput('');
      fetchData();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu hạn mức.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.logoRow}>
          <View style={s.logoCircle}>
            <Ionicons name="speedometer" size={18} color="#FFF" />
          </View>
          <Text style={s.logoText}>FinancialManagement Finance</Text>
        </View>
        <TouchableOpacity style={s.notifBtn} onPress={() => setShowNotifModal(true)}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.titleRow}>
          <Text style={s.title}>Hạn mức tổng {currentMonthLabel().toLowerCase()}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={s.totalCard}>
              <View style={s.totalTop}>
                <View>
                  <Text style={s.totalLabel}>Hạn mức chi tiêu</Text>
                  {globalLimit ? (
                    <Text style={s.totalAmount}>{formatCurrency(limitAmount)}</Text>
                  ) : (
                    <Text style={[s.totalAmount, { color: COLORS.gray, fontSize: 18 }]}>Chưa thiết lập</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.spentLabel}>Đã chi</Text>
                  <Text style={s.spentValue}>
                    {formatCurrency(totalSpent)}{'\n'}
                    {globalLimit && <Text style={s.pctText}>({Math.round(totalPct)}%)</Text>}
                  </Text>
                </View>
              </View>

              {globalLimit && (
                <>
                  <View style={s.barBg}>
                    <View style={[s.barFill, {
                      width: `${Math.min(totalPct, 100)}%`,
                      backgroundColor: barColor,
                    }]} />
                  </View>
                  {isOver ? (
                    <Text style={[s.remainText, { color: COLORS.danger, fontWeight: FONTS.bold }]}>
                      Vượt hạn mức: {formatCurrency(Math.abs(totalRemain))}
                    </Text>
                  ) : (
                    <Text style={s.remainText}>Còn lại: {formatCurrency(totalRemain)}</Text>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={s.editBtn}
              onPress={() => {
                setLimitInput(globalLimit ? String(globalLimit.limitAmount) : '');
                setShowEditModal(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={20} color={COLORS.primary} />
              <Text style={s.editBtnText}>
                {globalLimit ? 'Sửa hạn mức chi tiêu' : 'Thiết lập hạn mức chi tiêu'}
              </Text>
            </TouchableOpacity>

            <View style={s.infoBox}>
              <Ionicons name="information-circle" size={24} color={COLORS.primary} />
              <Text style={s.infoText}>
                Hạn mức chi tiêu giúp bạn kiểm soát tổng số tiền tiêu dùng trong tháng. Hệ thống sẽ tự động cảnh báo khi bạn đã tiêu trên 80% hoặc vượt quá hạn mức này.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <AppBottomNav navigation={navigation} activeTab="wallet" position="absolute" />

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheetLg}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Thông báo</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllRead}>
                    <Text style={{ color: COLORS.primary, fontSize: SIZES.sm, fontWeight: FONTS.semiBold }}>
                      Đọc tất cả
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                  <Ionicons name="close" size={22} color={COLORS.dark} />
                </TouchableOpacity>
              </View>
            </View>

            {notifications.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
                <Text style={s.emptyText}>Chưa có thông báo nào.</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item._id || item.createdAt}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => {
                  const iconName = item.type === 'income' ? 'arrow-down-circle' : item.type === 'budget_over' ? 'warning' : item.type === 'budget_warning' ? 'flash' : 'receipt';
                  const iconColor = item.type === 'income' ? COLORS.success : item.type === 'budget_over' ? COLORS.danger : item.type === 'budget_warning' ? COLORS.warning : COLORS.primary;
                  return (
                    <View style={[s.notifItem, !item.read && s.notifUnread]}>
                      <View style={[s.notifIcon, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={iconName} size={18} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.notifMsg}>{item.message}</Text>
                        <Text style={s.notifTime}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                        </Text>
                      </View>
                      {!item.read && <View style={s.unreadDot} />}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Thiết lập hạn mức</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Số tiền hạn mức (đ)</Text>
            <View style={s.inputWrapper}>
              <Text style={s.currencyPrefix}>đ</Text>
              <TextInput
                style={s.amountInput}
                keyboardType="numeric"
                placeholder="Ví dụ: 10,000,000"
                value={limitInput}
                onChangeText={(txt) => {
                  const num = txt.replace(/\D/g, '');
                  setLimitInput(num ? Number(num).toLocaleString('en-US') : '');
                }}
              />
            </View>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSaveLimit} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveBtnText}>Lưu thiết lập</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, backgroundColor: COLORS.white },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.primary },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: FONTS.bold },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, marginBottom: 12 },
  title: { fontSize: SIZES.h1, fontWeight: FONTS.extraBold, color: COLORS.dark, flex: 1 },
  totalCard: { marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 20, padding: 20, ...SHADOWS.sm },
  totalTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalLabel: { fontSize: SIZES.sm, color: COLORS.gray, marginBottom: 4 },
  totalAmount: { fontSize: 26, fontWeight: FONTS.extraBold, color: COLORS.primary },
  spentLabel: { fontSize: SIZES.sm, color: COLORS.gray, marginBottom: 4 },
  spentValue: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark, textAlign: 'right' },
  pctText: { fontSize: SIZES.sm, fontWeight: FONTS.regular },
  barBg: { height: 8, borderRadius: 4, backgroundColor: `${COLORS.primary}20`, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 4 },
  remainText: { fontSize: SIZES.sm, color: COLORS.gray, textAlign: 'right' },
  editBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtnText: { color: COLORS.primary, fontSize: SIZES.base, fontWeight: FONTS.semiBold },
  infoBox: { marginHorizontal: 16, marginTop: 24, backgroundColor: `${COLORS.primary}15`, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoText: { flex: 1, fontSize: SIZES.sm, color: COLORS.primaryDark, lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetLg: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  fieldLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 24, backgroundColor: COLORS.bg },
  currencyPrefix: { fontSize: SIZES.base, color: COLORS.gray, marginRight: 8, fontWeight: FONTS.bold },
  amountInput: { flex: 1, fontSize: SIZES.base, color: COLORS.dark, fontWeight: FONTS.bold },
  saveBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...SHADOWS.md },
  saveBtnText: { color: '#FFF', fontSize: SIZES.base, fontWeight: FONTS.bold },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifUnread: { backgroundColor: `${COLORS.primary}05`, borderRadius: 12, paddingHorizontal: 8 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifMsg: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 18, flex: 1 },
  notifTime: { fontSize: SIZES.xs, color: COLORS.lightGray, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
});

