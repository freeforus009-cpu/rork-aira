import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock, CheckCircle, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LOStatus } from '@/types';

interface StatusBadgeProps {
  status: LOStatus;
  size?: 'small' | 'medium';
}

const statusConfig: Record<LOStatus, { label: string; color: string; bgColor: string }> = {
  locked: { label: 'Locked', color: Colors.textMuted, bgColor: 'rgba(74,85,104,0.2)' },
  available: { label: 'Available', color: Colors.accent, bgColor: 'rgba(91,164,207,0.15)' },
  in_progress: { label: 'In Progress', color: Colors.warning, bgColor: 'rgba(255,217,61,0.15)' },
  completed: { label: 'Completed', color: Colors.success, bgColor: 'rgba(0,201,167,0.15)' },
};

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  const iconSize = size === 'small' ? 12 : 16;
  const fontSize = size === 'small' ? 11 : 13;

  return (
    <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
      {status === 'locked' && <Lock size={iconSize} color={config.color} />}
      {status === 'available' && <Clock size={iconSize} color={config.color} />}
      {status === 'in_progress' && <Clock size={iconSize} color={config.color} />}
      {status === 'completed' && <CheckCircle size={iconSize} color={config.color} />}
      <Text style={[styles.text, { color: config.color, fontSize }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontWeight: '600' as const,
  },
});
