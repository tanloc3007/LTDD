const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\nguyenduchieu\\Downloads\\LapTrinh\\Mobile\\cuoiky\\LTDD\\screens\\TransactionScreen.js';

if (!fs.existsSync(filePath)) {
  console.log("ERROR: TransactionScreen.js not found!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

const normalizeNewlines = (str) => str.replace(/\r\n/g, '\n');
let norm = normalizeNewlines(content);

// 1. Add ImagePicker import
const targetImportAnchor = `import AppBottomNav from '../components/AppBottomNav';`;
const newImport = `import AppBottomNav from '../components/AppBottomNav';
import * as ImagePicker from 'expo-image-picker';`;

norm = norm.replace(normalizeNewlines(targetImportAnchor), normalizeNewlines(newImport));

// 2. Add Scan functions inside TransactionScreen component
const targetStatesAnchor = `  const [saving, setSaving] = useState(false);`;
const addedFunctions = `  const [saving, setSaving] = useState(false);

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
  };`;

norm = norm.replace(normalizeNewlines(targetStatesAnchor), normalizeNewlines(addedFunctions));

// 3. Add Scan receipt button inside ScrollView
const targetScrollViewAnchor = `      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>`;

const newScrollViewStart = `      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.scanReceiptCard} onPress={handleScanReceipt} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={20} color="#8B5CF6" />
          <Text style={styles.scanReceiptText}>Quét hóa đơn tự động bằng AI</Text>
        </TouchableOpacity>

        <View style={styles.segment}>`;

norm = norm.replace(normalizeNewlines(targetScrollViewAnchor), normalizeNewlines(newScrollViewStart));

// 4. Add Styles
const targetStyleAnchor = `  safeArea: { flex: 1, backgroundColor: COLORS.bg },`;
const addedStyles = `  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  scanReceiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C084FC',
    paddingVertical: 12,
    gap: 8,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  scanReceiptText: {
    color: '#6B21A8',
    fontSize: SIZES.md,
    fontWeight: FONTS.bold,
  },`;

norm = norm.replace(normalizeNewlines(targetStyleAnchor), normalizeNewlines(addedStyles));

// Restore CRLF line endings for Windows
const finalResult = norm.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalResult, 'utf8');
console.log("SUCCESS: Added AI scan receipt to TransactionScreen.js");
