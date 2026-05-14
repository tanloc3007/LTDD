import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { CATEGORIES, parseTransactionDate, useFinance } from '../contexts/FinanceContext';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const screenWidth = Dimensions.get('window').width;
const chartWidth = Math.min(screenWidth - 48, 340);

const NAV_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home' },
  { id: 'history', label: 'Giao dich', icon: 'add-circle' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet' },
  { id: 'profile', label: 'Ca nhan', icon: 'person' },
];

const GROUP_CATEGORY_OPTIONS = [
  { id: 'food', label: 'An uong', icon: 'restaurant', color: '#E91E8C' },
  { id: 'transport', label: 'Di chuyen', icon: 'car', color: '#178BFF' },
  { id: 'shopping', label: 'Mua sam', icon: 'bag-handle', color: '#FF9500' },
  { id: 'health', label: 'Suc khoe', icon: 'heart', color: '#00C853' },
  { id: 'other', label: 'Khac', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

export default function StatsScreen({ navigation }) {
  const { transactions } = useFinance();
  const { token } = useAuth();
  const { colors: COLORS, formatCurrency } = useSettings();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    color: (opacity = 1) => `rgba(233, 30, 140, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(136, 146, 164, ${opacity})`,
    decimalPlaces: 0,
    barPercentage: 0.45,
    propsForBackgroundLines: { stroke: COLORS.border },
  }), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const [mainTab, setMainTab] = useState('personal');
  const [period, setPeriod] = useState('month');
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;
      let mounted = true;
      apiRequest('/notifications', { headers: authHeaders })
        .then((res) => {
          if (mounted) setNotifications(res.notifications || []);
        })
        .catch(() => {});
      return () => { mounted = false; };
    }, [token])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) {}
  };
  const [groupTotalAmount, setGroupTotalAmount] = useState(2220000);
  const [groupTotalInput, setGroupTotalInput] = useState('2220000');
  const [editingGroupTotal, setEditingGroupTotal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([
    { id: 'm-1', name: 'An (Ban)', initial: 'A' },
    { id: 'm-2', name: 'Binh', initial: 'B' },
    { id: 'm-3', name: 'Chong', initial: 'C' },
    { id: 'm-4', name: 'Lan', initial: 'L' },
  ]);
  const [newMemberName, setNewMemberName] = useState('');
  const [groupCategoryItems, setGroupCategoryItems] = useState([
    { id: 'gc-1', categoryId: 'food', amount: 20000 },
    { id: 'gc-2', categoryId: 'transport', amount: 200000 },
    { id: 'gc-3', categoryId: 'shopping', amount: 2000000 },
  ]);
  const [selectedGroupCategoryId, setSelectedGroupCategoryId] = useState('food');
  const [groupCategoryAmountInput, setGroupCategoryAmountInput] = useState('');

  const currentDate = new Date();
  const decoratedTransactions = useMemo(
    () => transactions.map((item) => ({ ...item, parsedDate: parseTransactionDate(item.date) })),
    [transactions]
  );

  const referenceDate = useMemo(() => {
    const datedTransactions = decoratedTransactions
      .map((item) => item.parsedDate)
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());

    return datedTransactions[0] || new Date();
  }, [decoratedTransactions]);

  const filteredTransactions = useMemo(
    () => decoratedTransactions.filter((item) => isInSelectedPeriod(item.parsedDate, period, referenceDate)),
    [decoratedTransactions, period, referenceDate]
  );

  const expenseTransactions = filteredTransactions.filter((item) => item.type === 'expense');
  const incomeTransactions = filteredTransactions.filter((item) => item.type === 'income');
  const totalExpense = expenseTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalIncome = incomeTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const categoryStats = useMemo(() => {
    return CATEGORIES.map((category) => {
      const total = expenseTransactions
        .filter((item) => item.category === category.id)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...category, total };
    }).filter((item) => item.total > 0);
  }, [expenseTransactions]);

  const pieData = (categoryStats.length ? categoryStats : [{ ...CATEGORIES[0], total: 1 }]).map((item) => ({
    name: item.label,
    population: item.total,
    color: item.color,
    legendFontColor: COLORS.gray,
    legendFontSize: 10,
  }));

  const barData = useMemo(
    () => buildPeriodBarData(decoratedTransactions, period, referenceDate, currentDate, COLORS),
    [decoratedTransactions, period, referenceDate, currentDate, COLORS]
  );

  const groupCategoryStats = useMemo(() => {
    return groupCategoryItems.map((item) => {
      const meta = GROUP_CATEGORY_OPTIONS.find((option) => option.id === item.categoryId) || GROUP_CATEGORY_OPTIONS[0];
      return { ...meta, itemId: item.id, amount: item.amount };
    });
  }, [groupCategoryItems]);

  const perPersonAmount = groupMembers.length ? Math.round(groupTotalAmount / groupMembers.length) : 0;

  useEffect(() => {
    const total = groupCategoryItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    setGroupTotalAmount(total);
    if (!editingGroupTotal) {
      setGroupTotalInput(String(total));
    }
  }, [groupCategoryItems, editingGroupTotal]);

  const handleNav = (tabId) => {
    if (tabId === 'home') navigation.navigate('Home');
    else if (tabId === 'history') navigation.navigate('Transaction');
    else if (tabId === 'stats') navigation.navigate('Stats');
    else if (tabId === 'wallet') navigation.navigate('Budget');
    else if (tabId === 'profile') navigation.navigate('Profile');
    else Alert.alert('Tinh nang', 'Man hinh dang phat trien!');
  };

  const saveGroupTotal = () => {
    const nextAmount = Number(String(groupTotalInput).replace(/[^0-9]/g, ''));
    if (!nextAmount) {
      Alert.alert('Thieu so tien', 'Vui long nhap tong so tien hop le.');
      return;
    }
    setGroupTotalAmount(nextAmount);
    setGroupTotalInput(String(nextAmount));
    setEditingGroupTotal(false);
  };

  const cancelGroupTotalEdit = () => {
    setGroupTotalInput(String(groupTotalAmount));
    setEditingGroupTotal(false);
  };

  const addGroupMember = () => {
    const cleanName = newMemberName.trim();
    if (!cleanName) {
      Alert.alert('Thieu ten', 'Vui long nhap ten thanh vien.');
      return;
    }

    const initial = cleanName.charAt(0).toUpperCase();
    setGroupMembers((current) => [
      ...current,
      { id: `m-${Date.now()}`, name: cleanName, initial },
    ]);
    setNewMemberName('');
  };

  const removeGroupMember = (memberId) => {
    setGroupMembers((current) => current.filter((member) => member.id !== memberId));
  };

  const upsertGroupCategory = () => {
    const nextAmount = Number(String(groupCategoryAmountInput).replace(/[^0-9]/g, ''));
    if (!nextAmount) {
      Alert.alert('Thieu so tien', 'Vui long nhap so tien hop le cho danh muc.');
      return;
    }

    setGroupCategoryItems((current) => {
      const existing = current.find((item) => item.categoryId === selectedGroupCategoryId);
      if (existing) {
        return current.map((item) =>
          item.categoryId === selectedGroupCategoryId ? { ...item, amount: nextAmount } : item
        );
      }

      return [...current, { id: `gc-${Date.now()}`, categoryId: selectedGroupCategoryId, amount: nextAmount }];
    });

    setGroupCategoryAmountInput('');
  };

  const removeGroupCategory = (itemId) => {
    setGroupCategoryItems((current) => current.filter((item) => item.id !== itemId));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.brand}>FinancialManagement Finance</Text>
        <TouchableOpacity style={styles.bell} onPress={() => setShowNotifModal(true)}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.primaryDark} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.topTabs}>
        <TouchableOpacity style={styles.topTab} onPress={() => setMainTab('personal')}>
          <Text style={[styles.topTabText, mainTab === 'personal' && styles.topTabTextActive]}>Ca nhan</Text>
          {mainTab === 'personal' && <View style={styles.topTabLine} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.topTab} onPress={() => setMainTab('group')}>
          <Text style={[styles.topTabText, mainTab === 'group' && styles.topTabTextActive]}>Nhom</Text>
          {mainTab === 'group' && <View style={styles.topTabLine} />}
        </TouchableOpacity>
      </View>

      {mainTab === 'personal' ? (
        <PersonalStats
          period={period}
          setPeriod={setPeriod}
          totalExpense={totalExpense}
          totalIncome={totalIncome}
          pieData={pieData}
          categoryStats={categoryStats}
          barData={barData}
          COLORS={COLORS}
          styles={styles}
          formatCurrency={formatCurrency}
          chartConfig={chartConfig}
        />
      ) : (
        <GroupStats
          groupTotalAmount={groupTotalAmount}
          groupTotalInput={groupTotalInput}
          setGroupTotalInput={setGroupTotalInput}
          editingGroupTotal={editingGroupTotal}
          setEditingGroupTotal={setEditingGroupTotal}
          saveGroupTotal={saveGroupTotal}
          cancelGroupTotalEdit={cancelGroupTotalEdit}
          groupMembers={groupMembers}
          newMemberName={newMemberName}
          setNewMemberName={setNewMemberName}
          addGroupMember={addGroupMember}
          removeGroupMember={removeGroupMember}
          selectedGroupCategoryId={selectedGroupCategoryId}
          setSelectedGroupCategoryId={setSelectedGroupCategoryId}
          groupCategoryAmountInput={groupCategoryAmountInput}
          setGroupCategoryAmountInput={setGroupCategoryAmountInput}
          upsertGroupCategory={upsertGroupCategory}
          removeGroupCategory={removeGroupCategory}
          groupCategoryStats={groupCategoryStats}
          perPersonAmount={perPersonAmount}
          COLORS={COLORS}
          styles={styles}
          formatCurrency={formatCurrency}
        />
      )}

      <BottomNav activeTab="stats" onPress={handleNav} COLORS={COLORS} styles={styles} />

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheetLg}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thông báo</Text>
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
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyText}>Chưa có thông báo nào.</Text>
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

function PersonalStats({ period, setPeriod, totalExpense, totalIncome, pieData, categoryStats, barData, COLORS, styles, formatCurrency, chartConfig }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.periodTabs}>
        {[
          { id: 'week', label: 'Tuan' },
          { id: 'month', label: 'Thang' },
          { id: 'year', label: 'Nam' },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.periodItem, period === item.id && styles.periodActive]}
            onPress={() => setPeriod(item.id)}
          >
            <Text style={[styles.periodText, period === item.id && styles.periodTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Tong Chi" value={formatCurrency(totalExpense)} color={COLORS.danger} styles={styles} />
        <SummaryCard label="Tong Thu" value={formatCurrency(totalIncome)} color={COLORS.success} styles={styles} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Co cau chi tieu</Text>
        <PieChart
          data={pieData}
          width={chartWidth}
          height={170}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="46"
          absolute={false}
          hasLegend
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{barData.title}</Text>
        <BarChart
          data={barData}
          width={chartWidth}
          height={190}
          chartConfig={chartConfig}
          fromZero
          showBarTops={false}
          withInnerLines={false}
          style={styles.barChart}
          yAxisLabel=""
          yAxisSuffix={barData.yAxisSuffix}
        />
      </View>

      <Text style={styles.sectionTitle}>Chi tiet danh muc</Text>
      <View style={styles.detailCard}>
        {categoryStats.length ? (
          categoryStats.map((item) => (
            <CategoryDetail key={item.id} item={item} total={totalExpense} styles={styles} formatCurrency={formatCurrency} />
          ))
        ) : (
          <Text style={styles.emptyState}>Chua co du lieu chi tieu trong bo loc nay.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function GroupStats({
  groupTotalAmount,
  groupTotalInput,
  setGroupTotalInput,
  editingGroupTotal,
  setEditingGroupTotal,
  saveGroupTotal,
  cancelGroupTotalEdit,
  groupMembers,
  newMemberName,
  setNewMemberName,
  addGroupMember,
  removeGroupMember,
  selectedGroupCategoryId,
  setSelectedGroupCategoryId,
  groupCategoryAmountInput,
  setGroupCategoryAmountInput,
  upsertGroupCategory,
  removeGroupCategory,
  groupCategoryStats,
  perPersonAmount,
  COLORS,
  styles,
  formatCurrency,
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.groupCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="receipt" size={18} color={COLORS.primaryDark} />
            <Text style={styles.cardHeaderTitle}>Chia hoa don nhanh</Text>
          </View>
          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.gray} />
        </View>

        <View style={styles.billBox}>
          <Text style={styles.billLabel}>Tong so tien</Text>
          {editingGroupTotal ? (
            <View>
              <TextInput
                value={groupTotalInput}
                onChangeText={setGroupTotalInput}
                keyboardType="numeric"
                style={styles.totalInput}
                placeholder="Nhap tong so tien"
                placeholderTextColor={COLORS.lightGray}
              />
              <View style={styles.inlineActions}>
                <TouchableOpacity style={styles.smallGhostButton} onPress={cancelGroupTotalEdit}>
                  <Text style={styles.smallGhostText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallPrimaryButton} onPress={saveGroupTotal}>
                  <Text style={styles.smallPrimaryText}>Luu</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.billAmount}>{formatCurrency(groupTotalAmount)}</Text>
          )}

          {!editingGroupTotal && (
            <TouchableOpacity style={styles.editBill} onPress={() => setEditingGroupTotal(true)}>
              <Ionicons name="pencil" size={16} color={COLORS.primaryDark} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.memberHeader}>
          <Text style={styles.memberLabel}>Thanh vien tham gia</Text>
          <TouchableOpacity style={styles.addMemberChip} onPress={addGroupMember}>
            <Text style={styles.addMemberText}>+ Them</Text>
          </TouchableOpacity>
          <View style={styles.peopleCount}>
            <Text style={styles.peopleCountText}>{groupMembers.length} nguoi</Text>
          </View>
        </View>

        <View style={styles.addMemberRow}>
          <TextInput
            value={newMemberName}
            onChangeText={setNewMemberName}
            placeholder="Nhap ten thanh vien"
            placeholderTextColor={COLORS.lightGray}
            style={styles.memberInput}
          />
          <TouchableOpacity style={styles.addMemberButton} onPress={addGroupMember}>
            <Ionicons name="add" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {groupMembers.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>{member.initial}</Text>
            </View>
            <Text style={styles.memberName}>{member.name}</Text>
            <TouchableOpacity style={styles.deleteMemberButton} onPress={() => removeGroupMember(member.id)}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.groupCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="flame" size={18} color={COLORS.primaryDark} />
            <Text style={styles.cardHeaderTitle}>Danh muc chi tieu</Text>
          </View>
          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.gray} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupCategoryTabs}>
          {GROUP_CATEGORY_OPTIONS.map((item) => {
            const active = selectedGroupCategoryId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.groupCategoryTab, active && styles.groupCategoryTabActive]}
                onPress={() => setSelectedGroupCategoryId(item.id)}
              >
                <Ionicons name={item.icon} size={16} color={active ? '#FFF' : item.color} />
                <Text style={[styles.groupCategoryTabText, active && styles.groupCategoryTabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.groupCategoryInputRow}>
          <TextInput
            value={groupCategoryAmountInput}
            onChangeText={setGroupCategoryAmountInput}
            keyboardType="numeric"
            placeholder="Nhap so tien cho danh muc"
            placeholderTextColor={COLORS.lightGray}
            style={styles.groupCategoryInput}
          />
          <TouchableOpacity style={styles.groupCategoryActionButton} onPress={upsertGroupCategory}>
            <Ionicons name="save-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {groupCategoryStats.length ? (
          groupCategoryStats.map((item) => (
            <View key={item.itemId} style={styles.groupCategoryRow}>
              <View style={[styles.detailIcon, { backgroundColor: `${item.color}16` }]}>
                <Ionicons name={item.icon} size={17} color={item.color} />
              </View>
              <Text style={styles.groupCategoryName}>{item.label}</Text>
              <Text style={styles.groupCategoryAmount}>{formatCurrency(item.amount)}</Text>
              <TouchableOpacity style={styles.groupCategoryDeleteButton} onPress={() => removeGroupCategory(item.itemId)}>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyState}>Chua co danh muc chi tieu nao.</Text>
        )}
      </View>

      <View style={styles.perPersonCard}>
        <Text style={styles.perPersonLabel}>SO TIEN MOI NGUOI</Text>
        <Text style={styles.perPersonAmount}>{formatCurrency(perPersonAmount)}</Text>
      </View>
    </ScrollView>
  );
}

function SummaryCard({ label, value, color, styles }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function CategoryDetail({ item, total, styles, formatCurrency }) {
  const percent = total > 0 ? Math.round((item.total / total) * 100) : 0;
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: `${item.color}16` }]}>
        <Ionicons name={item.icon} size={17} color={item.color} />
      </View>
      <View style={styles.detailInfo}>
        <View style={styles.detailTop}>
          <Text style={styles.detailName}>{item.label}</Text>
          <Text style={styles.detailAmount}>{formatCurrency(item.total)}</Text>
        </View>
        <Text style={styles.detailPercent}>{percent}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: item.color }]} />
        </View>
      </View>
    </View>
  );
}

function BottomNav({ activeTab, onPress, COLORS, styles }) {
  return (
    <View style={styles.bottomNav}>
      {NAV_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => onPress(tab.id)}>
            <Ionicons
              name={active ? tab.icon : `${tab.icon}-outline`}
              size={20}
              color={active ? COLORS.primary : COLORS.gray}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function isInSelectedPeriod(date, period, now) {
  if (!date) return false;

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return date >= start && date <= now;
  }

  if (period === 'month') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  if (period === 'year') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

function buildPeriodBarData(transactions, period, referenceDate, currentDate, COLORS) {
  if (period === 'week') return buildWeekBarData(transactions, referenceDate, COLORS);
  if (period === 'month') return buildMonthBarData(transactions, referenceDate, COLORS);
  return buildYearBarData(transactions, currentDate, COLORS);
}

function buildWeekBarData(transactions, referenceDate, COLORS) {
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const bucketDate = new Date(end);
    bucketDate.setDate(end.getDate() - offset);
    labels.push(`${bucketDate.getDate()}/${bucketDate.getMonth() + 1}`);
    const totals = sumTransactionsForDay(transactions, bucketDate);
    incomeData.push(totals.income);
    expenseData.push(totals.expense);
  }

  return buildChartPayload(labels, incomeData, expenseData, 'Thu / Chi theo tuan', COLORS);
}

function buildMonthBarData(transactions, referenceDate, COLORS) {
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekRanges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
    [29, daysInMonth],
  ].filter(([start]) => start <= daysInMonth);

  weekRanges.forEach(([startDay, endDay], index) => {
    labels.push(`T${index + 1}`);
    const totals = transactions.reduce(
      (acc, item) => {
        const date = item.parsedDate;
        if (!date || date.getFullYear() !== year || date.getMonth() !== month) return acc;
        const day = date.getDate();
        if (day < startDay || day > endDay) return acc;
        const amount = Number(item.amount || 0);
        if (item.type === 'income') acc.income += amount;
        if (item.type === 'expense') acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
    incomeData.push(totals.income);
    expenseData.push(totals.expense);
  });

  return buildChartPayload(labels, incomeData, expenseData, 'Thu / Chi theo thang', COLORS);
}

function buildYearBarData(transactions, currentDate, COLORS) {
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const transactionYears = transactions
    .map((item) => item.parsedDate?.getFullYear())
    .filter((year) => Number.isInteger(year));

  const currentYear = currentDate.getFullYear();
  const yearSet = new Set(transactionYears);
  yearSet.add(currentYear);
  const years = Array.from(yearSet).sort((a, b) => a - b);

  years.forEach((year) => {
    labels.push(String(year));
    const totals = transactions.reduce(
      (acc, item) => {
        const date = item.parsedDate;
        if (!date || date.getFullYear() !== year) return acc;
        const amount = Number(item.amount || 0);
        if (item.type === 'income') acc.income += amount;
        if (item.type === 'expense') acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
    incomeData.push(totals.income);
    expenseData.push(totals.expense);
  });

  return buildChartPayload(labels, incomeData, expenseData, 'Thu / Chi theo nam', COLORS);
}

function sumTransactionsForDay(transactions, targetDate) {
  return transactions.reduce(
    (acc, item) => {
      const date = item.parsedDate;
      if (
        !date ||
        date.getFullYear() !== targetDate.getFullYear() ||
        date.getMonth() !== targetDate.getMonth() ||
        date.getDate() !== targetDate.getDate()
      ) {
        return acc;
      }

      const amount = Number(item.amount || 0);
      if (item.type === 'income') acc.income += amount;
      if (item.type === 'expense') acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

function buildChartPayload(labels, incomeRaw, expenseRaw, title, COLORS) {
  const maxValue = Math.max(...incomeRaw, ...expenseRaw, 0);
  const scale = maxValue >= 1000000 ? 1000000 : maxValue >= 1000 ? 1000 : 1;
  const yAxisSuffix = scale === 1000000 ? 'tr' : scale === 1000 ? 'k' : '';
  const incomeData = incomeRaw.map((value) => Number((value / scale).toFixed(1)));
  const expenseData = expenseRaw.map((value) => Number((value / scale).toFixed(1)));

  return {
    labels,
    datasets: [
      { data: incomeData, color: () => COLORS.success },
      { data: expenseData, color: () => COLORS.danger },
    ],
    legend: ['Thu nhap', 'Chi tieu'],
    title,
    yAxisSuffix,
  };
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    height: 52,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: SIZES.sm, fontWeight: FONTS.extraBold, color: COLORS.primaryDark },
  bell: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { color: '#FFF', fontSize: 8, fontWeight: FONTS.bold },
  topTabs: { height: 42, backgroundColor: COLORS.white, flexDirection: 'row' },
  topTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topTabText: { fontSize: SIZES.xs, color: COLORS.gray, fontWeight: FONTS.medium },
  topTabTextActive: { color: COLORS.primaryDark, fontWeight: FONTS.bold },
  topTabLine: { position: 'absolute', bottom: 0, width: '88%', height: 3, backgroundColor: COLORS.primaryDark },
  scroll: { padding: 14, paddingBottom: 92 },
  periodTabs: { flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 8, padding: 3, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  periodItem: { flex: 1, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  periodActive: { backgroundColor: COLORS.white },
  periodText: { fontSize: SIZES.xs, color: COLORS.gray, fontWeight: FONTS.medium },
  periodTextActive: { color: COLORS.primaryDark, fontWeight: FONTS.bold },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, ...SHADOWS.sm },
  summaryLabel: { fontSize: SIZES.xs, color: COLORS.gray, marginBottom: 6 },
  summaryValue: { fontSize: SIZES.md, fontWeight: FONTS.extraBold },
  card: { backgroundColor: COLORS.white, borderRadius: 18, paddingVertical: 14, marginBottom: 14, ...SHADOWS.sm },
  cardTitle: { textAlign: 'center', fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 8 },
  barChart: { borderRadius: 12, marginLeft: -10 },
  sectionTitle: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 10 },
  detailCard: { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', ...SHADOWS.sm },
  detailRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailInfo: { flex: 1, marginLeft: 10 },
  detailTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailName: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },
  detailAmount: { fontSize: SIZES.xs, color: COLORS.danger, fontWeight: FONTS.bold },
  detailPercent: { fontSize: 10, color: COLORS.gray, marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: COLORS.border, borderRadius: 4, marginTop: 7 },
  progressFill: { height: 4, borderRadius: 4 },
  groupCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 14, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderTitle: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.bold },
  billBox: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, marginBottom: 12 },
  billLabel: { fontSize: SIZES.xs, color: COLORS.gray, marginBottom: 4 },
  billAmount: { fontSize: SIZES.base, color: COLORS.dark, fontWeight: FONTS.extraBold },
  totalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: SIZES.base,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
    fontWeight: FONTS.bold,
  },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  smallGhostButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FDE2EE' },
  smallGhostText: { color: COLORS.primaryDark, fontSize: SIZES.xs, fontWeight: FONTS.bold },
  smallPrimaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primaryDark },
  smallPrimaryText: { color: '#FFF', fontSize: SIZES.xs, fontWeight: FONTS.bold },
  editBill: {
    position: 'absolute',
    right: 12,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  memberLabel: { flex: 1, fontSize: SIZES.xs, color: COLORS.gray },
  addMemberChip: { backgroundColor: '#FDE2EE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  addMemberText: { color: COLORS.primaryDark, fontSize: SIZES.xs, fontWeight: FONTS.bold },
  peopleCount: { backgroundColor: '#FDE2EE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  peopleCountText: { color: COLORS.primaryDark, fontSize: SIZES.xs, fontWeight: FONTS.bold },
  addMemberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  memberInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: SIZES.sm,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  addMemberButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 6,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberInitial: { color: COLORS.primaryDark, fontSize: SIZES.xs, fontWeight: FONTS.bold },
  memberName: { flex: 1, fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },
  deleteMemberButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 9,
    padding: 10,
    marginBottom: 8,
  },
  groupCategoryTabs: { paddingBottom: 10, gap: 8 },
  groupCategoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    marginRight: 8,
  },
  groupCategoryTabActive: { backgroundColor: COLORS.primaryDark },
  groupCategoryTabText: { fontSize: SIZES.xs, color: COLORS.dark, fontWeight: FONTS.medium },
  groupCategoryTabTextActive: { color: '#FFF', fontWeight: FONTS.bold },
  groupCategoryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  groupCategoryInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: SIZES.sm,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  groupCategoryActionButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCategoryName: { flex: 1, marginLeft: 10, fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },
  groupCategoryAmount: { fontSize: SIZES.xs, color: COLORS.dark, fontWeight: FONTS.bold },
  groupCategoryDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  perPersonCard: {
    backgroundColor: `${COLORS.primary}20`,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  perPersonLabel: { fontSize: SIZES.xs, color: COLORS.gray, marginBottom: 4, fontWeight: FONTS.bold },
  perPersonAmount: { fontSize: SIZES.xl, color: COLORS.primaryDark, fontWeight: FONTS.extraBold },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingBottom: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },
  emptyState: { padding: 16, textAlign: 'center', color: COLORS.gray, fontSize: SIZES.sm },

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
