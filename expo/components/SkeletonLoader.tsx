import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

interface SkeletonLoaderProps {
  count?: number;
  height?: number;
  width?: string | number;
  borderRadius?: number;
  style?: ViewStyle;
  showText?: boolean;
  textLines?: number;
}

/** Animated shimmer skeleton placeholder for loading states */
export default function SkeletonLoader({
  count = 3,
  height = 60,
  width = '100%',
  borderRadius = 12,
  style,
  showText = false,
  textLines = 2,
}: SkeletonLoaderProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.6],
  });

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.skeletonCard, { borderRadius }]}>
          <Animated.View
            style={[
              styles.skeletonBlock,
              { height, width: width as any, borderRadius, opacity },
            ]}
          />
          {showText && (
            <View style={styles.skeletonTextContainer}>
              {Array.from({ length: textLines }).map((_, j) => (
                <Animated.View
                  key={j}
                  style={[
                    styles.skeletonTextLine,
                    {
                      width: `${80 - j * 15}%`,
                      opacity,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 8,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  skeletonBlock: {
    backgroundColor: Colors.surfaceLight,
  },
  skeletonTextContainer: {
    gap: 8,
    marginTop: 12,
  },
  skeletonTextLine: {
    height: 14,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 7,
  },
});
