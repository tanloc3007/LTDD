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

// 1. Update imports to include Audio and FileSystem
const oldImport = `import * as ImagePicker from 'expo-image-picker';`;
const newImport = `import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';`;

norm = norm.replace(normalizeNewlines(oldImport), normalizeNewlines(newImport));

// 2. Add recording states and handlers inside TransactionScreen
const targetStateAnchor = `  const [saving, setSaving] = useState(false);`;
const addedStatesAndHandlers = `  const [saving, setSaving] = useState(false);
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
          'Câu nói: "' + res.text + '"\\n\\nĐã tự động điền các trường thông tin!'
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
  };`;

norm = norm.replace(normalizeNewlines(targetStateAnchor), normalizeNewlines(addedStatesAndHandlers));

// 3. Replace the single Quét hóa đơn card in ScrollView with the new aiActionRow
const oldBtnJSX = `        <TouchableOpacity style={styles.scanReceiptCard} onPress={handleScanReceipt} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={20} color="#8B5CF6" />
          <Text style={styles.scanReceiptText}>Quét hóa đơn tự động bằng AI</Text>
        </TouchableOpacity>`;

const newBtnJSX = `        <View style={styles.aiActionRow}>
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
        </View>`;

norm = norm.replace(normalizeNewlines(oldBtnJSX), normalizeNewlines(newBtnJSX));

// 4. Update Styles
const oldStyles = `  scanReceiptCard: {
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

const newStyles = `  aiActionRow: {
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
  },`;

norm = norm.replace(normalizeNewlines(oldStyles), normalizeNewlines(newStyles));

// Restore CRLF line endings for Windows
const finalResult = norm.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalResult, 'utf8');
console.log("SUCCESS: Integrated AI Voice Assistant in TransactionScreen.js");
