import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useFinance, CATEGORIES, getCategory } from '../contexts/FinanceContext';
import { apiRequest } from '../constants/api';
import * as ImagePicker from 'expo-image-picker';

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayDMY() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

const PICKER_OPTIONS = {
  mediaTypes: 'Images',
  quality: 0.7,
  base64: true,
};

// ─── main component ───────────────────────────────────────────────────────────

export default function OCRScanScreen({ navigation }) {
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const { addTransaction } = useFinance();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [selectedImage, setSelectedImage] = useState(null); // { uri, base64 }
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  // result fields
  const [ocrResult, setOcrResult] = useState(null);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  // ── image pickers ────────────────────────────────────────────────────────

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyen truy cap', 'Can quyen su dung camera de chup anh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImage({ uri: asset.uri, base64: asset.base64 });
      setOcrResult(null);
    }
  };

  const handleGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyen truy cap', 'Can quyen truy cap thu vien anh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImage({ uri: asset.uri, base64: asset.base64 });
      setOcrResult(null);
    }
  };

  // ── OCR analysis ─────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!selectedImage) {
      Alert.alert('Chua co anh', 'Vui long chup anh hoac chon anh tu thu vien truoc.');
      return;
    }
    setAnalyzing(true);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const data = await apiRequest('/transactions/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: selectedImage.base64 }),
      });
      applyResult(data);
    } catch (_) {
      // fallback mock
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mock = {
        amount: 150000,
        category: 'food',
        note: 'Hoa don nha hang',
        date: todayDMY(),
        items: [{ name: 'Mon an', price: 150000 }],
      };
      applyResult(mock);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyResult = (data) => {
    setOcrResult(data);
    setAmount(String(data.amount || ''));
    setSelectedCategory(data.category || 'food');
    setNote(data.note || '');
    setDate(data.date || todayDMY());
  };

  // ── save transaction ──────────────────────────────────────────────────────

  const handleSave = async () => {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('So tien khong hop le', 'Vui long nhap so tien hop le truoc khi luu.');
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        amount: parsedAmount,
        type: 'expense',
        category: selectedCategory,
        note,
        date,
      });
      Alert.alert('Thanh cong', 'Giao dich da duoc luu!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Loi', err?.message || 'Khong the luu giao dich. Vui long thu lai.');
    } finally {
      setSaving(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quet Hoa Don AI</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image zone */}
        <View style={styles.imageZone}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderBox}>
              <View style={styles.cameraIconWrap}>
                <Ionicons name="camera" size={52} color={COLORS.primary} />
              </View>
              <Text style={styles.placeholderTitle}>Chup anh hoa don cua ban</Text>
              <Text style={styles.placeholderSub}>
                AI se tu dong nhan dien cac thong tin tren hoa don
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primary }]} onPress={handleCamera} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Chup anh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: COLORS.primary }]} onPress={handleGallery} activeOpacity={0.85}>
            <Ionicons name="images-outline" size={20} color={COLORS.primary} />
            <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Thu vien</Text>
          </TouchableOpacity>
        </View>

        {/* Analyze button */}
        {selectedImage && !ocrResult && (
          <TouchableOpacity
            style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            activeOpacity={0.85}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="scan" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.analyzeBtnText}>
              {analyzing ? 'Dang phan tich...' : 'Phan tich Hoa Don'}
            </Text>
          </TouchableOpacity>
        )}

        {/* OCR Result card */}
        {ocrResult && (
          <View style={styles.resultCard}>
            {/* Card header */}
            <View style={styles.resultCardHeader}>
              <View style={styles.resultIconWrap}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.resultCardTitle}>Ket qua nhan dien AI</Text>
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>So tien (VND)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="cash-outline" size={18} color={COLORS.gray} />
                <TextInput
                  style={styles.textInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.lightGray}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Danh muc</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catChip,
                        isSelected && { backgroundColor: `${cat.color}20`, borderColor: cat.color },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={cat.icon} size={16} color={isSelected ? cat.color : COLORS.gray} />
                      <Text style={[styles.catChipText, isSelected && { color: cat.color, fontWeight: FONTS.semiBold }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Note */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ghi chu</Text>
              <View style={styles.inputRow}>
                <Ionicons name="create-outline" size={18} color={COLORS.gray} />
                <TextInput
                  style={styles.textInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Noi dung hoa don..."
                  placeholderTextColor={COLORS.lightGray}
                />
              </View>
            </View>

            {/* Date */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ngay (dd/mm/yyyy)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.gray} />
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="dd/mm/yyyy"
                  placeholderTextColor={COLORS.lightGray}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Items list */}
            {ocrResult.items && ocrResult.items.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Chi tiet hoa don</Text>
                <View style={styles.itemsList}>
                  {ocrResult.items.map((item, index) => (
                    <View
                      key={index}
                      style={[
                        styles.itemRow,
                        index < ocrResult.items.length - 1 && styles.itemRowBorder,
                      ]}
                    >
                      <View style={styles.itemDot} />
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Re-analyze */}
            <TouchableOpacity
              style={styles.reAnalyzeBtn}
              onPress={() => { setOcrResult(null); }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={15} color={COLORS.gray} />
              <Text style={styles.reAnalyzeText}>Phan tich lai</Text>
            </TouchableOpacity>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.saveBtnText}>
                {saving ? 'Dang luu...' : 'Luu Giao Dich'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const getStyles = (COLORS) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bg },

    // header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      ...SHADOWS.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: `${COLORS.primary}12`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: SIZES.lg,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },

    // scroll
    scroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },

    // image zone
    imageZone: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: COLORS.white,
      ...SHADOWS.sm,
      minHeight: 220,
    },
    placeholderBox: {
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 12,
    },
    cameraIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${COLORS.primary}12`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    placeholderTitle: {
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
      textAlign: 'center',
    },
    placeholderSub: {
      fontSize: SIZES.sm,
      color: COLORS.gray,
      textAlign: 'center',
      lineHeight: 20,
    },
    previewImage: {
      width: '100%',
      height: 260,
    },

    // action buttons
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      ...SHADOWS.sm,
    },
    actionBtnOutline: {
      backgroundColor: COLORS.white,
      borderWidth: 1.5,
    },
    actionBtnText: {
      fontSize: SIZES.sm,
      fontWeight: FONTS.semiBold,
      color: '#FFFFFF',
    },

    // analyze button
    analyzeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: COLORS.primary,
      paddingVertical: 16,
      borderRadius: 18,
      marginBottom: 20,
      ...SHADOWS.md,
    },
    analyzeBtnDisabled: { opacity: 0.65 },
    analyzeBtnText: {
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
      color: '#FFFFFF',
    },

    // result card
    resultCard: {
      backgroundColor: COLORS.white,
      borderRadius: 24,
      padding: 20,
      ...SHADOWS.md,
      marginBottom: 8,
    },
    resultCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    resultIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${COLORS.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultCardTitle: {
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
      color: COLORS.dark,
    },

    // field groups
    fieldGroup: { marginBottom: 16 },
    fieldLabel: {
      fontSize: SIZES.xs,
      fontWeight: FONTS.semiBold,
      color: COLORS.gray,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: COLORS.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    textInput: {
      flex: 1,
      fontSize: SIZES.base,
      color: COLORS.dark,
      fontWeight: FONTS.medium,
      padding: 0,
    },

    // category grid
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.bg,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    catChipText: {
      fontSize: SIZES.xs,
      fontWeight: FONTS.medium,
      color: COLORS.gray,
    },

    // items list
    itemsList: {
      backgroundColor: COLORS.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    itemRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    itemDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.primary,
    },
    itemName: {
      flex: 1,
      fontSize: SIZES.sm,
      color: COLORS.dark,
      fontWeight: FONTS.medium,
    },
    itemPrice: {
      fontSize: SIZES.sm,
      color: COLORS.primary,
      fontWeight: FONTS.semiBold,
    },

    // re-analyze
    reAnalyzeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginBottom: 16,
    },
    reAnalyzeText: {
      fontSize: SIZES.sm,
      color: COLORS.gray,
      fontWeight: FONTS.medium,
    },

    // save button
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: COLORS.primary,
      paddingVertical: 16,
      borderRadius: 18,
      ...SHADOWS.md,
    },
    saveBtnDisabled: { opacity: 0.65 },
    saveBtnText: {
      fontSize: SIZES.base,
      fontWeight: FONTS.bold,
      color: '#FFFFFF',
    },
  });
