import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, INCOME_CATEGORIES, formatVnd, getCategory, useFinance } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function formatToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function parseDateFromText(text) {
  const normalized = normalizeText(text);
  if (normalized.includes('hom qua')) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  const match = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return formatToday();

  const year = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : new Date().getFullYear();
  return `${String(Number(match[1])).padStart(2, '0')}/${String(Number(match[2])).padStart(2, '0')}/${year}`;
}

function parseAmountFromText(text) {
  const normalized = normalizeText(text).replace(/\s+/g, ' ');
  const compactMatches = [...normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|nghin|ngan|k|vnd|d)?\b/g)];
  const candidates = compactMatches
    .filter((match) => !normalized.slice(Math.max(0, match.index - 1), match.index + match[0].length + 1).includes('/'))
    .map((match) => {
      const unit = match[2] || '';
      const raw = match[1];
      let value = Number(raw.replace(',', '.'));
      if (!unit && /[.,]/.test(raw)) {
        value = Number(raw.replace(/[.,]/g, ''));
      }
      if (['trieu', 'tr', 'm'].includes(unit)) value *= 1000000;
      if (['nghin', 'ngan', 'k'].includes(unit)) value *= 1000;
      return Math.round(value);
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates.length ? candidates[candidates.length - 1] : 0;
}

function inferTransactionType(text) {
  const normalized = normalizeText(text);
  if (/(thu nhap|luong|thuong|lai tiet kiem|qua tang|nhan tien|duoc tien)/.test(normalized)) {
    return 'income';
  }
  return 'expense';
}

function inferCategory(text, type) {
  const normalized = normalizeText(text);
  const options = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
  const aliases = {
    food: ['an uong', 'an', 'uong', 'cafe', 'ca phe', 'com', 'tra sua', 'do an'],
    transport: ['di chuyen', 'xe', 'xang', 'grab', 'taxi', 'bus', 'gui xe'],
    shopping: ['mua sam', 'shopping', 'quan ao', 'giay', 'sieu thi'],
    health: ['suc khoe', 'thuoc', 'benh vien', 'kham benh'],
    entertainment: ['giai tri', 'xem phim', 'game', 'karaoke'],
    education: ['giao duc', 'hoc', 'sach', 'khoa hoc'],
    home: ['nha', 'dien', 'nuoc', 'internet', 'tien nha'],
    salary: ['luong', 'salary'],
    bonus: ['thuong', 'bonus'],
    interest: ['lai', 'tiet kiem', 'lai tiet kiem'],
    gift: ['qua', 'qua tang', 'duoc tang'],
  };

  for (const option of options) {
    const words = [option.id, normalizeText(option.label), ...(aliases[option.id] || [])];
    if (words.some((word) => word && normalized.includes(word))) {
      return option.id;
    }
  }

  return type === 'income' ? 'income_other' : 'other';
}

function getActionIntent(text) {
  const normalized = normalizeText(text);
  const hasTransactionWord = /(giao dich|chi tieu|khoan|thu nhap|hoa don)/.test(normalized);
  const createIntent = /(tao|them|luu|ghi|nhap)/.test(normalized);
  const deleteIntent = /(xoa|huy|bo)/.test(normalized);

  if (deleteIntent && hasTransactionWord) return 'delete';
  if (createIntent && hasTransactionWord) return 'create';
  return null;
}

function findTransactionToDelete(text, transactions) {
  const normalized = normalizeText(text);
  const amount = parseAmountFromText(text);
  const type = inferTransactionType(text);
  const category = inferCategory(text, type);
  const wantsLatest = /(moi nhat|gan nhat|cuoi cung|vua tao|vua them)/.test(normalized);
  const hasSpecificCategory = category !== 'other' && category !== 'income_other';
  const hasSpecificType = /(thu nhap|chi tieu)/.test(normalized);

  if (!wantsLatest && !amount && !hasSpecificCategory && !hasSpecificType) {
    return null;
  }

  const matches = transactions.filter((transaction) => {
    if (!wantsLatest && amount && Number(transaction.amount) !== amount) return false;
    if (!wantsLatest && hasSpecificCategory && transaction.category !== category) return false;
    if (!wantsLatest && hasSpecificType && transaction.type !== type) return false;
    return true;
  });

  return matches[0] || null;
}

function MessageBubble({ message, colors, styles }) {
  const isUser = message.sender === 'user';

  return (
    <View style={[baseStyles.msgWrapper, isUser ? baseStyles.msgUserWrapper : baseStyles.msgAiWrapper]}>
      {!isUser && (
        <View style={[baseStyles.avatarBase, styles.aiAvatar]}>
          <Ionicons name="sparkles" size={16} color={colors.white} />
        </View>
      )}
      <View style={[baseStyles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[baseStyles.msgText, isUser ? styles.msgTextUser : styles.msgTextAi]}>{message.text}</Text>
      </View>
      {isUser && (
        <View style={[baseStyles.avatarBase, styles.userAvatar]}>
          <Ionicons name="person" size={16} color={colors.gray} />
        </View>
      )}
    </View>
  );
}

function TypingIndicator({ colors, styles }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (value, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={baseStyles.msgWrapper}>
      <View style={[baseStyles.avatarBase, styles.aiAvatar]}>
        <Ionicons name="sparkles" size={16} color={colors.white} />
      </View>
      <View style={[baseStyles.bubble, styles.bubbleAi, baseStyles.typingBubble]}>
        <Animated.View style={[baseStyles.dot, styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[baseStyles.dot, styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[baseStyles.dot, styles.dot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

export default function AIChatScreen({ navigation }) {
  const { token, user } = useAuth();
  const { transactions, addTransaction, deleteTransaction } = useFinance();
  const { colors: COLORS, theme, formatCurrency } = useSettings();
  const styles = useMemo(() => createStyles(COLORS, theme), [COLORS, theme]);
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: `Xin chao ${user?.name || 'ban'}! Toi la tro ly tai chinh AI cua ban. Toi co the giup gi cho ban hom nay?`,
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchBudgets = async () => {
      if (!token) return;
      try {
        const now = new Date();
        const monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const res = await apiRequest(`/budgets?month=${monthKey}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBudgets(res.budgets || []);
      } catch (_) {}
    };

    fetchBudgets();
  }, [token]);

  const executeFinanceAction = async (text) => {
    const intent = getActionIntent(text);
    if (!intent) return null;

    if (intent === 'create') {
      const amount = parseAmountFromText(text);
      if (!amount) {
        return 'Mình chưa thấy số tiền hợp lệ. Ví dụ: "tạo giao dịch ăn uống 50000".';
      }

      const type = inferTransactionType(text);
      const category = inferCategory(text, type);
      const payload = {
        amount,
        type,
        category,
        note: getCategory(category).label,
        date: parseDateFromText(text),
      };

      const transaction = await addTransaction(payload);
      const typeLabel = type === 'income' ? 'thu nhập' : 'chi tiêu';
      return `Đã tạo giao dịch ${typeLabel} ${formatCurrency(transaction.amount)} - ${getCategory(transaction.category).label} vào ${transaction.date}.`;
    }

    if (intent === 'delete') {
      if (!transactions.length) {
        return 'Hiện chưa có giao dịch nào để xóa.';
      }

      const transaction = findTransactionToDelete(text, transactions);
      if (!transaction) {
        return 'Mình chưa tìm thấy giao dịch phù hợp để xóa. Bạn có thể nói rõ hơn, ví dụ: "xóa giao dịch ăn uống 50000" hoặc "xóa giao dịch mới nhất".';
      }

      await deleteTransaction(transaction.id);
      return `Đã xóa giao dịch ${getCategory(transaction.category).label} ${formatCurrency(transaction.amount)} ngày ${transaction.date}.`;
    }

    return null;
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || isTyping) return;

    const userMsg = {
      id: Date.now().toString(),
      text: textToSend.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const actionResponse = await executeFinanceAction(textToSend.trim());
      if (actionResponse) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            text: actionResponse,
            sender: 'ai',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const now = new Date();
      const currentMonthTxs = transactions.filter((transaction) => {
        const dParts = transaction.date.split('/');
        return dParts[1] === String(now.getMonth() + 1).padStart(2, '0') && dParts[2] === String(now.getFullYear());
      });

      const totalExpense = currentMonthTxs
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const totalIncome = currentMonthTxs
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const budgetsInfo =
        budgets.map((budget) => `${budget.label}: giới hạn ${formatVnd(budget.budgetAmount)}`).join(', ') ||
        'Chưa thiết lập ngân sách';

      const res = await apiRequest('/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          input: textToSend.trim(),
          contextData: {
            totalTransactions: transactions.length,
            totalExpense: formatVnd(totalExpense),
            totalIncome: formatVnd(totalIncome),
            budgetsInfo,
          },
        }),
      });

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: res.text || 'Xin lỗi, tôi không thể trả lời lúc này.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Có lỗi xảy ra khi kết nối với AI. Bạn hãy thử lại sau nhé!',
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    { text: 'Phân tích chi tiêu tháng này', icon: 'analytics' },
    { text: 'Gợi ý tiết kiệm', icon: 'bulb' },
    { text: 'Chia bill ăn uống 3 người 500k', icon: 'receipt' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <View style={baseStyles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="sparkles" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.headerTitle}>Trợ lý AI</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={baseStyles.chatList}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} colors={COLORS} styles={styles} />
          ))}
          {isTyping && <TypingIndicator colors={COLORS} styles={styles} />}
        </ScrollView>

        <View style={styles.inputArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={baseStyles.suggestionsScroll}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity key={index} style={styles.sugBtn} onPress={() => handleSend(suggestion.text)}>
                <Ionicons name={suggestion.icon} size={14} color={COLORS.primary} />
                <Text style={styles.sugText}>{suggestion.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Hỏi AI về tài chính..."
              placeholderTextColor={COLORS.lightGray}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              <Ionicons name="send" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatList: { flex: 1 },
  msgWrapper: { flexDirection: 'row', marginBottom: 20, maxWidth: '85%', gap: 8 },
  msgUserWrapper: { alignSelf: 'flex-end', flexDirection: 'row' },
  msgAiWrapper: { alignSelf: 'flex-start' },
  avatarBase: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble: { padding: 12, borderRadius: 20, minHeight: 40, justifyContent: 'center' },
  msgText: { fontSize: 14, lineHeight: 20 },
  typingBubble: { flexDirection: 'row', gap: 4, paddingVertical: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  suggestionsScroll: { paddingVertical: 12 },
});

const createStyles = (COLORS, theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    backBtn: { padding: 8, borderRadius: 20 },
    headerIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: `${COLORS.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },
    aiAvatar: { backgroundColor: COLORS.primary },
    userAvatar: { backgroundColor: theme === 'dark' ? COLORS.border : '#F1F5F9' },
    bubbleAi: {
      backgroundColor: theme === 'dark' ? '#232736' : '#F8FAFC',
      borderBottomLeftRadius: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomRightRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    bubbleUser: {
      backgroundColor: COLORS.primary,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 20,
    },
    msgTextAi: { color: COLORS.dark },
    msgTextUser: { color: COLORS.white },
    dot: { backgroundColor: COLORS.gray },
    inputArea: {
      paddingBottom: Platform.OS === 'ios' ? 20 : 12,
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    sugBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
    },
    sugText: { fontSize: 12, color: COLORS.dark, fontWeight: FONTS.medium },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      backgroundColor: theme === 'dark' ? '#181C27' : COLORS.bg,
      borderRadius: 24,
      paddingLeft: 16,
      paddingRight: 4,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    input: { flex: 1, fontSize: 14, color: COLORS.dark, maxHeight: 100, paddingVertical: 8 },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.sm,
    },
    sendBtnDisabled: { backgroundColor: theme === 'dark' ? COLORS.lightGray : '#CBD5E1' },
  });
