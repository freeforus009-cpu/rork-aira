import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Image } from 'expo-image';

export default function SplashPage() {
  const router = useRouter();
  const { currentUser, isInitialized } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      if (currentUser) {
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
          router.replace('/(admin)/dashboard' as any);
        } else {
          router.replace('/(student)/home' as any);
        }
      } else {
        router.replace('/login' as any);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isInitialized, currentUser, router]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('@/assets/images/aira-logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.title}>AIRA</Text>
        <Text style={styles.subtitle}>Academic Integrated Review & Assessment</Text>
        <Text style={styles.tagline}>Train Smart. Get Certified!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.accent,
    marginTop: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
