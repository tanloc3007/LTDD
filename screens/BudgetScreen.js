import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
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

// ─── helpers ────────────────────────────────────────────────────────────────
function currentMonthLabel() {
  const now = new Date();
  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
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

const CATEGORIES = [
    { id: 'transport', label: 'Di chuyển', icon: 'car', color: '#178BFF' },
    { id: 'investment', label: 'Đầu tư', icon: 'leaf', color: '#2DCE89' },
    { id: 'entertainment', label: 'Play-circle', icon: 'play-circle', color: '#F5365C' },
    { id: 'bills', label: 'Hóa đơn', icon: 'receipt', color: '#00D9D5' },
    { id: 'education', label: 'Học tập', icon: 'book', color: '#9C27B0' },
    { id: 'beauty', label: 'Làm đẹp', icon: 'brush', color: '#FF4FB8' },
    { id: 'family', label: 'Người thân', icon: 'body', color: '#FF6B35' },
    { id: 'home', label: 'Nhà cửa', icon: 'home', color: '#7E57C2' },
    { id: 'health', label: 'Sức khỏe', icon: 'heart', color: '#F5365C' },
    { id: 'charity', label: 'Từ thiện', icon: 'wallet', color: '#FF9500' },
    { id: 'shopping', label: 'Chợ, siêu thị', icon: 'cart', color: '#FF8A00' },
    { id: 'food', label: 'Ăn uống', icon: 'restaurant', color: '#FF6B35' },
];

function getCatMeta(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || { id: 'other', label: categoryId, icon: 'ellipsis-horizontal', color: '#9CA3AF' };
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
  const { colors: COLORS, formatCurrency } = useSettings();
  const s = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [budgets, setBudgets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const monthKey = currentMonthKey();

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

  // ── unread count ──
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── mark all read ──
  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) { }
  };

  // ── delete budget ──
  const handleDelete = (id, label) => {
    Alert.alert('Xoá ngân sách', `Xoá ngân sách "${label}"?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá', style: 'destructive', onPress: async () => {
          try {
            await apiRequest(`/budgets/${id}`, { method: 'DELETE', headers: authHeaders });
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
    else if (tabId === 'wallet') navigation.navigate('Budget');
    else if (tabId === 'profile') navigation.navigate('Profile');
  };

  // ── FAQ ──
  const [expandedFaq, setExpandedFaq] = useState(null);
  const FAQs = [
      { id: 1, q: '1. Ngân sách hoạt động thế nào?', a: 'Ngân sách giúp bạn lập kế hoạch chi tiêu cho từng danh mục cụ thể trong tháng. Khi bạn thực hiện giao dịch, ứng dụng sẽ tự động cập nhật số tiền đã chi so với hạn mức bạn đặt ra.' },
      { id: 2, q: '2. Trạng thái ngân sách là gì?', a: '"Tốt": Chi tiêu của bạn đang dưới mức hạn mức.\n"Cảnh báo": Bạn đã chi tiêu gần hết hạn mức (trên 80%).\n"Vượt": Bạn đã chi tiêu quá số tiền cho phép.' }
  ];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ngân sách</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.dark} />
          </TouchableOpacity>
          <View style={s.headerDivider} />
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home-outline" size={22} color={COLORS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        
        {/* ── DATE & ADD NEW ── */}
        <View style={s.topRow}>
            <View>
                <Text style={s.monthLabel}>{currentMonthLabel()}</Text>
                <Text style={s.subLabel}>Chi 18 ngày tới</Text>
            </View>
            <TouchableOpacity 
                style={s.addNewBtn} 
                onPress={() => navigation.navigate('CreateBudget', { existingBudgets: budgets })}
            >
                <Ionicons name="add" size={20} color={COLORS.primary} />
                <Text style={s.addNewText}>Thêm mới</Text>
            </TouchableOpacity>
        </View>

        {/* ── CATEGORY SECTION ── */}
        <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Danh mục</Text>
            <TouchableOpacity style={s.sortBtn}>
                <Text style={s.sortText}>Xếp theo tên</Text>
                <Ionicons name="menu-outline" size={18} color={COLORS.dark} />
            </TouchableOpacity>
        </View>

        {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : budgets.length === 0 ? (
            <View style={s.emptyBox}>
                <Ionicons name="wallet-outline" size={40} color={COLORS.border} />
                <Text style={s.emptyText}>Chưa có ngân sách nào.{'\n'}Thêm danh mục để bắt đầu!</Text>
            </View>
        ) : (
            <View style={s.budgetList}>
                {budgets.map((b) => {
                    const spent = spentMap[b.categoryId] || 0;
                    const remain = b.budgetAmount - spent;
                    const cat = getCatMeta(b.categoryId);
                    const isExceeded = spent > b.budgetAmount;

                    return (
                        <View key={b._id} style={s.catCard}>
                            <View style={s.cardTop}>
                                <View style={[s.catIconWrap, { backgroundColor: `${cat.color}25` }]}>
                                    <View style={[s.innerCircle, { backgroundColor: '#00D9D5' }]}>
                                        <Ionicons name={cat.icon} size={22} color={cat.color} />
                                    </View>
                                </View>
                                <View style={s.cardInfo}>
                                    <View style={s.cardHeaderRow}>
                                        <Text style={s.catLabel}>{b.label}</Text>
                                        <TouchableOpacity onPress={() => handleDelete(b._id, b.label)}>
                                            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.dark} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={s.limitText}>Hạn mức: {formatCurrency(b.budgetAmount)}</Text>
                                    <View style={s.remainRow}>
                                        <Text style={s.remainValue}>Còn lại <Text style={[s.bold, { color: isExceeded ? COLORS.danger : '#00A8A5' }]}>{formatCurrency(Math.max(remain, 0))}</Text></Text>
                                        <View style={[s.statusBadge, { backgroundColor: isExceeded ? `${COLORS.danger}15` : '#E7F9F9' }]}>
                                            <Ionicons name={isExceeded ? "warning" : "checkmark-circle"} size={14} color={isExceeded ? COLORS.danger : COLORS.success} />
                                            <Text style={[s.statusText, { color: isExceeded ? COLORS.danger : COLORS.success }]}>{isExceeded ? 'Vượt' : 'Tốt'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        )}

        {/* ── FAQ SECTION ── */}
        <View style={s.faqSection}>
            <View style={s.faqHeader}>
                <Ionicons name="help-circle-outline" size={22} color={COLORS.dark} />
                <Text style={s.faqTitle}>Tìm hiểu về ngân sách</Text>
            </View>
            <View style={s.faqList}>
                {FAQs.map(faq => (
                    <View key={faq.id} style={s.faqItem}>
                        <TouchableOpacity 
                            style={s.faqQuestion} 
                            onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        >
                            <Text style={s.faqText}>{faq.q}</Text>
                            <Ionicons name={expandedFaq === faq.id ? "chevron-up" : "chevron-down"} size={18} color={COLORS.gray} />
                        </TouchableOpacity>
                        {expandedFaq === faq.id && (
                            <View style={s.faqAnswer}>
                                <Text style={s.faqAnswerText}>{faq.a}</Text>
                            </View>
                        )}
                        {faq.id < FAQs.length && <View style={s.faqDivider} />}
                    </View>
                ))}
            </View>
        </View>

        <View style={{ height: 40 }} />
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
                  const iconName = item.type === 'income' ? 'arrow-down-circle' : 'receipt';
                  const iconColor = item.type === 'income' ? COLORS.success : COLORS.primary;
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
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const getStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, paddingBottom: 8 },

  // header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 12, 
    paddingBottom: 12, 
    backgroundColor: COLORS.white 
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  iconBtn: { padding: 4 },
  headerDivider: { width: 1, height: 16, backgroundColor: COLORS.border, marginHorizontal: 4 },

  // top row
  topRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: 16, 
      paddingVertical: 16,
      backgroundColor: COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
  },
  monthLabel: { fontSize: SIZES.xl, fontWeight: FONTS.extraBold, color: COLORS.dark },
  subLabel: { fontSize: SIZES.sm, color: COLORS.gray, marginTop: 2 },
  addNewBtn: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      borderWidth: 1, 
      borderColor: COLORS.primary, 
      borderRadius: 12, 
      paddingHorizontal: 12, 
      paddingVertical: 6,
      gap: 4,
  },
  addNewText: { color: COLORS.primary, fontWeight: FONTS.bold, fontSize: SIZES.sm },

  // section header
  sectionHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: 16, 
      marginTop: 20, 
      marginBottom: 12 
  },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },

  // list
  budgetList: { paddingHorizontal: 16, gap: 12 },
  catCard: { 
      backgroundColor: COLORS.white, 
      borderRadius: 20, 
      padding: 16, 
      ...SHADOWS.sm 
  },
  cardTop: { flexDirection: 'row', gap: 16 },
  catIconWrap: { 
      width: 64, 
      height: 64, 
      borderRadius: 32, 
      alignItems: 'center', 
      justifyContent: 'center',
      overflow: 'hidden'
  },
  innerCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center'
  },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
  limitText: { fontSize: SIZES.sm, color: COLORS.gray, marginTop: 2 },
  remainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  remainValue: { fontSize: SIZES.sm, color: COLORS.dark },
  bold: { fontWeight: FONTS.bold },
  statusBadge: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 8, 
      paddingVertical: 4, 
      borderRadius: 20, 
      gap: 4 
  },
  statusText: { fontSize: SIZES.xs, fontWeight: FONTS.bold },

  // faq
  faqSection: { marginTop: 32, paddingHorizontal: 16 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  faqTitle: { fontSize: SIZES.base, fontWeight: FONTS.semiBold, color: COLORS.dark },
  faqList: { backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 16, ...SHADOWS.sm },
  faqItem: { },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  faqText: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },
  faqAnswer: { paddingBottom: 16 },
  faqAnswerText: { fontSize: SIZES.sm, color: COLORS.gray, lineHeight: 20 },
  faqDivider: { height: 1, backgroundColor: COLORS.border },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },

  // bottom nav
  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 8, paddingTop: 4, ...SHADOWS.sm },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  navIconWrap: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navIconActive: { backgroundColor: `${COLORS.primary}15` },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetLg: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifUnread: { backgroundColor: `${COLORS.primary}05`, borderRadius: 12, paddingHorizontal: 8 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifMsg: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 18, flex: 1 },
  notifTime: { fontSize: SIZES.xs, color: COLORS.lightGray, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
});
