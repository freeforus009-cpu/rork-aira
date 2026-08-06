import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, Edit3, Trash2, Users, Archive, FolderOpen, ChevronDown, ChevronUp, KeyRound, BarChart3, CheckSquare, Square, GraduationCap, Eye } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import Colors from '@/constants/colors';
import { GRADE_LEVELS, GradeLevel } from '@/types';

export default function SectionsMgmtScreen() {
  const router = useRouter();
  const { currentUser, sections, students, subjects, archivedStudents, addSection, editSection, deleteSection, archiveSection, resetStudentPassword, deleteStudent, archiveStudent } = useAuth();
  const { getSectionProgressData, toggleAdminCheck, getSubjectCOCs } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState<string | null>(null);
  const [progressSubjectId, setProgressSubjectId] = useState<string | null>(null);

  const adminSubjects = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.role === 'super_admin' 
      ? subjects.filter(s => !s.archived)
      : subjects.filter(s => s.adminId === currentUser.id && !s.archived);
  }, [currentUser, subjects]);

  const resetForm = useCallback(() => { setName(''); setDescription(''); setGradeLevel(''); setIsAdding(false); setEditingId(null); }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return Alert.alert('Error', 'Section name is required');
    setIsLoading(true);
    try {
      if (editingId) { await editSection(editingId, { name: name.trim(), description: description.trim(), gradeLevel: gradeLevel || undefined }); }
      else { await addSection(name.trim(), description.trim(), gradeLevel || undefined); }
      resetForm();
    } catch (error) { Alert.alert('Error', 'Failed to save section'); }
    finally { setIsLoading(false); }
  }, [name, description, gradeLevel, editingId, addSection, editSection, resetForm]);

  const handleEdit = useCallback((section: { id: string; name: string; description: string; gradeLevel?: GradeLevel }) => {
    setEditingId(section.id); setName(section.name); setDescription(section.description); setGradeLevel(section.gradeLevel || ''); setIsAdding(true);
  }, []);

  const handleDelete = useCallback((sectionId: string, sectionName: string) => {
    const studentCount = students.filter(s => s.sectionId === sectionId).length;
    Alert.alert('Delete Section', `Delete "${sectionName}"?${studentCount > 0 ? `\n\n${studentCount} student(s) will be unassigned.` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSection(sectionId) },
    ]);
  }, [deleteSection, students]);

  const getSectionStudents = useCallback((sectionId: string) => students.filter(s => s.sectionId === sectionId), [students]);

  const handleResetPassword = useCallback((userId: string, studentName: string) => {
    Alert.alert('Reset Password', `Reset password for ${studentName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset to "student123"', onPress: () => { resetStudentPassword(userId, 'student123'); Alert.alert('Success', 'Password reset to "student123".'); }},
    ]);
  }, [resetStudentPassword]);

  const handleDeleteStudent = useCallback((userId: string, studentName: string) => {
    Alert.alert('Delete Student', `Permanently delete "${studentName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteStudent(userId) },
    ]);
  }, [deleteStudent]);

  const handleArchiveStudent = useCallback((userId: string, studentName: string) => {
    Alert.alert('Archive Student', `Archive "${studentName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => archiveStudent(userId) },
    ]);
  }, [archiveStudent]);

  const handleToggleProgress = useCallback((sectionId: string) => {
    if (showProgress === sectionId) {
      setShowProgress(null);
      setProgressSubjectId(null);
    } else {
      setShowProgress(sectionId);
      if (adminSubjects.length > 0 && !progressSubjectId) {
        setProgressSubjectId(adminSubjects[0].id);
      }
    }
  }, [showProgress, adminSubjects, progressSubjectId]);

  const handleAdminCheck = useCallback(async (userId: string, loId: string, subjectId: string) => {
    if (!currentUser) return;
    await toggleAdminCheck(currentUser.id, userId, loId, subjectId);
    console.log('[Admin] Toggled progress check for user', userId, 'lo', loId);
  }, [currentUser, toggleAdminCheck]);

  const activeSections = sections.filter(s => !s.archived);
  const archivedSections = sections.filter(s => s.archived);

  const renderProgressChart = (sectionId: string) => {
    if (!progressSubjectId || !currentUser) return null;
    const sectionStudents = getSectionStudents(sectionId).map(s => ({ id: s.id, fullName: s.fullName }));
    if (sectionStudents.length === 0) return <Text style={styles.noStudentsText}>No students to show progress for</Text>;

    const chartData = getSectionProgressData(sectionStudents, progressSubjectId);
    const activeSubject = adminSubjects.find(s => s.id === progressSubjectId);

    return (
      <View style={styles.progressChartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View style={styles.chartHeaderRow}>
              <View style={styles.chartNameCell}>
                <Text style={styles.chartHeaderText}>Student</Text>
              </View>
              {chartData.learningOutcomes.map((lo, idx) => (
                <View key={lo.id} style={styles.chartLOCell}>
                  <Text style={styles.chartLOText} numberOfLines={2}>LO{idx + 1}</Text>
                </View>
              ))}
            </View>

            {chartData.students.map(student => (
              <View key={student.id} style={styles.chartRow}>
                <View style={styles.chartNameCell}>
                  <Text style={styles.chartStudentName} numberOfLines={1}>{student.fullName}</Text>
                </View>
                {student.checks.map((check, idx) => (
                  <TouchableOpacity
                    key={chartData.learningOutcomes[idx].id}
                    style={styles.chartCheckCell}
                    onPress={() => handleAdminCheck(student.id, chartData.learningOutcomes[idx].id, progressSubjectId)}
                  >
                    {check.adminChecked ? (
                      <CheckSquare size={18} color={Colors.primary} />
                    ) : check.passed ? (
                      <Square size={18} color={Colors.success + '80'} />
                    ) : (
                      <Square size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        {activeSubject && (
          <Text style={styles.chartNote}>
            {activeSubject.unlockType === 'sequential'
              ? 'Sequential: Check marks require admin validation'
              : 'Flexible: Progress auto-reflects'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Manage Sections</Text>
              <Text style={styles.pageSubtitle}>{activeSections.length} active sections</Text>
            </View>
            <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addBtn} disabled={isAdding}>
              <Plus size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {isAdding && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{editingId ? 'Edit Section' : 'Add New Section'}</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Section Name (e.g., Grade 12 - ICT A)" placeholderTextColor={Colors.textMuted} />
              <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
              <Text style={styles.gradeLevelLabel}>Assign Grade Level</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeLevelRow}>
                {GRADE_LEVELS.map(gl => (
                  <TouchableOpacity
                    key={gl}
                    style={[styles.gradeChip, gradeLevel === gl && styles.gradeChipActive]}
                    onPress={() => setGradeLevel(gradeLevel === gl ? '' : gl)}
                  >
                    <Text style={[styles.gradeChipText, gradeLevel === gl && styles.gradeChipTextActive]}>{gl}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.saveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeSections.length === 0 && !isAdding ? (
            <View style={styles.emptyState}><FolderOpen size={48} color={Colors.textMuted} /><Text style={styles.emptyText}>No sections created yet</Text></View>
          ) : (
            activeSections.map((section) => {
              const sectionStudents = getSectionStudents(section.id);
              const isExpanded = expandedSection === section.id;
              const isProgressVisible = showProgress === section.id;
              return (
                <View key={section.id} style={styles.sectionCard}>
                  <TouchableOpacity style={styles.sectionCardHeader} onPress={() => setExpandedSection(isExpanded ? null : section.id)}>
                    <View style={styles.sectionInfo}>
                      <Text style={styles.sectionName}>{section.name}</Text>
                      {section.description ? <Text style={styles.sectionDesc} numberOfLines={1}>{section.description}</Text> : null}
                      {section.gradeLevel && (
                      <View style={styles.gradeBadge}><GraduationCap size={12} color={Colors.accent} /><Text style={styles.gradeBadgeText}>{section.gradeLevel}</Text></View>
                    )}
                    <View style={styles.studentCount}><Users size={14} color={Colors.primary} /><Text style={styles.studentCountText}>{sectionStudents.length} students</Text></View>
                    </View>
                    <View style={styles.sectionActions}>
                      <TouchableOpacity style={styles.iconButton} onPress={() => handleEdit(section)}><Edit3 size={16} color={Colors.primary} /></TouchableOpacity>
                      <TouchableOpacity style={styles.iconButtonDanger} onPress={() => handleDelete(section.id, section.name)}><Trash2 size={16} color={Colors.error} /></TouchableOpacity>
                      {isExpanded ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.tabRow}>
                        <TouchableOpacity
                          style={[styles.tabBtn, !isProgressVisible && styles.tabBtnActive]}
                          onPress={() => setShowProgress(null)}
                        >
                          <Users size={14} color={!isProgressVisible ? '#000' : Colors.textMuted} />
                          <Text style={[styles.tabBtnText, !isProgressVisible && styles.tabBtnTextActive]}>Students</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.tabBtn, isProgressVisible && styles.tabBtnActive]}
                          onPress={() => handleToggleProgress(section.id)}
                        >
                          <BarChart3 size={14} color={isProgressVisible ? '#000' : Colors.textMuted} />
                          <Text style={[styles.tabBtnText, isProgressVisible && styles.tabBtnTextActive]}>Progress Chart</Text>
                        </TouchableOpacity>
                      </View>

                      {isProgressVisible ? (
                        <View style={styles.progressSection}>
                          {adminSubjects.length > 1 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectChipRow}>
                              {adminSubjects.map(subj => (
                                <TouchableOpacity
                                  key={subj.id}
                                  style={[styles.subjectChip, progressSubjectId === subj.id && styles.subjectChipActive]}
                                  onPress={() => setProgressSubjectId(subj.id)}
                                >
                                  <Text style={[styles.subjectChipText, progressSubjectId === subj.id && styles.subjectChipTextActive]}>{subj.code}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                          {renderProgressChart(section.id)}
                        </View>
                      ) : (
                        <View style={styles.studentsList}>
                          {sectionStudents.length === 0 ? (
                            <Text style={styles.noStudentsText}>No students in this section</Text>
                          ) : (
                            sectionStudents.map(student => (
                              <View key={student.id} style={styles.studentRow}>
                                <View style={styles.studentLeft}>
                                  {student.profileImage ? (
                                    <Image source={{ uri: student.profileImage }} style={styles.studentAvatar} />
                                  ) : (
                                    <View style={styles.studentAvatarPlaceholder}><Text style={styles.studentAvatarText}>{student.fullName.charAt(0).toUpperCase()}</Text></View>
                                  )}
                                  <View style={styles.studentInfo}>
                                    <Text style={styles.studentName}>{student.fullName}</Text>
                                    <Text style={styles.studentEmail}>@{student.username} · {student.email}{student.gradeLevel ? ` · ${student.gradeLevel}` : ''}</Text>
                                  </View>
                                </View>
                                <View style={styles.studentActions}>
                                  <TouchableOpacity style={styles.smallBtn} onPress={() => router.push(`/student-detail/${student.id}` as any)}><Eye size={12} color={Colors.primary} /></TouchableOpacity>
                                  <TouchableOpacity style={styles.smallBtn} onPress={() => handleResetPassword(student.id, student.fullName)}><KeyRound size={12} color={Colors.warning} /></TouchableOpacity>
                                  <TouchableOpacity style={styles.smallBtn} onPress={() => handleArchiveStudent(student.id, student.fullName)}><Archive size={12} color={Colors.accent} /></TouchableOpacity>
                                  <TouchableOpacity style={styles.smallBtnDanger} onPress={() => handleDeleteStudent(student.id, student.fullName)}><Trash2 size={12} color={Colors.error} /></TouchableOpacity>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {archivedSections.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Archived Sections</Text>
              {archivedSections.map((section) => (
                <View key={section.id} style={[styles.sectionCard, { opacity: 0.7 }]}>
                  <View style={styles.sectionCardHeader}>
                    <View style={styles.sectionInfo}><Text style={styles.sectionName}>{section.name}</Text><View style={styles.studentCount}><Users size={14} color={Colors.textMuted} /><Text style={[styles.studentCountText, { color: Colors.textMuted }]}>{getSectionStudents(section.id).length} students</Text></View></View>
                    <TouchableOpacity style={styles.iconButton} onPress={() => archiveSection(section.id)}><Archive size={18} color={Colors.primary} /></TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 18 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  formCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  input: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, marginBottom: 12 },
  textArea: { height: 80, textAlignVertical: 'top' as const },
  formActions: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  saveButton: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#000', fontSize: 14, fontWeight: '600' as const },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  emptyText: { marginTop: 12, fontSize: 14, color: Colors.textMuted },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  sectionInfo: { flex: 1 },
  sectionName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  studentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  studentCountText: { fontSize: 12, fontWeight: '500' as const, color: Colors.primary },
  sectionActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '15' },
  iconButtonDanger: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.error + '15' },
  expandedContent: { borderTopWidth: 1, borderTopColor: Colors.border },
  tabRow: { flexDirection: 'row', padding: 8, gap: 6 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surfaceLight },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted },
  tabBtnTextActive: { color: '#000' },
  studentsList: { paddingHorizontal: 16, paddingVertical: 12 },
  noStudentsText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' as const, paddingVertical: 16 },
  studentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  studentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: Colors.border },
  studentAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  studentAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  studentEmail: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  studentActions: { flexDirection: 'row', gap: 6 },
  smallBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  smallBtnDanger: { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center' },
  progressSection: { paddingHorizontal: 12, paddingBottom: 12 },
  subjectChipRow: { marginBottom: 10 },
  subjectChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  subjectChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subjectChipText: { fontSize: 12, fontWeight: '500' as const, color: Colors.text },
  subjectChipTextActive: { color: '#000' },
  progressChartContainer: { borderRadius: 10, overflow: 'hidden' },
  chartHeaderRow: { flexDirection: 'row', backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chartNameCell: { width: 120, paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  chartHeaderText: { fontSize: 11, fontWeight: '700' as const, color: Colors.text },
  chartLOCell: { width: 50, paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  chartLOText: { fontSize: 10, fontWeight: '600' as const, color: Colors.textSecondary, textAlign: 'center' as const },
  chartRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  chartStudentName: { fontSize: 12, color: Colors.text, fontWeight: '500' as const },
  chartCheckCell: { width: 50, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  chartNote: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' as const, marginTop: 8, textAlign: 'center' as const },
  gradeLevelLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8 },
  gradeLevelRow: { marginBottom: 14, flexGrow: 0 },
  gradeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  gradeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gradeChipText: { fontSize: 12, fontWeight: '500' as const, color: Colors.text },
  gradeChipTextActive: { color: '#000' },
  gradeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  gradeBadgeText: { fontSize: 11, fontWeight: '500' as const, color: Colors.accent },
});
