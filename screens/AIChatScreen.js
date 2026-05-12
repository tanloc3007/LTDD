import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { apiRequest } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';
import { formatVnd, useFinance } from '../contexts/FinanceContext';

const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  return (
    <View style={[s.msgWrapper, isUser ? s.msgUserWrapper : s.msgAiWrapper]}>
      {!isUser && (
        <View style={s.aiAvatar}>
          <Ionicons name="sparkles" size={16} color={COLORS.white} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAi]}>
        <Text style={[s.msgText, isUser ? s.msgTextUser : s.msgTextAi]}>
          {message.text}
        </Text>
      </View>
      {isUser && (
        <View style={s.userAvatar}>
          <Ionicons name="person" size={16} color={COLORS.gray} />
        </View>
      )}
    </View>
  );
};

const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (val, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={s.msgWrapper}>
      <View style={s.aiAvatar}>
        <Ionicons name="sparkles" size={16} color={COLORS.white} />
      </View>
      <View style={[s.bubble, s.bubbleAi, { flexDirection: 'row', gap: 4, paddingVertical: 12 }]}>
        <Animated.View style={[s.dot, { opacity: dot1 }]} />
        <Animated.View style={[s.dot, { opacity: dot2 }]} />
        <Animated.View style={[s.dot, { opacity: dot3 }]} />
      </View>
    </View>
  );
};

export default function AIChatScreen({ navigation }) {
  const { token, user } = useAuth();
  const { transactions } = useFinance();
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: `Xin chào ${user?.name || 'Luân'}! Tôi là trợ lý tài chính AI của bạn. Tôi có thể giúp gì cho bạn hôm nay?`,
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    const fetchBudgets = async () => {
      if (!token) return;
      try {
        const now = new Date();
        const monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const res = await apiRequest(`/budgets?month=${monthKey}`, {
          headers: { Authorization: `Bearer ${token}` }
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

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const now = new Date();
      const currentMonthTxs = transactions.filter(t => {
        const dParts = t.date.split('/');
        return dParts[1] === String(now.getMonth() + 1).padStart(2, '0') && dParts[2] === String(now.getFullYear());
      });

      const totalExpense = currentMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const totalIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      
      const budgetsInfo = budgets.map(b => `${b.label}: giới hạn ${formatVnd(b.budgetAmount)}`).join(', ') || 'Chưa thiết lập ngân sách';

      const res = await apiRequest('/ai-chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          input: textToSend.trim(),
          contextData: {
            totalTransactions: transactions.length,
            totalExpense: formatVnd(totalExpense),
            totalIncome: formatVnd(totalIncome),
            budgetsInfo
          }
        }),
      });

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: res.text || 'Xin lỗi, tôi không thể trả lời lúc này.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        text: 'Có lỗi xảy ra khi kết nối với AI. Bạn hãy thử lại sau nhé!',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
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
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <View style={s.headerTitleRow}>
          <View style={s.headerIconWrap}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.headerTitle}>AI Assistant</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        ref={scrollRef}
        style={s.chatList}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={s.inputArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionsScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {suggestions.map((sug, i) => (
              <TouchableOpacity 
                key={i} 
                style={s.sugBtn}
                onPress={() => handleSend(sug.text)}
              >
                <Ionicons name={sug.icon} size={14} color={COLORS.primary} />
                <Text style={s.sugText}>{sug.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.inputContainer}>
            <TextInput
              style={s.input}
              placeholder="Hỏi AI về tài chính..."
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity 
              style={[s.sendBtn, (!input.trim() || isTyping) && s.sendBtnDisabled]}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 8, borderRadius: 20 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${COLORS.primary}15`, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark },

  chatList: { flex: 1 },
  msgWrapper: { flexDirection: 'row', marginBottom: 20, maxWidth: '85%', gap: 8 },
  msgUserWrapper: { alignSelf: 'flex-end', flexDirection: 'row' },
  msgAiWrapper: { alignSelf: 'flex-start' },

  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  bubble: { padding: 12, borderRadius: 20, minHeight: 40, justifyContent: 'center' },
  bubbleAi: { backgroundColor: '#F8FAFC', borderBottomLeftRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20 },

  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextAi: { color: COLORS.dark },
  msgTextUser: { color: COLORS.white },

  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' },

  inputArea: { paddingBottom: Platform.OS === 'ios' ? 20 : 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  suggestionsScroll: { paddingVertical: 12 },
  sugBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20 },
  sugText: { fontSize: 12, color: '#475569', fontWeight: FONTS.medium },

  inputContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#F1F5F9', borderRadius: 24, paddingLeft: 16, paddingRight: 4, paddingVertical: 4 },
  input: { flex: 1, fontSize: 14, color: COLORS.dark, maxHeight: 100, paddingVertical: 8 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});
