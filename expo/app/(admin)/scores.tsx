import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ClipboardCheck, Search, ChevronDown, ChevronUp, Users, TrendingUp,
  TrendingDown, Award, CheckCircle, XCircle, Calendar, Filter, X,
  BarChart3, GraduationCap, BookOpen,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';
import OfflineBanner from '@/components/OfflineBanner';
import EmptyState from '@/components/EmptyState';
import type { QuizAttempt, User, Subject, Quiz } from '@/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SortField = 'name' | 'score' | 'date';
type SortDir = 'asc' | 'desc';

interface ScoreRow {
  attempt: QuizAttempt;
  student: User;
  subject: Subject;
  quiz: Quiz | undefined;
  percentage: number;
  dateTaken: string;
}

export default function ScoresScreen() {
  const { currentUser, allUsers, sections, subjects } = useAuth();
  const { quizAttempts, getLOQuiz, refreshFromCloud } = useData();
  const { colors } = useTheme();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedQuiz, setSelectedQuiz] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // === PERMISSION-SCOPED DATA ===
  const scopedStudents = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperAdmin) return allUsers.filter(u => u.role === 'student' && !u.archived);
    return allUsers.filter(u => u.role === 'student' && !u.archived && u.adminId === currentUser.id);
  }, [currentUser, allUsers, isSuperAdmin]);

  const scopedSections = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperAdmin) return sections.filter(s => !s.archived);
    return sections.filter(s => s.adminId === currentUser.id && !s.archived);
  }, [currentUser, sections, isSuperAdmin]);

  const scopedSubjects = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperAdmin) return subjects.filter(s => !s.archived);
    return subjects.filter(s => s.adminId === currentUser.id && !s.archived);
  }, [currentUser, subjects, isSuperAdmin]);

  const scopedStudentIds = useMemo(() => new Set(scopedStudents.map(s => s.id)), [scopedStudents]);

  // === BUILD SCORE ROWS ===
  const allScoreRows = useMemo<ScoreRow[]>(() => {
    const rows: ScoreRow[] = [];
    for (const attempt of quizAttempts) {
      if (!scopedStudentIds.has(attempt.studentId)) continue;
      const student = allUsers.find(u => u.id === attempt.studentId);
      if (!student) continue;
      const subject = subjects.find(s => s.id === attempt.subjectId);
      if (!subject) continue;
      const quiz = getLOQuiz(attempt.loId);
      const percentage = attempt.totalItems > 0 ? Math.round((attempt.score / attempt.totalItems) * 100) : 0;
      rows.push({
        attempt,
        student,
        subject,
        quiz,
        percentage,
        dateTaken: attempt.createdAt,
      });
    }
    return rows;
  }, [quizAttempts, scopedStudentIds, allUsers, subjects, getLOQuiz]);

  // === DATE FILTER ===
  const filterByDate = useCallback((isoDate: string): boolean => {
    if (selectedDateFilter === 'all') return true;
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (selectedDateFilter === '7days') return diffDays <= 7;
    if (selectedDateFilter === '30days') return diffDays <= 30;
    if (selectedDateFilter === '90days') return diffDays <= 90;
    return true;
  }, [selectedDateFilter]);

  // === APPLY FILTERS ===
  const filteredRows = useMemo(() => {
    let rows = allScoreRows;
    if (selectedSection !== 'all') {
      rows = rows.filter(r => r.student.sectionId === selectedSection);
    }
    if (selectedSubject !== 'all') {
      rows = rows.filter(r => r.subject.id === selectedSubject);
    }
    if (selectedQuiz !== 'all') {
      rows = rows.filter(r => r.quiz?.id === selectedQuiz);
    }
    rows = rows.filter(r => filterByDate(r.dateTaken));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(r =>
        r.student.fullName.toLowerCase().includes(q) ||
        r.subject.name.toLowerCase().includes(q) ||
        r.subject.code.toLowerCase().includes(q) ||
        (r.quiz?.title?.toLowerCase().includes(q) ?? false)
      );
    }
    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.student.fullName.localeCompare(b.student.fullName);
      else if (sortField === 'score') cmp = a.percentage - b.percentage;
      else if (sortField === 'date') cmp = new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [allScoreRows, selectedSection, selectedSubject, selectedQuiz, filterByDate, searchQuery, sortField, sortDir]);

  // === GROUP BY SECTION ===
  const sectionGroups = useMemo(() => {
    const groups: { sectionId: string; sectionName: string; rows: ScoreRow[] }[] = [];
    const sectionMap = new Map<string, ScoreRow[]>();
    for (const row of filteredRows) {
      const sid = row.student.sectionId ?? 'none';
      if (!sectionMap.has(sid)) sectionMap.set(sid, []);
      sectionMap.get(sid)!.push(row);
    }
    for (const [sid, rows] of sectionMap) {
      const section = scopedSections.find(s => s.id === sid);
      const sectionName = section?.name ?? (sid === 'none' ? 'No Section' : 'Unknown');
      groups.push({ sectionId: sid, sectionName, rows });
    }
    groups.sort((a, b) => a.sectionName.localeCompare(b.sectionName));
    return groups;
  }, [filteredRows, scopedSections]);

  // === SUMMARY STATS (for selected section or all) ===
  const summaryStats = useMemo(() => {
    const statsRows = selectedSection !== 'all'
      ? filteredRows
      : filteredRows;
    if (statsRows.length === 0) {
      return { avg: 0, highest: 0, lowest: 0, completed: 0, completionRate: 0, totalAttempts: 0 };
    }
    const percentages = statsRows.map(r => r.percentage);
    const avg = Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length);
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);
    const passedAttempts = statsRows.filter(r => r.attempt.isPassed).length;
    const uniqueStudents = new Set(statsRows.map(r => r.student.id));
    const totalStudentsInScope = selectedSection !== 'all'
      ? scopedStudents.filter(s => s.sectionId === selectedSection).length
      : scopedStudents.length;
    const completionRate = totalStudentsInScope > 0
      ? Math.round((uniqueStudents.size / totalStudentsInScope) * 100)
      : 0;
    return {
      avg,
      highest,
      lowest,
      completed: passedAttempts,
      completionRate,
      totalAttempts: statsRows.length,
    };
  }, [filteredRows, selectedSection, scopedStudents]);

  // === AVAILABLE QUIZZES (for filter dropdown) ===
  const availableQuizzes = useMemo(() => {
    const quizIds = new Set<string>();
    const quizzes: { id: string; title: string }[] = [];
    for (const row of allScoreRows) {
      if (row.quiz && !quizIds.has(row.quiz.id)) {
        quizIds.add(row.quiz.id);
        quizzes.push({ id: row.quiz.id, title: row.quiz.title });
      }
    }
    return quizzes;
  }, [allScoreRows]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refreshFromCloud(); } finally { setRefreshing(false); }
  };

  const toggleSort = (field: SortField) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  };

  const clearFilters = () => {
    setSelectedSection('all');
    setSelectedSubject('all');
    setSelectedQuiz('all');
    setSelectedDateFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedSection !== 'all' || selectedSubject !== 'all' || selectedQuiz !== 'all' || selectedDateFilter !== 'all' || searchQuery.trim().length > 0;

  if (!currentUser) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const toggleSection = (sectionId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={12} color={colors.textMuted} style={{ opacity: 0.4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} color={colors.primary} />
      : <ChevronDown size={12} color={colors.primary} />;
  };

  const renderScoreRow = (row: ScoreRow) => {
    const passed = row.attempt.isPassed;
    return (
      <View key={row.attempt.id} style={[styles.scoreRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scoreRowLeft}>
          {row.student.profileImage ? (
            <Image source={{ uri: row.student.profileImage }} style={styles.studentAvatar} />
          ) : (
            <View style={[styles.studentAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.studentAvatarText}>{row.student.fullName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.scoreRowInfo}>
            <Text style={[styles.scoreStudentName, { color: colors.text }]} numberOfLines={1}>
              {row.student.fullName}
            </Text>
            <Text style={[styles.scoreQuizTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {row.quiz?.title ?? 'Unknown Quiz'}
            </Text>
            <Text style={[styles.scoreSubjectMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {row.subject.code} · {row.subject.name}
            </Text>
          </View>
        </View>
        <View style={styles.scoreRowRight}>
          <Text style={[styles.scoreValue, { color: colors.text }]}>
            {row.attempt.score}/{row.attempt.totalItems}
          </Text>
          <Text style={[styles.scorePercentage, { color: passed ? colors.primary : colors.error }]}>
            {row.percentage}%
          </Text>
          <Text style={[styles.scoreDate, { color: colors.textMuted }]}>
            {formatDate(row.dateTaken)}
          </Text>
          <View style={[styles.scoreStatusBadge, { backgroundColor: passed ? colors.primary + '15' : colors.error + '15' }]}>
            {passed ? (
              <CheckCircle size={10} color={colors.primary} />
            ) : (
              <XCircle size={10} color={colors.error} />
            )}
            <Text style={[styles.scoreStatusText, { color: passed ? colors.primary : colors.error }]}>
              {passed ? 'Passed' : 'Failed'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSectionGroup = (group: { sectionId: string; sectionName: string; rows: ScoreRow[] }) => {
    const isExpanded = expandedSection === group.sectionId || sectionGroups.length === 1;
    const passedCount = group.rows.filter(r => r.attempt.isPassed).length;
    const avgScore = group.rows.length > 0
      ? Math.round(group.rows.reduce((s, r) => s + r.percentage, 0) / group.rows.length)
      : 0;
    return (
      <View key={group.sectionId} style={[styles.sectionGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.sectionGroupHeader}
          onPress={() => toggleSection(group.sectionId)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionGroupHeaderLeft}>
            <View style={[styles.sectionGroupIcon, { backgroundColor: colors.accent + '15' }]}>
              <Users size={16} color={colors.accent} />
            </View>
            <View style={styles.sectionGroupInfo}>
              <Text style={[styles.sectionGroupName, { color: colors.text }]} numberOfLines={1}>
                {group.sectionName}
              </Text>
              <Text style={[styles.sectionGroupMeta, { color: colors.textSecondary }]}>
                {group.rows.length} attempt{group.rows.length !== 1 ? 's' : ''} · {passedCount} passed · Avg {avgScore}%
              </Text>
            </View>
          </View>
          <ChevronDown
            size={18}
            color={colors.textMuted}
            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={[styles.sectionGroupRows, { borderTopColor: colors.border }]}>
            {group.rows.map(renderScoreRow)}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.primary + '15' }]}>
                <ClipboardCheck size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.screenTitle, { color: colors.text }]}>Student Quiz Scores</Text>
                <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                  {isSuperAdmin ? 'All sections' : 'Your sections'} · {scopedStudents.length} students
                </Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search student, subject, or quiz..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Toggle */}
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[styles.filterToggleBtn, { backgroundColor: colors.surface, borderColor: showFilters ? colors.primary : colors.border }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} color={showFilters ? colors.primary : colors.textMuted} />
              <Text style={[styles.filterToggleText, { color: showFilters ? colors.primary : colors.textSecondary }]}>
                Filters
              </Text>
              {hasActiveFilters && (
                <View style={[styles.filterActiveDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                <Text style={[styles.clearFiltersText, { color: colors.error }]}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Expandable Filter Panel */}
          {showFilters && (
            <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Section Filter */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Section</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <TouchableOpacity
                    style={[styles.filterChip, { backgroundColor: selectedSection === 'all' ? colors.primary : colors.inputBg, borderColor: selectedSection === 'all' ? colors.primary : colors.border }]}
                    onPress={() => setSelectedSection('all')}
                  >
                    <Text style={[styles.filterChipText, { color: selectedSection === 'all' ? '#000' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {scopedSections.map(sec => (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.filterChip, { backgroundColor: selectedSection === sec.id ? colors.primary : colors.inputBg, borderColor: selectedSection === sec.id ? colors.primary : colors.border }]}
                      onPress={() => setSelectedSection(sec.id)}
                    >
                      <Text style={[styles.filterChipText, { color: selectedSection === sec.id ? '#000' : colors.textSecondary }]} numberOfLines={1}>
                        {sec.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Subject Filter */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <TouchableOpacity
                    style={[styles.filterChip, { backgroundColor: selectedSubject === 'all' ? colors.primary : colors.inputBg, borderColor: selectedSubject === 'all' ? colors.primary : colors.border }]}
                    onPress={() => setSelectedSubject('all')}
                  >
                    <Text style={[styles.filterChipText, { color: selectedSubject === 'all' ? '#000' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {scopedSubjects.map(sub => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.filterChip, { backgroundColor: selectedSubject === sub.id ? colors.primary : colors.inputBg, borderColor: selectedSubject === sub.id ? colors.primary : colors.border }]}
                      onPress={() => setSelectedSubject(sub.id)}
                    >
                      <Text style={[styles.filterChipText, { color: selectedSubject === sub.id ? '#000' : colors.textSecondary }]} numberOfLines={1}>
                        {sub.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Quiz Filter */}
              {availableQuizzes.length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Quiz</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    <TouchableOpacity
                      style={[styles.filterChip, { backgroundColor: selectedQuiz === 'all' ? colors.primary : colors.inputBg, borderColor: selectedQuiz === 'all' ? colors.primary : colors.border }]}
                      onPress={() => setSelectedQuiz('all')}
                    >
                      <Text style={[styles.filterChipText, { color: selectedQuiz === 'all' ? '#000' : colors.textSecondary }]}>All</Text>
                    </TouchableOpacity>
                    {availableQuizzes.map(q => (
                      <TouchableOpacity
                        key={q.id}
                        style={[styles.filterChip, { backgroundColor: selectedQuiz === q.id ? colors.primary : colors.inputBg, borderColor: selectedQuiz === q.id ? colors.primary : colors.border }]}
                        onPress={() => setSelectedQuiz(q.id)}
                      >
                        <Text style={[styles.filterChipText, { color: selectedQuiz === q.id ? '#000' : colors.textSecondary }]} numberOfLines={1}>
                          {q.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Date Filter */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Date Range</Text>
                <View style={styles.dateFilterRow}>
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: '7days', label: '7 Days' },
                    { key: '30days', label: '30 Days' },
                    { key: '90days', label: '90 Days' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.filterChip, { backgroundColor: selectedDateFilter === opt.key ? colors.primary : colors.inputBg, borderColor: selectedDateFilter === opt.key ? colors.primary : colors.border }]}
                      onPress={() => setSelectedDateFilter(opt.key)}
                    >
                      <Text style={[styles.filterChipText, { color: selectedDateFilter === opt.key ? '#000' : colors.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Summary Statistics */}
          {filteredRows.length > 0 && (
            <View style={styles.statsSection}>
              <View style={styles.statsHeader}>
                <BarChart3 size={16} color={colors.accent} />
                <Text style={[styles.statsTitle, { color: colors.text }]}>Summary</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TrendingUp size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.avg}%</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Average</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Award size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.highest}%</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Highest</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TrendingDown size={18} color={colors.error} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.lowest}%</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Lowest</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <CheckCircle size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.completed}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Passed</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <GraduationCap size={18} color={colors.accent} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.completionRate}%</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Completion</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ClipboardCheck size={18} color={colors.warning} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{summaryStats.totalAttempts}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Attempts</Text>
                </View>
              </View>
            </View>
          )}

          {/* Sort Controls */}
          {filteredRows.length > 0 && (
            <View style={styles.sortBar}>
              <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by:</Text>
              <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort('name')}>
                <Text style={[styles.sortBtnText, { color: sortField === 'name' ? colors.primary : colors.textSecondary }]}>Name</Text>
                <SortIcon field="name" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort('score')}>
                <Text style={[styles.sortBtnText, { color: sortField === 'score' ? colors.primary : colors.textSecondary }]}>Score</Text>
                <SortIcon field="score" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort('date')}>
                <Text style={[styles.sortBtnText, { color: sortField === 'date' ? colors.primary : colors.textSecondary }]}>Date</Text>
                <SortIcon field="date" />
              </TouchableOpacity>
            </View>
          )}

          {/* Score Results */}
          {filteredRows.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={40} color={colors.textMuted} />}
              title="No Quiz Scores Found"
              message={hasActiveFilters
                ? "No scores match your current filters. Try adjusting or clearing them."
                : "No quiz attempts have been recorded yet. Scores will appear here once students start taking quizzes."
              }
              actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          ) : (
            <View style={styles.resultsList}>
              {sectionGroups.map(renderSectionGroup)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  screenTitle: { fontSize: 20, fontWeight: '700' as const },
  screenSubtitle: { fontSize: 13, marginTop: 2 },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },

  // Filter bar
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  filterToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterToggleText: { fontSize: 13, fontWeight: '600' as const },
  filterActiveDot: { width: 7, height: 7, borderRadius: 4 },
  clearFiltersBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  clearFiltersText: { fontSize: 12, fontWeight: '500' as const },

  // Filter panel
  filterPanel: { borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, gap: 12 },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '600' as const },
  chipScroll: { flexDirection: 'row' as const },
  dateFilterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' as const },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 6 },
  filterChipText: { fontSize: 12, fontWeight: '500' as const },

  // Stats
  statsSection: { marginBottom: 16 },
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statsTitle: { fontSize: 16, fontWeight: '700' as const },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  statCard: { width: '32%', minWidth: 100, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  statValue: { fontSize: 20, fontWeight: '700' as const },
  statLabel: { fontSize: 10 },

  // Sort
  sortBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const },
  sortLabel: { fontSize: 12, fontWeight: '500' as const },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 12, fontWeight: '600' as const },

  // Results
  resultsList: { gap: 12 },

  // Section group
  sectionGroupCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  sectionGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  sectionGroupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionGroupIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionGroupInfo: { flex: 1 },
  sectionGroupName: { fontSize: 15, fontWeight: '600' as const },
  sectionGroupMeta: { fontSize: 12, marginTop: 2 },
  sectionGroupRows: { padding: 8, paddingTop: 8, borderTopWidth: 1, gap: 6 },

  // Score row
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 12, borderWidth: 1 },
  scoreRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  studentAvatar: { width: 36, height: 36, borderRadius: 18 },
  studentAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  studentAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#000' },
  scoreRowInfo: { flex: 1 },
  scoreStudentName: { fontSize: 14, fontWeight: '600' as const },
  scoreQuizTitle: { fontSize: 12, marginTop: 2 },
  scoreSubjectMeta: { fontSize: 10, marginTop: 1 },
  scoreRowRight: { alignItems: 'flex-end', gap: 2 },
  scoreValue: { fontSize: 14, fontWeight: '700' as const },
  scorePercentage: { fontSize: 13, fontWeight: '600' as const },
  scoreDate: { fontSize: 10 },
  scoreStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  scoreStatusText: { fontSize: 9, fontWeight: '700' as const },
});
