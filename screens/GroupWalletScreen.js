import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, TextInput, FlatList,
  ActivityIndicator, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../constants/api';
import AppBottomNav from '../components/AppBottomNav';

export default function GroupWalletScreen({ navigation }) {
  const { colors: COLORS, formatCurrency } = useSettings();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal tao nhom
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal tham gia nhom
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest('/group-wallet', { headers: authHeaders });
      setGroups(res.groups || res || []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups])
  );

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert('Loi', 'Vui long nhap ten nhom!');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/group-wallet', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name }),
      });
      setShowCreateModal(false);
      setNewGroupName('');
      fetchGroups();
      Alert.alert('Thanh cong', 'Da tao nhom moi!');
    } catch (e) {
      Alert.alert('That bai', e?.message || 'Khong the tao nhom.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Loi', 'Ma nhom phai co 6 ky tu!');
      return;
    }
    setJoining(true);
    try {
      await apiRequest('/group-wallet/join', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ code }),
      });
      setShowJoinModal(false);
      setJoinCode('');
      fetchGroups();
      Alert.alert('Thanh cong', 'Da tham gia nhom thanh cong!');
    } catch (e) {
      Alert.alert('That bai', e?.message || 'Ma nhom khong hop le hoac da het han.');
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = (code) => {
    Clipboard.setString(code);
    Alert.alert('Da sao chep', `Ma nhom "${code}" da duoc sao chep.`);
  };

  const renderGroupItem = ({ item }) => {
    const totalExpense = item.totalExpense ?? item.total ?? 0;
    const memberCount = item.memberCount ?? (item.members ? item.members.length : 0);
    const code = item.code || item.inviteCode || '------';

    return (
      <View style={styles.groupCard}>
        {/* Header card */}
        <View style={styles.groupCardHeader}>
          <View style={styles.groupIconBox}>
            <Ionicons name="people" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Ma: </Text>
              <Text style={styles.codeValue}>{code}</Text>
              <TouchableOpacity onPress={() => handleCopyCode(code)} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.groupStats}>
          <View style={styles.statPill}>
            <Ionicons name="person-outline" size={13} color={COLORS.gray} />
            <Text style={styles.statPillText}>{memberCount} thanh vien</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="wallet-outline" size={13} color={COLORS.danger} />
            <Text style={[styles.statPillText, { color: COLORS.danger }]}>
              {formatCurrency(totalExpense)}
            </Text>
          </View>
        </View>

        {/* Detail button */}
        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() => navigation.navigate('GroupDetail', {
            groupId: item._id || item.id,
            groupName: item.name,
          })}
          activeOpacity={0.8}
        >
          <Text style={styles.detailBtnText}>Xem chi tiet</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Vi Nhom</Text>
          <Text style={styles.headerSub}>{groups.length} nhom dang tham gia</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => { setJoinCode(''); setShowJoinModal(true); }}
          >
            <Ionicons name="enter-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => { setNewGroupName(''); setShowCreateModal(true); }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Dang tai danh sach nhom...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={48} color={COLORS.lightGray} />
          </View>
          <Text style={styles.emptyTitle}>Chua co nhom nao</Text>
          <Text style={styles.emptyDesc}>
            Tao nhom moi hoac tham gia nhom bang ma moi de quan ly chi tieu chung.
          </Text>
          <View style={styles.emptyBtnRow}>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => { setNewGroupName(''); setShowCreateModal(true); }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={styles.emptyBtnText}>Tao nhom</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.primary }]}
              onPress={() => { setJoinCode(''); setShowJoinModal(true); }}
            >
              <Ionicons name="enter-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.emptyBtnText, { color: COLORS.primary }]}>Tham gia</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AppBottomNav navigation={navigation} activeTab="wallet" />

      {/* Modal Tao nhom */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tao Nhom Moi</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ten nhom</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Nhap ten nhom..."
              placeholderTextColor={COLORS.lightGray}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
            />

            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.7 }]}
              onPress={handleCreateGroup}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="people" size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>Tao Nhom</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Tham gia nhom */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tham Gia Nhom</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ma moi (6 ky tu)</Text>
            <TextInput
              style={[styles.textInput, { letterSpacing: 4, textAlign: 'center', fontSize: SIZES.xl }]}
              placeholder="- - - - - -"
              placeholderTextColor={COLORS.lightGray}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
            <Text style={styles.hintText}>Nhap ma 6 ky tu duoc cung cap boi truong nhom</Text>

            <TouchableOpacity
              style={[styles.submitBtn, joining && { opacity: 0.7 }]}
              onPress={handleJoinGroup}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="enter" size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>Tham Gia Nhom</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: SIZES.xl, fontWeight: FONTS.bold, color: COLORS.dark },
  headerSub: { fontSize: SIZES.sm, color: COLORS.gray, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.gray, fontSize: SIZES.sm },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 8 },
  emptyDesc: { fontSize: SIZES.sm, color: COLORS.gray, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtnRow: { flexDirection: 'row', gap: 12 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, ...SHADOWS.sm,
  },
  emptyBtnText: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: '#FFFFFF' },

  listContainer: { padding: 16, gap: 14, paddingBottom: 12 },

  groupCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.sm,
  },
  groupCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  groupIconBox: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeLabel: { fontSize: SIZES.sm, color: COLORS.gray },
  codeValue: { fontSize: SIZES.sm, fontWeight: FONTS.bold, color: COLORS.dark, letterSpacing: 1.5 },
  copyBtn: { padding: 4, marginLeft: 4 },

  groupStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bg, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statPillText: { fontSize: SIZES.xs, fontWeight: FONTS.semiBold, color: COLORS.gray },

  detailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: `${COLORS.primary}10`,
  },
  detailBtnText: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.primary },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark },
  inputLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark, marginBottom: 8 },
  textInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: SIZES.base, color: COLORS.dark,
    backgroundColor: COLORS.bg, marginBottom: 8,
  },
  hintText: { fontSize: SIZES.xs, color: COLORS.gray, marginBottom: 20, textAlign: 'center' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 14, marginTop: 12,
    ...SHADOWS.md,
  },
  submitBtnText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: '#FFFFFF' },
});
