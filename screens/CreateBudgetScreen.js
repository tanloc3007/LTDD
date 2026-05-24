import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { useFinance, formatVnd } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';

const STATIC_CATEGORIES = [
    { id: 'transport', label: 'Di chuyển', icon: 'car', color: '#178BFF' },
    { id: 'investment', label: 'Đầu tư', icon: 'leaf', color: '#2DCE89' },
    { id: 'entertainment', label: 'Giải trí', icon: 'play-circle', color: '#F5365C' },
    { id: 'bills', label: 'Hóa đơn', icon: 'receipt', color: '#00D9D5' },
    { id: 'education', label: 'Học tập', icon: 'book', color: '#9C27B0' },
    { id: 'beauty', label: 'Làm đẹp', icon: 'brush', color: '#FF4FB8' },
    { id: 'family', label: 'Người thân', icon: 'body', color: '#FF6B35' },
    { id: 'home', label: 'Nhà cửa', icon: 'home', color: '#7E57C2' },
    { id: 'health', label: 'Sức khỏe', icon: 'heart', color: '#F5365C' },
    { id: 'charity', label: 'Từ thiện', icon: 'wallet', color: '#FF9500' },
    { id: 'shopping', label: 'Chợ, siêu thị', icon: 'cart', color: '#FF8A00' },
];

export default function CreateBudgetScreen({ navigation, route }) {
  const { token } = useAuth();
  const { transactions } = useFinance();
  const { colors: COLORS } = useSettings();
  const existingBudgets = route.params?.existingBudgets || [];
  const s = useMemo(() => getStyles(COLORS), [COLORS]);

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) { }
  };
  const [loadingAi, setLoadingAi] = useState(true);

  const fetchCustomCategories = async () => {
    if (!token) return;
    try {
      const res = await apiRequest('/categories', { headers: { Authorization: `Bearer ${token}` } });
      setCustomCategories(res.categories || []);
    } catch (_) {}
  };

  useFocusEffect(
    useCallback(() => {
      fetchCustomCategories();
    }, [token])
  );

  const allCategories = useMemo(() => {
    const custom = customCategories.map(c => ({
        id: c._id,
        label: c.label,
        icon: c.icon,
        color: c.color,
        isCustom: true
    }));
    return [...STATIC_CATEGORIES, ...custom];
  }, [customCategories]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!token) return;
      try {
        const now = new Date();
        const currentMonthTxs = transactions.filter(t => {
            const dParts = t.date.split('/');
            return dParts[1] === String(now.getMonth() + 1).padStart(2, '0') && dParts[2] === String(now.getFullYear());
        });
        const income = currentMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = currentMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const budgetsStr = existingBudgets.map(b => `${b.label}: ${formatVnd(b.budgetAmount)}`).join(', ');

        const [res, nRes] = await Promise.all([
          apiRequest('/ai-budget-suggestions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                  income: formatVnd(income),
                  expenses: formatVnd(expenses),
                  currentBudgets: budgetsStr
              })
          }),
          apiRequest('/notifications', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setAiSuggestions(res.suggestions || []);
        setNotifications(nRes.notifications || []);
      } catch (err) {
        console.error('AI Suggestion Fetch Error:', err);
      } finally {
        setLoadingAi(false);
      }
    };

    fetchSuggestions();
  }, [token, transactions]);

  const handleSelectCategory = (cat) => {
    const isAlreadyCreated = existingBudgets.some(b => b.categoryId === cat.id);
    if (isAlreadyCreated) return;
    navigation.navigate('SetBudgetAmount', { category: cat });
  };

  const handleSelectSuggestion = (sug) => {
      const cat = allCategories.find(c => c.label === sug.label) || {
          id: sug.id,
          label: sug.label,
          icon: sug.icon || 'star',
          color: sug.color || COLORS.primary
      };
      navigation.navigate('SetBudgetAmount', { category: cat, initialAmount: sug.suggestion.replace(/\D/g, '') });
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── HEADER ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => navigation.navigate('Budget')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Tạo ngân sách</Text>
        <TouchableOpacity style={s.notifBtn} onPress={() => setShowNotifModal(true)}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* SUGGESTIONS */}
        <View style={s.suggestBox}>
            <View style={s.suggestHeader}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                <Text style={s.suggestHeaderText}>Ứng dụng đề xuất</Text>
            </View>
            <Text style={s.suggestSubText}>Đề xuất dựa trên thu nhập và chi tiêu của bạn</Text>

            {loadingAi ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
                <View style={s.suggestList}>
                    {aiSuggestions.map((item) => (
                        <TouchableOpacity key={item.id} style={s.suggestItem} onPress={() => handleSelectSuggestion(item)}>
                            <View style={[s.catIconWrap, { backgroundColor: `${item.color}15` }]}>
                                <Ionicons name={item.icon || 'star'} size={22} color={item.color} />
                            </View>
                            <View style={s.itemContent}>
                                <Text style={s.itemLabel}>{item.label}</Text>
                                <Text style={s.itemSub}>Đề xuất <Text style={s.bold}>{item.suggestion}</Text></Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
                        </TouchableOpacity>
                    ))}
                    {aiSuggestions.length === 0 && (
                        <Text style={s.emptySuggest}>Không có đề xuất nào phù hợp lúc này.</Text>
                    )}
                </View>
            )}
        </View>

        {/* OTHER CATEGORIES */}
        <Text style={s.sectionTitle}>Chọn danh mục khác</Text>
        <View style={s.catList}>
            {allCategories.map((cat) => {
                const isCreated = existingBudgets.some(b => b.categoryId === cat.id);
                return (
                    <TouchableOpacity 
                        key={cat.id} 
                        style={[s.suggestItem, isCreated && s.disabledItem]}
                        onPress={() => handleSelectCategory(cat)}
                        disabled={isCreated}
                    >
                        <View style={[s.catIconWrap, { backgroundColor: isCreated ? COLORS.bg : `${cat.color}15` }]}>
                            <Ionicons name={cat.icon} size={22} color={isCreated ? COLORS.lightGray : cat.color} />
                        </View>
                        <View style={s.itemContent}>
                            <Text style={[s.itemLabel, isCreated && { color: COLORS.lightGray }]}>{cat.label}</Text>
                        </View>
                        {isCreated ? (
                            <View style={s.createdBadge}>
                                <Text style={s.createdText}>Đã tạo ngân sách</Text>
                            </View>
                        ) : (
                            <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>

        <TouchableOpacity 
          style={s.addMoreBtn} 
          onPress={() => navigation.navigate('AddCategory')}
        >
            <Ionicons name="add" size={24} color={COLORS.primary} />
            <Text style={s.addMoreText}>Thêm danh mục</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
                <Text style={{ color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 }}>Chưa có thông báo nào.</Text>
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

const getStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    height: 56,
    backgroundColor: COLORS.white,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center' },
  topTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  notifBtn: { position: 'relative', padding: 4, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: FONTS.bold },

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
  
  scroll: { padding: 16 },
  
  suggestBox: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.sm,
  },
  suggestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  suggestHeaderText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
  suggestSubText: { fontSize: SIZES.sm, color: COLORS.gray, marginBottom: 16 },
  
  suggestList: { gap: 12 },
  suggestItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  catIconWrap: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16,
  },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: SIZES.base, fontWeight: FONTS.semiBold, color: COLORS.dark },
  itemSub: { fontSize: SIZES.sm, color: COLORS.gray, marginTop: 2 },
  bold: { fontWeight: FONTS.bold, color: COLORS.dark },
  
  emptySuggest: { textAlign: 'center', color: COLORS.gray, fontSize: SIZES.sm, marginVertical: 10 },

  sectionTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 16 },
  catList: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.sm,
  },
  disabledItem: { opacity: 0.7 },
  createdBadge: { 
    backgroundColor: COLORS.bg, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  createdText: { fontSize: SIZES.xs, color: COLORS.gray, fontWeight: FONTS.medium },

  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  addMoreText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.primary },
});
