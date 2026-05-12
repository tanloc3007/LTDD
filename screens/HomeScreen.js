import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';
import { formatVnd, getCategory, useFinance } from '../contexts/FinanceContext';

const QUICK_ACTIONS = [
  { id: '1', label: 'Them', icon: 'add-circle', color: COLORS.primary },
  { id: '2', label: 'Thong ke', icon: 'bar-chart', color: '#8B5CF6' },
  { id: '3', label: 'Ngan sach', icon: 'wallet', color: '#F59E0B' },
  { id: '4', label: 'AI Chat', icon: 'chatbubbles', color: '#06B6D4' },
];

const NAV_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home' },
  { id: 'history', label: 'Giao dich', icon: 'list' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet' },
  { id: 'profile', label: 'Ca nhan', icon: 'person' },
];

export default function HomeScreen({ navigation, route }) {
  const userName = route?.params?.userName || 'Luan';
  const { transactions, loading } = useFinance();
  const [activeTab, setActiveTab] = useState('home');
  const [hideBalance, setHideBalance] = useState(false);

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

  const handleTabPress = (tabId) => {
    if (tabId === 'history') {
      navigation.navigate('Transaction');
    } else if (tabId === 'stats') {
      navigation.navigate('Stats');
    } else if (tabId !== 'home') {
      Alert.alert('Tinh nang', `Man hinh "${NAV_TABS.find((t) => t.id === tabId)?.label}" dang phat trien!`);
    } else {
      setActiveTab(tabId);
    }
  };

  const handleQuickAction = (action) => {
    if (action.id === '1') {
      navigation.navigate('Transaction');
    } else if (action.id === '2') {
      navigation.navigate('Stats');
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
              <Ionicons name="person" size={20} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.greetText}>Xin chao,</Text>
              <Text style={styles.userName}>{userName.charAt(0).toUpperCase() + userName.slice(1)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
            <View style={styles.notifDot} />
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
            {hideBalance ? '........' : formatVnd(summary.totalBalance)}
          </Text>

          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={16} color="#A7F3D0" />
              <View>
                <Text style={styles.statLabel}>Thu nhap</Text>
                <Text style={[styles.statAmount, { color: '#A7F3D0' }]}>
                  +{formatVnd(summary.totalIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={16} color="#FCA5A5" />
              <View>
                <Text style={styles.statLabel}>Chi tieu</Text>
                <Text style={[styles.statAmount, { color: '#FCA5A5' }]}>
                  -{formatVnd(summary.totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

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
                <TransactionItem key={item.id} item={item} />
              ))
            ) : (
              <Text style={styles.emptyState}>Chua co giao dich nao.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.navItem}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.navIconWrap, isActive && styles.navIconActive]}>
                <Ionicons
                  name={isActive ? tab.icon : `${tab.icon}-outline`}
                  size={22}
                  color={isActive ? COLORS.primary : COLORS.gray}
                />
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function TransactionItem({ item }) {
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
        {isPositive ? '+' : ''}{formatVnd(item.signedAmount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  balanceCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 24, padding: 24,
    backgroundColor: COLORS.primary,
    ...SHADOWS.lg,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceLabel: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.medium },
  balanceAmount: { fontSize: 32, fontWeight: FONTS.extraBold, color: COLORS.white, marginBottom: 20 },
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
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, ...SHADOWS.sm,
  },
  quickItem: { alignItems: 'center', gap: 8, flex: 1 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.dark },
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
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 8, paddingTop: 4,
    ...SHADOWS.sm,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  navIconWrap: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navIconActive: { backgroundColor: `${COLORS.primary}15` },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },
});
