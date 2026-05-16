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
import { formatVnd, useFinance } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';

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
  const { transactions } = useFinance();
  const { colors: COLORS, theme } = useSettings();
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <View style={baseStyles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={baseStyles.chatList}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} colors={COLORS} styles={styles} />
        ))}
        {isTyping && <TypingIndicator colors={COLORS} styles={styles} />}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
