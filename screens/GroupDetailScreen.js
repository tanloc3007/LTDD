import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../constants/api';

const CATEGORY_MAP = {
  food: { label: 'An uong', icon: 'restaurant', color: '#F59E0B' },
  transport: { label: 'Di chuyen', icon: 'car', color: '#3B82F6' },
  shopping: { label: 'Mua sam', icon: 'bag', color: '#8B5CF6' },
  entertainment: { label: 'Giai tri', icon: 'game-controller', color: '#EC4899' },
  health: { label: 'Suc khoe', icon: 'medical', color: '#EF4444' },
  education: { label: 'Giao duc', icon: 'school', color: '#06B6D4' },
  bills: { label: 'Hoa don', icon: 'receipt', color: '#10B981' },
  other: { label: 'Khac', icon: 'ellipsis-horizontal-circle', color: '#6B7280' },
};

const getCat = (id) => CATEGORY_MAP[id] || CATEGORY_MAP.other;

const CATEGORIES = Object.entries(CATEGORY_MAP).map(([id, val]) => ({ id, ...val }));

export default function GroupDetailScreen({ navigation, route }) {
  const { groupId, groupName } = route.params || {};
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add expense modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'food', note: '', date: new Date().toISOString().slice(0, 10) });
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token || !groupId) return;
    setLoading(true);
    try {
      const [expRes, groupRes] = await Promise.all([
        apiRequest(`/group-wallet/${groupId}/expenses`, { headers: authHeaders }),
        apiRequest(`/group-wallet`, { headers: authHeaders }),
      ]);
      setExpenses(expRes.expenses || expRes || []);
      // Find this group from list
      const list = groupRes.groups || groupRes || [];
      const found = list.find((g) => (g._id || g.id) === groupId);
      if (found) setGroup(found);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, groupId, authHeaders]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleAddExpense = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Loi', 'Vui long nhap so tien hop le!');
      return;
    }
    setAdding(true);
    try {
      await apiRequest(`/group-wallet/${groupId}/expenses`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount,
          category: form.category,
          note: form.note.trim(),
          date: form.date,
        }),
      });
      setShowAddModal(false);
      setForm({ amount: '', category: 'food', note: '', date: new Date().toISOString().slice(0, 10) });
      fetchData();
    } catch (e) {
      Alert.alert('That bai', e?.message || 'Khong the them chi tieu.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteExpense = (expenseId) => {
    Alert.alert(
      'Xoa chi tieu',
      'Ban co chac muon xoa khoan chi tieu nay?',
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xoa', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/group-wallet/${groupId}/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: authHeaders,
              });
              fetchData();
            } catch (e) {
              Alert.alert('That bai', 'Khong the xoa chi tieu.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Roi Nhom',
      `Ban co chac muon roi khoi nhom "${groupName}"?`,
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Roi nhom', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/group-wallet/${groupId}/leave`, {
                method: 'DELETE',
                headers: authHeaders,
              });
              Alert.alert('Da roi nhom', 'Ban da roi khoi nhom thanh cong.');
              navigation.goBack();
            } catch (e) {
              Alert.alert('That bai', e?.message || 'Khong the roi nhom luc nay.');
            }
          },
        },
      ]
    );
  };

  // Debt settlement calculation
  const settlement = useMemo(() => {
    if (!group || !expenses.length) return [];
    const members = group.members || [];
    const memberCount = members.length;
    if (memberCount === 0) return [];

    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const perPerson = totalExpense / memberCount;

    // Tong tien da tra cua tung nguoi
    const paid = {};
    members.forEach((m) => {
      const memberId = m._id || m.id || m.userId;
      paid[memberId] = { name: m.name || m.userId || 'Unknown', total: 0 };
    });

    expenses.forEach((e) => {
      const paidById = e.paidBy?._id || e.paidBy?.id || e.paidBy;
      if (paid[paidById]) {
        paid[paidById].total += Number(e.amount || 0);
      }
    });

    return Object.entries(paid).map(([id, data]) => ({
      id,
      name: data.name,
      paid: data.total,
      balance: data.total - perPerson,
    }));
  }, [group, expenses]);

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );

  const renderExpenseItem = ({ item }) => {
    const cat = getCat(item.category);
    const paidName = item.paidByName || item.paidBy?.name || 'Unknown';
    return (
      <View style={styles.expenseItem}>
        <View style={[styles.expIconBox, { backgroundColor: `${cat.color}18` }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.expTitle} numberOfLines={1}>{item.note || cat.label}</Text>
          <Text style={styles.expSub}>
            {paidName} • {item.date ? item.date.slice(0, 10) : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.expAmount}>{formatCurrency(item.amount)}</Text>
          <TouchableOpacity onPress={() => handleDeleteExpense(item._id || item.id)}>
            <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName || 'Vi Nhom'}</Text>
          {group && (
            <Text style={styles.headerSub}>{(group.members || []).length} thanh vien</Text>
          )}
        </View>
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
          <Ionicons name="exit-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Dang tai du lieu...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tong chi tieu nhom</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>So giao dich</Text>
                <Text style={styles.summaryItemValue}>{expenses.length}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Thanh vien</Text>
                <Text style={styles.summaryItemValue}>{(group?.members || []).length}</Text>
              </View>
            </View>
          </View>

          {/* Ket toan cong no */}
          {settlement.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calculator-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Ket toan cong no</Text>
              </View>
              {settlement.map((item) => (
                <View key={item.id} style={styles.settlementItem}>
                  <View style={styles.settlementAvatar}>
                    <Text style={styles.settlementAvatarText}>
                      {(item.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settlementName}>{item.name}</Text>
                    <Text style={styles.settlementPaid}>Da tra: {formatCurrency(item.paid)}</Text>
                  </View>
                  <View style={[
                    styles.balanceBadge,
                    { backgroundColor: item.balance >= 0 ? `${COLORS.success}18` : `${COLORS.danger}18` }
                  ]}>
                    <Text style={[
                      styles.balanceBadgeText,
                      { color: item.balance >= 0 ? COLORS.success : COLORS.danger }
                    ]}>
                      {item.balance >= 0 ? '+' : ''}{formatCurrency(item.balance)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Danh sach chi tieu */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Danh sach chi tieu</Text>
            </View>

            {expenses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.lightGray} />
                <Text style={styles.emptyText}>Chua co chi tieu nao trong nhom.</Text>
              </View>
            ) : (
              <View style={styles.expenseList}>
                {expenses.map((item) => (
                  <View key={item._id || item.id}>
                    {renderExpenseItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/* FAB - Them chi tieu */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setForm({ amount: '', category: 'food', note: '', date: new Date().toISOString().slice(0, 10) });
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal Them chi tieu */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Them Chi Tieu</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>So tien *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={COLORS.lightGray}
                value={form.amount}
                onChangeText={(t) => setForm((f) => ({ ...f, amount: t }))}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Danh muc</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 4 }}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      form.category === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, category: cat.id }))}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={14}
                      color={form.category === cat.id ? '#FFF' : cat.color}
                    />
                    <Text style={[
                      styles.catChipText,
                      form.category === cat.id && { color: '#FFF' },
                    ]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Ghi chu</Text>
              <TextInput
                style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Nhap ghi chu..."
                placeholderTextColor={COLORS.lightGray}
                value={form.note}
                onChangeText={(t) => setForm((f) => ({ ...f, note: t }))}
                multiline
              />

              <Text style={styles.inputLabel}>Ngay (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-01-01"
                placeholderTextColor={COLORS.lightGray}
                value={form.date}
                onChangeText={(t) => setForm((f) => ({ ...f, date: t }))}
              />

              <TouchableOpacity
                style={[styles.submitBtn, adding && { opacity: 0.7 }]}
                onPress={handleAddExpense}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    <Text style={styles.submitBtnText}>Them Chi Tieu</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ height: 12 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { flexGrow: 1, paddingBottom: 80 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  headerSub: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 1 },
  leaveBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: `${COLORS.danger}12`,
    alignItems: 'center', justifyContent: 'center',
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.gray, fontSize: SIZES.sm },

  summaryCard: {
    margin: 16, borderRadius: 24, padding: 24,
    backgroundColor: COLORS.primary,
    ...SHADOWS.lg,
  },
  summaryLabel: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.75)', marginBottom: 4, fontWeight: FONTS.medium },
  summaryAmount: { fontSize: 32, fontWeight: FONTS.extraBold, color: '#FFF', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.7)' },
  summaryItemValue: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: '#FFF', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },

  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },

  settlementItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 8, ...SHADOWS.sm,
  },
  settlementAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  settlementAvatarText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: '#FFF' },
  settlementName: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark },
  settlementPaid: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 2 },
  balanceBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  balanceBadgeText: { fontSize: SIZES.sm, fontWeight: FONTS.bold },

  expenseList: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', ...SHADOWS.sm },
  expenseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: `${COLORS.border}80`,
  },
  expIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expTitle: { fontSize: SIZES.md, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 2 },
  expSub: { fontSize: SIZES.xs, color: COLORS.gray },
  expAmount: { fontSize: SIZES.md, fontWeight: FONTS.bold, color: COLORS.danger, marginBottom: 4 },

  emptyBox: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center' },

  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.lg,
  },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 32, maxHeight: '90%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  inputLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 6, marginTop: 8 },
  textInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: SIZES.base, color: COLORS.dark,
    backgroundColor: COLORS.bg, marginBottom: 4,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  catChipText: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.dark },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 14, marginTop: 16,
    ...SHADOWS.md,
  },
  submitBtnText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: '#FFFFFF' },
});
