import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';

// ===== DỮ LIỆU MẪU =====
const TRANSACTIONS = [
  { id: '1', title: 'Ăn uống',      subtitle: 'Hôm nay, 12:30',    amount: -150000,    icon: 'restaurant',      color: '#FF6B35' },
  { id: '2', title: 'Lương tháng 10', subtitle: 'Hôm qua, 09:00',  amount: 20000000,   icon: 'cash',            color: '#2DCE89' },
  { id: '3', title: 'Di chuyển',    subtitle: '20/10/2023',         amount: -50000,     icon: 'car',             color: '#8B5CF6' },
  { id: '4', title: 'Mua sắm',      subtitle: 'Hôm nay, 15:00',    amount: -320000,    icon: 'bag',             color: '#F59E0B' },
  { id: '5', title: 'Freelance',    subtitle: '18/10/2023',         amount: 5000000,    icon: 'laptop',          color: '#06B6D4' },
  { id: '6', title: 'Hoá đơn điện', subtitle: '15/10/2023',         amount: -280000,    icon: 'flash',           color: '#EF4444' },
  { id: '7', title: 'Gym',          subtitle: '10/10/2023',         amount: -200000,    icon: 'barbell',         color: '#8B5CF6' },
];

const QUICK_ACTIONS = [
  { id: '1', label: 'Thêm',     icon: 'add-circle',   color: COLORS.primary },
  { id: '2', label: 'Thống kê', icon: 'bar-chart',    color: '#8B5CF6'      },
  { id: '3', label: 'Ngân sách',icon: 'wallet',        color: '#F59E0B'      },
  { id: '4', label: 'AI Chat',  icon: 'chatbubbles',   color: '#06B6D4'      },
];

const NAV_TABS = [
  { id: 'home',    label: 'Trang chủ',  icon: 'home' },
  { id: 'history', label: 'Giao dịch',  icon: 'list' },
  { id: 'stats',   label: 'Thống kê',   icon: 'bar-chart' },
  { id: 'wallet',  label: 'Ngân sách',  icon: 'wallet' },
  { id: 'profile', label: 'Cá nhân',    icon: 'person' },
];

const formatMoney = (amount) => {
  const abs = Math.abs(amount);
  return abs.toLocaleString('vi-VN') + ' đ';
};

// ===== MAIN COMPONENT =====
export default function HomeScreen({ navigation, route }) {
  const userName = route?.params?.userName || 'Luân';
  const [activeTab, setActiveTab] = useState('home');
  const [hideBalance, setHideBalance] = useState(false);

  const totalBalance = 15450000;
  const totalIncome  = 20000000;
  const totalExpense = 4550000;

  const handleTabPress = (tabId) => {
    if (tabId !== 'home') {
      Alert.alert('Tính năng', `Màn hình "${NAV_TABS.find(t => t.id === tabId)?.label}" đang phát triển!`);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ===== MAIN CONTENT ===== */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ----- Header ----- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={20} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.greetText}>👋 Xin chào,</Text>
              <Text style={styles.userName}>{userName.charAt(0).toUpperCase() + userName.slice(1)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* ----- Balance Card ----- */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Tổng số dư</Text>
            <TouchableOpacity onPress={() => setHideBalance(!hideBalance)}>
              <Ionicons
                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                size={20} color="rgba(255,255,255,0.8)"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceAmount}>
            {hideBalance ? '••••••••' : formatMoney(totalBalance)}
          </Text>

          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={16} color="#A7F3D0" />
              <View>
                <Text style={styles.statLabel}>Thu nhập</Text>
                <Text style={[styles.statAmount, { color: '#A7F3D0' }]}>
                  +{formatMoney(totalIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={16} color="#FCA5A5" />
              <View>
                <Text style={styles.statLabel}>Chi tiêu</Text>
                <Text style={[styles.statAmount, { color: '#FCA5A5' }]}>
                  -{formatMoney(totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ----- Quick Actions ----- */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickItem}
                onPress={() => Alert.alert(action.label, 'Tính năng đang phát triển!')}
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

        {/* ----- AI Tip Card ----- */}
        <View style={styles.section}>
          <View style={styles.tipCard}>
            <View style={styles.tipLeft}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>Gợi ý từ AI</Text>
                <Text style={styles.tipBody}>
                  Bạn đã chi tiêu 60% ngân sách ăn uống tháng này. Gợi ý: giảm ăn ngoài để tiết kiệm thêm!
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ----- Transactions ----- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <TouchableOpacity onPress={() => Alert.alert('Xem tất cả', 'Tính năng đang phát triển!')}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            {TRANSACTIONS.map((item) => (
              <TransactionItem key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* Padding bottom cho nav bar */}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ===== BOTTOM NAV ===== */}
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

// --- Transaction item component ---
function TransactionItem({ item }) {
  const isPositive = item.amount > 0;
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
        {isPositive ? '+' : ''}{formatMoney(item.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scroll:   { flexGrow: 1, paddingBottom: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  greetText: { fontSize: SIZES.xs, color: COLORS.gray, fontWeight: FONTS.regular },
  userName:  { fontSize: SIZES.base, color: COLORS.dark, fontWeight: FONTS.bold },
  notifBtn:  { position: 'relative', padding: 4 },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5, borderColor: COLORS.white,
  },

  // Balance card
  balanceCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 24, padding: 24,
    backgroundColor: COLORS.primary,
    ...SHADOWS.lg,
  },
  balanceTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceLabel: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.medium },
  balanceAmount:{ fontSize: 32, fontWeight: FONTS.extraBold, color: COLORS.white, marginBottom: 20 },
  balanceStats: { flexDirection: 'row', alignItems: 'center' },
  statItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDivider:  { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 12 },
  statLabel:    { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FONTS.regular },
  statAmount:   { fontSize: SIZES.sm, fontWeight: FONTS.bold },

  // Section
  section: { marginTop: 16, marginHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:  { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
  seeAll:        { fontSize: SIZES.sm,   fontWeight: FONTS.semiBold, color: COLORS.primary },

  // Quick actions
  quickActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, ...SHADOWS.sm,
  },
  quickItem:  { alignItems: 'center', gap: 8, flex: 1 },
  quickIcon:  { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.dark },

  // AI Tip card
  tipCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary, ...SHADOWS.sm,
  },
  tipLeft:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 4 },
  tipBody:  { fontSize: SIZES.xs, color: COLORS.gray, lineHeight: 18 },

  // Transaction list
  transactionList: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', ...SHADOWS.sm },
  txItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: `${COLORS.border}80`,
  },
  txIcon:   { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txInfo:   { flex: 1 },
  txTitle:  { fontSize: SIZES.md, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 2 },
  txSub:    { fontSize: SIZES.xs, color: COLORS.gray },
  txAmount: { fontSize: SIZES.md, fontWeight: FONTS.bold },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 8, paddingTop: 4,
    ...SHADOWS.sm,
  },
  navItem:        { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  navIconWrap:    { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navIconActive:  { backgroundColor: `${COLORS.primary}15` },
  navLabel:       { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },
});
