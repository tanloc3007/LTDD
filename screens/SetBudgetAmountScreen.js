import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../constants/api';

const { width } = Dimensions.get('window');

function currentMonthKey() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export default function SetBudgetAmountScreen({ navigation, route }) {
  const { category, initialAmount } = route.params;
  const { token } = useAuth();
  const { colors: COLORS, formatCurrency } = useSettings();
  const s = useMemo(() => getStyles(COLORS), [COLORS]);

  const [amount, setAmount] = useState(initialAmount || '0');
  const [loading, setLoading] = useState(false);

  const handleAmountChange = (val) => {
    const numericValue = val.replace(/\D/g, '');
    setAmount(numericValue);
  };

  const handleSave = async () => {
    if (!token) return;
    const amt = Number(amount);
    if (amt <= 0) {
        Alert.alert('Thông báo', 'Vui lòng nhập số tiền ngân sách.');
        return;
    }

    setLoading(true);
    try {
      await apiRequest('/budgets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoryId: category.id,
          label: category.label,
          icon: category.icon,
          color: category.color,
          budgetAmount: amt,
          month: currentMonthKey(),
        }),
      });
      
      navigation.navigate('Budget', { refresh: true });
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo ngân sách.');
    } finally {
      setLoading(false);
    }
  };

  // Mock chart data
  const chartData = {
    labels: ['12', '1/26', '2', '3', '4', '5'],
    datasets: [
      {
        data: [0, 10, 0, 0, 0, 80],
        color: (opacity = 1) => `rgba(233, 30, 140, ${opacity})`,
        strokeWidth: 2,
      },
    ],
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
        {/* CATEGORY INFO & INPUT */}
        <View style={s.inputCard}>
            <View style={s.catRow}>
                <View style={[s.catIconWrap, { backgroundColor: `${category.color}15` }]}>
                    <Ionicons name={category.icon} size={30} color={category.color} />
                </View>
                <View>
                    <Text style={s.labelSmall}>Danh mục</Text>
                    <Text style={s.catName}>{category.label}</Text>
                </View>
            </View>

            <View style={s.inputBox}>
                <Text style={s.inputLabel}>Ngân sách chi tiêu trong tháng*</Text>
                <View style={s.inputWrapper}>
                    <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={Number(amount).toLocaleString('vi-VN') + 'đ'}
                        onChangeText={handleAmountChange}
                        onFocus={() => { if(amount === '0') setAmount('') }}
                    />
                </View>
            </View>
        </View>

        {/* STATS SECTION */}
        <View style={s.statsHeader}>
            <Ionicons name="bulb-outline" size={20} color={COLORS.dark} />
            <Text style={s.statsTitle}>Tham khảo thống kê chi tiêu của bạn</Text>
        </View>

        <View style={s.chartCard}>
            <View style={s.chartHeader}>
                <View style={s.amountBadge}><Text style={s.amountBadgeText}>0đ</Text></View>
            </View>
            
            <LineChart
                data={chartData}
                width={width - 64}
                height={180}
                chartConfig={{
                    backgroundColor: '#fff',
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(136, 146, 164, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(136, 146, 164, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: {
                        r: '4',
                        strokeWidth: '2',
                        stroke: COLORS.primary,
                    },
                    propsForBackgroundLines: {
                        strokeDasharray: '', // solid background lines
                        stroke: '#f0f0f0',
                    },
                }}
                bezier
                style={s.chart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={true}
                fromZero
            />

            <View style={s.chartFooter}>
                <Text style={s.chartLegend}>-- Trung bình 5 tháng gần nhất, chỉ tính tháng có chi tiêu</Text>
                <Text style={s.chartDesc}>Xu hướng chi tiêu {category.label} 6 tháng gần đây</Text>
            </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={s.footer}>
          <TouchableOpacity 
            style={[s.mainBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
          >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={s.mainBtnText}>Tạo ngân sách</Text>
              )}
          </TouchableOpacity>
      </View>
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

  inputCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.sm,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  catIconWrap: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  labelSmall: { fontSize: SIZES.sm, color: COLORS.gray },
  catName: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  
  inputBox: { 
      borderWidth: 1, 
      borderColor: COLORS.border, 
      borderRadius: 16, 
      padding: 12,
      backgroundColor: COLORS.bg,
  },
  inputLabel: { fontSize: SIZES.sm, color: COLORS.gray, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center' },
  input: { fontSize: 24, fontWeight: FONTS.extraBold, color: COLORS.dark, flex: 1 },

  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statsTitle: { fontSize: SIZES.base, fontWeight: FONTS.semiBold, color: COLORS.dark },

  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.sm,
    alignItems: 'center',
  },
  chartHeader: { width: '100%', alignItems: 'flex-end', marginBottom: 8 },
  amountBadge: { backgroundColor: `${COLORS.primary}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  amountBadgeText: { fontSize: SIZES.xs, fontWeight: FONTS.bold, color: COLORS.primary },
  chart: { marginVertical: 8, borderRadius: 16, paddingRight: 40 },
  
  chartFooter: { marginTop: 12, alignItems: 'center' },
  chartLegend: { fontSize: SIZES.xs, color: COLORS.gray, textAlign: 'center' },
  chartDesc: { fontSize: SIZES.sm, color: COLORS.dark, marginTop: 8, textAlign: 'center', fontWeight: FONTS.medium },

  footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
  },
  mainBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
  },
  mainBtnText: { color: COLORS.white, fontSize: SIZES.base, fontWeight: FONTS.bold },
});
