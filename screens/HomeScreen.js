import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SIZES, SHADOWS } from '../constants/theme';
import { getCategory, useFinance } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import AppBottomNav from '../components/AppBottomNav';

export default function HomeScreen({ navigation, route }) {
  const { transactions, loading } = useFinance();
  const { token, user } = useAuth();
  const userName = user?.name || route?.params?.userName || '';
  const { colors: COLORS, formatCurrency } = useSettings();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const QUICK_ACTIONS = [
    { id: '1', label: 'Them', icon: 'add-circle', color: COLORS.primary },
    { id: '2', label: 'Quet HD', icon: 'camera', color: '#8B5CF6' },
    { id: '3', label: 'Ngan sach', icon: 'wallet', color: '#F59E0B' },
    { id: '4', label: 'Tiet kiem', icon: 'save', color: '#2DCE89' },
    { id: '5', label: 'Nhom', icon: 'people', color: '#06B6D4' },
    { id: '6', label: 'Dinh ky', icon: 'repeat', color: '#EF4444' },
    { id: '7', label: 'Suc khoe', icon: 'fitness', color: '#FF6B35' },
    { id: '8', label: 'AI Chat', icon: 'chatbubbles', color: '#6366F1' },
  ];

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const [hideBalance, setHideBalance] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [savingGoals, setSavingGoals] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;
      let mounted = true;
      apiRequest('/notifications', { headers: authHeaders })
        .then((res) => {
          if (mounted) setNotifications(res.notifications || []);
        })
        .catch(() => { });
      // Lấy danh sách hũ tiết kiệm
      apiRequest('/saving-goals', { headers: authHeaders })
        .then((res) => {
          if (mounted) setSavingGoals(res.goals || []);
        })
        .catch(() => { });
      return () => { mounted = false; };
    }, [token])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) { }
  };

  const summary = useMemo(() => {
    const totalIncome = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalExpense = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
    };
  }, [transactions]);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 5).map((item) => {
      const category = getCategory(item.category);
      return {
        ...item,
        title: item.note || category.label,
        subtitle: item.date,
        signedAmount: item.type === 'income' ? Number(item.amount || 0) : -Number(item.amount || 0),
        icon: category.icon,
        color: category.color,
      };
    }),
    [transactions]
  );

  const topExpenseTip = useMemo(() => {
    const expenseTotals = {};
    for (const item of transactions) {
      if (item.type !== 'expense') continue;
      expenseTotals[item.category] = (expenseTotals[item.category] || 0) + Number(item.amount || 0);
    }

    const entries = Object.entries(expenseTotals);
    if (!entries.length || summary.totalExpense <= 0) {
      return 'Them giao dich de xem goi y chi tieu ca nhan.';
    }

    const [topCategoryId, amount] = entries.sort((a, b) => b[1] - a[1])[0];
    const percent = Math.round((amount / summary.totalExpense) * 100);
    return `Danh muc ${getCategory(topCategoryId).label} dang chiem ${percent}% tong chi. Ban co the xem lai muc nay de toi uu ngan sach.`;
  }, [summary.totalExpense, transactions]);

  // Tổng các hũ tiết kiệm
  const totalSavedAmount = useMemo(() => savingGoals.reduce((s, g) => s + Number(g.currentAmount || 0), 0), [savingGoals]);
  const activeGoals = savingGoals.filter(g => g.status === 'active');

  const handleQuickAction = (action) => {
    if (action.id === '1') {
      navigation.navigate('Transaction');
    } else if (action.id === '2') {
      navigation.navigate('OCRScan');
    } else if (action.id === '3') {
      navigation.navigate('Budget');
    } else if (action.id === '4') {
      navigation.navigate('SavingGoal');
    } else if (action.id === '5') {
      navigation.navigate('GroupWallet');
    } else if (action.id === '6') {
      navigation.navigate('Recurring');
    } else if (action.id === '7') {
      navigation.navigate('HealthScore');
    } else if (action.id === '8') {
      navigation.navigate('AIChat');
    } else {
      Alert.alert(action.label, 'Tinh nang dang phat trien!');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.greetText}>Xin chao,</Text>
              <Text style={styles.userName}>{userName || 'Nguoi dung'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifModal(true)}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Tong so du</Text>
            <TouchableOpacity onPress={() => setHideBalance(!hideBalance)}>
              <Ionicons
                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="rgba(255,255,255,0.8)"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceAmount}>
            {hideBalance ? '........' : formatCurrency(summary.totalBalance)}
          </Text>

          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={16} color="#A7F3D0" />
              <View>
                <Text style={styles.statLabel}>Thu nhap</Text>
                <Text style={[styles.statAmount, { color: '#A7F3D0' }]}>
                  +{formatCurrency(summary.totalIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={16} color="#FCA5A5" />
              <View>
                <Text style={styles.statLabel}>Chi tieu</Text>
                <Text style={[styles.statAmount, { color: '#FCA5A5' }]}>
                  -{formatCurrency(summary.totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions - 2 rows of 4 */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickItem}
                onPress={() => handleQuickAction(action)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${action.color}18` }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Saving Goals Widget */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hu Tiet Kiem</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SavingGoal')}>
                <Text style={styles.seeAll}>Xem tat ca</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.savingCard}>
              <View style={styles.savingCardTop}>
                <View style={styles.savingIcon}>
                  <Ionicons name="save" size={20} color={COLORS.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savingTitle}>Tong tiet kiem: {formatCurrency(totalSavedAmount)}</Text>
                  <Text style={styles.savingSubtitle}>{activeGoals.length} muc tieu dang hoat dong</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </View>
              {activeGoals.slice(0, 2).map((goal) => {
                const percent = goal.targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100) : 0;
                return (
                  <View key={goal._id} style={styles.savingGoalRow}>
                    <View style={[styles.savingGoalDot, { backgroundColor: goal.color || COLORS.primary }]} />
                    <Text style={styles.savingGoalName} numberOfLines={1}>{goal.title}</Text>
                    <Text style={styles.savingGoalPercent}>{percent}%</Text>
                    <View style={styles.savingProgress}>
                      <View style={[styles.savingProgressFill, { width: `${percent}%`, backgroundColor: goal.color || COLORS.primary }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.tipCard}>
            <View style={styles.tipLeft}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>Goi y tu AI</Text>
                <Text style={styles.tipBody}>{topExpenseTip}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dich gan day</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transaction')}>
              <Text style={styles.seeAll}>Xem tat ca</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            {loading ? (
              <Text style={styles.emptyState}>Dang tai du lieu...</Text>
            ) : recentTransactions.length ? (
              recentTransactions.map((item) => (
                <TransactionItem key={item.id} item={item} COLORS={COLORS} formatCurrency={formatCurrency} styles={styles} />
              ))
            ) : (
              <Text style={styles.emptyState}>Chua co giao dich nao.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <AppBottomNav navigation={navigation} activeTab="home" />

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheetLg}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thong bao</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllRead}>
                    <Text style={{ color: COLORS.primary, fontSize: SIZES.sm, fontWeight: FONTS.semiBold }}>
                      Doc tat ca
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                  <Ionicons name="close" size={22} color={COLORS.dark} />
                </TouchableOpacity>
              </View>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyText}>Chua co thong bao nao.</Text>
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
                    <View style={[styles.notifItem, !item.read && styles.notifUnread]}>
                      <View style={[styles.notifIcon, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={iconName} size={18} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifMsg}>{item.message}</Text>
                        <Text style={styles.notifTime}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                        </Text>
                      </View>
                      {!item.read && <View style={styles.unreadDot} />}
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

function TransactionItem({ item, COLORS, formatCurrency, styles }) {
  const isPositive = item.signedAmount > 0;
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIcon, { backgroundColor: `${item.color}18` }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{item.title}</Text>
        <Text style={styles.txSub}>{item.subtitle}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isPositive ? COLORS.success : COLORS.danger }]}>
        {isPositive ? '+' : ''}{formatCurrency(item.signedAmount)}
      </Text>
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, paddingBottom: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  greetText: { fontSize: SIZES.xs, color: COLORS.gray, fontWeight: FONTS.regular },
  userName: { fontSize: SIZES.base, color: COLORS.dark, fontWeight: FONTS.bold },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: FONTS.bold },
  balanceCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 24, padding: 24,
    backgroundColor: COLORS.primary,
    ...SHADOWS.lg,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceLabel: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.medium },
  balanceAmount: { fontSize: 32, fontWeight: FONTS.extraBold, color: '#FFFFFF', marginBottom: 20 },
  balanceStats: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 12 },
  statLabel: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FONTS.regular },
  statAmount: { fontSize: SIZES.sm, fontWeight: FONTS.bold },
  section: { marginTop: 16, marginHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
  seeAll: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.primary },
  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, ...SHADOWS.sm,
  },
  quickItem: { alignItems: 'center', gap: 8, width: '23%', marginBottom: 8 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.dark, textAlign: 'center' },
  savingCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    borderLeftWidth: 4, borderLeftColor: COLORS.success, ...SHADOWS.sm,
  },
  savingCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  savingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${COLORS.success}12`, alignItems: 'center', justifyContent: 'center' },
  savingTitle: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark },
  savingSubtitle: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 2 },
  savingGoalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  savingGoalDot: { width: 8, height: 8, borderRadius: 4 },
  savingGoalName: { flex: 1, fontSize: SIZES.xs, color: COLORS.dark, fontWeight: FONTS.medium },
  savingGoalPercent: { fontSize: SIZES.xs, color: COLORS.gray, minWidth: 32, textAlign: 'right' },
  savingProgress: { width: 60, height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  savingProgressFill: { height: '100%', borderRadius: 2 },
  tipCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary, ...SHADOWS.sm,
  },
  tipLeft: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 4 },
  tipBody: { fontSize: SIZES.xs, color: COLORS.gray, lineHeight: 18 },
  transactionList: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', ...SHADOWS.sm },
  txItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: `${COLORS.border}80`,
  },
  txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txTitle: { fontSize: SIZES.md, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 2 },
  txSub: { fontSize: SIZES.xs, color: COLORS.gray },
  txAmount: { fontSize: SIZES.md, fontWeight: FONTS.bold },
  emptyState: { padding: 20, textAlign: 'center', color: COLORS.gray, fontSize: SIZES.sm },

  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetLg: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifUnread: { backgroundColor: `${COLORS.primary}05`, borderRadius: 12, paddingHorizontal: 8 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifMsg: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 18, flex: 1 },
  notifTime: { fontSize: SIZES.xs, color: COLORS.lightGray, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
});
