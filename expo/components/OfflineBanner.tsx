import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import Colors from '@/constants/colors';

export default function OfflineBanner() {
  const { connectivityState } = useConnectivity();

  if (connectivityState !== 'offline') return null;

  return (
    <View style={styles.banner}>
      <WifiOff size={14} color={Colors.warning} />
      <Text style={styles.text}>You are offline. Changes will sync when connection returns.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.warning + '15',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '30',
  },
  text: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
});
