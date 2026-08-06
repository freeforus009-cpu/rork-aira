import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { useConnectivity, ConnectivityState } from '@/contexts/ConnectivityContext';
import Colors from '@/constants/colors';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending';

interface Props {
  syncStatus?: SyncStatus;
  pendingCount?: number;
  compact?: boolean;
}

export default function SyncStatusIndicator({ syncStatus = 'synced', pendingCount = 0, compact = true }: Props) {
  const { connectivityState } = useConnectivity();

  const isOffline = connectivityState === 'offline';
  const effectiveStatus: SyncStatus = isOffline ? 'offline' : syncStatus;

  const config: Record<SyncStatus, { color: string; icon: typeof Cloud; label: string; pulsing?: boolean }> = {
    synced: { color: Colors.success, icon: CheckCircle2, label: 'Synced' },
    syncing: { color: Colors.warning, icon: RefreshCw, label: 'Syncing', pulsing: true },
    offline: { color: Colors.textMuted, icon: CloudOff, label: 'Offline' },
    pending: { color: Colors.warning, icon: Cloud, label: `${pendingCount} pending` },
  };

  const { color, icon: Icon, label, pulsing } = config[effectiveStatus];

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.dot, { backgroundColor: color }, pulsing && styles.pulsingDot]} />
        <Text style={[styles.compactLabel, { color }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: color + '30' }]}>
      <Icon size={16} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {pendingCount > 0 && !isOffline && (
        <View style={[styles.badge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.badgeText, { color }]}>{pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulsingDot: {
    opacity: 0.7,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
