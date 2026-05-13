import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../constants/api';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const FONTS = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

const SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
};

const NAV_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home' },
  { id: 'history', label: 'Giao dich', icon: 'list' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet' },
  { id: 'profile', label: 'Ca nhan', icon: 'person' },
];

export default function ProfileScreen({ navigation }) {
  const { user, token, logout, setUser } = useAuth();
  const { fetchTransactions } = useFinance();
  const { colors: COLORS, theme, setTheme, currency, setCurrency, formatCurrency } = useSettings();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  
  // App Rating
  const [rating, setRating] = useState(0);

  // Loading flags
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Edit Profile States
  const [editName, setEditName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

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

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Tên không được để trống.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiRequest('/user/profile', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ name: editName }),
      });
      setUser(res.user);
      setShowEditModal(false);
      Alert.alert('Thành công', 'Đã cập nhật thông tin.');
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setSavingPass(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setShowPassModal(false);
      setOldPassword('');
      setNewPassword('');
      Alert.alert('Thành công', 'Đã đổi mật khẩu.');
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setSavingPass(false);
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Xóa tất cả dữ liệu',
      'Bạn có chắc chắn muốn xóa dữ liệu giao dịch, ngân sách không? Lịch sử sẽ lưu lại hành động này.',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa ngay', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest('/user/data', { method: 'DELETE', headers: authHeaders });
              fetchTransactions();
              Alert.alert('Thành công', 'Đã xóa dữ liệu.');
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          }
        }
      ]
    );
  };

  // ─── EXPORT PDF ───────────────────────────────────────────────────────────
  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await apiRequest('/user/export', { headers: authHeaders });
      const txs = data.transactions || [];
      const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
              h1 { color: #E91E63; text-align: center; }
              .info { margin-bottom: 20px; font-size: 16px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #FCE4EC; color: #E91E63; }
              .income { color: #10B981; }
              .expense { color: #EF4444; }
            </style>
          </head>
          <body>
            <h1>Báo Cáo Tài Chính</h1>
            <div class="info">
              <strong>Họ tên:</strong> ${user?.name || 'N/A'}<br/>
              <strong>Email:</strong> ${user?.email || 'N/A'}<br/>
              <strong>Ngày xuất:</strong> ${new Date().toLocaleString('vi-VN')}<br/><br/>
              <strong>Tổng Thu:</strong> <span class="income">${formatCurrency(totalIncome)}</span><br/>
              <strong>Tổng Chi:</strong> <span class="expense">${formatCurrency(totalExpense)}</span>
            </div>
            <h2>Lịch sử giao dịch</h2>
            <table>
              <tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Ghi chú</th><th>Số tiền</th></tr>
              ${txs.map(t => `
                <tr>
                  <td>${t.date}</td>
                  <td class="${t.type}">${t.type === 'income' ? 'Thu' : 'Chi'}</td>
                  <td>${t.category}</td>
                  <td>${t.note || ''}</td>
                  <td class="${t.type}">${formatCurrency(t.amount)}</td>
                </tr>
              `).join('')}
            </table>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể xuất dữ liệu: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // ─── BACKUP & RESTORE ─────────────────────────────────────────────────────
  const handleBackup = async () => {
    try {
      const data = await apiRequest('/user/export', { headers: authHeaders });
      const fileUri = FileSystem.documentDirectory + 'momo_finance_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
      await Sharing.shareAsync(fileUri);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể sao lưu: ' + err.message);
    }
  };

  const handleRestore = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      
      Alert.alert('Xác nhận khôi phục', 'Dữ liệu hiện tại sẽ bị xóa và thay thế bằng bản sao lưu này. Bạn có chắc không?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', style: 'destructive', onPress: async () => {
            setRestoring(true);
            try {
              const fileContent = await FileSystem.readAsStringAsync(res.assets[0].uri);
              const jsonData = JSON.parse(fileContent);
              await apiRequest('/user/import', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(jsonData)
              });
              fetchTransactions();
              Alert.alert('Thành công', 'Đã khôi phục dữ liệu.');
            } catch (error) {
              Alert.alert('Lỗi', 'Tệp không hợp lệ hoặc lỗi server.');
            } finally {
              setRestoring(false);
            }
        }}
      ]);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể đọc tệp sao lưu.');
    }
  };

  const submitRating = () => {
    if (rating === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn số sao.');
      return;
    }
    Alert.alert('Cảm ơn!', 'Cảm ơn bạn đã đánh giá ứng dụng ' + rating + ' sao.');
    setShowRateModal(false);
    setRating(0);
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  const handleNav = (tabId) => {
    if (tabId === 'home') navigation.navigate('Home');
    else if (tabId === 'stats') navigation.navigate('Stats');
    else if (tabId === 'history') navigation.navigate('Transaction');
    else if (tabId === 'wallet') navigation.navigate('Budget');
    else if (tabId === 'profile') return;
    else Alert.alert('Tinh nang', 'Man hinh dang phat trien!');
  };

  const developingFeature = () => Alert.alert('Thông báo', 'Tính năng đang được phát triển.');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profile</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={developingFeature}>
          <Ionicons name="settings-outline" size={24} color={COLORS.gray} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?u=' + (user?.email || 'demo') }} 
              style={styles.avatar}
            />
          </View>
          <Text style={styles.userName}>{user?.name || 'Nguyễn Văn A'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'nguyen.van.a@example.com'}</Text>
          <TouchableOpacity 
            style={styles.editBtn} 
            onPress={() => {
              setEditName(user?.name || '');
              setShowEditModal(true);
            }}
          >
            <Ionicons name="pencil" size={14} color={COLORS.dark} style={{ marginRight: 6 }} />
            <Text style={styles.editBtnText}>Chỉnh sửa hồ sơ</Text>
          </TouchableOpacity>
        </View>

        {/* TÀI KHOẢN */}
        <Text style={styles.sectionTitle}>TÀI KHOẢN</Text>
        <View style={styles.sectionBox}>
          <SettingItem 
            COLORS={COLORS} icon="notifications" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Thông báo" onPress={() => setShowNotifModal(true)} hasBadge={unreadCount > 0}
          />
          <SettingItem 
            COLORS={COLORS} icon="shield-checkmark" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Bảo mật & Mật khẩu" onPress={() => setShowPassModal(true)} 
          />
          <SettingItem 
            COLORS={COLORS} icon="color-palette" iconBg={COLORS.purpleLight} iconColor={COLORS.primary} 
            label="Giao diện" value={theme === 'light' ? 'Sáng' : 'Tối'} 
            onPress={() => setShowThemeModal(true)} 
          />
          <SettingItem 
            COLORS={COLORS} icon="wallet" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Đơn vị tiền tệ" value={currency} 
            onPress={() => setShowCurrencyModal(true)} isLast
          />
        </View>

        {/* DỮ LIỆU */}
        <Text style={styles.sectionTitle}>DỮ LIỆU</Text>
        <View style={styles.sectionBox}>
          <SettingItem 
            COLORS={COLORS} icon="download" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Xuất dữ liệu PDF" value={exporting ? 'Đang xuất...' : ''}
            onPress={handleExportData} 
          />
          <SettingItem 
            COLORS={COLORS} icon="sync" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Sao lưu dữ liệu JSON" 
            onPress={handleBackup} 
          />
          <SettingItem 
            COLORS={COLORS} icon="refresh" iconBg={COLORS.warningLight} iconColor={COLORS.warning} 
            label="Khôi phục dữ liệu JSON" value={restoring ? 'Đang tải...' : ''}
            onPress={handleRestore} 
          />
          <SettingItem 
            COLORS={COLORS} icon="trash-bin" iconBg={COLORS.dangerLight} iconColor={COLORS.danger} 
            label="Xóa tất cả dữ liệu" labelStyle={{ color: COLORS.danger }}
            onPress={handleDeleteData} hideChevron isLast
          />
        </View>

        {/* KHÁC */}
        <Text style={styles.sectionTitle}>KHÁC</Text>
        <View style={styles.sectionBox}>
          <SettingItem 
            COLORS={COLORS} icon="help-circle" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Trợ giúp & FAQ" onPress={developingFeature} 
          />
          <SettingItem 
            COLORS={COLORS} icon="star" iconBg={COLORS.warningLight} iconColor={COLORS.warning} 
            label="Đánh giá ứng dụng" onPress={() => setShowRateModal(true)} 
          />
          <SettingItem 
            COLORS={COLORS} icon="information-circle" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} 
            label="Phiên bản" value="1.0.0" hideChevron onPress={developingFeature} isLast
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {NAV_TABS.map((tab) => {
          const active = 'profile' === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => handleNav(tab.id)}>
              <Ionicons
                name={active ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={active ? COLORS.primary : COLORS.gray}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modals ────────────────────────────────────────────────────────── */}
      {/* Theme Modal */}
      <Modal visible={showThemeModal} animationType="fade" transparent onRequestClose={() => setShowThemeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn giao diện</Text>
            <TouchableOpacity style={styles.modalActionRow} onPress={() => { setTheme('light'); setShowThemeModal(false); }}>
              <Text style={styles.modalActionText}>Sáng (Light Mode)</Text>
              {theme === 'light' && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionRow, { borderBottomWidth: 0 }]} onPress={() => { setTheme('dark'); setShowThemeModal(false); }}>
              <Text style={styles.modalActionText}>Tối (Dark Mode)</Text>
              {theme === 'dark' && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnCancelFull} onPress={() => setShowThemeModal(false)}>
              <Text style={styles.modalBtnCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} animationType="fade" transparent onRequestClose={() => setShowCurrencyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn đơn vị tiền tệ</Text>
            <TouchableOpacity style={styles.modalActionRow} onPress={() => { setCurrency('VND'); setShowCurrencyModal(false); }}>
              <Text style={styles.modalActionText}>VND (Việt Nam Đồng)</Text>
              {currency === 'VND' && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionRow, { borderBottomWidth: 0 }]} onPress={() => { setCurrency('USD'); setShowCurrencyModal(false); }}>
              <Text style={styles.modalActionText}>USD (Đô la Mỹ)</Text>
              {currency === 'USD' && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnCancelFull} onPress={() => setShowCurrencyModal(false)}>
              <Text style={styles.modalBtnCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rate Modal */}
      <Modal visible={showRateModal} animationType="fade" transparent onRequestClose={() => setShowRateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đánh giá ứng dụng</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1,2,3,4,5].map(i => (
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                  <Ionicons name={rating >= i ? "star" : "star-outline"} size={36} color={COLORS.warning} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowRateModal(false)}>
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={submitRating}>
                <Text style={styles.modalBtnSaveText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="fade" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chỉnh sửa hồ sơ</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nhập tên mới..."
              placeholderTextColor={COLORS.gray}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleUpdateProfile} disabled={savingProfile}>
                <Text style={styles.modalBtnSaveText}>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPassModal} animationType="fade" transparent onRequestClose={() => setShowPassModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Mật khẩu cũ"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowPassModal(false)}>
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleChangePassword} disabled={savingPass}>
                <Text style={styles.modalBtnSaveText}>{savingPass ? 'Đang lưu...' : 'Cập nhật'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.sheetOverlay}>
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

function SettingItem({ COLORS, icon, iconBg, iconColor, label, value, onPress, isLast, labelStyle, hideChevron, hasBadge }) {
  const styles = getStyles(COLORS);
  return (
    <TouchableOpacity 
      style={[styles.settingRow, !isLast && styles.borderBottom]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.settingLabelWrap}>
        <Text style={[styles.settingLabel, labelStyle]}>{label}</Text>
        {hasBadge && <View style={styles.badgeDot} />}
      </View>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      {!hideChevron && <Ionicons name="chevron-forward" size={18} color={COLORS.lightGray} />}
    </TouchableOpacity>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    height: 56, backgroundColor: COLORS.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    zIndex: 10
  },
  iconBtn: { padding: 4 },
  topTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.primary },
  scroll: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 },
  
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    padding: 4,
    marginBottom: 12,
  },
  avatar: {
    width: '100%', height: '100%', borderRadius: 36,
  },
  userName: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 4 },
  userEmail: { fontSize: SIZES.sm, color: COLORS.gray, marginBottom: 16 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  editBtnText: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark },

  sectionTitle: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.lightGray, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  sectionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16,
  },
  borderBottom: {
    borderBottomWidth: 1, borderBottomColor: COLORS.bg,
  },
  settingIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  settingLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  settingLabel: { fontSize: SIZES.sm, fontWeight: FONTS.semiBold, color: COLORS.dark },
  settingValue: { fontSize: SIZES.xs, color: COLORS.gray, marginRight: 8 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 8 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1, borderColor: COLORS.dangerLight,
    marginTop: 8,
  },
  logoutText: { fontSize: SIZES.base, fontWeight: FONTS.bold, color: COLORS.danger, marginLeft: 8 },

  bottomNav: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 8, paddingTop: 4,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // Base Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: COLORS.white, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: SIZES.lg, fontWeight: FONTS.bold, color: COLORS.dark, marginBottom: 16, textAlign: 'center' },
  input: {
    height: 48, borderRadius: 8, backgroundColor: COLORS.bg,
    paddingHorizontal: 16, marginBottom: 16, fontSize: SIZES.base, color: COLORS.dark,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, height: 48, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelText: { color: COLORS.dark, fontWeight: FONTS.semiBold, fontSize: SIZES.base },
  modalBtnSave: { flex: 1, height: 48, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  modalBtnSaveText: { color: COLORS.white, fontWeight: FONTS.semiBold, fontSize: SIZES.base },
  
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalActionText: { fontSize: SIZES.base, color: COLORS.dark },
  modalBtnCancelFull: { marginTop: 16, height: 48, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  // Sheet Modal (Notifications)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
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
