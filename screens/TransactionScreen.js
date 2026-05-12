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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  formatVnd,
  getCategory,
  parseTransactionDate,
  useFinance,
} from '../contexts/FinanceContext';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';

const NAV_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home' },
  { id: 'history', label: 'Giao dich', icon: 'add-circle' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet' },
  { id: 'profile', label: 'Ca nhan', icon: 'person' },
];

export default function TransactionScreen({ navigation }) {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();
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
        Alert.alert('Da cap nhat', 'Giao dich da duoc cap nhat.');
      } else {
        await addTransaction(payload);
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

  const handleDelete = (id) => {
    Alert.alert('Xoa giao dich', 'Ban co chac muon xoa giao dich nay?', [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id);
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
        <View style={{ width: 40 }} />
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
                  <Ionicons name={item.icon} size={22} color={active ? COLORS.white : item.color} />
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
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item.id)}
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

      <BottomNav activeTab="history" onPress={handleNav} />
    </SafeAreaView>
  );
}

function TransactionRow({ item, onEdit, onDelete }) {
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
        {isIncome ? '+' : '-'}{formatVnd(item.amount)}
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

function BottomNav({ activeTab, onPress }) {
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

const styles = StyleSheet.create({
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
  saveText: { color: COLORS.white, fontSize: SIZES.base, fontWeight: FONTS.bold },
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
});
