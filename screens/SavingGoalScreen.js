import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../constants/api';
import AppBottomNav from '../components/AppBottomNav';

// ─── Constants ──────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  'save', 'home', 'airplane', 'car', 'gift',
  'school', 'heart', 'camera', 'diamond', 'star', 'trophy', 'flash',
];

const COLOR_OPTIONS = [
  '#E91E8C', '#178BFF', '#FF9500', '#2DCE89',
  '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(`${y}-${m}-${d}`);
  return isNaN(date.getTime()) ? null : date;
}

function formatDateDisplay(str) {
  const d = parseDateDDMMYYYY(str);
  if (!d) return str;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysRemaining(deadlineStr) {
  const d = parseDateDDMMYYYY(deadlineStr);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SavingGoalScreen({ navigation }) {
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // State
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newIcon, setNewIcon] = useState('save');
  const [newColor, setNewColor] = useState('#E91E8C');
  const [creating, setCreating] = useState(false);

  // Deposit/Withdraw modal state
  const [txModal, setTxModal] = useState(null); // { goal, type: 'deposit'|'withdraw' }
  const [txAmount, setTxAmount] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // ── Fetch goals ────────────────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest('/saving-goals', { headers: authHeaders });
      setGoals(res.goals || res || []);
    } catch (e) {
      Alert.alert('Loi', 'Khong the tai danh sach hu tiet kiem.');
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useFocusEffect(
    useCallback(() => {
      fetchGoals();
    }, [fetchGoals])
  );

  // ── Summary ────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const totalCurrent = goals.reduce((s, g) => s + Number(g.currentAmount || 0), 0);
    const totalTarget = goals.reduce((s, g) => s + Number(g.targetAmount || 0), 0);
    return { totalCurrent, totalTarget };
  }, [goals]);

  // ── Create goal ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long nhap ten hu tiet kiem.');
      return;
    }
    const target = parseFloat(newTarget.replace(/,/g, ''));
    if (!target || target <= 0) {
      Alert.alert('Thieu thong tin', 'Vui long nhap so tien muc tieu hop le.');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/saving-goals', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          targetAmount: target,
          deadline: newDeadline.trim() || null,
          icon: newIcon,
          color: newColor,
        }),
      });
      setShowCreateModal(false);
      resetCreateForm();
      fetchGoals();
    } catch (e) {
      Alert.alert('Loi', 'Khong the tao hu tiet kiem. Vui long thu lai.');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewTarget('');
    setNewDeadline('');
    setNewIcon('save');
    setNewColor('#E91E8C');
  };

  // ── Deposit / Withdraw ─────────────────────────────────────────────────────

  const handleTransaction = async () => {
    if (!txModal) return;
    const amount = parseFloat(txAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('So tien khong hop le', 'Vui long nhap so tien lon hon 0.');
      return;
    }
    const { goal, type } = txModal;
    setTxLoading(true);
    try {
      await apiRequest(`/saving-goals/${goal._id}/${type}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      setTxModal(null);
      setTxAmount('');
      fetchGoals();
    } catch (e) {
      Alert.alert('Loi', `Khong the ${type === 'deposit' ? 'gui tien' : 'rut tien'}. Vui long thu lai.`);
    } finally {
      setTxLoading(false);
    }
  };

  // ── Delete goal ────────────────────────────────────────────────────────────

  const handleDelete = (goal) => {
    Alert.alert(
      'Xoa hu tiet kiem',
      `Ban co chac muon xoa "${goal.title}"?`,
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xoa',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/saving-goals/${goal._id}`, {
                method: 'DELETE',
                headers: authHeaders,
              });
              fetchGoals();
            } catch (e) {
              Alert.alert('Loi', 'Khong the xoa. Vui long thu lai.');
            }
          },
        },
      ]
    );
  };

  // ── Render goal card ───────────────────────────────────────────────────────

  const renderGoal = ({ item: goal }) => {
    const current = Number(goal.currentAmount || 0);
    const target = Number(goal.targetAmount || 1);
    const progress = Math.min(current / target, 1);
    const percent = Math.round(progress * 100);
    const days = daysRemaining(goal.deadline);
    const isExpired = days !== null && days < 0 && current < target;
    const isCompleted = current >= target;
    const goalColor = goal.color || COLORS.primary;

    return (
      <View style={[styles.goalCard, { borderLeftColor: goalColor, borderLeftWidth: 4 }]}>
        {/* Header row */}
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconBox, { backgroundColor: `${goalColor}18` }]}>
            <Ionicons name={goal.icon || 'save'} size={24} color={goalColor} />
          </View>
          <View style={styles.goalMeta}>
            <View style={styles.goalTitleRow}>
              <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
              {isCompleted && (
                <View style={[styles.statusBadge, { backgroundColor: '#2DCE8918' }]}>
                  <Ionicons name="happy" size={12} color="#2DCE89" />
                  <Text style={[styles.statusBadgeText, { color: '#2DCE89' }]}>Dat muc tieu</Text>
                </View>
              )}
              {isExpired && !isCompleted && (
                <View style={[styles.statusBadge, { backgroundColor: '#EF444415' }]}>
                  <Ionicons name="alert-circle" size={12} color="#EF4444" />
                  <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>Het han</Text>
                </View>
              )}
            </View>
            {goal.deadline ? (
              <Text style={styles.goalDeadline}>
                <Ionicons name="calendar-outline" size={11} color={COLORS.gray} />
                {'  '}
                {formatDateDisplay(goal.deadline)}
                {days !== null && (
                  <Text style={{ color: isExpired ? '#EF4444' : days <= 7 ? '#F59E0B' : COLORS.gray }}>
                    {isExpired ? `  (da het han ${Math.abs(days)} ngay)` : `  (con ${days} ngay)`}
                  </Text>
                )}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => handleDelete(goal)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percent}%`,
                  backgroundColor: isCompleted ? '#2DCE89' : isExpired ? '#EF4444' : goalColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, { color: isCompleted ? '#2DCE89' : goalColor }]}>
            {percent}%
          </Text>
        </View>

        {/* Amount row */}
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Da tiet kiem</Text>
            <Text style={[styles.amountCurrent, { color: goalColor }]}>
              {formatCurrency(current)}
            </Text>
          </View>
          <View style={styles.amountDivider} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Muc tieu</Text>
            <Text style={styles.amountTarget}>{formatCurrency(target)}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.goalActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: `${goalColor}12`, borderColor: `${goalColor}30` }]}
            onPress={() => { setTxModal({ goal, type: 'deposit' }); setTxAmount(''); }}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-down-circle" size={16} color={goalColor} />
            <Text style={[styles.actionBtnText, { color: goalColor }]}>Gui tien</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#EF444412', borderColor: '#EF444430' }]}
            onPress={() => { setTxModal({ goal, type: 'withdraw' }); setTxAmount(''); }}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-up-circle" size={16} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Rut</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Hu Tiet Kiem</Text>
          <Text style={styles.headerSub}>{goals.length} hu dang hoat dong</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { resetCreateForm(); setShowCreateModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tong da tiet kiem</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalCurrent)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tong muc tieu</Text>
          <Text style={[styles.summaryValue, { color: COLORS.dark }]}>
            {formatCurrency(summary.totalTarget)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Hoan thanh</Text>
          <Text style={[styles.summaryValue, { color: '#2DCE89' }]}>
            {summary.totalTarget > 0
              ? `${Math.round((summary.totalCurrent / summary.totalTarget) * 100)}%`
              : '0%'}
          </Text>
        </View>
      </View>

      {/* Goals list */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Dang tai du lieu...</Text>
        </View>
      ) : goals.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="wallet-outline" size={64} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Chua co hu nao</Text>
          <Text style={styles.emptyDesc}>Nhan nut + de tao hu tiet kiem dau tien</Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => { resetCreateForm(); setShowCreateModal(true); }}
          >
            <Text style={styles.emptyCreateBtnText}>Tao hu tiet kiem</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          renderItem={renderGoal}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <AppBottomNav navigation={navigation} activeTab="saving" />

      {/* ── Create Modal ── */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tao Hu Tiet Kiem</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Icon picker */}
              <Text style={styles.fieldLabel}>Chon bieu tuong</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
                {ICON_OPTIONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setNewIcon(ic)}
                    style={[
                      styles.iconOption,
                      newIcon === ic && { backgroundColor: `${newColor}20`, borderColor: newColor, borderWidth: 2 },
                    ]}
                  >
                    <Ionicons name={ic} size={22} color={newIcon === ic ? newColor : COLORS.gray} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Color picker */}
              <Text style={styles.fieldLabel}>Chon mau</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((clr) => (
                  <TouchableOpacity
                    key={clr}
                    onPress={() => setNewColor(clr)}
                    style={[
                      styles.colorOption,
                      { backgroundColor: clr },
                      newColor === clr && styles.colorSelected,
                    ]}
                  >
                    {newColor === clr && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={styles.fieldLabel}>Ten hu</Text>
              <View style={styles.inputWrap}>
                <Ionicons name={newIcon} size={18} color={newColor} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Vd: Mua xe, Du lich..."
                  placeholderTextColor={COLORS.lightGray}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>

              {/* Target amount */}
              <Text style={styles.fieldLabel}>So tien muc tieu</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="cash-outline" size={18} color={COLORS.gray} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.lightGray}
                  value={newTarget}
                  onChangeText={setNewTarget}
                  keyboardType="numeric"
                />
              </View>

              {/* Deadline */}
              <Text style={styles.fieldLabel}>Han chot (DD/MM/YYYY)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.gray} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="31/12/2025"
                  placeholderTextColor={COLORS.lightGray}
                  value={newDeadline}
                  onChangeText={setNewDeadline}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* Preview */}
              {(newTitle || newTarget) ? (
                <View style={[styles.previewCard, { borderLeftColor: newColor }]}>
                  <View style={[styles.previewIcon, { backgroundColor: `${newColor}18` }]}>
                    <Ionicons name={newIcon} size={20} color={newColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle}>{newTitle || 'Ten hu'}</Text>
                    <Text style={styles.previewAmt}>
                      Muc tieu: {newTarget ? formatCurrency(parseFloat(newTarget.replace(/,/g, '')) || 0) : '—'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: newColor }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Tao Hu Tiet Kiem</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Deposit / Withdraw Modal ── */}
      <Modal
        visible={!!txModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setTxModal(null); setTxAmount(''); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheetSm}>
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={txModal?.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={22}
                  color={txModal?.type === 'deposit' ? (txModal?.goal?.color || COLORS.primary) : '#EF4444'}
                />
                <Text style={styles.sheetTitle}>
                  {txModal?.type === 'deposit' ? 'Gui tien vao hu' : 'Rut tien khoi hu'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setTxModal(null); setTxAmount(''); }}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {txModal && (
              <View style={styles.txGoalInfo}>
                <View style={[styles.txGoalIcon, { backgroundColor: `${txModal.goal.color || COLORS.primary}18` }]}>
                  <Ionicons
                    name={txModal.goal.icon || 'save'}
                    size={20}
                    color={txModal.goal.color || COLORS.primary}
                  />
                </View>
                <View>
                  <Text style={styles.txGoalName}>{txModal.goal.title}</Text>
                  <Text style={styles.txGoalBalance}>
                    Hien co: {formatCurrency(Number(txModal.goal.currentAmount || 0))}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>So tien</Text>
            <View style={[styles.inputWrap, { borderColor: txModal?.type === 'deposit' ? (txModal?.goal?.color || COLORS.primary) : '#EF4444' }]}>
              <Ionicons name="cash-outline" size={18} color={COLORS.gray} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="Nhap so tien..."
                placeholderTextColor={COLORS.lightGray}
                value={txAmount}
                onChangeText={setTxAmount}
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor:
                    txModal?.type === 'deposit'
                      ? (txModal?.goal?.color || COLORS.primary)
                      : '#EF4444',
                  marginTop: 20,
                },
              ]}
              onPress={handleTransaction}
              disabled={txLoading}
              activeOpacity={0.85}
            >
              {txLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={txModal?.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitBtnText}>
                    {txModal?.type === 'deposit' ? 'Xac nhan Gui tien' : 'Xac nhan Rut tien'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (COLORS) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 12,
      backgroundColor: COLORS.white,
      ...SHADOWS.sm,
    },
    headerTitle: {
      fontSize: SIZES.xl,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },
    headerSub: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      fontWeight: FONTS.regular,
      marginTop: 2,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.md,
    },

    // Summary card
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      backgroundColor: COLORS.white,
      borderRadius: 20,
      padding: 18,
      ...SHADOWS.sm,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      fontWeight: FONTS.regular,
      marginBottom: 4,
      textAlign: 'center',
    },
    summaryValue: {
      fontSize: SIZES.sm,
      fontWeight: FONTS.bold,
      color: COLORS.primary,
      textAlign: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 36,
      backgroundColor: COLORS.border,
    },

    // List
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },

    // Goal card
    goalCard: {
      backgroundColor: COLORS.white,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      ...SHADOWS.sm,
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
      gap: 12,
    },
    goalIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalMeta: { flex: 1 },
    goalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 4,
    },
    goalTitle: {
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },
    goalDeadline: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      fontWeight: FONTS.regular,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: FONTS.bold,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#EF444412',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Progress
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      backgroundColor: COLORS.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      minWidth: 4,
    },
    progressPercent: {
      fontSize: SIZES.xs,
      fontWeight: FONTS.bold,
      minWidth: 36,
      textAlign: 'right',
    },

    // Amount
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    amountLabel: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      fontWeight: FONTS.regular,
      marginBottom: 2,
    },
    amountCurrent: {
      fontSize: SIZES.md,
      fontWeight: FONTS.bold,
    },
    amountTarget: {
      fontSize: SIZES.md,
      fontWeight: FONTS.semiBold,
      color: COLORS.dark,
    },
    amountDivider: {
      flex: 1,
      height: 1,
      backgroundColor: COLORS.border,
      marginHorizontal: 12,
    },

    // Actions
    goalActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    actionBtnText: {
      fontSize: SIZES.sm,
      fontWeight: FONTS.semiBold,
    },

    // Empty / Loading
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: COLORS.gray,
      fontSize: SIZES.sm,
    },
    emptyBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: SIZES.lg,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
      marginTop: 8,
    },
    emptyDesc: {
      fontSize: SIZES.sm,
      color: COLORS.gray,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyCreateBtn: {
      marginTop: 16,
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 28,
    },
    emptyCreateBtnText: {
      color: '#FFFFFF',
      fontWeight: FONTS.bold,
      fontSize: SIZES.base,
    },

    // Modal
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: COLORS.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      maxHeight: '92%',
    },
    sheetSm: {
      backgroundColor: COLORS.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: SIZES.lg,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },

    // Form fields
    fieldLabel: {
      fontSize: SIZES.sm,
      fontWeight: FONTS.semiBold,
      color: COLORS.dark,
      marginBottom: 8,
      marginTop: 4,
    },
    iconRow: { marginBottom: 16 },
    iconOption: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    colorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    colorOption: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSelected: {
      borderWidth: 3,
      borderColor: COLORS.white,
      ...SHADOWS.sm,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    input: {
      flex: 1,
      fontSize: SIZES.md,
      color: COLORS.dark,
      fontWeight: FONTS.regular,
    },

    // Preview card
    previewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.bg,
      borderRadius: 16,
      padding: 14,
      borderLeftWidth: 4,
      marginBottom: 16,
    },
    previewIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewTitle: {
      fontSize: SIZES.md,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },
    previewAmt: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      marginTop: 2,
    },

    // Submit button
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 6,
      ...SHADOWS.md,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
    },

    // Tx modal
    txGoalInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.bg,
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
    },
    txGoalIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txGoalName: {
      fontSize: SIZES.md,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },
    txGoalBalance: {
      fontSize: SIZES.xs,
      color: COLORS.gray,
      marginTop: 2,
    },
  });
