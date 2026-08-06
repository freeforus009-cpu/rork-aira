import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, UserCog, Pencil, Trash2, Power, X, ChevronLeft, ChevronRight, Mail, Building2, CalendarDays, KeyRound, Lock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { User } from '@/types';
import Colors from '@/constants/colors';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminManagementScreen() {
  const { currentUser, admins, editAdmin, archiveAdmin, deleteAdmin, resetUserPassword } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState<number>(1);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [schoolOrganization, setSchoolOrganization] = useState<string>('');
  const [accountType, setAccountType] = useState<'admin' | 'teacher'>('admin');
  const [resetPwdAdmin, setResetPwdAdmin] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState<string>('');

  const adminAccounts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return admins
      .filter(admin => admin.role === 'admin')
      .filter(admin => {
        if (statusFilter === 'active') return !admin.archived;
        if (statusFilter === 'inactive') return Boolean(admin.archived);
        return true;
      })
      .filter(admin => !normalized || [admin.fullName, admin.email, admin.schoolOrganization ?? ''].some(value => value.toLowerCase().includes(normalized)));
  }, [admins, searchQuery, statusFilter]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(adminAccounts.length / pageSize));
  const visibleAdmins = adminAccounts.slice((page - 1) * pageSize, page * pageSize);

  const openEdit = (admin: User) => {
    setEditingAdmin(admin);
    setFullName(admin.fullName);
    setEmail(admin.email);
    setSchoolOrganization(admin.schoolOrganization ?? '');
    setAccountType(admin.accountType ?? 'admin');
  };

  const saveEdit = async () => {
    if (!editingAdmin || !fullName.trim() || !email.trim()) {
      Alert.alert('Missing information', 'Full name and email are required.');
      return;
    }
    try {
      await editAdmin(editingAdmin.id, { fullName: fullName.trim(), email: email.trim().toLowerCase(), schoolOrganization: schoolOrganization.trim(), accountType });
      setEditingAdmin(null);
    } catch (error: unknown) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const toggleAdmin = (admin: User) => {
    Alert.alert(admin.archived ? 'Activate account?' : 'Deactivate account?', `${admin.fullName} will ${admin.archived ? 'be able to sign in again' : 'no longer be able to sign in'}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: admin.archived ? 'Activate' : 'Deactivate', style: admin.archived ? 'default' : 'destructive', onPress: async () => {
        try { await archiveAdmin(admin.id); } catch (error: unknown) { Alert.alert('Unable to update', error instanceof Error ? error.message : 'Please try again.'); }
      } },
    ]);
  };

  const confirmDelete = (admin: User) => {
    Alert.alert('Delete admin account?', `This permanently removes ${admin.fullName}. Students and subject copies remain stored for review.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAdmin(admin.id); } catch (error: unknown) { Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.'); }
      } },
    ]);
  };

  const handleResetPassword = async () => {
    if (!resetPwdAdmin || !newPwd.trim()) return;
    if (newPwd.length < 6) { showError('Password must be at least 6 characters'); return; }
    try {
      await resetUserPassword(resetPwdAdmin.id, newPwd);
      setResetPwdAdmin(null);
      setNewPwd('');
      showSuccess(`Password reset for ${resetPwdAdmin.fullName}`);
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Failed to reset password');
    }
  };

  if (!currentUser || currentUser.role !== 'super_admin') {
    return <View style={styles.container}><View style={styles.denied}><UserCog size={40} color={Colors.textMuted} /><Text style={styles.deniedText}>Super Admin access required</Text></View></View>;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Admin Management</Text>
          <Text style={styles.subtitle}>Review and manage every Admin and Teacher account.</Text>

          <View style={styles.searchBox}><Search size={17} color={Colors.textMuted} /><TextInput value={searchQuery} onChangeText={value => { setSearchQuery(value); setPage(1); }} placeholder="Search name, email, or school" placeholderTextColor={Colors.textMuted} style={styles.searchInput} /></View>
          <View style={styles.filterRow}>
            <Filter size={15} color={Colors.textMuted} />
            {(['all', 'active', 'inactive'] as const).map(filter => <TouchableOpacity key={filter} style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]} onPress={() => { setStatusFilter(filter); setPage(1); }}><Text style={[styles.filterText, statusFilter === filter && styles.filterTextActive]}>{filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Inactive'}</Text></TouchableOpacity>)}
          </View>

          <View style={styles.summary}><Text style={styles.summaryText}>{adminAccounts.length} matching account{adminAccounts.length === 1 ? '' : 's'}</Text><Text style={styles.summaryText}>Page {page} of {pageCount}</Text></View>
          {visibleAdmins.length === 0 ? <View style={styles.empty}><UserCog size={38} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No Admin accounts found</Text><Text style={styles.emptyText}>Try a different search or filter.</Text></View> : visibleAdmins.map(admin => (
            <View key={admin.id} style={[styles.card, admin.archived && styles.cardInactive]}>
              <View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{admin.fullName.charAt(0).toUpperCase()}</Text></View><View style={styles.cardIdentity}><Text style={styles.name}>{admin.fullName}</Text><Text style={styles.email}>{admin.email}</Text><View style={[styles.statusPill, admin.archived ? styles.statusInactive : styles.statusActive]}><Text style={[styles.statusText, { color: admin.archived ? Colors.error : Colors.success }]}>{admin.archived ? 'Inactive' : 'Active'}</Text></View></View></View>
              <View style={styles.detailGrid}><View style={styles.detailItem}><Building2 size={14} color={Colors.textMuted} /><Text style={styles.detailValue}>{admin.schoolOrganization || 'No organization'}</Text></View><View style={styles.detailItem}><CalendarDays size={14} color={Colors.textMuted} /><Text style={styles.detailValue}>{new Date(admin.createdAt).toLocaleDateString()}</Text></View></View>
              <View style={styles.actions}><TouchableOpacity style={styles.actionBtn} onPress={() => setSelectedAdmin(admin)}><Text style={styles.actionText}>Details</Text></TouchableOpacity><TouchableOpacity style={styles.iconBtn} onPress={() => { setResetPwdAdmin(admin); setNewPwd(''); }}><KeyRound size={16} color={Colors.accent} /></TouchableOpacity><TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(admin)}><Pencil size={16} color={Colors.primary} /></TouchableOpacity><TouchableOpacity style={styles.iconBtn} onPress={() => toggleAdmin(admin)}><Power size={16} color={admin.archived ? Colors.success : Colors.warning} /></TouchableOpacity><TouchableOpacity style={styles.iconBtnDanger} onPress={() => confirmDelete(admin)}><Trash2 size={16} color={Colors.error} /></TouchableOpacity></View>
            </View>
          ))}

          <View style={styles.pagination}><TouchableOpacity disabled={page <= 1} onPress={() => setPage(current => Math.max(1, current - 1))} style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}><ChevronLeft size={18} color={page <= 1 ? Colors.textMuted : Colors.text} /></TouchableOpacity><Text style={styles.pageText}>{page} / {pageCount}</Text><TouchableOpacity disabled={page >= pageCount} onPress={() => setPage(current => Math.min(pageCount, current + 1))} style={[styles.pageBtn, page >= pageCount && styles.pageBtnDisabled]}><ChevronRight size={18} color={page >= pageCount ? Colors.textMuted : Colors.text} /></TouchableOpacity></View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={Boolean(selectedAdmin)} transparent animationType="slide" onRequestClose={() => setSelectedAdmin(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Admin Details</Text><TouchableOpacity onPress={() => setSelectedAdmin(null)}><X size={21} color={Colors.text} /></TouchableOpacity></View>{selectedAdmin && <><Text style={styles.modalName}>{selectedAdmin.fullName}</Text><Text style={styles.modalRole}>{selectedAdmin.accountType === 'teacher' ? 'Teacher' : 'Admin'} · {selectedAdmin.archived ? 'Inactive' : 'Active'}</Text><View style={styles.modalLine}><Mail size={15} color={Colors.textMuted} /><Text style={styles.modalValue}>{selectedAdmin.email}</Text></View><View style={styles.modalLine}><Building2 size={15} color={Colors.textMuted} /><Text style={styles.modalValue}>{selectedAdmin.schoolOrganization || 'No organization recorded'}</Text></View><View style={styles.modalLine}><CalendarDays size={15} color={Colors.textMuted} /><Text style={styles.modalValue}>Created {new Date(selectedAdmin.createdAt).toLocaleDateString()}</Text></View></>}</View></View></Modal>
      <Modal visible={Boolean(editingAdmin)} transparent animationType="slide" onRequestClose={() => setEditingAdmin(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit Admin</Text><TouchableOpacity onPress={() => setEditingAdmin(null)}><X size={21} color={Colors.text} /></TouchableOpacity></View><TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={Colors.textMuted} style={styles.input} /><TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={Colors.textMuted} autoCapitalize="none" keyboardType="email-address" style={styles.input} /><TextInput value={schoolOrganization} onChangeText={setSchoolOrganization} placeholder="School / Organization" placeholderTextColor={Colors.textMuted} style={styles.input} /><View style={styles.typeRow}>{(['admin', 'teacher'] as const).map(type => <TouchableOpacity key={type} onPress={() => setAccountType(type)} style={[styles.typeChip, accountType === type && styles.typeChipActive]}><Text style={[styles.typeText, accountType === type && styles.typeTextActive]}>{type === 'admin' ? 'Admin' : 'Teacher'}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.saveBtn} onPress={saveEdit}><Text style={styles.saveText}>Save Changes</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={Boolean(resetPwdAdmin)} transparent animationType="slide" onRequestClose={() => { setResetPwdAdmin(null); setNewPwd(''); }}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Reset Password</Text><TouchableOpacity onPress={() => { setResetPwdAdmin(null); setNewPwd(''); }}><X size={21} color={Colors.text} /></TouchableOpacity></View>{resetPwdAdmin && <><Text style={styles.modalName}>{resetPwdAdmin.fullName}</Text><Text style={styles.modalRole}>{resetPwdAdmin.accountType === 'teacher' ? 'Teacher' : 'Admin'}</Text><View style={[styles.inputContainer, { marginTop: 16 }]}><Lock size={16} color={Colors.textMuted} /><TextInput value={newPwd} onChangeText={setNewPwd} placeholder="New password (min 6 chars)" placeholderTextColor={Colors.textMuted} secureTextEntry style={styles.input} /></View><TouchableOpacity style={styles.saveBtn} onPress={handleResetPassword}><Text style={styles.saveText}>Reset Password</Text></TouchableOpacity></>}</View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontSize: 25, fontWeight: '800' as const, color: Colors.text, marginTop: 16 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' as const },
  filterTextActive: { color: '#000' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryText: { fontSize: 12, color: Colors.textMuted },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardInactive: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' as const, color: Colors.primary },
  cardIdentity: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  email: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 7 },
  statusActive: { backgroundColor: Colors.success + '18' },
  statusInactive: { backgroundColor: Colors.error + '18' },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  detailGrid: { flexDirection: 'row', gap: 16, marginTop: 10, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailValue: { fontSize: 12, color: Colors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceLight },
  actionText: { fontSize: 12, color: Colors.accent, fontWeight: '500' as const },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16, marginBottom: 12 },
  pageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' as const },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, color: Colors.text, fontWeight: '600' as const },
  emptyText: { fontSize: 13, color: Colors.textMuted },
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  deniedText: { fontSize: 16, color: Colors.textMuted, fontWeight: '500' as const },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 },
  modal: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  modalName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 2 },
  modalRole: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  modalLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  modalValue: { fontSize: 14, color: Colors.textSecondary },
  input: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 12, color: Colors.text, fontSize: 14, marginBottom: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 48 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  typeTextActive: { color: '#000', fontWeight: '700' as const },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' as const },
});
