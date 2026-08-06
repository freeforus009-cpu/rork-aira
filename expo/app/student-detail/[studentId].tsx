import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking,
  TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  CheckSquare, Square, FileText, ExternalLink, Video, Link2,
  ChevronDown, ChevronUp, Award, BookOpen, ClipboardList, Plus, X,
  GraduationCap, KeyRound, Lock, ShieldAlert, EyeOff, Eye, TrendingUp,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import ProgressBar from '@/components/ProgressBar';
import Colors from '@/constants/colors';
import type { Quarter } from '@/types';

const QUARTERS: Quarter[] = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'];

export default function StudentDetailScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { allUsers, subjects, sections, currentUser, resetUserPassword, resetStudentPassword } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const {
    cocs, learningOutcomes, getStudentProgress, getCOCProgress,
    getOverallProgress, getStudentSubmissions, toggleValidation,
    getStudentActivities, getStudentQuizAttempts, addActivity,
    gradeSubmission, getStudentQuizViolations, acknowledgeViolation,
    getDocProgress,
  } = useData();

  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [showGradeModal, setShowGradeModal] = useState<boolean>(false);
  const [gradingSubId, setGradingSubId] = useState<string>('');
  const [gradeScore, setGradeScore] = useState<string>('');
  const [gradeMax, setGradeMax] = useState<string>('100');
  const [gradeRemarks, setGradeRemarks] = useState<string>('');
  const [showActivityModal, setShowActivityModal] = useState<boolean>(false);
  const [activityLoId, setActivityLoId] = useState<string>('');
  const [activitySubjectId, setActivitySubjectId] = useState<string>('');
  const [activityScore, setActivityScore] = useState<string>('');
  const [activityMaxScore, setActivityMaxScore] = useState<string>('100');
  const [activityQuarter, setActivityQuarter] = useState<Quarter>('Quarter 1');
  const [activityRemarks, setActivityRemarks] = useState<string>('');
  const [showResetPwdModal, setShowResetPwdModal] = useState<boolean>(false);
  const [newPwd, setNewPwd] = useState<string>('');

  const student = useMemo(() => allUsers.find(u => u.id === studentId), [allUsers, studentId]);
  const studentSection = useMemo(() => {
    if (!student?.sectionId) return null;
    return sections.find(s => s.id === student.sectionId) ?? null;
  }, [student, sections]);

  const enrolledSubjects = useMemo(() => {
    if (!student) return [];
    const ids = student.subjectIds || [];
    return subjects.filter(s => ids.includes(s.id) && !s.archived);
  }, [student, subjects]);

  const overall = useMemo(() => student ? getOverallProgress(student.id) : { total: 0, completed: 0, percentage: 0 }, [student, getOverallProgress]);
  const studentProg = useMemo(() => student ? getStudentProgress(student.id) : [], [student, getStudentProgress]);
  const studentSubs = useMemo(() => student ? getStudentSubmissions(student.id) : [], [student, getStudentSubmissions]);
  const studentActivities = useMemo(() => student ? getStudentActivities(student.id) : [], [student, getStudentActivities]);
  const studentQuizAttempts = useMemo(() => student ? getStudentQuizAttempts(student.id) : [], [student, getStudentQuizAttempts]);
  const studentViolations = useMemo(() => student ? getStudentQuizViolations(student.id) : [], [student, getStudentQuizViolations]);
  const studentDocProgress = useMemo(() => student ? getDocProgress : undefined, [student, getDocProgress]);

  const canResetPassword = (() => {
    if (!currentUser || !student) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'admin') {
      if (student.role === 'student' && student.adminId === currentUser.id) return true;
      if (student.role === 'admin' && student.accountType === 'teacher' && student.schoolOrganization === currentUser.schoolOrganization) return true;
    }
    return false;
  })();

  const handleResetStudentPassword = async () => {
    if (!student || !newPwd.trim() || newPwd.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    try {
      if (currentUser?.role === 'super_admin' || (currentUser?.role === 'admin' && student.role !== 'student')) {
        await resetUserPassword(student.id, newPwd);
      } else {
        await resetStudentPassword(student.id, newPwd);
      }
      setShowResetPwdModal(false);
      setNewPwd('');
      showSuccess(`Password reset for ${student.fullName}`);
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Failed to reset password');
    }
  };

  if (!student) return null;

  const openFile = (url: string, name: string) => {
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('content://')) {
      formattedUrl = 'https://' + url;
    }
    Linking.openURL(formattedUrl).catch(() => {
      Alert.alert('Error', `Could not open "${name}".`);
    });
  };

  const getSubIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText size={14} color={Colors.accent} />;
      case 'video': return <Video size={14} color={Colors.error} />;
      default: return <Link2 size={14} color={Colors.primary} />;
    }
  };

  const handleToggleValidation = (subId: string, subName: string, currentlyValidated: boolean) => {
    const action = currentlyValidated ? 'Unvalidate' : 'Validate';
    Alert.alert(`${action} Submission`, `${action} "${subName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, onPress: () => toggleValidation(subId, student.id) },
    ]);
  };

  const openGradeModal = (subId: string) => {
    setGradingSubId(subId);
    setGradeScore('');
    setGradeMax('100');
    setGradeRemarks('');
    setShowGradeModal(true);
  };

  const handleGradeSubmission = async () => {
    const score = parseInt(gradeScore, 10);
    const max = parseInt(gradeMax, 10);
    if (isNaN(score) || isNaN(max) || score < 0 || max <= 0) {
      Alert.alert('Error', 'Please enter valid score values');
      return;
    }
    await gradeSubmission(gradingSubId, score, max, gradeRemarks.trim() || undefined);
    setShowGradeModal(false);
    Alert.alert('Success', 'Submission graded successfully');
  };

  const openActivityModal = (loId: string, subjectId: string) => {
    setActivityLoId(loId);
    setActivitySubjectId(subjectId);
    setActivityScore('');
    setActivityMaxScore('100');
    setActivityQuarter('Quarter 1');
    setActivityRemarks('');
    setShowActivityModal(true);
  };

  const handleAddActivity = useCallback(async () => {
    const score = parseInt(activityScore, 10);
    const max = parseInt(activityMaxScore, 10);
    if (isNaN(score) || isNaN(max) || score < 0 || max <= 0) {
      Alert.alert('Error', 'Please enter valid score values');
      return;
    }
    await addActivity({
      studentId: student.id,
      adminId: student.adminId || '',
      subjectId: activitySubjectId,
      loId: activityLoId,
      type: 'performance_task',
      score,
      maxScore: max,
      quarter: activityQuarter,
      remarks: activityRemarks.trim() || undefined,
    });
    setShowActivityModal(false);
    Alert.alert('Success', 'Activity score added');
  }, [student, activityScore, activityMaxScore, activityQuarter, activityRemarks, activityLoId, activitySubjectId, addActivity]);

  const getAvgQuizScore = (subjectId: string) => {
    const attempts = studentQuizAttempts.filter(a => a.subjectId === subjectId && a.isPassed);
    if (attempts.length === 0) return null;
    const total = attempts.reduce((sum, a) => sum + (a.score / a.totalItems) * 100, 0);
    return (total / attempts.length).toFixed(0);
  };

  const getAvgActivityScore = (subjectId: string) => {
    const acts = studentActivities.filter(a => a.subjectId === subjectId);
    if (acts.length === 0) return null;
    const total = acts.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0);
    return (total / acts.length).toFixed(0);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: student.fullName, headerBackTitle: 'Back' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          {student.profileImage ? (
            <Image source={{ uri: student.profileImage }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{student.fullName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.studentName}>{student.fullName}</Text>
          <Text style={styles.studentEmail}>{student.email}</Text>
          <View style={styles.metaRow}>
            {student.gradeLevel && (
              <View style={styles.metaBadge}>
                <GraduationCap size={12} color={Colors.accent} />
                <Text style={styles.metaBadgeText}>{student.gradeLevel}</Text>
              </View>
            )}
            {studentSection && (
              <View style={styles.metaBadge}>
                <BookOpen size={12} color={Colors.primary} />
                <Text style={styles.metaBadgeText}>{studentSection.name}</Text>
              </View>
            )}
          </View>
          <View style={styles.overallProgress}>
            <ProgressBar percentage={overall.percentage} height={8} />
            <Text style={styles.overallText}>
              Overall: {overall.completed}/{overall.total} LOs ({overall.percentage.toFixed(0)}%)
            </Text>
          </View>
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{enrolledSubjects.length}</Text>
              <Text style={styles.quickStatLabel}>Subjects</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{studentSubs.length}</Text>
              <Text style={styles.quickStatLabel}>Uploads</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{studentQuizAttempts.length}</Text>
              <Text style={styles.quickStatLabel}>Quiz Attempts</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatValue, studentViolations.length > 0 && { color: Colors.warning }]}>{studentViolations.length}</Text>
              <Text style={styles.quickStatLabel}>Violations</Text>
            </View>
          </View>
          {canResetPassword && (
            <TouchableOpacity style={styles.resetPwdBtn} onPress={() => { setShowResetPwdModal(true); setNewPwd(''); }}>
              <KeyRound size={16} color={Colors.accent} />
              <Text style={styles.resetPwdText}>Reset Password</Text>
            </TouchableOpacity>
          )}
        </View>

        {studentViolations.length > 0 && (
          <View style={styles.violationsSection}>
            <View style={styles.violationsHeader}>
              <ShieldAlert size={18} color={Colors.warning} />
              <Text style={styles.violationsTitle}>Quiz Violations</Text>
              <View style={styles.violationsCountBadge}>
                <Text style={styles.violationsCountText}>{studentViolations.length}</Text>
              </View>
            </View>
            {studentViolations.slice(0, 10).map((v) => {
              const vIcon = v.type === 'tab_switch' ? EyeOff : v.type === 'window_blur' ? Eye : EyeOff;
              const VIcon = vIcon;
              const vLabel = v.type === 'tab_switch' ? 'Switched Tab' : v.type === 'window_blur' ? 'Lost Focus' : 'Left Quiz';
              return (
                <View key={v.id} style={[styles.violationItem, v.acknowledged && styles.violationItemAck]}>
                  <View style={styles.violationItemLeft}>
                    <VIcon size={14} color={v.acknowledged ? Colors.textMuted : Colors.warning} />
                    <View style={styles.violationItemInfo}>
                      <Text style={[styles.violationItemTitle, v.acknowledged && { color: Colors.textMuted }]}>{vLabel}</Text>
                      <Text style={styles.violationItemMeta}>
                        Q{v.questionIndex + 1} · {new Date(v.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  {!v.acknowledged && (
                    <TouchableOpacity
                      style={styles.ackBtn}
                      onPress={() => acknowledgeViolation(v.id)}
                    >
                      <Text style={styles.ackBtnText}>Ack</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {studentViolations.length > 10 && (
              <Text style={styles.violationsMoreText}>+{studentViolations.length - 10} more violations...</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Subjects & Scores</Text>

        {enrolledSubjects.map(subject => {
          const isExpanded = expandedSubject === subject.id;
          const subjectCOCs = cocs.filter(c => c.subjectId === subject.id && !c.archived).sort((a, b) => a.order - b.order);
          const avgQuiz = getAvgQuizScore(subject.id);
          const avgActivity = getAvgActivityScore(subject.id);
          const subSubs = studentSubs.filter(s => s.subjectId === subject.id);
          const subActivities = studentActivities.filter(a => a.subjectId === subject.id);
          const subAttempts = studentQuizAttempts.filter(a => a.subjectId === subject.id);

          return (
            <View key={subject.id} style={styles.subjectSection}>
              <TouchableOpacity style={styles.subjectHeader} onPress={() => setExpandedSubject(isExpanded ? null : subject.id)}>
                <View style={styles.subjectHeaderLeft}>
                  <View style={styles.subjectCodeRow}>
                    <Text style={styles.subjectCode}>{subject.code}</Text>
                    {subject.gradeLevel && <Text style={styles.subjectGrade}>{subject.gradeLevel}</Text>}
                    {subject.semester && <Text style={styles.subjectSem}>{subject.semester}</Text>}
                  </View>
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <View style={styles.scoreRow}>
                    {avgQuiz !== null && (
                      <View style={styles.scoreBadge}>
                        <ClipboardList size={10} color={Colors.primary} />
                        <Text style={styles.scoreBadgeText}>Quiz: {avgQuiz}%</Text>
                      </View>
                    )}
                    {avgActivity !== null && (
                      <View style={[styles.scoreBadge, { backgroundColor: Colors.warning + '20' }]}>
                        <Award size={10} color={Colors.warning} />
                        <Text style={[styles.scoreBadgeText, { color: Colors.warning }]}>Task: {avgActivity}%</Text>
                      </View>
                    )}
                  </View>
                </View>
                {isExpanded ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.subjectContent}>
                  {subjectCOCs.map(coc => {
                    const cocProg = getCOCProgress(student.id, coc.id);
                    const cocLOs = learningOutcomes.filter(lo => lo.cocId === coc.id && !lo.archived).sort((a, b) => a.order - b.order);
                    return (
                      <View key={coc.id} style={styles.cocBlock}>
                        <View style={styles.cocBlockHeader}>
                          <Text style={styles.cocBlockTitle}>
                            {subject.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}: {coc.title}
                          </Text>
                          <Text style={styles.cocBlockProg}>{cocProg.completed}/{cocProg.total}</Text>
                        </View>
                        <ProgressBar percentage={cocProg.percentage} height={3} />

                        {cocLOs.map(lo => {
                          const prog = studentProg.find(p => p.loId === lo.id && p.subjectId === subject.id);
                          const isPassed = prog?.passed || false;
                          const loSubs = subSubs.filter(s => s.loId === lo.id);
                          const loActivities = subActivities.filter(a => a.loId === lo.id);
                          const loAttempts = subAttempts.filter(a => a.loId === lo.id);

                          return (
                            <View key={lo.id} style={styles.loBlock}>
                              <View style={styles.loBlockHeader}>
                                <View style={styles.loBlockCheck}>
                                  {isPassed ? <CheckSquare size={16} color={Colors.primary} /> : <Square size={16} color={Colors.textMuted} />}
                                </View>
                                <View style={styles.loBlockInfo}>
                                  <Text style={styles.loBlockTitle} numberOfLines={1}>LO {lo.order}: {lo.title}</Text>
                                  {prog ? (
                                    <Text style={isPassed ? styles.passedText : styles.failedText}>
                                      {isPassed
                                        ? `Passed (${prog.score}/${prog.totalItems ?? 20}) · ${prog.attempts} attempt${prog.attempts !== 1 ? 's' : ''}`
                                        : `In Progress · ${prog.attempts} attempt${prog.attempts !== 1 ? 's' : ''} · Score: ${prog.score}/${prog.totalItems ?? 20}`}
                                    </Text>
                                  ) : (
                                    <Text style={styles.lockedText}>Not started</Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  style={styles.addActivityBtn}
                                  onPress={() => openActivityModal(lo.id, subject.id)}
                                >
                                  <Plus size={12} color={Colors.primary} />
                                </TouchableOpacity>
                              </View>

                              {loAttempts.length > 0 && (
                                <View style={styles.scoresBlock}>
                                  <Text style={styles.scoresLabel}>Written Test (Quiz)</Text>
                                  {loAttempts.map((attempt, idx) => (
                                    <View key={attempt.id} style={styles.scoreItem}>
                                      <Text style={styles.scoreItemLabel}>Attempt {idx + 1}</Text>
                                      <Text style={[styles.scoreItemValue, attempt.isPassed ? styles.scoreGreen : styles.scoreRed]}>
                                        {attempt.score}/{attempt.totalItems} ({((attempt.score / attempt.totalItems) * 100).toFixed(0)}%)
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                              {loActivities.length > 0 && (
                                <View style={styles.scoresBlock}>
                                  <Text style={styles.scoresLabel}>Performance Task</Text>
                                  {loActivities.map(act => (
                                    <View key={act.id} style={styles.scoreItem}>
                                      <Text style={styles.scoreItemLabel}>{act.quarter ?? 'N/A'}</Text>
                                      <Text style={styles.scoreItemValue}>{act.score}/{act.maxScore}</Text>
                                      {act.remarks && <Text style={styles.scoreRemarks}>{act.remarks}</Text>}
                                    </View>
                                  ))}
                                </View>
                              )}

                              {loSubs.length > 0 && (
                                <View style={styles.subsSection}>
                                  <Text style={styles.scoresLabel}>Uploads</Text>
                                  {loSubs.map(sub => (
                                    <View key={sub.id} style={styles.subItem}>
                                      <View style={styles.subTopRow}>
                                        {getSubIcon(sub.type)}
                                        <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                                        <TouchableOpacity
                                          style={styles.validationCheckbox}
                                          onPress={() => handleToggleValidation(sub.id, sub.name, sub.validated)}
                                        >
                                          {sub.validated ? <CheckSquare size={14} color={Colors.primary} /> : <Square size={14} color={Colors.textMuted} />}
                                        </TouchableOpacity>
                                      </View>
                                      <View style={styles.subActions}>
                                        <TouchableOpacity style={styles.openBtn} onPress={() => openFile(sub.url, sub.name)}>
                                          <ExternalLink size={11} color={Colors.accent} />
                                          <Text style={styles.openBtnText}>Open</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.gradeBtn} onPress={() => openGradeModal(sub.id)}>
                                          <Award size={11} color={Colors.warning} />
                                          <Text style={styles.gradeBtnText}>Grade</Text>
                                        </TouchableOpacity>
                                        {sub.grade !== undefined && (
                                          <Text style={styles.gradeDisplay}>{sub.grade}/{sub.maxGrade}</Text>
                                        )}
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {enrolledSubjects.length === 0 && (
          <View style={styles.emptyState}>
            <BookOpen size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No subjects enrolled</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showGradeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grade Submission</Text>
              <TouchableOpacity onPress={() => setShowGradeModal(false)}><X size={20} color={Colors.text} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Score</Text>
            <TextInput style={styles.modalInput} placeholder="Score" placeholderTextColor={Colors.textMuted} value={gradeScore} onChangeText={setGradeScore} keyboardType="numeric" />
            <Text style={styles.inputLabel}>Max Score</Text>
            <TextInput style={styles.modalInput} placeholder="Max Score" placeholderTextColor={Colors.textMuted} value={gradeMax} onChangeText={setGradeMax} keyboardType="numeric" />
            <Text style={styles.inputLabel}>Remarks (optional)</Text>
            <TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Remarks..." placeholderTextColor={Colors.textMuted} value={gradeRemarks} onChangeText={setGradeRemarks} multiline />
            <TouchableOpacity style={styles.saveBtn} onPress={handleGradeSubmission}>
              <Text style={styles.saveBtnText}>Save Grade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showActivityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Performance Task Score</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}><X size={20} color={Colors.text} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Quarter</Text>
            <View style={styles.quarterRow}>
              {QUARTERS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.quarterChip, activityQuarter === q && styles.quarterChipActive]}
                  onPress={() => setActivityQuarter(q)}
                >
                  <Text style={[styles.quarterChipText, activityQuarter === q && styles.quarterChipTextActive]}>{q.replace('Quarter ', 'Q')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Score</Text>
            <TextInput style={styles.modalInput} placeholder="Score" placeholderTextColor={Colors.textMuted} value={activityScore} onChangeText={setActivityScore} keyboardType="numeric" />
            <Text style={styles.inputLabel}>Max Score</Text>
            <TextInput style={styles.modalInput} placeholder="Max Score" placeholderTextColor={Colors.textMuted} value={activityMaxScore} onChangeText={setActivityMaxScore} keyboardType="numeric" />
            <Text style={styles.inputLabel}>Remarks (optional)</Text>
            <TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Remarks..." placeholderTextColor={Colors.textMuted} value={activityRemarks} onChangeText={setActivityRemarks} multiline />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddActivity}>
              <Text style={styles.saveBtnText}>Save Score</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showResetPwdModal} transparent animationType="slide" onRequestClose={() => { setShowResetPwdModal(false); setNewPwd(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => { setShowResetPwdModal(false); setNewPwd(''); }}><X size={20} color={Colors.text} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>New password for {student.fullName}</Text>
            <View style={styles.pwdInputRow}>
              <Lock size={16} color={Colors.textMuted} />
              <TextInput style={styles.pwdInput} placeholder="New password (min 6 chars)" placeholderTextColor={Colors.textMuted} value={newPwd} onChangeText={setNewPwd} secureTextEntry />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleResetStudentPassword}>
              <Text style={styles.saveBtnText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  avatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.primary, marginBottom: 12 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700' as const, color: '#fff' },
  studentName: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  studentEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metaBadgeText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
  overallProgress: { width: '100%', marginTop: 16, gap: 6 },
  overallText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const },
  quickStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, width: '100%' },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 22, fontWeight: '800' as const, color: Colors.text },
  quickStatLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  quickStatDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 14 },
  subjectSection: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  subjectHeaderLeft: { flex: 1 },
  subjectCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  subjectCode: { fontSize: 12, fontWeight: '700' as const, color: Colors.primary },
  subjectGrade: { fontSize: 10, color: Colors.accent, fontWeight: '500' as const },
  subjectSem: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' as const },
  subjectName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 6 },
  scoreRow: { flexDirection: 'row', gap: 8 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scoreBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.primary },
  subjectContent: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  cocBlock: { marginBottom: 14 },
  cocBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cocBlockTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  cocBlockProg: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  loBlock: { backgroundColor: Colors.surfaceLight, borderRadius: 10, padding: 10, marginTop: 8 },
  loBlockHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  loBlockCheck: { marginRight: 8, marginTop: 2 },
  loBlockInfo: { flex: 1 },
  loBlockTitle: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  passedText: { fontSize: 11, color: Colors.primary, fontWeight: '500' as const, marginTop: 2 },
  failedText: { fontSize: 11, color: Colors.warning, fontWeight: '500' as const, marginTop: 2 },
  lockedText: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  addActivityBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  scoresBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  scoresLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  scoreItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  scoreItemLabel: { fontSize: 12, color: Colors.textMuted },
  scoreItemValue: { fontSize: 12, fontWeight: '600' as const, color: Colors.text },
  scoreGreen: { color: Colors.primary },
  scoreRed: { color: Colors.error },
  scoreRemarks: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' as const },
  subsSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  subItem: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, marginTop: 6 },
  subTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subName: { flex: 1, fontSize: 12, color: Colors.text, fontWeight: '500' as const },
  validationCheckbox: { padding: 2 },
  subActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(91,164,207,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  openBtnText: { fontSize: 11, color: Colors.accent, fontWeight: '600' as const },
  gradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  gradeBtnText: { fontSize: 11, color: Colors.warning, fontWeight: '600' as const },
  gradeDisplay: { fontSize: 12, fontWeight: '700' as const, color: Colors.primary },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  inputLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 14, marginBottom: 4 },
  modalTextArea: { minHeight: 60, textAlignVertical: 'top' as const },
  quarterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quarterChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surfaceLight, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  quarterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quarterChipText: { fontSize: 12, fontWeight: '500' as const, color: Colors.textMuted },
  quarterChipTextActive: { color: '#000', fontWeight: '700' as const },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' as const },
  resetPwdBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  resetPwdText: { fontSize: 13, color: Colors.accent, fontWeight: '600' as const },
  pwdInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 48, marginBottom: 4 },
  pwdInput: { flex: 1, color: Colors.text, fontSize: 14 },
  violationsSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.warning + '40' },
  violationsHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 },
  violationsTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  violationsCountBadge: { backgroundColor: Colors.warning + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  violationsCountText: { fontSize: 12, fontWeight: '700' as const, color: Colors.warning },
  violationItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  violationItemAck: { opacity: 0.5 },
  violationItemLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flex: 1 },
  violationItemInfo: { flex: 1 },
  violationItemTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  violationItemMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  ackBtn: { backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  ackBtnText: { fontSize: 11, fontWeight: '700' as const, color: Colors.primary },
  violationsMoreText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 8 },
});
