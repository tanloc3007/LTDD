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
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const ICONS = [
  'apps', 'cart', 'car', 'restaurant', 'play-circle', 'receipt', 'book', 'brush', 
  'body', 'home', 'heart', 'wallet', 'gift', 'medical', 'airplane', 'subway',
  'bicycle', 'bus', 'fast-food', 'beer', 'cafe', 'wine', 'shirt', 'watch'
];

const COLORS_LIST = [
  '#FF4FB8', '#FF6B35', '#FF9500', '#FF8A00', '#2DCE89', '#11CDEF', '#178BFF', 
  '#9C27B0', '#7E57C2', '#F5365C', '#FB6340', '#8892A4', '#5E72E4', '#2D3436'
];

export default function AddCategoryScreen({ navigation }) {
  const { token } = useAuth();
  const { colors: COLORS } = useSettings();
  const s = useMemo(() => getStyles(COLORS), [COLORS]);

  const [label, setLabel] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('apps');
  const [selectedColor, setSelectedColor] = useState('#FF4FB8');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên danh mục.');
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      await apiRequest('/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: label.trim(),
          icon: selectedIcon,
          color: selectedColor,
        }),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo danh mục.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Thêm danh mục mới</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* PREVIEW */}
        <View style={s.previewCard}>
          <View style={[s.iconWrap, { backgroundColor: `${selectedColor}15` }]}>
            <Ionicons name={selectedIcon} size={40} color={selectedColor} />
          </View>
          <Text style={[s.previewText, { color: selectedColor }]}>
            {label.trim() || 'Tên danh mục'}
          </Text>
        </View>

        {/* INPUT */}
        <View style={s.inputSection}>
          <Text style={s.sectionLabel}>Tên danh mục</Text>
          <TextInput
            style={s.input}
            placeholder="Ví dụ: Ăn vặt, Gym, Nuôi thú cưng..."
            value={label}
            onChangeText={setLabel}
            maxLength={20}
          />
        </View>

        {/* ICON PICKER */}
        <Text style={s.sectionLabel}>Chọn biểu tượng</Text>
        <View style={s.grid}>
          {ICONS.map((icon) => (
            <TouchableOpacity 
              key={icon} 
              style={[s.gridItem, selectedIcon === icon && s.selectedItem]} 
              onPress={() => setSelectedIcon(icon)}
            >
              <Ionicons 
                name={icon} 
                size={24} 
                color={selectedIcon === icon ? COLORS.primary : COLORS.gray} 
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* COLOR PICKER */}
        <Text style={s.sectionLabel}>Chọn màu sắc</Text>
        <View style={s.colorGrid}>
          {COLORS_LIST.map((color) => (
            <TouchableOpacity 
              key={color} 
              style={[s.colorItem, { backgroundColor: color }, selectedColor === color && s.selectedColor]} 
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor === color && <Ionicons name="checkmark" size={20} color="#FFF" />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FOOTER */}
      <View style={s.footer}>
        <TouchableOpacity 
          style={[s.mainBtn, loading && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={s.mainBtnText}>Lưu danh mục</Text>
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
    ...SHADOWS.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  
  scroll: { padding: 16 },
  
  previewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...SHADOWS.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewText: { fontSize: SIZES.lg, fontWeight: FONTS.bold },
  
  inputSection: { marginBottom: 24 },
  sectionLabel: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: SIZES.base,
    color: COLORS.dark,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  gridItem: {
    width: (Dimensions?.get('window')?.width - 32 - 48) / 5,
    aspectRatio: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedItem: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}05` },
  
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: { borderWidth: 3, borderColor: '#FFF', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  
  footer: {
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
    ...SHADOWS.md,
  },
  mainBtnText: { color: '#FFF', fontSize: SIZES.base, fontWeight: FONTS.bold },
});
