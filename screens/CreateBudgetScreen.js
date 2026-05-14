import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
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

        const res = await apiRequest('/ai-budget-suggestions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                income: formatVnd(income),
                expenses: formatVnd(expenses),
                currentBudgets: budgetsStr
            })
        });
        setAiSuggestions(res.suggestions || []);
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
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Tạo ngân sách</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.dark} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home-outline" size={22} color={COLORS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* SUGGESTIONS */}
        <View style={s.suggestBox}>
            <View style={s.suggestHeader}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                <Text style={s.suggestHeaderText}>FinancialManagement đề xuất</Text>
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
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  iconBtn: { padding: 4 },
  divider: { width: 1, height: 16, backgroundColor: COLORS.border, marginHorizontal: 4 },
  
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
