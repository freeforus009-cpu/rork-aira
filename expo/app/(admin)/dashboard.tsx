import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  BookOpen, ChevronRight, Users, Layers, ChevronDown, Megaphone, Plus,
  Trash2, X, Send, Pencil, Globe, UserCheck, Target, Pin, PinOff,
  GraduationCap, ClipboardList, Award,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import OfflineBanner from '@/components/OfflineBanner';
import Colors from '@/constants/colors';
import type { AnnouncementTargetType, GradeLevel } from '@/types';
import { GRADE_LEVELS } from '@/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { currentUser, students, sections, subjects, admins, allUsers } = useAuth();
  const {
    getSubjectCOCs, getCOCLOs, activeSubjectId, setActiveSubjectId,
    getAdminAnnouncements, addAnnouncement, editAnnouncement, deleteAnnouncement,
    announcements, getUndismissedAdminAnnouncements, dismissAnnouncements,
    togglePinAnnouncement, refreshFromCloud,
  } = useData();

  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [showAnnModal, setShowAnnModal] = useState<boolean>(false);
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annMessage, setAnnMessage] = useState<string>('');
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annPriority, setAnnPriority] = useState<'normal' | 'important'>('normal');
  const [annTargetType, setAnnTargetType] = useState<AnnouncementTargetType>('my_students');
  const [annTargetIds, setAnnTargetIds] = useState<string[]>([]);
  const [showTargetPicker, setShowTargetPicker] = useState<boolean>(false);
  const [adminTargetScope, setAdminTargetScope] = useState<'all_my' | 'grade' | 'section' | 'specific'>('all_my');
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<GradeLevel[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showAdminTargetPicker, setShowAdminTargetPicker] = useState<boolean>(false);

  const [showSuperAnnPopup, setShowSuperAnnPopup] = useState<boolean>(false);
  const [popupOpacity] = useState(() => new Animated.Value(0));

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isTeacher = currentUser?.accountType === 'teacher';

  const superAdminAnnsForMe = useMemo(() => {
    if (!currentUser || currentUser.role !== 'admin') return [];
    return getUndismissedAdminAnnouncements(currentUser.id);
  }, [currentUser, getUndismissedAdminAnnouncements]);

  useEffect(() => {
    if (superAdminAnnsForMe.length > 0) {
      setShowSuperAnnPopup(true);
      Animated.timing(popupOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [superAdminAnnsForMe.length]);

  const closeSuperAnnPopup = useCallback(() => {
    const ids = superAdminAnnsForMe.map(a => a.id);
    Animated.timing(popupOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowSuperAnnPopup(false);
      if (ids.length > 0) dismissAnnouncements(ids);
    });
  }, [superAdminAnnsForMe, dismissAnnouncements, popupOpacity]);

  const adminSubjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin') return subjects.filter(s => !s.archived);
    // Admins/Teachers: only their own created or adopted subjects
    return subjects.filter(s => !s.archived && s.adminId === currentUser.id);
  }, [currentUser, subjects]);

  const adminAnnouncements = useMemo(() => {
    if (!currentUser) return [];
    const list = currentUser.role === 'super_admin'
      ? (announcements ?? []).filter((a: any) => !a.archived)
      : getAdminAnnouncements(currentUser.id);
    // Sort: pinned first (by pinnedAt desc), then unpinned by createdAt desc
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        return new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [currentUser, getAdminAnnouncements, announcements]);

  const selectableAdmins = useMemo(() => {
    return allUsers.filter(u => u.role === 'admin' && !u.archived);
  }, [allUsers]);

  const selectableStudents = useMemo(() => {
    return allUsers.filter(u => u.role === 'student' && !u.archived);
  }, [allUsers]);

  const adminOwnStudents = useMemo(() => {
    if (!currentUser || isSuperAdmin) return [];
    return allUsers.filter(u => u.role === 'student' && !u.archived && u.adminId === currentUser.id);
  }, [currentUser, allUsers, isSuperAdmin]);

  const adminOwnSections = useMemo(() => {
    if (!currentUser || isSuperAdmin) return [];
    return sections.filter(s => s.adminId === currentUser.id && !s.archived);
  }, [currentUser, sections, isSuperAdmin]);

  const handlePostAnnouncement = useCallback(async () => {
    if (!annTitle.trim() || !annMessage.trim() || !currentUser) {
      Alert.alert('Error', 'Title and message are required.');
      return;
    }

    const extra = !isSuperAdmin ? {
      targetStudentIds: adminTargetScope === 'specific' ? selectedStudentIds : [],
      targetSectionIds: adminTargetScope === 'section' ? selectedSectionIds : [],
      targetGradeLevels: adminTargetScope === 'grade' ? selectedGradeLevels : [],
    } : {
      targetAdminIds: annTargetType === 'specific' ? annTargetIds.filter(id => allUsers.find(u => u.id === id)?.role === 'admin') : [],
      targetStudentIds: annTargetType === 'specific' ? annTargetIds.filter(id => allUsers.find(u => u.id === id)?.role === 'student') : [],
    };

    if (editingAnnId) {
      let scope: 'global' | 'admin_students' | 'targeted' = 'admin_students';
      let targetRole: 'all' | 'admins' | 'students' = 'students';
      const tt = isSuperAdmin ? annTargetType : 'my_students';
      if (isSuperAdmin) {
        if (tt === 'all') { scope = 'global'; targetRole = 'all'; }
        else if (tt === 'admins') { scope = 'targeted'; targetRole = 'admins'; }
        else if (tt === 'students') { scope = 'global'; targetRole = 'students'; }
        else if (tt === 'specific') { scope = 'targeted'; targetRole = 'all'; }
        else { scope = 'global'; targetRole = 'all'; }
      } else {
        const hasSpecific = (extra.targetStudentIds?.length ?? 0) > 0 ||
          (extra.targetSectionIds?.length ?? 0) > 0 ||
          (extra.targetGradeLevels?.length ?? 0) > 0;
        scope = hasSpecific ? 'targeted' : 'admin_students';
      }
      await editAnnouncement(editingAnnId, {
        title: annTitle.trim(),
        message: annMessage.trim(),
        targetType: tt,
        targetIds: annTargetType === 'specific' ? annTargetIds : [],
        scope,
        targetRole,
        priority: annPriority,
        ...extra,
      });
      console.log('[Admin] Announcement edited:', editingAnnId);
    } else {
      const targetType = isSuperAdmin ? annTargetType : 'my_students';
      const targetIds = annTargetType === 'specific' ? annTargetIds : [];
      await addAnnouncement(currentUser.id, annTitle.trim(), annMessage.trim(), targetType, targetIds, isSuperAdmin, { ...extra, priority: annPriority });
      console.log('[Admin] Announcement posted, target:', targetType, 'scope:', adminTargetScope, 'priority:', annPriority);
    }
    setAnnTitle('');
    setAnnMessage('');
    setEditingAnnId(null);
    setAnnTargetType('my_students');
    setAnnPriority('normal');
    setAnnTargetIds([]);
    setAdminTargetScope('all_my');
    setSelectedGradeLevels([]);
    setSelectedSectionIds([]);
    setSelectedStudentIds([]);
    setShowAnnModal(false);
  }, [annTitle, annMessage, currentUser, addAnnouncement, editAnnouncement, editingAnnId, isSuperAdmin, annTargetType, annTargetIds, adminTargetScope, selectedGradeLevels, selectedSectionIds, selectedStudentIds, allUsers]);

  const handleEditAnn = useCallback((ann: any) => {
    setEditingAnnId(ann.id);
    setAnnTitle(ann.title);
    setAnnMessage(ann.message);
    setAnnTargetType(ann.targetType ?? 'my_students');
    setAnnTargetIds(ann.targetIds ?? []);
    setSelectedStudentIds(ann.targetStudentIds ?? []);
    setSelectedSectionIds(ann.targetSectionIds ?? []);
    setSelectedGradeLevels(ann.targetGradeLevels ?? []);
    if ((ann.targetStudentIds?.length ?? 0) > 0) {
      setAdminTargetScope('specific');
    } else if ((ann.targetSectionIds?.length ?? 0) > 0) {
      setAdminTargetScope('section');
    } else if ((ann.targetGradeLevels?.length ?? 0) > 0) {
      setAdminTargetScope('grade');
    } else {
      setAdminTargetScope('all_my');
    }
    setShowAnnModal(true);
  }, []);

  const openNewAnnModal = useCallback(() => {
    setEditingAnnId(null);
    setAnnTitle('');
    setAnnMessage('');
    setAnnTargetType(isSuperAdmin ? 'all' : 'my_students');
    setAnnTargetIds([]);
    setAdminTargetScope('all_my');
    setSelectedGradeLevels([]);
    setSelectedSectionIds([]);
    setSelectedStudentIds([]);
    setShowAnnModal(true);
  }, [isSuperAdmin]);

  const handleDeleteAnn = useCallback((annId: string) => {
    Alert.alert('Delete Announcement', 'Remove this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAnnouncement(annId) },
    ]);
  }, [deleteAnnouncement]);

  const handleTogglePin = useCallback(async (annId: string) => {
    if (!currentUser) return;
    try {
      await togglePinAnnouncement(annId, currentUser.id);
    } catch (err) {
      console.log('[Dashboard] Pin toggle error:', err);
    }
  }, [currentUser, togglePinAnnouncement]);

  const toggleTargetId = useCallback((id: string) => {
    setAnnTargetIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const getTargetLabel = (type: AnnouncementTargetType): string => {
    switch (type) {
      case 'all': return 'All (Admins & Students)';
      case 'admins': return 'All Admins';
      case 'students': return 'All Students';
      case 'specific': return 'Specific Users';
      case 'my_students': return 'My Students';
      default: return 'My Students';
    }
  };

  if (!currentUser) return null;

  const toggleSubjectExpand = (subjectId: string) => {
    setExpandedSubject(expandedSubject === subjectId ? null : subjectId);
    setActiveSubjectId(subjectId);
  };



  return (
    <View style={styles.container}>
      <OfflineBanner />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try { await refreshFromCloud(); } finally { setRefreshing(false); }
              }}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{isSuperAdmin ? 'Super Admin' : 'Admin Dashboard'}</Text>
              <Text style={styles.userName}>{currentUser.fullName}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(admin)/admin-profile' as any)}>
              {currentUser.profileImage ? (
                <Image source={{ uri: currentUser.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {currentUser.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Users size={24} color={Colors.accent} />
              <Text style={styles.statNumber}>{students.length}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statCard}>
              <BookOpen size={24} color={Colors.primary} />
              <Text style={styles.statNumber}>{adminSubjects.length}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
            <View style={styles.statCard}>
              <Layers size={24} color={Colors.warning} />
              <Text style={styles.statNumber}>{sections.length}</Text>
              <Text style={styles.statLabel}>Sections</Text>
            </View>
          </View>

          <View style={styles.announcementsSection}>
            <View style={styles.annHeader}>
              <View style={styles.annHeaderLeft}>
                <Megaphone size={18} color={Colors.warning} />
                <Text style={styles.sectionTitle}>Announcements</Text>
              </View>
              <TouchableOpacity style={styles.annAddBtn} onPress={openNewAnnModal}>
                <Plus size={16} color="#000" />
              </TouchableOpacity>
            </View>
            {adminAnnouncements.length === 0 ? (
              <Text style={styles.annEmptyText}>No announcements yet. Post one for your students.</Text>
            ) : (
              adminAnnouncements.slice(0, 8).map(ann => (
                <View key={ann.id} style={[styles.annCard, ann.pinned && styles.annCardPinned]}>
                  <View style={styles.annCardContent}>
                    <View style={styles.annCardTitleRow}>
                      {ann.pinned && (
                        <View style={styles.pinnedBadge}>
                          <Pin size={9} color="#000" />
                          <Text style={styles.pinnedBadgeText}>Pinned</Text>
                        </View>
                      )}
                      <Text style={styles.annCardTitle}>{ann.title}</Text>
                    </View>
                    <View style={styles.annBadgesRow}>
                      {ann.scope === 'global' && (
                        <View style={styles.annTargetBadge}>
                          <Text style={styles.annTargetBadgeText}>Global</Text>
                        </View>
                      )}
                      {ann.scope === 'targeted' && (
                        <View style={[styles.annTargetBadge, { backgroundColor: Colors.primary + '25' }]}>
                          <Text style={[styles.annTargetBadgeText, { color: Colors.primary }]}>Targeted</Text>
                        </View>
                      )}
                      {ann.scope === 'admin_students' && (
                        <View style={[styles.annTargetBadge, { backgroundColor: Colors.warning + '25' }]}>
                          <Text style={[styles.annTargetBadgeText, { color: Colors.warning }]}>My Students</Text>
                        </View>
                      )}
                      {ann.priority === 'important' && (
                        <View style={[styles.annTargetBadge, { backgroundColor: Colors.error + '25' }]}>
                          <Text style={[styles.annTargetBadgeText, { color: Colors.error }]}>Important</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.annCardMsg} numberOfLines={2}>{ann.message}</Text>
                    <Text style={styles.annCardDate}>{new Date(ann.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.annActions}>
                    <TouchableOpacity
                      onPress={() => handleTogglePin(ann.id)}
                      style={styles.annPinBtn}
                    >
                      {ann.pinned ? <PinOff size={14} color={Colors.warning} /> : <Pin size={14} color={Colors.textMuted} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEditAnn(ann)} style={styles.annEditBtn}>
                      <Pencil size={14} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteAnn(ann.id)} style={styles.annDeleteBtn}>
                      <Trash2 size={14} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>Subjects Overview</Text>
          {adminSubjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No subjects available</Text>
            </View>
          ) : (
            adminSubjects.map(subject => {
              const subjectCOCList = getSubjectCOCs(subject.id);
              const isExpanded = expandedSubject === subject.id;
              const isAdopted = subject.isGlobal && subject.adminId !== currentUser.id;

              return (
                <View key={subject.id} style={styles.subjectCard}>
                  <TouchableOpacity
                    style={styles.subjectHeader}
                    onPress={() => toggleSubjectExpand(subject.id)}
                  >
                    <View style={styles.subjectInfo}>
                      <View style={styles.subjectCodeRow}>
                        <Text style={styles.subjectCode}>{subject.code}</Text>
                        {subject.isGlobal && (
                          <View style={styles.globalBadge}>
                            <Globe size={10} color={Colors.accent} />
                            <Text style={styles.globalBadgeText}>Global</Text>
                          </View>
                        )}
                        {isAdopted && (
                          <View style={styles.adoptedBadge}>
                            <UserCheck size={10} color={Colors.primary} />
                            <Text style={styles.adoptedBadgeText}>Adopted</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <Text style={styles.subjectMeta}>
                        {subjectCOCList.length} {subject.unlockType === 'flexible' ? 'Topics' : 'COCs'} · {subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'} unlock
                      </Text>
                    </View>
                    <ChevronDown
                      size={20}
                      color={Colors.textMuted}
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.cocsList}>
                      {subjectCOCList.map((coc) => {
                        const cocLOs = getCOCLOs(coc.id);
                        return (
                          <TouchableOpacity
                            key={coc.id}
                            style={styles.cocItem}
                            onPress={() => router.push(`/coc/${coc.id}` as any)}
                          >
                            <View style={styles.cocNumber}>
                              <Text style={styles.cocNumberText}>{coc.order}</Text>
                            </View>
                            <View style={styles.cocInfo}>
                              <Text style={styles.cocTitle}>
                                {subject.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}: {coc.title}
                              </Text>
                              <Text style={styles.cocDesc} numberOfLines={1}>
                                {cocLOs.length} Learning Outcomes
                              </Text>
                            </View>
                            <ChevronRight size={16} color={Colors.textMuted} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showAnnModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingAnnId ? 'Edit Announcement' : 'Post Announcement'}</Text>
                <TouchableOpacity onPress={() => setShowAnnModal(false)}>
                  <X size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Title"
                placeholderTextColor={Colors.textMuted}
                value={annTitle}
                onChangeText={setAnnTitle}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Message..."
                placeholderTextColor={Colors.textMuted}
                value={annMessage}
                onChangeText={setAnnMessage}
                multiline
                numberOfLines={4}
              />

              {/* Priority Selector */}
              <View style={styles.prioritySection}>
                <Text style={styles.targetLabel}>Priority</Text>
                <View style={styles.targetOptions}>
                  <TouchableOpacity
                    style={[styles.targetOption, annPriority === 'normal' && styles.targetOptionActive]}
                    onPress={() => setAnnPriority('normal')}
                  >
                    <Text style={[styles.targetOptionText, annPriority === 'normal' && styles.targetOptionTextActive]}>
                      Normal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.targetOption, annPriority === 'important' && { backgroundColor: Colors.warning, borderColor: Colors.warning }]}
                    onPress={() => setAnnPriority('important')}
                  >
                    <Text style={[styles.targetOptionText, annPriority === 'important' && { color: '#000', fontWeight: '700' as const }]}>
                      Important
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isSuperAdmin && (
                <View style={styles.targetSection}>
                  <Text style={styles.targetLabel}>Target Audience</Text>
                  <View style={styles.targetOptions}>
                    {(['all', 'admins', 'students', 'specific'] as AnnouncementTargetType[]).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.targetOption, annTargetType === type && styles.targetOptionActive]}
                        onPress={() => {
                          setAnnTargetType(type);
                          if (type !== 'specific') setAnnTargetIds([]);
                        }}
                      >
                        {type === 'all' && <Globe size={14} color={annTargetType === type ? '#000' : Colors.textMuted} />}
                        {type === 'admins' && <UserCheck size={14} color={annTargetType === type ? '#000' : Colors.textMuted} />}
                        {type === 'students' && <Users size={14} color={annTargetType === type ? '#000' : Colors.textMuted} />}
                        {type === 'specific' && <Target size={14} color={annTargetType === type ? '#000' : Colors.textMuted} />}
                        <Text style={[styles.targetOptionText, annTargetType === type && styles.targetOptionTextActive]}>
                          {getTargetLabel(type)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {annTargetType === 'specific' && (
                    <View style={styles.specificTargets}>
                      <TouchableOpacity
                        style={styles.selectTargetBtn}
                        onPress={() => setShowTargetPicker(!showTargetPicker)}
                      >
                        <Text style={styles.selectTargetText}>
                          {annTargetIds.length > 0 ? `${annTargetIds.length} user(s) selected` : 'Select users...'}
                        </Text>
                        <ChevronDown size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                      {showTargetPicker && (
                        <View style={styles.targetPickerList}>
                          {selectableAdmins.length > 0 && (
                            <Text style={styles.targetGroupLabel}>Admins</Text>
                          )}
                          {selectableAdmins.map(user => (
                            <TouchableOpacity
                              key={user.id}
                              style={[styles.targetUserItem, annTargetIds.includes(user.id) && styles.targetUserItemActive]}
                              onPress={() => toggleTargetId(user.id)}
                            >
                              <Text style={styles.targetUserName}>{user.fullName}</Text>
                              <Text style={styles.targetUserEmail}>{user.email}</Text>
                            </TouchableOpacity>
                          ))}
                          {selectableStudents.length > 0 && (
                            <Text style={styles.targetGroupLabel}>Students</Text>
                          )}
                          {selectableStudents.slice(0, 20).map(user => (
                            <TouchableOpacity
                              key={user.id}
                              style={[styles.targetUserItem, annTargetIds.includes(user.id) && styles.targetUserItemActive]}
                              onPress={() => toggleTargetId(user.id)}
                            >
                              <Text style={styles.targetUserName}>{user.fullName}</Text>
                              <Text style={styles.targetUserEmail}>{user.email}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {!isSuperAdmin && (
                <View style={styles.targetSection}>
                  <Text style={styles.targetLabel}>Target Audience</Text>
                  <View style={styles.targetOptions}>
                    {(['all_my', 'grade', 'section', 'specific'] as const).map(scope => (
                      <TouchableOpacity
                        key={scope}
                        style={[styles.targetOption, adminTargetScope === scope && styles.targetOptionActive]}
                        onPress={() => {
                          setAdminTargetScope(scope);
                          if (scope === 'all_my') {
                            setSelectedGradeLevels([]);
                            setSelectedSectionIds([]);
                            setSelectedStudentIds([]);
                          }
                        }}
                      >
                        {scope === 'all_my' && <Users size={14} color={adminTargetScope === scope ? '#000' : Colors.textMuted} />}
                        {scope === 'grade' && <Layers size={14} color={adminTargetScope === scope ? '#000' : Colors.textMuted} />}
                        {scope === 'section' && <BookOpen size={14} color={adminTargetScope === scope ? '#000' : Colors.textMuted} />}
                        {scope === 'specific' && <Target size={14} color={adminTargetScope === scope ? '#000' : Colors.textMuted} />}
                        <Text style={[styles.targetOptionText, adminTargetScope === scope && styles.targetOptionTextActive]}>
                          {scope === 'all_my' ? 'All My Students' : scope === 'grade' ? 'By Grade Level' : scope === 'section' ? 'By Section' : 'Specific Students'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {adminTargetScope === 'grade' && (
                    <View style={styles.specificTargets}>
                      <Text style={styles.targetSubLabel}>Select Grade Level(s)</Text>
                      <View style={styles.chipWrap}>
                        {GRADE_LEVELS.map(gl => (
                          <TouchableOpacity
                            key={gl}
                            style={[styles.chip, selectedGradeLevels.includes(gl) && styles.chipActive]}
                            onPress={() => setSelectedGradeLevels(prev => prev.includes(gl) ? prev.filter(g => g !== gl) : [...prev, gl])}
                          >
                            <Text style={[styles.chipText, selectedGradeLevels.includes(gl) && styles.chipTextActive]}>{gl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {adminTargetScope === 'section' && (
                    <View style={styles.specificTargets}>
                      <Text style={styles.targetSubLabel}>Select Section(s)</Text>
                      {adminOwnSections.length === 0 ? (
                        <Text style={styles.noDataText}>No sections found.</Text>
                      ) : (
                        <View style={styles.chipWrap}>
                          {adminOwnSections.map(sec => (
                            <TouchableOpacity
                              key={sec.id}
                              style={[styles.chip, selectedSectionIds.includes(sec.id) && styles.chipActive]}
                              onPress={() => setSelectedSectionIds(prev => prev.includes(sec.id) ? prev.filter(s => s !== sec.id) : [...prev, sec.id])}
                            >
                              <Text style={[styles.chipText, selectedSectionIds.includes(sec.id) && styles.chipTextActive]}>{sec.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {adminTargetScope === 'specific' && (
                    <View style={styles.specificTargets}>
                      <TouchableOpacity
                        style={styles.selectTargetBtn}
                        onPress={() => setShowAdminTargetPicker(!showAdminTargetPicker)}
                      >
                        <Text style={styles.selectTargetText}>
                          {selectedStudentIds.length > 0 ? `${selectedStudentIds.length} student(s) selected` : 'Select students...'}
                        </Text>
                        <ChevronDown size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                      {showAdminTargetPicker && (
                        <ScrollView style={styles.targetPickerList} nestedScrollEnabled>
                          {adminOwnStudents.length === 0 ? (
                            <Text style={styles.noDataText}>No students found.</Text>
                          ) : (
                            adminOwnStudents.map(stu => (
                              <TouchableOpacity
                                key={stu.id}
                                style={[styles.targetUserItem, selectedStudentIds.includes(stu.id) && styles.targetUserItemActive]}
                                onPress={() => setSelectedStudentIds(prev => prev.includes(stu.id) ? prev.filter(s => s !== stu.id) : [...prev, stu.id])}
                              >
                                <Text style={styles.targetUserName}>{stu.fullName}</Text>
                                <Text style={styles.targetUserEmail}>{stu.gradeLevel ?? 'No grade'} · {stu.email}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.postBtn} onPress={handlePostAnnouncement}>
                <Send size={16} color="#000" />
                <Text style={styles.postBtnText}>{editingAnnId ? 'Save Changes' : 'Post Announcement'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showSuperAnnPopup && superAdminAnnsForMe.length > 0} transparent animationType="none">
        <Animated.View style={[styles.annPopupOverlay, { opacity: popupOpacity }]}>
          <View style={styles.annPopupCard}>
            <View style={styles.annPopupHeader}>
              <View style={styles.annPopupHeaderLeft}>
                <Megaphone size={20} color={Colors.warning} />
                <Text style={styles.annPopupTitle}>System Announcements</Text>
              </View>
              <TouchableOpacity onPress={closeSuperAnnPopup} style={styles.annPopupCloseBtn}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.annPopupScroll} showsVerticalScrollIndicator={false}>
              {superAdminAnnsForMe.map(ann => (
                <View key={ann.id} style={styles.annPopupItem}>
                  <Text style={styles.annPopupItemTitle}>{ann.title}</Text>
                  <Text style={styles.annPopupItemMsg}>{ann.message}</Text>
                  <Text style={styles.annPopupItemDate}>{new Date(ann.createdAt).toLocaleDateString()}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.annPopupDismissBtn} onPress={closeSuperAnnPopup}>
              <Text style={styles.annPopupDismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 24 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  userName: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, marginTop: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.primary },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700' as const, color: '#000' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 28, fontWeight: '800' as const, color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 12, marginTop: 8 },
  subjectCard: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  subjectInfo: { flex: 1 },
  subjectCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  subjectCode: { fontSize: 12, color: Colors.primary, fontWeight: '600' as const },
  globalBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  globalBadgeText: { fontSize: 10, color: Colors.accent, fontWeight: '600' as const },
  adoptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adoptedBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' as const },
  subjectName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  subjectMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cocsList: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  cocItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  cocNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cocNumberText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text },
  cocInfo: { flex: 1 },
  cocTitle: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  cocDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  emptyState: { backgroundColor: Colors.surface, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
  announcementsSection: { marginBottom: 20 },
  annHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  annHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  annEmptyText: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' as const, backgroundColor: Colors.surface, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: Colors.border },
  annCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  annCardPinned: { borderLeftColor: Colors.primary, borderWidth: 1.5, borderColor: Colors.primary + '40', backgroundColor: Colors.primary + '08' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pinnedBadgeText: { fontSize: 9, color: '#000', fontWeight: '700' as const },
  annBadgesRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' as const, marginBottom: 4 },
  annPinBtn: { padding: 6, justifyContent: 'center' as const },
  annCardContent: { flex: 1 },
  annCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  annCardTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  annTargetBadge: { backgroundColor: Colors.accent + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annTargetBadgeText: { fontSize: 10, color: Colors.accent, fontWeight: '600' as const },
  annCardMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  annCardDate: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  annActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  annEditBtn: { padding: 6, justifyContent: 'center' as const },
  annDeleteBtn: { padding: 6, justifyContent: 'center' as const },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 20 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center' as const },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '90%' as const },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  modalInput: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 14, marginBottom: 12 },
  modalTextArea: { minHeight: 100, textAlignVertical: 'top' as const },
  targetSection: { marginBottom: 12 },
  prioritySection: { marginBottom: 12 },
  targetLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8 },
  targetOptions: { gap: 6 },
  targetOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  targetOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  targetOptionText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  targetOptionTextActive: { color: '#000' },
  specificTargets: { marginTop: 10 },
  selectTargetBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  selectTargetText: { fontSize: 13, color: Colors.textSecondary },
  targetPickerList: { marginTop: 8, maxHeight: 200, backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 8 },
  targetGroupLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  targetUserItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  targetUserItemActive: { backgroundColor: Colors.primary + '25' },
  targetUserName: { fontSize: 13, color: Colors.text, fontWeight: '500' as const },
  targetUserEmail: { fontSize: 11, color: Colors.textMuted },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, height: 48, marginTop: 4 },
  postBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
  annPopupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  annPopupCard: { backgroundColor: Colors.surface, borderRadius: 20, width: '100%', maxHeight: '70%', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  annPopupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  annPopupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  annPopupTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  annPopupCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  annPopupScroll: { paddingHorizontal: 20, paddingTop: 12, maxHeight: 320 },
  annPopupItem: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  annPopupItemTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  annPopupItemMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  annPopupItemDate: { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  annPopupDismissBtn: { marginHorizontal: 20, marginBottom: 18, marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12, height: 46, justifyContent: 'center', alignItems: 'center' },
  annPopupDismissText: { fontSize: 15, fontWeight: '700' as const, color: '#000' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetSubLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const },
  chipTextActive: { color: '#000' },
  noDataText: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' as const, paddingVertical: 8 },
});
