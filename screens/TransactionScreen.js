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
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  getCategory,
  parseTransactionDate,
  useFinance,
} from '../contexts/FinanceContext';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../constants/api';
import AppBottomNav from '../components/AppBottomNav';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export default function TransactionScreen({ navigation }) {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const { token } = useAuth();
  const { colors: COLORS, formatCurrency, currency } = useSettings();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;
      let mounted = true;
      apiRequest('/notifications', { headers: authHeaders })
        .then((res) => {
          if (mounted) setNotifications(res.notifications || []);
        })
        .catch(() => {});
      return () => { mounted = false; };
    }, [token])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST', headers: authHeaders });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) {}
  };

  const pushNotif = async (message, type = 'other') => {
    if (!token) return;
    try {
      const res = await apiRequest('/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message, type }),
      });
      setNotifications((prev) => [res.notification, ...prev]);
    } catch (_) {}
  };
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Quyền truy cập bị từ chối', 'Bạn cần cấp quyền truy cập micro để sử dụng tính năng này.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm: ' + err.message);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Lỗi', 'Không tìm thấy tệp ghi âm.');
        return;
      }

      setSaving(true);
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await apiRequest('/ai-voice-chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ audioBase64 })
      });

      if (res && res.data) {
        const { amount: parsedAmount, category: parsedCategory, note: parsedNote, date: parsedDate, type: parsedType } = res.data;
        
        if (parsedAmount) setAmount(String(parsedAmount));
        if (parsedCategory) setCategory(parsedCategory);
        if (parsedNote) setNote(parsedNote);
        if (parsedType) setType(parsedType);
        
        if (parsedDate) {
          const parts = parsedDate.split('/');
          if (parts.length === 3) {
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            if (!isNaN(d.getTime())) {
              setSelectedDate(d);
            }
          }
        }
        Alert.alert(
          'Nhận diện thành công',
          'Câu nói: "' + res.text + '"\n\nĐã tự động điền các trường thông tin!'
        );
      } else {
        Alert.alert('Thất bại', 'Không thể phân tích dữ liệu giọng nói.');
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Lỗi', 'Có lỗi khi xử lý âm thanh: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleScanReceipt = async () => {
    Alert.alert(
      'Quét hóa đơn bằng AI',
      'Chọn phương thức để quét hóa đơn',
      [
        { text: 'Chụp ảnh mới', onPress: () => triggerImagePicker(true) },
        { text: 'Chọn từ thư viện', onPress: () => triggerImagePicker(false) },
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  };

  const triggerImagePicker = async (useCamera) => {
    try {
      let permissionResult;
      if (useCamera) {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (permissionResult.granted === false) {
        Alert.alert('Quyền truy cập bị từ chối', 'Bạn cần cấp quyền truy cập để sử dụng tính năng này.');
        return;
      }

      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const base64Data = asset.base64;
      const mimeType = asset.mimeType || 'image/jpeg';

      setSaving(true);
      
      const res = await apiRequest('/ai-scan-receipt', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          image: base64Data,
          mimeType: mimeType
        })
      });

      if (res && res.data) {
        const { amount: parsedAmount, category: parsedCategory, note: parsedNote, date: parsedDate, type: parsedType } = res.data;
        if (parsedAmount) setAmount(String(parsedAmount));
        if (parsedCategory) setCategory(parsedCategory);
        if (parsedNote) setNote(parsedNote);
        if (parsedType) setType(parsedType);
        if (parsedDate) {
          const parts = parsedDate.split('/');
          if (parts.length === 3) {
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            if (!isNaN(d.getTime())) {
              setSelectedDate(d);
            }
          }
        }
        Alert.alert('Thành công', 'Đã phân tích hóa đơn! Hãy kiểm tra lại thông tin và bấm Lưu.');
      } else {
        Alert.alert('Thất bại', 'Không thể nhận diện dữ liệu hóa đơn.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể quét hóa đơn: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

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
    // Allow decimals for USD input, otherwise restrict to digits
    const rawNum = Number(String(amount).replace(currency === 'USD' ? /[^0-9.]/g : /[^0-9]/g, ''));
    if (!rawNum) {
      Alert.alert('Thiếu số tiền', 'Vui lòng nhập số tiền giao dịch.');
      return;
    }

    // Convert the input to base unit (VND) if currency is USD
    const cleanAmount = Math.round(currency === 'USD' ? rawNum * 25000 : rawNum);

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
        const catLabel = getCategory(category).label;
        await pushNotif(`✏️ Đã sửa giao dịch: ${payload.type === 'income' ? 'Thu nhập' : 'Chi tiêu'} ${formatCurrency(payload.amount)} - ${catLabel} (${payload.date})`, payload.type);
        Alert.alert('Đã cập nhật', 'Giao dịch đã được cập nhật.');
      } else {
        await addTransaction(payload);
        const catLabel = getCategory(category).label;
        await pushNotif(`${payload.type === 'income' ? '⬇️ Thu nhập' : '⬆️ Chi tiêu'}: ${formatCurrency(payload.amount)} - ${catLabel}${payload.note ? ' (' + payload.note + ')' : ''} vào ${payload.date}`, payload.type);
        Alert.alert('Đã lưu', 'Giao dịch mới đã được thêm.');
      }
      resetForm();
    } catch (error) {
      Alert.alert('Không thể lưu', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setType(item.type);
    // If USD is the active currency, display the converted amount for editing
    const displayAmt = currency === 'USD' ? String((Number(item.amount) / 25000).toFixed(2)) : String(item.amount);
    setAmount(displayAmt);
    setCategory(item.category);
    setNote(item.note || '');
    setSelectedDate(parseTransactionDate(item.date) || new Date());
    setShowDatePicker(false);
  };

  const handleDelete = (id, note, txType, txCategory) => {
    Alert.alert('Xóa giao dịch', 'Bạn có chắc muốn xóa giao dịch này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id);
            const catLabel = getCategory(txCategory).label;
            await pushNotif(`🗑️ Đã xoá giao dịch: ${txType === 'income' ? 'Thu nhập' : 'Chi tiêu'} - ${catLabel}${note ? ' (' + note + ')' : ''}`, txType);
          } catch (error) {
            Alert.alert('Không thể xóa', error.message);
          }
        },
      },
    ]);
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
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.replace('Home', { tabTransitionDirection: -1 })}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{editingId ? 'Sửa giao dịch' : 'Thêm giao dịch'}</Text>
        <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifModal(true)}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.dark} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.aiActionRow}>
          <TouchableOpacity style={styles.scanReceiptCard} onPress={handleScanReceipt} activeOpacity={0.8}>
            <Ionicons name="scan-outline" size={18} color="#8B5CF6" />
            <Text style={styles.scanReceiptText}>Quét hóa đơn AI</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.voiceActionCard, isRecording && styles.voiceActionCardRecording]} 
            onPress={isRecording ? handleStopRecording : handleStartRecording} 
            activeOpacity={0.8}
          >
            <Ionicons name={isRecording ? "stop-circle" : "mic-outline"} size={18} color={isRecording ? COLORS.danger : "#06B6D4"} />
            <Text style={[styles.voiceActionText, isRecording && { color: COLORS.danger }]}>
              {isRecording ? "Đang thu..." : "Nhập giọng nói"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'expense' && styles.segmentActive]}
            onPress={() => selectType('expense')}
          >
            <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextExpense]}>Chi tiêu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'income' && styles.segmentActive]}
            onPress={() => selectType('income')}
          >
            <Text style={[styles.segmentText, type === 'income' && styles.segmentTextIncome]}>Thu nhập</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Số tiền ({currency === 'USD' ? '$' : 'đ'})</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType={currency === 'USD' ? 'decimal-pad' : 'numeric'}
            placeholder={currency === 'USD' ? '$0' : '0 đ'}
            placeholderTextColor={accentColor}
            style={[styles.amountInput, { color: accentColor }]}
          />
          <View style={styles.amountLine} />
        </View>

        <Text style={styles.sectionTitle}>Danh mục</Text>
        <View style={styles.categoryGrid}>
          {visibleCategories.map((item) => {
            const active = category === item.id;
            return (
              <TouchableOpacity key={item.id} style={styles.categoryItem} onPress={() => setCategory(item.id)}>
                <View style={[styles.categoryIcon, active && { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={22} color={active ? '#FFF' : item.color} />
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
            placeholder="Thêm ghi chú..."
            placeholderTextColor={COLORS.lightGray}
            style={styles.noteInput}
            multiline
          />
        </View>

        <View style={styles.managementHeader}>
          <Text style={styles.sectionTitle}>Quản lý giao dịch</Text>
          {editingId && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelEdit}>Hủy sửa</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.transactionList}>
          {transactions.map((item) => (
            <TransactionRow
              key={item.id}
              item={item}
              COLORS={COLORS}
              styles={styles}
              formatCurrency={formatCurrency}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item.id, item.note, item.type, item.category)}
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
            {saving ? 'Đang lưu...' : editingId ? 'Cập nhật giao dịch' : 'Lưu giao dịch'}
          </Text>
        </TouchableOpacity>
      </View>

      <AppBottomNav navigation={navigation} activeTab="history" position="absolute" />

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheetLg}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thông báo</Text>
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
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyText}>Chưa có thông báo nào.</Text>
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
                    <View style={[styles.notifItem, !item.read && styles.notifUnread]}>
                      <View style={[styles.notifIcon, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={iconName} size={18} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifMsg}>{item.message}</Text>
                        <Text style={styles.notifTime}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                        </Text>
                      </View>
                      {!item.read && <View style={styles.unreadDot} />}
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

function TransactionRow({ item, onEdit, onDelete, COLORS, styles, formatCurrency }) {
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
        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
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

  return `${isToday ? 'Hôm nay, ' : ''}${formatDateForStorage(date)}`;
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  aiActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  scanReceiptCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C084FC',
    paddingVertical: 12,
    gap: 6,
    ...SHADOWS.sm,
  },
  scanReceiptText: {
    color: '#6B21A8',
    fontSize: SIZES.sm,
    fontWeight: FONTS.bold,
  },
  voiceActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingVertical: 12,
    gap: 6,
    ...SHADOWS.sm,
  },
  voiceActionCardRecording: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  voiceActionText: {
    color: '#0891B2',
    fontSize: SIZES.sm,
    fontWeight: FONTS.bold,
  },
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
  notifBtn: { position: 'relative', padding: 4, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: FONTS.bold },
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
  saveText: { color: '#FFF', fontSize: SIZES.base, fontWeight: FONTS.bold },
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

  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetLg: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: COLORS.gray, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifUnread: { backgroundColor: `${COLORS.primary}05`, borderRadius: 12, paddingHorizontal: 8 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifMsg: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 18, flex: 1 },
  notifTime: { fontSize: SIZES.xs, color: COLORS.lightGray, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
});
