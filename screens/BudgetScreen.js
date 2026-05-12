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
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, formatVnd, useFinance } from '../contexts/FinanceContext';

// ─── helpers ────────────────────────────────────────────────────────────────
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

const EXTRA_CATEGORIES = [
  { id: 'food', label: 'Ăn uống', icon: 'restaurant', color: '#E91E8C' },
  { id: 'transport', label: 'Di chuyển', icon: 'car', color: '#178BFF' },
  { id: 'shopping', label: 'Mua sắm', icon: 'bag-handle', color: '#FF9500' },
  { id: 'health', label: 'Sức khỏe', icon: 'heart', color: '#00C853' },
  { id: 'entertainment', label: 'Giải trí', icon: 'game-controller', color: '#9C27B0' },
  { id: 'education', label: 'Giáo dục', icon: 'school', color: '#1976FF' },
  { id: 'home', label: 'Nhà cửa', icon: 'home', color: '#FF8A00' },
  { id: 'other', label: 'Khác', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

function getCatMeta(categoryId) {
  return EXTRA_CATEGORIES.find((c) => c.id === categoryId) || EXTRA_CATEGORIES[EXTRA_CATEGORIES.length - 1];
}

// ─── NAV TABS (shared) ───────────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'home', label: 'Trang chủ', icon: 'home' },
  { id: 'history', label: 'Giao dịch', icon: 'list' },
  { id: 'stats', label: 'Thống kê', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngân sách', icon: 'wallet' },
  { id: 'profile', label: 'Cá nhân', icon: 'person' },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BudgetScreen({ navigation }) {
  const { token } = useAuth();
  const { transactions } = useFinance();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [budgets, setBudgets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── form state ──
  const [selCatId, setSelCatId] = useState('');
  const [budgetAmt, setBudgetAmt] = useState('');
  const [saving, setSaving] = useState(false);

  const monthKey = currentMonthKey();

  // ── push notification helper ──
  const pushNotif = useCallback(async (message, type = 'other') => {
    if (!token) return;
    try {
      const notif = await apiRequest('/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message, type }),
      });
      setNotifications((prev) => [notif.notification, ...prev]);
    } catch (_) { }
  }, [token]);

  // ── fetch ──
  const fetchData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [bRes, nRes] = await Promise.all([
        apiRequest(`/budgets?month=${monthKey}`, { headers: authHeaders }),
        apiRequest('/notifications', { headers: authHeaders }),
      ]);
      setBudgets(bRes.budgets || []);
      setNotifications(nRes.notifications || []);
    } catch (_) {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [token, monthKey]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ── compute spent per category this month ──
  const spentMap = useMemo(() => {
    const map = {};
    const now = new Date();
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const d = parseDate(tx.date);
      if (!d) continue;
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
      map[tx.category] = (map[tx.category] || 0) + Number(tx.amount || 0);
    }
    return map;
  }, [transactions]);

  // ── total budget / spent ──
  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + b.budgetAmount, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((s, b) => s + (spentMap[b.categoryId] || 0), 0), [budgets, spentMap]);
  const totalPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const totalRemain = totalBudget - totalSpent;

  // ── unread count ──
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── mark all read ──
  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) { }
  };

  // ── add budget ──
  const handleAddBudget = async () => {
    if (!selCatId) return Alert.alert('Thông báo', 'Vui lòng chọn danh mục.');
    const amt = Number(String(budgetAmt).replace(/\D/g, ''));
    if (!amt || amt <= 0) return Alert.alert('Thông báo', 'Vui lòng nhập số tiền hợp lệ.');
    const cat = getCatMeta(selCatId);
    setSaving(true);
    try {
      await apiRequest('/budgets', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          categoryId: cat.id,
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          budgetAmount: amt,
          month: monthKey,
        }),
      });
      // Lưu thông báo
      await pushNotif(
        `💰 Đã thêm ngân sách "${cat.label}" ${Number(amt).toLocaleString('vi-VN')}đ cho ${currentMonthLabel().toLowerCase()}`,
        'other'
      );
      setShowAddModal(false);
      setSelCatId('');
      setBudgetAmt('');
      fetchData();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể thêm danh mục ngân sách.');
    } finally {
      setSaving(false);
    }
  };

  // ── delete budget ──
  const handleDelete = (id, label) => {
    Alert.alert('Xoá ngân sách', `Xoá ngân sách "${label}"?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá', style: 'destructive', onPress: async () => {
          try {
            await apiRequest(`/budgets/${id}`, { method: 'DELETE', headers: authHeaders });
            await pushNotif(`🗑️ Đã xoá ngân sách danh mục "${label}"`, 'other');
            fetchData();
          } catch (_) { }
        },
      },
    ]);
  };

  // ── nav ──
  const handleTabPress = (tabId) => {
    if (tabId === 'home') navigation.navigate('Home');
    else if (tabId === 'history') navigation.navigate('Transaction');
    else if (tabId === 'stats') navigation.navigate('Stats');
  };

  // ── categories not yet added ──
  const availableCats = EXTRA_CATEGORIES.filter(
    (c) => !budgets.find((b) => b.categoryId === c.id)
  );

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.logoRow}>
          <View style={s.logoCircle}>
            <Ionicons name="wallet" size={18} color={COLORS.white} />
          </View>
          <Text style={s.logoText}>MoMo Finance</Text>
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

        {/* ── TITLE ── */}
        <View style={s.titleRow}>
          <Text style={s.title}>Ngân sách {currentMonthLabel().toLowerCase()}</Text>
          <TouchableOpacity onPress={fetchData}>
            <Ionicons name="pencil-outline" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* ── TOTAL CARD ── */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={s.totalCard}>
              <View style={s.totalTop}>
                <View>
                  <Text style={s.totalLabel}>Tổng ngân sách</Text>
                  <Text style={s.totalAmount}>{formatVnd(totalBudget)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.spentLabel}>Đã chi</Text>
                  <Text style={s.spentValue}>
                    {formatVnd(totalSpent)}{'\n'}
                    <Text style={s.pctText}>({Math.round(totalPct)}%)</Text>
                  </Text>
                </View>
              </View>
              {/* progress bar */}
              <View style={s.barBg}>
                <View style={[s.barFill, {
                  width: `${totalPct}%`,
                  backgroundColor: totalPct >= 100 ? COLORS.danger : totalPct >= 80 ? COLORS.warning : COLORS.success,
                }]} />
              </View>
              <Text style={s.remainText}>Còn lại: {formatVnd(Math.max(totalRemain, 0))}</Text>
            </View>

            {/* ── CATEGORY LIST ── */}
            <Text style={s.secTitle}>Theo danh mục</Text>

            {budgets.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="wallet-outline" size={40} color={COLORS.border} />
                <Text style={s.emptyText}>Chưa có ngân sách nào.{'\n'}Thêm danh mục để bắt đầu!</Text>
              </View>
            ) : (
              budgets.map((b) => {
                const spent = spentMap[b.categoryId] || 0;
                const pct = b.budgetAmount > 0 ? (spent / b.budgetAmount) * 100 : 0;
                const over = spent > b.budgetAmount;
                const cat = getCatMeta(b.categoryId);
                const barColor = over ? COLORS.danger : pct >= 80 ? COLORS.warning : COLORS.success;

                return (
                  <View key={b._id} style={s.catCard}>
                    <View style={s.catRow}>
                      <View style={[s.catIcon, { backgroundColor: `${cat.color}18` }]}>
                        <Ionicons name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.catName, over && { color: COLORS.danger }]}>{b.label}</Text>
                        <Text style={s.catBudget}>Ngân sách: {formatVnd(b.budgetAmount)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8 }}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.catSpent}>{formatVnd(spent)}</Text>
                          <Text style={[s.catPct, { color: barColor }]}>{Math.round(pct)}%</Text>
                        </View>
                        <TouchableOpacity
                          style={s.deleteBtn}
                          onPress={() => handleDelete(b._id, b.label)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                    </View>
                    {over && (
                      <Text style={s.overText}>
                        Vượt ngân sách {formatVnd(spent - b.budgetAmount)}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── ADD BUTTON ── */}
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={COLORS.primary} />
          <Text style={s.addBtnText}>Thêm danh mục ngân sách</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ── */}
      <View style={s.bottomNav}>
        {NAV_TABS.map((tab) => {
          const isActive = tab.id === 'wallet';
          return (
            <TouchableOpacity
              key={tab.id}
              style={s.navItem}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <View style={[s.navIconWrap, isActive && s.navIconActive]}>
                <Ionicons
                  name={isActive ? tab.icon : `${tab.icon}-outline`}
                  size={22}
                  color={isActive ? COLORS.primary : COLORS.gray}
                />
              </View>
              <Text style={[s.navLabel, isActive && s.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ═══════════ NOTIFICATION MODAL ═══════════ */}
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
                  const iconName =
                    item.type === 'income' ? 'arrow-down-circle' :
                      item.type === 'budget_over' ? 'warning' :
                        item.type === 'budget_warning' ? 'flash' :
                          'receipt';
                  const iconColor =
                    item.type === 'income' ? COLORS.success :
                      item.type === 'budget_over' ? COLORS.danger :
                        item.type === 'budget_warning' ? COLORS.warning :
                          COLORS.primary;
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

      {/* ═══════════ ADD CATEGORY MODAL ═══════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Thêm danh mục ngân sách</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Chọn danh mục</Text>
            <View style={s.catGrid}>
              {availableCats.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catChip, selCatId === c.id && { borderColor: c.color, backgroundColor: `${c.color}15` }]}
                  onPress={() => setSelCatId(c.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={c.icon} size={18} color={selCatId === c.id ? c.color : COLORS.gray} />
                  <Text style={[s.catChipLabel, selCatId === c.id && { color: c.color }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
              {availableCats.length === 0 && (
                <Text style={s.emptyText}>Tất cả danh mục đã được thêm.</Text>
              )}
            </View>

            <Text style={s.fieldLabel}>Số tiền ngân sách (đ)</Text>
            <TextInput
              style={s.input}
              placeholder="Ví dụ: 3000000"
              placeholderTextColor={COLORS.lightGray}
              keyboardType="numeric"
              value={budgetAmt}
              onChangeText={setBudgetAmt}
            />

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddBudget}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={s.saveBtnText}>Thêm ngân sách</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, paddingBottom: 8 },

  // header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, backgroundColor: COLORS.white },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.primary },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: FONTS.bold },

  // title
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, marginBottom: 12 },
  title: { fontSize: SIZES.h1, fontWeight: FONTS.extraBold, color: COLORS.dark, flex: 1 },

  // total card
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

  // section
  secTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },

  // category card
  catCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.white, borderRadius: 20, padding: 16, ...SHADOWS.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: SIZES.base, fontWeight: FONTS.semiBold, color: COLORS.dark },
  catBudget: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 2 },
  catSpent: { fontSize: SIZES.md, fontWeight: FONTS.bold, color: COLORS.dark },
  catPct: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold },
  overText: { fontSize: SIZES.xs, color: COLORS.danger, marginTop: 4, fontWeight: FONTS.semiBold },
  deleteBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: `${COLORS.danger}12`, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },

  // add button
  addBtn: { marginHorizontal: 16, marginTop: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnText: { color: COLORS.primary, fontSize: SIZES.base, fontWeight: FONTS.semiBold },

  // bottom nav
  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 8, paddingTop: 4, ...SHADOWS.sm },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  navIconWrap: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navIconActive: { backgroundColor: `${COLORS.primary}15` },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // modal overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetLg: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },

  // notification items
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifUnread: { backgroundColor: `${COLORS.primary}05`, borderRadius: 12, paddingHorizontal: 8 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifMsg: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 18, flex: 1 },
  notifTime: { fontSize: SIZES.xs, color: COLORS.lightGray, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },

  // add form
  fieldLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  catChipLabel: { fontSize: SIZES.sm, fontWeight: FONTS.medium, color: COLORS.gray },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: SIZES.base, color: COLORS.dark, marginBottom: 20, backgroundColor: '#FAFBFF' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontSize: SIZES.base, fontWeight: FONTS.bold },
});
