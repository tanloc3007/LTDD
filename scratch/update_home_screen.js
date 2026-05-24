const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\nguyenduchieu\\Downloads\\LapTrinh\\Mobile\\cuoiky\\LTDD\\screens\\HomeScreen.js';

if (!fs.existsSync(filePath)) {
  console.log("ERROR: HomeScreen.js not found!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

const normalizeNewlines = (str) => str.replace(/\r\n/g, '\n');
let norm = normalizeNewlines(content);

// 1. Add health states
const targetStatesAnchor = `  const [showNotifModal, setShowNotifModal] = useState(false);`;
const addedStates = `  const [showNotifModal, setShowNotifModal] = useState(false);
  const [healthData, setHealthData] = useState({ score: 100, diagnosis: '' });
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [showHealthModal, setShowHealthModal] = useState(false);`;

norm = norm.replace(normalizeNewlines(targetStatesAnchor), normalizeNewlines(addedStates));

// 2. Update useFocusEffect to load notifications AND health status
const oldEffect = `  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;
      let mounted = true;
      apiRequest('/notifications', { headers: authHeaders })
        .then((res) => {
          if (mounted) setNotifications(res.notifications || []);
        })
        .catch(() => { });
      return () => { mounted = false; };
    }, [token])
  );`;

const newEffect = `  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;
      let mounted = true;

      // Fetch notifications
      apiRequest('/notifications', { headers: authHeaders })
        .then((res) => {
          if (mounted) setNotifications(res.notifications || []);
        })
        .catch(() => { });

      // Fetch health check
      setLoadingHealth(true);
      apiRequest('/ai-health-check', { method: 'POST', headers: authHeaders })
        .then((res) => {
          if (mounted && res) {
            setHealthData({ score: res.score, diagnosis: res.diagnosis });
          }
        })
        .catch((err) => {
          console.error('AI Health Check Fetch Error:', err);
        })
        .finally(() => {
          if (mounted) setLoadingHealth(false);
        });

      return () => { mounted = false; };
    }, [token, transactions])
  );`;

norm = norm.replace(normalizeNewlines(oldEffect), normalizeNewlines(newEffect));

// 3. Add Health Score Card between Quick Actions and AI Suggestion Card
const oldSectionInsertionAnchor = `        <View style={styles.section}>
          <View style={styles.tipCard}>`;

const newSectionInsertion = `        {/* HEALTH SCORE CARD */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.healthCard} 
            activeOpacity={0.8}
            onPress={() => setShowHealthModal(true)}
          >
            <View style={styles.healthLeft}>
              <View style={[styles.healthCircle, { borderColor: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger }]}>
                <Text style={[styles.healthScoreVal, { color: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger }]}>
                  {loadingHealth ? '...' : healthData.score}
                </Text>
                <Text style={styles.healthScoreMax}>/100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthTitle}>Sức khỏe tài chính</Text>
                <Text style={styles.healthStatus}>
                  Trạng thái: <Text style={[styles.healthStatusText, { color: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger }]}>
                    {healthData.score >= 80 ? 'Rất tốt' : healthData.score >= 50 ? 'Trung bình' : 'Cần cải thiện'}
                  </Text>
                </Text>
              </View>
            </View>
            <View style={styles.healthRight}>
              <Text style={styles.diagnosticLink}>Chẩn đoán AI</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.tipCard}>`;

norm = norm.replace(normalizeNewlines(oldSectionInsertionAnchor), normalizeNewlines(newSectionInsertion));

// 4. Add Fullscreen/BottomSheet Modal at the end of JSX
const oldModalEndAnchor = `      <AppBottomNav navigation={navigation} activeTab="home" />

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>`;

const newModalEnd = `      <AppBottomNav navigation={navigation} activeTab="home" />

      {/* ═══════════ HEALTH DIAGNOSIS MODAL ═══════════ */}
      <Modal visible={showHealthModal} animationType="slide" transparent onRequestClose={() => setShowHealthModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheetLg, { maxHeight: '90%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Chẩn đoán Tài chính AI</Text>
              <TouchableOpacity onPress={() => setShowHealthModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.diagScoreContainer}>
                <View style={[styles.diagCircle, { borderColor: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger }]}>
                  <Text style={[styles.diagScoreText, { color: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger }]}>
                    {healthData.score}
                  </Text>
                  <Text style={styles.diagScoreMax}>/ 100 điểm</Text>
                </View>
                <Text style={styles.diagRating}>
                  Đánh giá: <Text style={{ color: healthData.score >= 80 ? COLORS.success : healthData.score >= 50 ? COLORS.warning : COLORS.danger, fontWeight: FONTS.bold }}>
                    {healthData.score >= 80 ? 'Bền vững' : healthData.score >= 50 ? 'Cảnh báo nhẹ' : 'Mất cân đối'}
                  </Text>
                </Text>
              </View>

              <View style={styles.diagReportBox}>
                <View style={styles.diagReportHeader}>
                  <Ionicons name="medkit-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.diagReportTitle}>Chi tiết chẩn đoán từ AI</Text>
                </View>
                <Text style={styles.diagReportBody}>
                  {loadingHealth ? 'AI đang tổng hợp và phân tích dữ liệu...' : healthData.diagnosis || 'Không có dữ liệu chẩn đoán.'}
                </Text>
              </View>

              <TouchableOpacity style={styles.diagActionBtn} onPress={() => { setShowHealthModal(false); navigation.navigate('AIChat'); }}>
                <Ionicons name="chatbubbles-outline" size={20} color="#FFF" />
                <Text style={styles.diagActionText}>Hỏi ý kiến Trợ lý AI</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>`;

norm = norm.replace(normalizeNewlines(oldModalEndAnchor), normalizeNewlines(newModalEnd));

// 5. Add Styles inside getStyles generator
const oldStylesHeaderAnchor = `  safeArea: { flex: 1, backgroundColor: COLORS.bg },`;
const addedStyles = `  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  healthCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.sm,
  },
  healthLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  healthCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreVal: { fontSize: SIZES.md, fontWeight: FONTS.bold },
  healthScoreMax: { fontSize: 8, color: COLORS.gray, marginTop: -2 },
  healthTitle: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark },
  healthStatus: { fontSize: SIZES.xs, color: COLORS.gray, marginTop: 2 },
  healthStatusText: { fontWeight: FONTS.bold },
  healthRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  diagnosticLink: { fontSize: SIZES.xs, color: COLORS.primary, fontWeight: FONTS.semiBold },

  // Diagnosis Modal
  diagScoreContainer: { alignItems: 'center', marginVertical: 20 },
  diagCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  diagScoreText: { fontSize: SIZES.xxl, fontWeight: FONTS.extraBold },
  diagScoreMax: { fontSize: SIZES.xs, color: COLORS.gray },
  diagRating: { fontSize: SIZES.base, color: COLORS.dark },
  diagReportBox: {
    backgroundColor: \`\${COLORS.primary}05\`,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: \`\${COLORS.primary}15\`,
    marginBottom: 20,
  },
  diagReportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  diagReportTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
  diagReportBody: { fontSize: SIZES.sm, color: COLORS.dark, lineHeight: 22 },
  diagActionBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.md,
  },
  diagActionText: { color: '#FFF', fontSize: SIZES.base, fontWeight: FONTS.bold },`;

norm = norm.replace(normalizeNewlines(oldStylesHeaderAnchor), normalizeNewlines(addedStyles));

// Restore CRLF line endings for Windows
const finalResult = norm.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalResult, 'utf8');
console.log("SUCCESS: Added AI Health score and diagnosis to HomeScreen.js");
