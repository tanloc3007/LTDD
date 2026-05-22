import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../constants/api';

function getScoreColor(score) {
  if (score >= 750) return '#2DCE89';
  if (score >= 600) return '#36B9CC';
  if (score >= 400) return '#FFC107';
  return '#F5365C';
}

function getScoreLevel(score) {
  if (score >= 750) return 'Xuat sac';
  if (score >= 600) return 'Tot';
  if (score >= 400) return 'Trung binh';
  return 'Kem';
}

function getScoreLevelText(level) {
  if (level === 'excellent') return 'Xuất sắc';
  if (level === 'good') return 'Tốt';
  if (level === 'average') return 'Trung bình';
  return 'Kém';
}

const DETAIL_CONFIG = [
  {
    key: 'saving_rate',
    label: 'Tỷ lệ tiết kiệm',
    icon: 'wallet-outline',
    maxScore: 200,
  },
  {
    key: 'budget_compliance',
    label: 'Tuân thủ ngân sách',
    icon: 'checkmark-circle-outline',
    maxScore: 200,
  },
  {
    key: 'has_saving_goals',
    label: 'Mục tiêu tiết kiệm',
    icon: 'flag-outline',
    maxScore: 150,
  },
  {
    key: 'balance_positive',
    label: 'Số dư dương',
    icon: 'trending-up-outline',
    maxScore: 200,
  },
  {
    key: 'consistency',
    label: 'Tham khảo 3 tháng',
    icon: 'bar-chart-outline',
    maxScore: 100,
  },
];

export default function HealthScoreScreen({ navigation }) {
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const animatedScore = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  const fetchHealthScore = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/ai/health-score', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res);
      animatedScore.setValue(0);
      Animated.timing(animatedScore, {
        toValue: res.score || 0,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    } catch (err) {
      setError(err.message || 'Khong the tai du lieu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthScore();
  }, [token]);

  useEffect(() => {
    const id = animatedScore.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    return () => animatedScore.removeListener(id);
  }, [animatedScore]);

  const score = data?.score || 0;
  const level = data?.level || 'poor';
  const details = data?.details || {};
  const tips = data?.tips || [];
  const scoreColor = getScoreColor(score);

  const circumference = 2 * Math.PI * 72;
  const strokeDash = score > 0 ? circumference * (1 - score / 850) : circumference;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sức Khỏe Tài Chính</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !data ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang phân tích...</Text>
        </View>
      ) : error && !data ? (
        <View style={styles.loadingBox}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.refreshBtn, { marginTop: 16 }]} onPress={fetchHealthScore}>
            <Text style={styles.refreshBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Score Circle */}
          <View style={styles.scoreSection}>
            <View style={[styles.scoreCircleOuter, { borderColor: `${scoreColor}30` }]}>
              <View style={[styles.scoreCircleInner, { borderColor: scoreColor, shadowColor: scoreColor }]}>
                <Text style={[styles.scoreNumber, { color: scoreColor }]}>{displayScore}</Text>
                <Text style={styles.scoreOutOf}>/ 850</Text>
                <View style={[styles.levelBadge, { backgroundColor: `${scoreColor}18` }]}>
                  <Text style={[styles.levelText, { color: scoreColor }]}>
                    {getScoreLevelText(level)}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.scoreDesc}>
              Điểm sức khỏe tài chính của bạn
            </Text>
          </View>

          {/* Score Range Legend */}
          <View style={styles.legendRow}>
            {[
              { label: 'Kém', color: '#F5365C', range: '<400' },
              { label: 'TB', color: '#FFC107', range: '400-600' },
              { label: 'Tốt', color: '#36B9CC', range: '600-750' },
              { label: 'Xuất sắc', color: '#2DCE89', range: '750+' },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendRange}>{item.range}</Text>
              </View>
            ))}
          </View>

          {/* Detail Cards */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Các chỉ số chi tiết</Text>
            {DETAIL_CONFIG.map((cfg) => {
              const val = details[cfg.key] || 0;
              const pct = Math.min(val / cfg.maxScore, 1);
              const cardColor = pct >= 0.75 ? '#2DCE89' : pct >= 0.5 ? '#36B9CC' : pct >= 0.25 ? '#FFC107' : '#F5365C';
              return (
                <View key={cfg.key} style={styles.detailCard}>
                  <View style={[styles.detailIcon, { backgroundColor: `${cardColor}15` }]}>
                    <Ionicons name={cfg.icon} size={20} color={cardColor} />
                  </View>
                  <View style={styles.detailBody}>
                    <View style={styles.detailTop}>
                      <Text style={styles.detailLabel}>{cfg.label}</Text>
                      <Text style={[styles.detailScore, { color: cardColor }]}>
                        {val} / {cfg.maxScore}
                      </Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(pct * 100)}%`, backgroundColor: cardColor },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* AI Tips */}
          {tips.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Lời khuyên từ AI</Text>
              {tips.map((tip, idx) => (
                <View key={idx} style={styles.tipCard}>
                  <View style={styles.tipIconWrap}>
                    <Ionicons name="bulb" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Refresh Button */}
          <TouchableOpacity
            style={[styles.refreshBtn, loading && { opacity: 0.7 }]}
            onPress={fetchHealthScore}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.refreshBtnText}>Làm mới</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
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
    scroll: { paddingBottom: 24 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
    loadingText: { fontSize: SIZES.md, color: COLORS.gray },
    errorText: { fontSize: SIZES.md, color: COLORS.danger, textAlign: 'center', lineHeight: 22 },

    // Score circle
    scoreSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 16 },
    scoreCircleOuter: {
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 12,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.md,
    },
    scoreCircleInner: {
      width: 172,
      height: 172,
      borderRadius: 86,
      borderWidth: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.white,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    scoreNumber: { fontSize: 48, fontWeight: FONTS.extraBold, lineHeight: 52 },
    scoreOutOf: { fontSize: SIZES.sm, color: COLORS.gray, fontWeight: FONTS.regular },
    levelBadge: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 3, borderRadius: 20 },
    levelText: { fontSize: SIZES.sm, fontWeight: FONTS.bold },
    scoreDesc: { marginTop: 12, fontSize: SIZES.sm, color: COLORS.gray, textAlign: 'center' },

    // Legend
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: COLORS.white,
      borderRadius: 16,
      padding: 12,
      ...SHADOWS.sm,
    },
    legendItem: { alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.dark },
    legendRange: { fontSize: 9, color: COLORS.gray },

    // Section
    sectionBlock: { marginHorizontal: 16, marginTop: 20 },
    sectionTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 12 },

    // Detail cards
    detailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      gap: 12,
      ...SHADOWS.sm,
    },
    detailIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    detailBody: { flex: 1 },
    detailTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    detailLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark },
    detailScore: { fontSize: SIZES.sm, fontWeight: FONTS.bold },
    progressBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },

    // Tip cards
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: COLORS.white,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      gap: 10,
      borderLeftWidth: 3,
      borderLeftColor: COLORS.primary,
      ...SHADOWS.sm,
    },
    tipIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: `${COLORS.primary}12`,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    tipText: { flex: 1, fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 20 },

    // Refresh button
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 20,
      height: 48,
      borderRadius: 24,
      backgroundColor: COLORS.primary,
      ...SHADOWS.md,
    },
    refreshBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: FONTS.bold },
  });
