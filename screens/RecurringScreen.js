import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../constants/api';
import { getCategory, CATEGORIES, INCOME_CATEGORIES } from '../contexts/FinanceContext';

const FREQUENCY_OPTIONS = [
  { key: 'daily', label: 'Hàng ngày', icon: 'today-outline' },
  { key: 'weekly', label: 'Hàng tuần', icon: 'calendar-outline' },
  { key: 'monthly', label: 'Hàng tháng', icon: 'calendar-number-outline' },
];

function getFrequencyLabel(freq) {
  if (freq === 'daily') return 'Hàng ngày';
  if (freq === 'weekly') return 'Hàng tuần';
  if (freq === 'monthly') return 'Hàng tháng';
  return freq || '';
}

function formatNextRunDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

export default function RecurringScreen({ navigation }) {
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('food');
  const [formNote, setFormNote] = useState('');
  const [formFrequency, setFormFrequency] = useState('monthly');
  const [formDayOfMonth, setFormDayOfMonth] = useState('1');

  const visibleCategories = formType === 'income' ? INCOME_CATEGORIES : CATEGORIES;

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest('/recurring', { headers: authHeaders });
      setList(res.recurrings || res.data || []);
    } catch (err) {
      Alert.alert('Loi', err.message || 'Khong the tai danh sach.');
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await apiRequest('/recurring/process', {
        method: 'POST',
        headers: authHeaders,
      });
      const count = res.count || res.created || 0;
      Alert.alert(
        'Thành công',
        `Đã xử lý ${count} giao dịch định kỳ hôm nay.`,
        [{ text: 'OK', onPress: fetchList }]
      );
    } catch (err) {
      Alert.alert('Loi', err.message || 'Khong the xu ly.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Xóa giao dịch định kỳ', 'Bạn có chắc muốn xóa giao dịch này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/recurring/${id}`, {
              method: 'DELETE',
              headers: authHeaders,
            });
            setList((prev) => prev.filter((item) => item._id !== id && item.id !== id));
          } catch (err) {
            Alert.alert('Loi', err.message || 'Khong the xoa.');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormType('expense');
    setFormAmount('');
    setFormCategory('food');
    setFormNote('');
    setFormFrequency('monthly');
    setFormDayOfMonth('1');
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSave = async () => {
    const cleanAmount = Number(String(formAmount).replace(/[^0-9]/g, ''));
    if (!cleanAmount) {
      Alert.alert('Thiếu số tiền', 'Vui lòng nhập số tiền.');
      return;
    }
    const payload = {
      amount: cleanAmount,
      type: formType,
      category: formCategory,
      note: formNote.trim(),
      frequency: formFrequency,
      dayOfMonth: formFrequency === 'monthly' ? Number(formDayOfMonth) || 1 : undefined,
    };
    setSaving(true);
    try {
      const res = await apiRequest('/recurring', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const newItem = res.recurring || res.data || res;
      setList((prev) => [newItem, ...prev]);
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Loi', err.message || 'Khong the them.');
    } finally {
      setSaving(false);
    }
  };

  const selectFormType = (t) => {
    setFormType(t);
    setFormCategory(t === 'income' ? 'salary' : 'food');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giao Dịch Định Kỳ</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenModal}>
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Process Today Button */}
      <View style={styles.processRow}>
        <View style={styles.processInfo}>
          <Ionicons name="repeat-outline" size={18} color={COLORS.primary} />
          <Text style={styles.processInfoText}>Tự động tạo giao dịch hôm nay</Text>
        </View>
        <TouchableOpacity
          style={[styles.processBtn, processing && { opacity: 0.7 }]}
          onPress={handleProcess}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.processBtnText}>Xử lý</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item._id || item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="repeat-outline" size={52} color={COLORS.border} />
              <Text style={styles.emptyText}>Chưa có giao dịch định kỳ nào.</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenModal}>
                <Text style={styles.emptyAddText}>Thêm ngay</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const cat = getCategory(item.category);
            const isIncome = item.type === 'income';
            const itemId = item._id || item.id;
            return (
              <View style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: `${cat.color}18` }]}>
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemNote} numberOfLines={1}>
                      {item.note || cat.label}
                    </Text>
                    <Text style={[styles.itemAmount, { color: isIncome ? COLORS.success : COLORS.danger }]}>
                      {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>
                  </View>
                  <View style={styles.itemMetaRow}>
                    <View style={[styles.typeBadge, { backgroundColor: isIncome ? `${COLORS.success}15` : `${COLORS.danger}12` }]}>
                      <Text style={[styles.typeBadgeText, { color: isIncome ? COLORS.success : COLORS.danger }]}>
                        {isIncome ? 'Thu' : 'Chi'}
                      </Text>
                    </View>
                    <View style={styles.freqBadge}>
                      <Ionicons name="repeat-outline" size={11} color={COLORS.gray} />
                      <Text style={styles.freqText}>{getFrequencyLabel(item.frequency)}</Text>
                    </View>
                    {item.nextRunDate && (
                      <View style={styles.nextDateWrap}>
                        <Ionicons name="calendar-outline" size={11} color={COLORS.gray} />
                        <Text style={styles.nextDateText}>{formatNextRunDate(item.nextRunDate)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(itemId)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Add Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thêm Giao Dịch Định Kỳ</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {/* Type Toggle */}
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segmentItem, formType === 'expense' && styles.segmentActive]}
                  onPress={() => selectFormType('expense')}
                >
                  <Text style={[styles.segmentText, formType === 'expense' && styles.segmentExpense]}>
                    Chi tiêu
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentItem, formType === 'income' && styles.segmentActive]}
                  onPress={() => selectFormType('income')}
                >
                  <Text style={[styles.segmentText, formType === 'income' && styles.segmentIncome]}>
                    Thu nhập
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Số tiền</Text>
                <View style={styles.inputCard}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.gray} />
                  <TextInput
                    value={formAmount}
                    onChangeText={setFormAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.lightGray}
                    style={styles.textInput}
                  />
                  <Text style={styles.inputSuffix}>đ</Text>
                </View>
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>Danh mục</Text>
              <View style={styles.categoryGrid}>
                {visibleCategories.map((item) => {
                  const active = formCategory === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.categoryItem}
                      onPress={() => setFormCategory(item.id)}
                    >
                      <View style={[styles.categoryIcon, active && { backgroundColor: item.color }]}>
                        <Ionicons name={item.icon} size={20} color={active ? '#FFF' : item.color} />
                      </View>
                      <Text style={[styles.categoryLabel, active && { color: item.color, fontWeight: FONTS.bold }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Note */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Ghi chú</Text>
                <View style={[styles.inputCard, { minHeight: 60, alignItems: 'flex-start', paddingTop: 12 }]}>
                  <Ionicons name="create-outline" size={20} color={COLORS.gray} style={{ marginTop: 2 }} />
                  <TextInput
                    value={formNote}
                    onChangeText={setFormNote}
                    placeholder="Ghi chú (tuỳ chọn)"
                    placeholderTextColor={COLORS.lightGray}
                    style={[styles.textInput, { textAlignVertical: 'top' }]}
                    multiline
                  />
                </View>
              </View>

              {/* Frequency */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Tần suất</Text>
                <View style={styles.freqRow}>
                  {FREQUENCY_OPTIONS.map((opt) => {
                    const active = formFrequency === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.freqOption, active && { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}10` }]}
                        onPress={() => setFormFrequency(opt.key)}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={16}
                          color={active ? COLORS.primary : COLORS.gray}
                        />
                        <Text style={[styles.freqOptionText, active && { color: COLORS.primary, fontWeight: FONTS.bold }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Day of Month */}
              {formFrequency === 'monthly' && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Ngày trong tháng (1-31)</Text>
                  <View style={styles.inputCard}>
                    <Ionicons name="calendar-number-outline" size={20} color={COLORS.gray} />
                    <TextInput
                      value={formDayOfMonth}
                      onChangeText={(v) => {
                        const n = Number(v.replace(/[^0-9]/g, ''));
                        if (n >= 1 && n <= 31) setFormDayOfMonth(String(n));
                        else if (v === '') setFormDayOfMonth('');
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={COLORS.lightGray}
                      style={styles.textInput}
                      maxLength={2}
                    />
                  </View>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu giao dịch định kỳ</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },
    header: {
      height: 56,
      backgroundColor: COLORS.white,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      ...SHADOWS.sm,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
    addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    // Process row
    processRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 8,
      backgroundColor: COLORS.white,
      borderRadius: 16,
      padding: 14,
      ...SHADOWS.sm,
    },
    processInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    processInfoText: { fontSize: SIZES.sm, color: COLORS.dark, fontWeight: FONTS.medium },
    processBtn: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      ...SHADOWS.sm,
    },
    processBtnText: { color: '#fff', fontSize: SIZES.sm, fontWeight: FONTS.bold },

    // List
    listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: SIZES.md, color: COLORS.gray },
    emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: SIZES.md, color: COLORS.gray, textAlign: 'center' },
    emptyAddBtn: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
    },
    emptyAddText: { color: '#fff', fontWeight: FONTS.bold, fontSize: SIZES.sm },

    // Item card
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      gap: 12,
      ...SHADOWS.sm,
    },
    itemIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    itemBody: { flex: 1 },
    itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    itemNote: { flex: 1, fontSize: SIZES.md, fontWeight: FONTS.semiBold, color: COLORS.dark, marginRight: 8 },
    itemAmount: { fontSize: SIZES.md, fontWeight: FONTS.bold },
    itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    typeBadgeText: { fontSize: 10, fontWeight: FONTS.bold },
    freqBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    freqText: { fontSize: SIZES.xs, color: COLORS.gray },
    nextDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    nextDateText: { fontSize: SIZES.xs, color: COLORS.gray },
    deleteBtn: { padding: 6 },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: COLORS.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 20,
      maxHeight: '92%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
    sheetScroll: { paddingHorizontal: 20, paddingBottom: 40 },

    // Form
    segment: {
      flexDirection: 'row',
      backgroundColor: `${COLORS.border}`,
      borderRadius: 12,
      padding: 3,
      marginBottom: 16,
    },
    segmentItem: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { backgroundColor: COLORS.white, ...SHADOWS.sm },
    segmentText: { fontSize: SIZES.md, fontWeight: FONTS.semiBold, color: COLORS.gray },
    segmentExpense: { color: COLORS.danger },
    segmentIncome: { color: COLORS.success },

    fieldBlock: { marginBottom: 14 },
    fieldLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 8 },
    inputCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      minHeight: 48,
    },
    textInput: {
      flex: 1,
      fontSize: SIZES.md,
      color: COLORS.dark,
      marginLeft: 8,
      paddingVertical: 8,
    },
    inputSuffix: { fontSize: SIZES.md, color: COLORS.gray, fontWeight: FONTS.semiBold },

    // Category
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    categoryItem: { width: '24%', alignItems: 'center', marginBottom: 14 },
    categoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    categoryLabel: { fontSize: 10, color: COLORS.gray, textAlign: 'center' },

    // Frequency
    freqRow: { flexDirection: 'row', gap: 8 },
    freqOption: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    freqOptionText: { fontSize: SIZES.xs, color: COLORS.gray, textAlign: 'center' },

    // Save button
    saveBtn: {
      height: 50,
      borderRadius: 25,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      ...SHADOWS.md,
    },
    saveBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: FONTS.bold },
  });
