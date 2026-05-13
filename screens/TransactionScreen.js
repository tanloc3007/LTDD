import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  getCategory,
  parseTransactionDate,
  useFinance,
} from '../contexts/FinanceContext';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../constants/api';

const NAV_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home' },
  { id: 'history', label: 'Giao dich', icon: 'add-circle' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet' },
  { id: 'profile', label: 'Ca nhan', icon: 'person' },
];

export default function TransactionScreen({ navigation }) {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const { token } = useAuth();
  const { colors: COLORS, formatCurrency } = useSettings();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

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

  const pushNotif = async (message, type = 'other') => {
    if (!token) return;
    try {
      const res = await apiRequest('/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message, type }),
      });
      setNotifications((prev) => [res.notification, ...prev]);
    } catch (_) {}
  };
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const normalizedDate = useMemo(() => formatDateForStorage(selectedDate), [selectedDate]);
  const displayDate = useMemo(() => formatDateForDisplay(selectedDate), [selectedDate]);
  const visibleCategories = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
  const accentColor = type === 'income' ? COLORS.success : COLORS.primaryDark;

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('food');
    setNote('');
    setSelectedDate(new Date());
    setShowDatePicker(false);
    setEditingId(null);
  };

  const selectType = (nextType) => {
    setType(nextType);
    setCategory(nextType === 'income' ? 'salary' : 'food');
  };

  const handleSave = async () => {
    const cleanAmount = Number(String(amount).replace(/[^0-9]/g, ''));
    if (!cleanAmount) {
      Alert.alert('Thieu so tien', 'Vui long nhap so tien giao dich.');
      return;
    }

    const payload = {
      amount: cleanAmount,
      type,
      category,
      note: note.trim() || getCategory(category).label,
      date: normalizedDate,
    };

    try {
      setSaving(true);
      if (editingId) {
        await updateTransaction(editingId, payload);
        const catLabel = getCategory(category).label;
        await pushNotif(`✏️ Đã sửa giao dịch: ${payload.type === 'income' ? 'Thu nhập' : 'Chi tiêu'} ${Number(payload.amount).toLocaleString('vi-VN')}đ - ${catLabel} (${payload.date})`, payload.type);
        Alert.alert('Da cap nhat', 'Giao dich da duoc cap nhat.');
      } else {
        await addTransaction(payload);
        const catLabel = getCategory(category).label;
        await pushNotif(`${payload.type === 'income' ? '⬇️ Thu nhập' : '⬆️ Chi tiêu'}: ${Number(payload.amount).toLocaleString('vi-VN')}đ - ${catLabel}${payload.note ? ' (' + payload.note + ')' : ''} vào ${payload.date}`, payload.type);
        Alert.alert('Da luu', 'Giao dich moi da duoc them.');
      }
      resetForm();
    } catch (error) {
      Alert.alert('Khong the luu', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setType(item.type);
    setAmount(String(item.amount));
    setCategory(item.category);
    setNote(item.note || '');
    setSelectedDate(parseTransactionDate(item.date) || new Date());
    setShowDatePicker(false);
  };

  const handleDelete = (id, note, txType, txCategory) => {
    Alert.alert('Xoa giao dich', 'Ban co chac muon xoa giao dich nay?', [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id);
            const catLabel = getCategory(txCategory).label;
            await pushNotif(`🗑️ Đã xoá giao dịch: ${txType === 'income' ? 'Thu nhập' : 'Chi tiêu'} - ${catLabel}${note ? ' (' + note + ')' : ''}`, txType);
          } catch (error) {
            Alert.alert('Khong the xoa', error.message);
          }
        },
      },
    ]);
  };

  const handleNav = (tabId) => {
    if (tabId === 'home') navigation.navigate('Home');
    else if (tabId === 'stats') navigation.navigate('Stats');
    else if (tabId === 'history') navigation.navigate('Transaction');
    else if (tabId === 'wallet') navigation.navigate('Budget');
    else if (tabId === 'profile') navigation.navigate('Profile');
    else Alert.alert('Tinh nang', 'Man hinh dang phat trien!');
  };

  const handleDateChange = (event, value) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'dismissed' || !value) {
      return;
    }

    setSelectedDate(value);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{editingId ? 'Sua giao dich' : 'Them giao dich'}</Text>
        <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifModal(true)}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'expense' && styles.segmentActive]}
            onPress={() => selectType('expense')}
          >
            <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextExpense]}>Chi tieu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'income' && styles.segmentActive]}
            onPress={() => selectType('income')}
          >
            <Text style={[styles.segmentText, type === 'income' && styles.segmentTextIncome]}>Thu nhap</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>So tien</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0 d"
            placeholderTextColor={accentColor}
            style={[styles.amountInput, { color: accentColor }]}
          />
          <View style={styles.amountLine} />
        </View>

        <Text style={styles.sectionTitle}>Danh muc</Text>
        <View style={styles.categoryGrid}>
          {visibleCategories.map((item) => {
            const active = category === item.id;
            return (
              <TouchableOpacity key={item.id} style={styles.categoryItem} onPress={() => setCategory(item.id)}>
                <View style={[styles.categoryIcon, active && { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={22} color={active ? '#FFF' : item.color} />
                </View>
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.inputCard} activeOpacity={0.8} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.gray} />
          <Text style={styles.dateText}>{displayDate}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        <View style={[styles.inputCard, styles.noteCard]}>
          <Ionicons name="list-outline" size={22} color={COLORS.gray} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Them ghi chu..."
            placeholderTextColor={COLORS.lightGray}
            style={styles.noteInput}
            multiline
          />
        </View>

        <View style={styles.managementHeader}>
          <Text style={styles.sectionTitle}>Quan ly giao dich</Text>
          {editingId && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelEdit}>Huy sua</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.transactionList}>
          {transactions.map((item) => (
            <TransactionRow
              key={item.id}
              item={item}
              COLORS={COLORS}
              styles={styles}
              formatCurrency={formatCurrency}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item.id, item.note, item.type, item.category)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.saveWrap}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? 'Dang luu...' : editingId ? 'Cap nhat giao dich' : 'Luu giao dich'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomNav}>
        {NAV_TABS.map((tab) => {
          const active = 'history' === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => handleNav(tab.id)}>
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

function TransactionRow({ item, onEdit, onDelete, COLORS, styles, formatCurrency }) {
  const category = getCategory(item.category);
  const isIncome = item.type === 'income';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: `${category.color}18` }]}>
        <Ionicons name={category.icon} size={18} color={category.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{item.note || category.label}</Text>
        <Text style={styles.txMeta}>{category.label} · {item.date}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? COLORS.success : COLORS.danger }]}>
        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
      <TouchableOpacity style={styles.iconBtn} onPress={onEdit}>
        <Ionicons name="create-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
}

function formatDateForStorage(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateForDisplay(date) {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return `${isToday ? 'Hom nay, ' : ''}${formatDateForStorage(date)}`;
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    height: 56,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center' },
  topTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  notifBtn: { position: 'relative', padding: 4, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: FONTS.bold },
  scroll: { padding: 14, paddingBottom: 152 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FBE1ED',
    borderRadius: 11,
    padding: 3,
    marginTop: 8,
  },
  segmentItem: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: COLORS.white },
  segmentText: { color: COLORS.lightGray, fontSize: SIZES.md, fontWeight: FONTS.semiBold },
  segmentTextExpense: { color: COLORS.primaryDark },
  segmentTextIncome: { color: COLORS.success },
  amountBlock: { alignItems: 'center', marginVertical: 26 },
  amountLabel: { fontSize: SIZES.xs, color: COLORS.gray, marginBottom: 8 },
  amountInput: {
    minWidth: 140,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: FONTS.extraBold,
    paddingVertical: 0,
  },
  amountLine: { width: 160, height: 2, backgroundColor: COLORS.border, marginTop: 4 },
  sectionTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  categoryItem: { width: '24%', alignItems: 'center', marginBottom: 16 },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDE2EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryLabel: { fontSize: 11, color: COLORS.dark, textAlign: 'center' },
  inputCard: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  dateText: { flex: 1, marginLeft: 12, fontSize: SIZES.md, color: COLORS.dark },
  noteCard: { height: 96, alignItems: 'flex-start', paddingTop: 14 },
  noteInput: { flex: 1, marginLeft: 12, fontSize: SIZES.md, color: COLORS.dark, textAlignVertical: 'top' },
  managementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelEdit: { color: COLORS.primary, fontWeight: FONTS.bold },
  transactionList: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', ...SHADOWS.sm },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, marginLeft: 10 },
  txTitle: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.semiBold },
  txMeta: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 2 },
  txAmount: { fontSize: SIZES.xs, fontWeight: FONTS.bold, marginRight: 4 },
  iconBtn: { padding: 5 },
  saveWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.md,
  },
  saveBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
  },
  saveText: { color: '#FFF', fontSize: SIZES.base, fontWeight: FONTS.bold },
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
