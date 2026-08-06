import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Share2, Trash2, Plus, KeyRound, Shield, CalendarClock, UserRound } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import type { InviteCode } from '@/types';
import Colors from '@/constants/colors';

type InviteRoleChoice = 'admin' | 'teacher';

export default function RegLinksScreen() {
  const { currentUser, inviteCodes, regLinks, generateInviteCode, deactivateInviteCode, deleteInviteCode, generateRegLink, deactivateRegLink } = useAuth();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [inviteRole, setInviteRole] = useState<InviteRoleChoice>('admin');
  const [expiration, setExpiration] = useState<string>('');
  const [maxUses, setMaxUses] = useState<string>('1');
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const validExpiration = useMemo(() => {
    if (!expiration.trim()) return undefined;
    const parsed = new Date(`${expiration.trim()}T23:59:59.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }, [expiration]);

  const statusForInvite = useCallback((invite: InviteCode): { label: string; color: string } => {
    if (invite.deactivatedAt || !invite.is_active) return { label: 'Inactive', color: Colors.textMuted };
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return { label: 'Expired', color: Colors.error };
    if (invite.maxUses && (invite.usedCount ?? 0) >= invite.maxUses) return { label: 'Used', color: Colors.warning };
    return { label: 'Active', color: Colors.success };
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const parsedUses = Number.parseInt(maxUses, 10);
      if (expiration.trim() && !validExpiration) throw new Error('Use expiration format YYYY-MM-DD.');
      if (isSuperAdmin) {
        const invite = await generateInviteCode(inviteRole, validExpiration, parsedUses > 0 ? parsedUses : undefined);
        Alert.alert('Invitation code created', `${invite.code}\n\nRole: ${inviteRole === 'teacher' ? 'Teacher' : 'Admin'}`);
      } else {
        const days = validExpiration ? Math.max(1, Math.ceil((new Date(validExpiration).getTime() - Date.now()) / 86400000)) : undefined;
        const link = await generateRegLink(parsedUses > 0 ? parsedUses : undefined, days);
        Alert.alert('Student link created', `Code: ${link.code}`);
      }
      setExpiration('');
      setMaxUses('1');
    } catch (error: unknown) {
      Alert.alert('Unable to generate', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [expiration, generateInviteCode, generateRegLink, inviteRole, isSuperAdmin, maxUses, validExpiration]);

  const shareCode = useCallback(async (code: string) => {
    try { await Share.share({ message: `Join AIRA using invitation code: ${code}`, title: 'AIRA Invitation Code' }); } catch (error) { console.log('[Access] Share cancelled'); }
  }, []);

  const handleDeleteInvite = (invite: InviteCode) => {
    Alert.alert('Delete invitation code?', 'Only unused codes can be permanently deleted. Used codes can be deactivated.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteInviteCode(invite.id); } catch (error: unknown) { Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please deactivate it instead.'); } } },
    ]);
  };

  const handleDeactivateInvite = (invite: InviteCode) => {
    Alert.alert('Deactivate invitation code?', 'New accounts will no longer be able to use this code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => { try { await deactivateInviteCode(invite.id); } catch (error: unknown) { Alert.alert('Unable to deactivate', error instanceof Error ? error.message : 'Please try again.'); } } },
    ]);
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>{isSuperAdmin ? 'Invitation Codes' : 'Student Access'}</Text>
          <Text style={styles.pageSubtitle}>{isSuperAdmin ? 'Create controlled Admin and Teacher invitations.' : 'Create student registration links for your organization.'}</Text>
          <View style={styles.infoCard}><Shield size={20} color={Colors.accent} /><Text style={styles.infoText}>{isSuperAdmin ? 'Invitation codes are role-specific, expirable, and usage-limited. Deactivated codes remain visible for auditing.' : 'Registration links are scoped to your organization and never expose another Admin’s students.'}</Text></View>

          {isSuperAdmin && <><Text style={styles.label}>Account role</Text><View style={styles.roleRow}>{(['admin', 'teacher'] as const).map(role => <TouchableOpacity key={role} style={[styles.roleChip, inviteRole === role && styles.roleChipActive]} onPress={() => setInviteRole(role)}><UserRound size={14} color={inviteRole === role ? '#000' : Colors.textMuted} /><Text style={[styles.roleText, inviteRole === role && styles.roleTextActive]}>{role === 'admin' ? 'Admin' : 'Teacher'}</Text></TouchableOpacity>)}</View></>}
          <View style={styles.formRow}><View style={styles.formField}><Text style={styles.label}>Expiration</Text><View style={styles.inputWrap}><CalendarClock size={15} color={Colors.textMuted} /><TextInput value={expiration} onChangeText={setExpiration} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={Colors.textMuted} style={styles.input} autoCapitalize="none" /></View></View><View style={styles.formFieldSmall}><Text style={styles.label}>Max uses</Text><TextInput value={maxUses} onChangeText={setMaxUses} placeholder="1" placeholderTextColor={Colors.textMuted} style={styles.smallInput} keyboardType="number-pad" /></View></View>
          <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} disabled={isGenerating}>{isGenerating ? <ActivityIndicator color="#000" /> : <><Plus size={20} color="#000" /><Text style={styles.generateButtonText}>{isSuperAdmin ? 'Generate Invitation Code' : 'Generate Student Link'}</Text></>}</TouchableOpacity>

          <Text style={styles.subsectionTitle}>{isSuperAdmin ? 'All invitation codes' : 'Your student links'}</Text>
          {isSuperAdmin ? (inviteCodes.length === 0 ? <EmptyState label="No invitation codes yet" /> : inviteCodes.map(invite => { const status = statusForInvite(invite); return <InviteCard key={invite.id} invite={invite} status={status} onShare={shareCode} onDeactivate={handleDeactivateInvite} onDelete={handleDeleteInvite} />; })) : (regLinks.length === 0 ? <EmptyState label="No student links yet" /> : regLinks.map(link => <View key={link.id} style={styles.linkCard}><CardHeader code={link.code} active={link.active} onShare={shareCode} /><View style={styles.linkStats}><Stat label="Created" value={new Date(link.createdAt).toLocaleDateString()} /><Stat label="Expires" value={link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Never'} /><Stat label="Uses" value={`${link.usedCount}${link.maxUses ? ` / ${link.maxUses}` : ''}`} /></View><View style={styles.linkActions}><TouchableOpacity style={styles.actionButton} onPress={() => shareCode(link.code)}><Share2 size={17} color={Colors.primary} /><Text style={[styles.actionText, { color: Colors.primary }]}>Share</Text></TouchableOpacity>{link.active && <TouchableOpacity style={styles.actionButtonDanger} onPress={() => deactivateRegLink(link.id)}><Trash2 size={17} color={Colors.error} /><Text style={[styles.actionText, { color: Colors.error }]}>Deactivate</Text></TouchableOpacity>}</View></View>))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InviteCard({ invite, status, onShare, onDeactivate, onDelete }: { invite: InviteCode; status: { label: string; color: string }; onShare: (code: string) => void; onDeactivate: (invite: InviteCode) => void; onDelete: (invite: InviteCode) => void }) {
  return <View style={styles.linkCard}><CardHeader code={invite.code} active={status.label === 'Active'} onShare={onShare} status={status} /><View style={styles.linkStats}><Stat label="Role" value={invite.role === 'teacher' ? 'Teacher' : invite.role === 'admin' ? 'Admin' : 'Student'} /><Stat label="Created" value={new Date(invite.createdAt).toLocaleDateString()} /><Stat label="Expires" value={invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'Never'} /><Stat label="Uses" value={`${invite.usedCount ?? 0}${invite.maxUses ? ` / ${invite.maxUses}` : ''}`} /></View><View style={styles.linkActions}><TouchableOpacity style={styles.actionButton} onPress={() => onShare(invite.code)}><Share2 size={17} color={Colors.primary} /><Text style={[styles.actionText, { color: Colors.primary }]}>Share</Text></TouchableOpacity>{invite.is_active && <TouchableOpacity style={styles.actionButtonDanger} onPress={() => onDeactivate(invite)}><Trash2 size={17} color={Colors.error} /><Text style={[styles.actionText, { color: Colors.error }]}>Deactivate</Text></TouchableOpacity>}{(invite.usedCount ?? 0) === 0 && <TouchableOpacity style={styles.iconDelete} onPress={() => onDelete(invite)}><Trash2 size={17} color={Colors.error} /></TouchableOpacity>}</View></View>;
}

function CardHeader({ code, active, onShare, status }: { code: string; active: boolean; onShare: (code: string) => void; status?: { label: string; color: string } }) { const resolvedStatus = status ?? { label: active ? 'Active' : 'Inactive', color: active ? Colors.success : Colors.textMuted }; return <View style={styles.linkHeader}><View style={styles.codeContainer}><Text style={styles.codeText}>{code}</Text><TouchableOpacity onPress={() => Alert.alert('Copied', code)}><Copy size={18} color={Colors.primary} /></TouchableOpacity></View><View style={[styles.statusBadge, { backgroundColor: resolvedStatus.color + '20' }]}><Text style={[styles.statusText, { color: resolvedStatus.color }]}>{resolvedStatus.label}</Text></View></View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function EmptyState({ label }: { label: string }) { return <View style={styles.emptyState}><KeyRound size={44} color={Colors.textMuted} /><Text style={styles.emptyText}>{label}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, safeArea: { flex: 1 }, scroll: { paddingHorizontal: 20, paddingBottom: 30 }, pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, marginTop: 16 }, pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 18 }, infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.accent + '12', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: Colors.accent + '25' }, infoText: { flex: 1, fontSize: 12, color: Colors.accent, lineHeight: 18 }, label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' as const, marginBottom: 7 }, roleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, roleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }, roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary }, roleText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700' as const }, roleTextActive: { color: '#000' }, formRow: { flexDirection: 'row', gap: 10, marginBottom: 15 }, formField: { flex: 1 }, formFieldSmall: { width: 92 }, inputWrap: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10 }, input: { flex: 1, color: Colors.text, fontSize: 12 }, smallInput: { height: 46, color: Colors.text, fontSize: 14, textAlign: 'center', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10 }, generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: Colors.primary }, generateButtonText: { color: '#000', fontSize: 15, fontWeight: '700' as const }, subsectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginTop: 22, marginBottom: 12 }, emptyState: { alignItems: 'center', padding: 32, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }, emptyText: { marginTop: 10, fontSize: 13, color: Colors.textMuted }, linkCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }, linkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, codeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }, codeText: { fontSize: 16, fontWeight: '800' as const, color: Colors.text, letterSpacing: 0.7 }, statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 }, statusText: { fontSize: 11, fontWeight: '700' as const }, linkStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 15 }, stat: { minWidth: 70, flex: 1 }, statLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 }, statValue: { fontSize: 12, fontWeight: '600' as const, color: Colors.text }, linkActions: { flexDirection: 'row', gap: 8 }, actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.primary + '15' }, actionButtonDanger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.error + '15' }, iconDelete: { width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.error + '15' }, actionText: { fontSize: 12, fontWeight: '700' as const },
});
