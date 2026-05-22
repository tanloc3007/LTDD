import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SHADOWS } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';

export const APP_TABS = [
  { id: 'home', label: 'Trang chu', icon: 'home', route: 'Home' },
  { id: 'history', label: 'Giao dich', icon: 'list', route: 'Transaction' },
  { id: 'stats', label: 'Thong ke', icon: 'bar-chart', route: 'Stats' },
  { id: 'saving', label: 'Tiet kiem', icon: 'save', route: 'SavingGoal' },
  { id: 'wallet', label: 'Ngan sach', icon: 'wallet', route: 'Budget' },
  { id: 'profile', label: 'Ca nhan', icon: 'person', route: 'Profile' },
];

export default function AppBottomNav({ navigation, activeTab, position = 'inline' }) {
  const { colors: COLORS } = useSettings();
  const styles = getStyles(COLORS);
  const navigatingRef = useRef(false);
  const tabAnimations = useRef(
    APP_TABS.reduce((acc, tab) => {
      acc[tab.id] = new Animated.Value(tab.id === activeTab ? 1 : 0);
      return acc;
    }, {})
  ).current;

  useEffect(() => {
    APP_TABS.forEach((tab) => {
      if (tab.id === activeTab) {
        Animated.spring(tabAnimations[tab.id], {
          toValue: 1,
          tension: 220,
          friction: 18,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(tabAnimations[tab.id], {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
    });
  }, [activeTab, tabAnimations]);

  const handlePress = (tab) => {
    if (tab.id === activeTab || navigatingRef.current) return;

    const currentIndex = APP_TABS.findIndex((item) => item.id === activeTab);
    const nextIndex = APP_TABS.findIndex((item) => item.id === tab.id);
    const tabTransitionDirection = nextIndex > currentIndex ? 1 : -1;
    navigatingRef.current = true;

    // Điều hướng ngay lập tức, animation chạy song song (không chờ animation xong)
    navigation.replace(tab.route, { tabTransitionDirection });

    Animated.parallel([
      // Tab cũ: fade out nhanh
      Animated.timing(tabAnimations[activeTab], {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Tab mới: spring tự nhiên, có độ nảy nhẹ
      Animated.spring(tabAnimations[tab.id], {
        toValue: 1,
        tension: 220,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigatingRef.current = false;
    });
  };

  return (
    <View style={[styles.bottomNav, position === 'absolute' && styles.bottomNavAbsolute]}>
      {APP_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const animatedValue = tabAnimations[tab.id];
        const iconScale = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.14],
        });
        const iconLift = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        });
        const pillOpacity = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        });
        const pillScale = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.62, 1],
        });
        const labelOpacity = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.72, 1],
        });

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => handlePress(tab)}
            activeOpacity={0.85}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.navPill,
                {
                  opacity: pillOpacity,
                  transform: [{ scaleX: pillScale }, { scaleY: pillScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.navIconWrap,
                {
                  transform: [{ translateY: iconLift }, { scale: iconScale }],
                },
              ]}
            >
              <Ionicons
                name={isActive ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={isActive ? COLORS.primary : COLORS.gray}
              />
            </Animated.View>
            <Animated.Text
              style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
                { opacity: labelOpacity },
              ]}
            >
              {tab.label}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 8,
    paddingTop: 4,
    ...SHADOWS.sm,
  },
  bottomNavAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, position: 'relative' },
  navPill: {
    position: 'absolute',
    top: 2,
    width: 48,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}18`,
  },
  navIconWrap: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navLabel: { fontSize: 9, color: COLORS.gray, fontWeight: FONTS.medium },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.bold },
});
