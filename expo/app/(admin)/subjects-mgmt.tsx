import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Edit3, Trash2, ChevronDown, ChevronUp, X, BookOpen,
  FileText, PlayCircle, HelpCircle, Archive, Layers, Lock, Unlock,
  GraduationCap, Globe, UserCheck, XCircle, Info, Link2, Share2, Shield,
  FileType, Presentation, Image as ImageIcon, Video, Upload,
  Calendar, CalendarClock, CalendarX, Clock, Timer, Trash, CheckCircle,
  GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import { useToast } from '@/contexts/ToastContext';
import Colors from '@/constants/colors';
import type { COC, LearningOutcome, Content, Quiz, Question, Subject, GradeLevel, Semester, SubjectType } from '@/types';
import { GRADE_LEVELS, getSemestersForGrade } from '@/types';
import { ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadLocalFile } from '@/services/cloudSync';

type ContentType = 'text' | 'youtube' | 'pdf' | 'ppt' | 'doc' | 'image' | 'video';
type ViewMode = 'subjects' | 'content';

export default function SubjectsMgmtScreen() {
  const { currentUser, subjects, students, admins, addSubject, editSubject, deleteSubject, archiveSubject, adoptSubject, unadoptSubject, getAdoptableSubjects, getAdoptedSubjects, shareGenericSubject } = useAuth();
  const {
    getSubjectCOCs, getCOCLOs, getLOContents, getLOQuiz, getQuizQuestions,
    addCOC, editCOC, deleteCOC, archiveCOC,
    addLO, editLO, deleteLO, archiveLO,
    addContent, editContent, deleteContent,
    addQuiz, editQuiz, deleteQuiz,
    addQuestion, editQuestion, deleteQuestion,
    setQuizSchedule, clearQuizSchedule, getQuizSchedule, getQuizScheduleStatus,
    reorderLOs,
  } = useData();

  const [viewMode, setViewMode] = useState<ViewMode>('subjects');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [expandedCOC, setExpandedCOC] = useState<string | null>(null);
  const [expandedLO, setExpandedLO] = useState<string | null>(null);
  const [expandedQuizLO, setExpandedQuizLO] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cocs' | 'quizzes'>('cocs');

  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');
  const [unlockType, setUnlockType] = useState<'sequential' | 'flexible'>('sequential');
  const [subjectGradeLevel, setSubjectGradeLevel] = useState<GradeLevel | ''>('');
  const [subjectSemester, setSubjectSemester] = useState<Semester | ''>('');
  const [subjectType, setSubjectType] = useState<SubjectType>('global');
  const [isSaving, setIsSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [sharingSubjectId, setSharingSubjectId] = useState<string | null>(null);
  const [selectedShareAdminIds, setSelectedShareAdminIds] = useState<string[]>([]);

  const [showCOCModal, setShowCOCModal] = useState<boolean>(false);
  const [editingCOCId, setEditingCOCId] = useState<string>('');
  const [cocTitle, setCocTitle] = useState<string>('');
  const [cocDesc, setCocDesc] = useState<string>('');

  const [showLOModal, setShowLOModal] = useState<boolean>(false);
  const [editingLOId, setEditingLOId] = useState<string>('');
  const [loParentCOCId, setLoParentCOCId] = useState<string>('');
  const [loTitle, setLoTitle] = useState<string>('');
  const [loDesc, setLoDesc] = useState<string>('');
  const [loPerformanceCriteria, setLoPerformanceCriteria] = useState<string>('');

  const [showContentModal, setShowContentModal] = useState<boolean>(false);
  const [editingContentId, setEditingContentId] = useState<string>('');
  const [contentLOId, setContentLOId] = useState<string>('');
  const [contentCOCId, setContentCOCId] = useState<string>('');
  const [contentTitle, setContentTitle] = useState<string>('');
  const [contentBody, setContentBody] = useState<string>('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [contentFileName, setContentFileName] = useState<string>('');
  const [contentFileSize, setContentFileSize] = useState<number>(0);
  const [contentMimeType, setContentMimeType] = useState<string>('');
  const [contentFileUri, setContentFileUri] = useState<string>('');
  const [contentFileUrl, setContentFileUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [showQModal, setShowQModal] = useState<boolean>(false);
  const [editingQId, setEditingQId] = useState<string>('');
  const [qLOId, setQLOId] = useState<string>('');
  const [qText, setQText] = useState<string>('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState<number>(0);

  const [showAdoptModal, setShowAdoptModal] = useState<boolean>(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [showIntegrateSuggestion, setShowIntegrateSuggestion] = useState<boolean>(true);
  const [declinedSubjectIds, setDeclinedSubjectIds] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'own' | 'adopted' | 'global'>('all');

  // Quiz Schedule state (Flexible Subjects Only)
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [scheduleQuizId, setScheduleQuizId] = useState<string>('');
  const [scheduleStart, setScheduleStart] = useState<string>('');
  const [scheduleEnd, setScheduleEnd] = useState<string>('');
  const [scheduleTimeZone, setScheduleTimeZone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [scheduleExtendable, setScheduleExtendable] = useState<boolean>(true);
  const [scheduleSaving, setScheduleSaving] = useState<boolean>(false);
  const [reorderingCOCId, setReorderingCOCId] = useState<string | null>(null);
  const [draggedLOId, setDraggedLOId] = useState<string | null>(null);
  const [dropTargetLOId, setDropTargetLOId] = useState<string | null>(null);

  const { success: toastSuccess, info: toastInfo } = useToast();

  const isAdmin = currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const selectableAdmins = useMemo(() => admins.filter(admin => admin.role === 'admin' && !admin.archived), [admins]);

  const adminSubjects = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperAdmin) return subjects.filter(s => !s.archived);
    // Admins/Teachers: only their own created or adopted subjects — NOT Super Admin subjects
    const mySubjects = subjects.filter(s => !s.archived && s.adminId === currentUser.id);
    if (subjectFilter === 'own') return mySubjects.filter(s => s.subjectType === 'private' || !s.subjectType);
    if (subjectFilter === 'adopted') return mySubjects.filter(s => s.subjectType === 'adapted' || s.sourceSubjectId);
    if (subjectFilter === 'global') return []; // Global tab no longer shows master subjects in the list
    return mySubjects;
  }, [currentUser, subjects, isSuperAdmin, subjectFilter]);

  const adoptableSubjects = useMemo(() => {
    if (!isAdmin) return [];
    return getAdoptableSubjects().filter(s => !declinedSubjectIds.includes(s.id));
  }, [isAdmin, getAdoptableSubjects, declinedSubjectIds]);

  const adoptedSubjects = useMemo(() => {
    if (!isAdmin) return [];
    return getAdoptedSubjects();
  }, [isAdmin, getAdoptedSubjects]);

  const archivedSubjectsList = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.role === 'super_admin'
      ? subjects.filter(s => s.archived)
      : subjects.filter(s => s.adminId === currentUser.id && s.archived);
  }, [currentUser, subjects]);

  const activeSubject = useMemo(() => {
    if (selectedSubjectId) return adminSubjects.find(s => s.id === selectedSubjectId);
    return adminSubjects[0];
  }, [selectedSubjectId, adminSubjects]);

  const canEditActiveSubject = Boolean(activeSubject && (isSuperAdmin || (activeSubject.adminId === currentUser?.id && activeSubject.subjectType !== 'global' && activeSubject.subjectType !== 'generic' && !activeSubject.isGlobal)));

  // Get source subject name for adapted copies
  const getSourceSubjectName = useCallback((subject: Subject): string | null => {
    const sourceId = subject.adaptedFromSubjectId ?? subject.sourceSubjectId;
    if (!sourceId) return null;
    const source = subjects.find(s => s.id === sourceId);
    return source?.name ?? null;
  }, [subjects]);

  const subjectCOCs = useMemo(() => {
    if (!activeSubject) return [];
    return getSubjectCOCs(activeSubject.id);
  }, [activeSubject, getSubjectCOCs]);

  const resetSubjectForm = useCallback(() => {
    setSubjectName('');
    setSubjectCode('');
    setSubjectDesc('');
    setUnlockType('sequential');
    setSubjectGradeLevel('');
    setSubjectSemester('');
    setSubjectType(isSuperAdmin ? 'global' : 'private');
    setIsAddingSubject(false);
    setEditingSubjectId(null);
  }, [isSuperAdmin]);

  const handleSaveSubject = useCallback(async () => {
    if (!subjectName.trim()) return Alert.alert('Error', 'Subject name is required');
    if (!subjectCode.trim()) return Alert.alert('Error', 'Subject code is required');
    setIsSaving(true);
    try {
      if (editingSubjectId) {
        await editSubject(editingSubjectId, { name: subjectName.trim(), code: subjectCode.trim(), description: subjectDesc.trim(), unlockType, gradeLevel: subjectGradeLevel || undefined, semester: subjectSemester || undefined });
      } else {
        await addSubject(subjectName.trim(), subjectDesc.trim(), subjectCode.trim(), unlockType, subjectGradeLevel || undefined, subjectSemester || undefined, isSuperAdmin ? subjectType : 'private');
      }
      resetSubjectForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to save subject');
    } finally {
      setIsSaving(false);
    }
  }, [subjectName, subjectCode, subjectDesc, unlockType, subjectGradeLevel, subjectSemester, editingSubjectId, addSubject, editSubject, resetSubjectForm]);

  const handleEditSubject = useCallback((subject: Subject) => {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code);
    setSubjectDesc(subject.description);
    setUnlockType(subject.unlockType);
    setSubjectGradeLevel(subject.gradeLevel || '');
    setSubjectSemester(subject.semester || '');
    setSubjectType(subject.subjectType ?? (subject.isGlobal ? 'global' : 'private'));
    setIsAddingSubject(true);
  }, []);

  const handleDeleteSubject = useCallback((subjectId: string, name: string) => {
    const studentCount = students.filter(s => s.subjectIds?.includes(subjectId)).length;
    Alert.alert('Delete Subject', `Delete "${name}"?${studentCount > 0 ? `\n\n${studentCount} student(s) are enrolled.` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSubject(subjectId) },
    ]);
  }, [deleteSubject, students]);

  const getStudentCount = useCallback((subjectId: string) => {
    return students.filter(s => s.subjectIds?.includes(subjectId)).length;
  }, [students]);

  const openAddCOC = () => { setEditingCOCId(''); setCocTitle(''); setCocDesc(''); setShowCOCModal(true); };
  const openEditCOC = (coc: COC) => { setEditingCOCId(coc.id); setCocTitle(coc.title); setCocDesc(coc.description); setShowCOCModal(true); };

  const saveCOC = async () => {
    if (!cocTitle.trim() || !activeSubject || !currentUser) return Alert.alert('Error', 'Title is required.');
    if (editingCOCId) { await editCOC(editingCOCId, { title: cocTitle.trim(), description: cocDesc.trim() }); }
    else { await addCOC(activeSubject.id, currentUser.id, cocTitle.trim(), cocDesc.trim()); }
    setShowCOCModal(false);
  };

  const handleDeleteCOC = (cocId: string, title: string) => {
    const cocLOs = getCOCLOs(cocId);
    const isFlexibleSubject = activeSubject?.unlockType === 'flexible';
    Alert.alert(isFlexibleSubject ? 'Delete Topic' : 'Delete COC', `Delete "${title}"?${cocLOs.length > 0 ? `\n\n${cocLOs.length} LO(s) will also be deleted.` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCOC(cocId) },
    ]);
  };

  const openAddLO = (cocId: string) => { setEditingLOId(''); setLoParentCOCId(cocId); setLoTitle(''); setLoDesc(''); setLoPerformanceCriteria(''); setShowLOModal(true); };
  const openEditLO = (lo: LearningOutcome) => { setEditingLOId(lo.id); setLoParentCOCId(lo.cocId); setLoTitle(lo.title); setLoDesc(lo.description); setLoPerformanceCriteria(lo.performanceCriteria.join('\n')); setShowLOModal(true); };

  const saveLO = async () => {
    if (!loTitle.trim() || !activeSubject || !currentUser) return Alert.alert('Error', 'Title is required.');
    const criteria = loPerformanceCriteria.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    if (editingLOId) { await editLO(editingLOId, { title: loTitle.trim(), description: loDesc.trim(), performanceCriteria: criteria }); }
    else { await addLO(loParentCOCId, activeSubject.id, currentUser.id, loTitle.trim(), loDesc.trim(), criteria); }
    setShowLOModal(false);
  };

  const handleDeleteLO = (loId: string, title: string) => {
    Alert.alert('Delete LO', `Delete "${title}" and all its content and quiz?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLO(loId) },
    ]);
  };

  const openAddContent = (loId: string, cocId: string) => {
    setEditingContentId(''); setContentLOId(loId); setContentCOCId(cocId);
    setContentTitle(''); setContentBody(''); setContentType('text');
    setContentFileName(''); setContentFileSize(0); setContentMimeType('');
    setContentFileUri(''); setContentFileUrl(''); setUploadProgress(0);
    setShowContentModal(true);
  };
  const openEditContent = (c: Content) => {
    setEditingContentId(c.id); setContentLOId(c.loId); setContentCOCId(c.cocId);
    setContentTitle(c.title); setContentBody(c.content); setContentType(c.type as ContentType);
    setContentFileName(c.fileName ?? ''); setContentFileSize(c.fileSize ?? 0);
    setContentMimeType(c.mimeType ?? ''); setContentFileUrl(c.fileUrl ?? '');
    setContentFileUri(''); setUploadProgress(0);
    setShowContentModal(true);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/*', 'image/*'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? '';
      const name = asset.name ?? 'file';
      let detectedType: ContentType = 'text';
      if (mimeType.includes('pdf') || name.toLowerCase().endsWith('.pdf')) detectedType = 'pdf';
      else if (mimeType.includes('presentation') || name.toLowerCase().match(/\.pptx?$/)) detectedType = 'ppt';
      else if (mimeType.includes('word') || name.toLowerCase().match(/\.docx?$/)) detectedType = 'doc';
      else if (mimeType.startsWith('video/')) detectedType = 'video';
      else if (mimeType.startsWith('image/')) detectedType = 'image';
      setContentType(detectedType);
      setContentFileUri(asset.uri);
      setContentFileName(name);
      setContentFileSize(asset.size ?? 0);
      setContentMimeType(mimeType);
      if (!contentTitle.trim()) setContentTitle(name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      console.log('[Content] Document picker error:', err);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant permission to access photos'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setContentType('image');
      setContentFileUri(asset.uri);
      setContentFileName(asset.fileName ?? 'image.jpg');
      setContentFileSize(asset.fileSize ?? 0);
      setContentMimeType(asset.mimeType ?? 'image/jpeg');
      if (!contentTitle.trim()) setContentTitle('Image');
    } catch (err) {
      console.log('[Content] Image picker error:', err);
    }
  };

  const uploadFile = async (): Promise<string> => {
    if (!contentFileUri || !currentUser) return contentBody.trim();
    if (contentFileUrl) return contentFileUrl;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadLocalFile(contentFileUri, contentFileName, contentMimeType, currentUser.id, (p) => setUploadProgress(p));
      if (result?.url) {
        setContentFileUrl(result.url);
        return result.url;
      }
    } catch (err) {
      console.log('[Content] Upload failed, using local URI:', err);
    } finally {
      setIsUploading(false);
    }
    return contentFileUri;
  };

  const saveContent = async () => {
    if (!contentTitle.trim() || !activeSubject || !currentUser) return Alert.alert('Error', 'Title is required.');
    const needsFile = ['pdf', 'ppt', 'doc', 'image', 'video'].includes(contentType);
    if (needsFile && !contentFileUri && !contentFileUrl && !contentBody.trim()) {
      return Alert.alert('Error', 'Please select a file to upload.');
    }
    if (contentType === 'text' && !contentBody.trim()) return Alert.alert('Error', 'Content text is required.');
    if (contentType === 'youtube' && !contentBody.trim()) return Alert.alert('Error', 'YouTube URL is required.');

    let fileUrl = contentFileUrl;
    if (needsFile && contentFileUri && !fileUrl) {
      fileUrl = await uploadFile();
    }

    const contentValue = contentType === 'text' ? contentBody.trim() : contentType === 'youtube' ? contentBody.trim() : fileUrl;
    const options = needsFile ? {
      fileName: contentFileName,
      fileSize: contentFileSize,
      mimeType: contentMimeType,
      fileUrl,
    } : undefined;

    if (editingContentId) {
      await editContent(editingContentId, { title: contentTitle.trim(), content: contentValue, type: contentType, fileName: contentFileName || undefined, fileSize: contentFileSize || undefined, mimeType: contentMimeType || undefined, fileUrl: fileUrl || undefined });
    } else {
      await addContent(contentLOId, contentCOCId, activeSubject.id, currentUser.id, contentType, contentTitle.trim(), contentValue, options);
    }
    setShowContentModal(false);
  };

  const handleDeleteContent = (id: string, title: string) => {
    Alert.alert('Delete Content', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContent(id) },
    ]);
  };

  const openAddQ = (loId: string) => { setEditingQId(''); setQLOId(loId); setQText(''); setQOptions(['', '', '', '']); setQCorrect(0); setShowQModal(true); };
  const openEditQ = (q: Question) => { setEditingQId(q.id); setQLOId(q.loId); setQText(q.question); setQOptions([...q.options]); setQCorrect(q.correctAnswer); setShowQModal(true); };

  const saveQ = async () => {
    if (!qText.trim() || !activeSubject) return Alert.alert('Error', 'Question is required.');
    if (qOptions.some(o => !o.trim())) return Alert.alert('Error', 'All options are required.');
    if (editingQId) {
      await editQuestion(editingQId, { question: qText.trim(), options: qOptions.map(o => o.trim()), correctAnswer: qCorrect });
    } else {
      const quiz = getLOQuiz(qLOId);
      if (!quiz) {
        const lo = subjectCOCs.flatMap(c => getCOCLOs(c.id)).find(l => l.id === qLOId);
        const cocId = lo?.cocId ?? '';
        const newQuiz = await addQuiz(qLOId, cocId, activeSubject.id, currentUser?.id ?? '', 'Post Test', 'Post test for this LO', 80);
        if (newQuiz) { await addQuestion(newQuiz.id, qLOId, activeSubject.id, qText.trim(), qOptions.map(o => o.trim()), qCorrect); }
      } else {
        await addQuestion(quiz.id, qLOId, activeSubject.id, qText.trim(), qOptions.map(o => o.trim()), qCorrect);
      }
    }
    setShowQModal(false);
  };

  const updateOption = (index: number, value: string) => { const updated = [...qOptions]; updated[index] = value; setQOptions(updated); };

  // === Quiz Schedule Functions (Flexible Subjects Only) ===
  const openScheduleModal = (quizId: string) => {
    const existing = getQuizSchedule(quizId);
    if (existing) {
      setScheduleStart(existing.startDateTime);
      setScheduleEnd(existing.endDateTime);
      setScheduleTimeZone(existing.timeZone);
      setScheduleExtendable(existing.isExtendable);
    } else {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setScheduleStart(now.toISOString().slice(0, 16));
      setScheduleEnd(tomorrow.toISOString().slice(0, 16));
      setScheduleTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setScheduleExtendable(true);
    }
    setScheduleQuizId(quizId);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleStart || !scheduleEnd) {
      Alert.alert('Error', 'Please set both start and end date/time.');
      return;
    }
    const startDate = new Date(scheduleStart);
    const endDate = new Date(scheduleEnd);
    if (startDate >= endDate) {
      Alert.alert('Error', 'End time must be after start time.');
      return;
    }
    setScheduleSaving(true);
    try {
      await setQuizSchedule(scheduleQuizId, {
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
        timeZone: scheduleTimeZone,
        isExtendable: scheduleExtendable,
      });
      toastSuccess('Quiz schedule saved successfully!');
      setShowScheduleModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save schedule.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    Alert.alert('Remove Schedule', 'Remove the scheduled access for this quiz?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await clearQuizSchedule(scheduleQuizId);
          toastInfo('Quiz schedule removed.');
          setShowScheduleModal(false);
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'Failed to remove schedule.');
        }
      } },
    ]);
  };

  const formatScheduleDisplay = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // === Lesson Reordering (Flexible Subjects) ===
  const handleMoveLO = useCallback(async (cocId: string, loId: string, direction: 'up' | 'down') => {
    const cocLOs = getCOCLOs(cocId).sort((a, b) => a.order - b.order);
    const idx = cocLOs.findIndex(lo => lo.id === loId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cocLOs.length) return;
    const newOrder = cocLOs.map(lo => lo.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setReorderingCOCId(cocId);
    try {
      await reorderLOs(cocId, newOrder);
      toastSuccess('Lesson order updated');
    } catch {
      toastInfo('Failed to reorder lessons');
    } finally {
      setReorderingCOCId(null);
    }
  }, [getCOCLOs, reorderLOs, toastSuccess, toastInfo]);

  // Web drag-and-drop handlers
  const handleDragStart = (loId: string) => setDraggedLOId(loId);
  const handleDragOver = (e: any, loId: string) => {
    e.preventDefault?.();
    setDropTargetLOId(loId);
  };
  const handleDrop = async (cocId: string, targetLOId: string) => {
    if (!draggedLOId || draggedLOId === targetLOId) return;
    const cocLOs = getCOCLOs(cocId).sort((a, b) => a.order - b.order);
    const newOrder = cocLOs.map(lo => lo.id);
    const fromIdx = newOrder.indexOf(draggedLOId);
    const toIdx = newOrder.indexOf(targetLOId);
    if (fromIdx < 0 || toIdx < 0) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedLOId);
    setReorderingCOCId(cocId);
    try {
      await reorderLOs(cocId, newOrder);
      toastSuccess('Lesson order updated');
    } catch {
      toastInfo('Failed to reorder lessons');
    } finally {
      setDraggedLOId(null);
      setDropTargetLOId(null);
      setReorderingCOCId(null);
    }
  };

  const getScheduleStatusBadge = (quizId: string) => {
    const status = getQuizScheduleStatus(quizId);
    if (status === 'available' && !getQuizSchedule(quizId)) return null;
    const config = {
      upcoming: { color: Colors.accent, bg: Colors.accent + '20', label: 'Upcoming' },
      available: { color: Colors.success, bg: Colors.success + '20', label: 'Available' },
      closed: { color: Colors.error, bg: Colors.error + '20', label: 'Closed' },
    };
    const cfg = config[status];
    return (
      <View style={[styles.scheduleStatusPill, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.scheduleStatusPillText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    );
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (<View style={styles.container}><View style={styles.emptyState}><Text style={styles.emptyText}>Admin access required</Text></View></View>);
  }

  const handleAdoptSubject = useCallback(async (subjectId: string) => {
    setAdoptingId(subjectId);
    try {
      await adoptSubject(subjectId);
      // Remove from declined list if previously declined
      setDeclinedSubjectIds(prev => prev.filter(id => id !== subjectId));
      Alert.alert('Subject Adopted', 'An independent copy has been created for your organization. You can now edit it freely.', [{ text: 'Great' }]);
      console.log('[Subjects] Subject adopted:', subjectId);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to adopt subject');
    } finally {
      setAdoptingId(null);
    }
  }, [adoptSubject]);

  const handleDeclineSubject = useCallback((subjectId: string, subjectName: string) => {
    Alert.alert(
      'Decline Subject',
      `Decline "${subjectName}"?\n\nYou won't see this subject in your list. You can adopt it later from the Adopt Global Subject button.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            setDecliningId(subjectId);
            setDeclinedSubjectIds(prev => [...prev, subjectId]);
            setTimeout(() => setDecliningId(null), 500);
          },
        },
      ],
    );
  }, []);

  const handleUnadoptSubject = useCallback(async (subjectId: string, name: string) => {
    Alert.alert('Remove Adopted Subject', `Remove "${name}" from your subjects?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await unadoptSubject(subjectId);
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to remove subject');
          }
        },
      },
    ]);
  }, [unadoptSubject]);

  const openShareSubject = useCallback((subject: Subject) => {
    setSharingSubjectId(subject.id);
    setSelectedShareAdminIds(subject.sharedWithAdminIds ?? []);
    setShowShareModal(true);
  }, []);

  const saveSubjectSharing = useCallback(async () => {
    if (!sharingSubjectId) return;
    try {
      await shareGenericSubject(sharingSubjectId, selectedShareAdminIds);
      setShowShareModal(false);
      Alert.alert('Sharing updated', 'Selected Admins can now adopt their independent copies.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unable to update sharing.');
    }
  }, [sharingSubjectId, selectedShareAdminIds, shareGenericSubject]);

  const renderSubjectsList = () => (
    <View>
      {isAdmin && (
        <View style={styles.addBtnRow}>
          <TouchableOpacity style={styles.addMainBtn} onPress={() => { resetSubjectForm(); setShowIntegrateSuggestion(false); setIsAddingSubject(true); }}>
            <Plus size={16} color="#000" />
            <Text style={styles.addMainBtnText}>Create New Subject</Text>
          </TouchableOpacity>
          {adoptableSubjects.length > 0 && (
            <TouchableOpacity style={styles.adoptMainBtn} onPress={() => setShowAdoptModal(true)}>
              <Globe size={16} color="#000" />
              <Text style={styles.addMainBtnText}>Adopt Global Subject</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {isSuperAdmin && (
        <TouchableOpacity style={styles.addMainBtn} onPress={() => { resetSubjectForm(); setIsAddingSubject(true); }}>
          <Plus size={16} color="#000" />
          <Text style={styles.addMainBtnText}>Create Subject</Text>
        </TouchableOpacity>
      )}

      {isAdmin && (
        <View style={styles.filterTabsRow}>
          {([
            { key: 'all', label: 'All' },
            { key: 'own', label: 'My Subjects' },
            { key: 'adopted', label: 'Adopted' },
            { key: 'global', label: 'Global & Shared' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, subjectFilter === tab.key && styles.filterTabActive]}
              onPress={() => setSubjectFilter(tab.key)}
            >
              <Text style={[styles.filterTabText, subjectFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isAddingSubject && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingSubjectId ? 'Edit Subject' : isSuperAdmin ? 'Create Subject' : 'Create New Subject'}</Text>

          {isAdmin && !editingSubjectId && adoptableSubjects.length > 0 && (
            <TouchableOpacity
              style={styles.integrateBanner}
              onPress={() => setShowIntegrateSuggestion(!showIntegrateSuggestion)}
            >
              <View style={styles.integrateBannerLeft}>
                <Link2 size={16} color={Colors.accent} />
                <View style={styles.integrateBannerTextWrap}>
                  <Text style={styles.integrateBannerTitle}>Integrate existing subjects?</Text>
                  <Text style={styles.integrateBannerDesc}>Super Admin has {adoptableSubjects.length} subject(s) available to adopt as independent copies.</Text>
                </View>
              </View>
              <ChevronDown size={16} color={Colors.textMuted} style={{ transform: [{ rotate: showIntegrateSuggestion ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>
          )}

          {showIntegrateSuggestion && adoptableSubjects.length > 0 && (
            <View style={styles.integrateList}>
              {adoptableSubjects.map(gs => (
                <View key={gs.id} style={styles.integrateCard}>
                  <View style={styles.integrateCardInfo}>
                    <View style={styles.integrateCardBadgeRow}>
                      <View style={styles.codeBadge}><Text style={styles.codeText}>{gs.code}</Text></View>
                      <View style={styles.globalBadge}>
                        <Globe size={10} color={Colors.accent} />
                        <Text style={styles.globalBadgeText}>Global</Text>
                      </View>
                    </View>
                    <Text style={styles.integrateCardName}>{gs.name}</Text>
                    {gs.description ? <Text style={styles.integrateCardDesc} numberOfLines={2}>{gs.description}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.integrateAdoptBtn}
                    onPress={() => {
                      handleAdoptSubject(gs.id);
                      setShowIntegrateSuggestion(false);
                      setIsAddingSubject(false);
                    }}
                    disabled={adoptingId === gs.id}
                  >
                    {adoptingId === gs.id ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <>
                        <UserCheck size={13} color="#000" />
                        <Text style={styles.integrateAdoptBtnText}>Adopt This</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.integrateDivider}>
                <View style={styles.integrateDividerLine} />
                <Text style={styles.integrateDividerText}>or create your own below</Text>
                <View style={styles.integrateDividerLine} />
              </View>
            </View>
          )}

          <TextInput style={styles.input} value={subjectName} onChangeText={setSubjectName} placeholder="Subject Name" placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} value={subjectCode} onChangeText={setSubjectCode} placeholder="Subject Code (e.g., CSS-NC-II)" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
          <TextInput style={[styles.input, styles.textArea]} value={subjectDesc} onChangeText={setSubjectDesc} placeholder="Description" placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
          {isSuperAdmin && !editingSubjectId && (
            <>
              <Text style={styles.unlockLabel}>Subject Type</Text>
              <View style={styles.subjectTypeSelector}>
                <TouchableOpacity style={[styles.subjectTypeOption, subjectType === 'global' && styles.subjectTypeOptionActive]} onPress={() => setSubjectType('global')}>
                  <Globe size={16} color={subjectType === 'global' ? '#000' : Colors.accent} />
                  <View style={styles.subjectTypeInfo}><Text style={[styles.subjectTypeTitle, subjectType === 'global' && styles.subjectTypeTitleActive]}>Global Subject</Text><Text style={[styles.subjectTypeDesc, subjectType === 'global' && styles.subjectTypeDescActive]}>Available for every Admin to adopt</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subjectTypeOption, subjectType === 'generic' && styles.subjectTypeOptionActive]} onPress={() => setSubjectType('generic')}>
                  <Shield size={16} color={subjectType === 'generic' ? '#000' : Colors.warning} />
                  <View style={styles.subjectTypeInfo}><Text style={[styles.subjectTypeTitle, subjectType === 'generic' && styles.subjectTypeTitleActive]}>Generic Subject</Text><Text style={[styles.subjectTypeDesc, subjectType === 'generic' && styles.subjectTypeDescActive]}>Private until shared with selected Admins</Text></View>
                </TouchableOpacity>
              </View>
            </>
          )}
          <Text style={styles.unlockLabel}>Grade Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeLevelScroll}>
            {GRADE_LEVELS.map(gl => (
              <TouchableOpacity
                key={gl}
                style={[styles.gradeChip, subjectGradeLevel === gl && styles.gradeChipActive]}
                onPress={() => { setSubjectGradeLevel(subjectGradeLevel === gl ? '' : gl); setSubjectSemester(''); }}
              >
                <Text style={[styles.gradeChipText, subjectGradeLevel === gl && styles.gradeChipTextActive]}>{gl}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {subjectGradeLevel !== '' && (
            <>
              <Text style={styles.unlockLabel}>Semester</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeLevelScroll}>
                {getSemestersForGrade(subjectGradeLevel).map(sem => (
                  <TouchableOpacity
                    key={sem}
                    style={[styles.gradeChip, subjectSemester === sem && styles.gradeChipActive]}
                    onPress={() => setSubjectSemester(subjectSemester === sem ? '' : sem)}
                  >
                    <Text style={[styles.gradeChipText, subjectSemester === sem && styles.gradeChipTextActive]}>{sem}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.unlockLabel}>Unlock Type</Text>
          <View style={styles.unlockSelector}>
            <TouchableOpacity style={[styles.unlockOption, unlockType === 'sequential' && styles.unlockOptionActive]} onPress={() => setUnlockType('sequential')}>
              <Lock size={16} color={unlockType === 'sequential' ? '#000' : Colors.textMuted} />
              <View style={styles.unlockOptionInfo}>
                <Text style={[styles.unlockOptionTitle, unlockType === 'sequential' && styles.unlockOptionTitleActive]}>Sequential</Text>
                <Text style={[styles.unlockOptionDesc, unlockType === 'sequential' && styles.unlockOptionDescActive]}>Must pass quiz to unlock next</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.unlockOption, unlockType === 'flexible' && styles.unlockOptionActive]} onPress={() => setUnlockType('flexible')}>
              <Unlock size={16} color={unlockType === 'flexible' ? '#000' : Colors.textMuted} />
              <View style={styles.unlockOptionInfo}>
                <Text style={[styles.unlockOptionTitle, unlockType === 'flexible' && styles.unlockOptionTitleActive]}>Flexible</Text>
                <Text style={[styles.unlockOptionDesc, unlockType === 'flexible' && styles.unlockOptionDescActive]}>All topics available, quiz once</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={resetSubjectForm}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSubject} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {adminSubjects.map((subject) => {
        const subjectType = subject.subjectType ?? (subject.isGlobal ? 'global' : 'private');
        const isAdaptedCopy = isAdmin && subject.adminId === currentUser?.id && (subjectType === 'adapted' || Boolean(subject.sourceSubjectId));
        const isOwnSubject = subject.adminId === currentUser?.id;
        const isGeneric = subjectType === 'generic';
        return (
          <TouchableOpacity
            key={subject.id}
            style={styles.subjectCard}
            onPress={() => { setSelectedSubjectId(subject.id); setViewMode('content'); }}
            activeOpacity={0.7}
          >
            <View style={styles.subjectHeader}>
              <View style={styles.subjectBadgeRow}>
                <View style={styles.codeBadge}><Text style={styles.codeText}>{subject.code}</Text></View>
                {subjectType === 'global' && (
                  <View style={styles.globalBadge}>
                    <Globe size={10} color={Colors.accent} />
                    <Text style={styles.globalBadgeText}>Global</Text>
                  </View>
                )}
                {isGeneric && (
                  <View style={styles.genericBadge}>
                    <Shield size={10} color={Colors.warning} />
                    <Text style={styles.genericBadgeText}>Generic</Text>
                  </View>
                )}
                {isAdaptedCopy && (
                  <View style={styles.adoptedBadge}>
                    <UserCheck size={10} color={Colors.primary} />
                    <Text style={styles.adoptedBadgeText}>Adapted Copy</Text>
                  </View>
                )}
              </View>
              <View style={styles.unlockBadge}>
                {subject.unlockType === 'sequential' ? <Lock size={12} color={Colors.warning} /> : <Unlock size={12} color={Colors.primary} />}
                <Text style={styles.unlockBadgeText}>{subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}</Text>
              </View>
            </View>
            <Text style={styles.subjectNameCard}>{subject.name}</Text>
            {subject.description ? <Text style={styles.subjectDescCard} numberOfLines={2}>{subject.description}</Text> : null}
            {isAdaptedCopy && (() => {
              const sourceName = getSourceSubjectName(subject);
              return sourceName ? (
                <View style={styles.adaptedFromRow}>
                  <Link2 size={11} color={Colors.textMuted} />
                  <Text style={styles.adaptedFromText}>Adapted from: {sourceName}</Text>
                </View>
              ) : null;
            })()}
            <View style={styles.subjectFooter}>
              <View style={styles.studentCount}><GraduationCap size={14} color={Colors.primary} /><Text style={styles.studentCountText}>{getStudentCount(subject.id)} students</Text></View>
              <View style={styles.subjectActions}>
                {isAdaptedCopy && (
                  <TouchableOpacity style={styles.iconButtonDanger} onPress={(e) => { e.stopPropagation?.(); handleUnadoptSubject(subject.id, subject.name); }}><XCircle size={18} color={Colors.error} /></TouchableOpacity>
                )}
                {isSuperAdmin && isGeneric && (
                  <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation?.(); openShareSubject(subject); }}><Share2 size={18} color={Colors.accent} /></TouchableOpacity>
                )}
                {(isOwnSubject || isSuperAdmin) && (isSuperAdmin || !subject.isGlobal) && (
                  <>
                    <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation?.(); handleEditSubject(subject); }}><Edit3 size={18} color={Colors.primary} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButtonDanger} onPress={(e) => { e.stopPropagation?.(); handleDeleteSubject(subject.id, subject.name); }}><Trash2 size={18} color={Colors.error} /></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {adminSubjects.length === 0 && !isAddingSubject && (
        <View style={styles.emptyState}><BookOpen size={48} color={Colors.textMuted} /><Text style={styles.emptyText}>No subjects created yet</Text></View>
      )}

      {archivedSubjectsList.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Archived Subjects</Text>
          {archivedSubjectsList.map((subject) => (
            <View key={subject.id} style={[styles.subjectCard, { opacity: 0.6 }]}>
              <View style={styles.codeBadge}><Text style={styles.codeText}>{subject.code}</Text></View>
              <Text style={styles.subjectNameCard}>{subject.name}</Text>
              <TouchableOpacity style={styles.iconButton} onPress={() => archiveSubject(subject.id)}><Archive size={18} color={Colors.primary} /></TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderContentManagement = () => (
    <View>
      <TouchableOpacity style={styles.backToSubjects} onPress={() => setViewMode('subjects')}>
        <Text style={styles.backToSubjectsText}>← Back to Subjects</Text>
      </TouchableOpacity>

      {activeSubject && !canEditActiveSubject && (
        <View style={styles.readOnlyBanner}><Lock size={16} color={Colors.warning} /><Text style={styles.readOnlyText}>Read-only master subject. Adopt it to create an editable copy for your organization.</Text></View>
      )}

      {activeSubject && (
        <View style={styles.subjectInfoCard}>
          <Text style={styles.subjectInfoName}>{activeSubject.name}</Text>
          <Text style={styles.subjectInfoType}>{activeSubject.subjectType === 'adapted' ? `Adapted from ${getSourceSubjectName(activeSubject) ?? 'master subject'}` : activeSubject.subjectType === 'generic' ? 'Generic master subject' : activeSubject.subjectType === 'global' || activeSubject.isGlobal ? 'Global master subject' : 'Private subject'} · Unlock: {activeSubject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}</Text>
          {activeSubject.subjectType === 'adapted' && getSourceSubjectName(activeSubject) && (
            <View style={styles.adaptedFromRow}>
              <Link2 size={11} color={Colors.textMuted} />
              <Text style={styles.adaptedFromText}>Original: {getSourceSubjectName(activeSubject)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'cocs' && styles.tabActive]} onPress={() => setActiveTab('cocs')}>
          <Layers size={15} color={activeTab === 'cocs' ? '#000' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'cocs' && styles.tabTextActive]}>{activeSubject?.unlockType === 'flexible' ? 'Topics' : 'COCs & LOs'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'quizzes' && styles.tabActive]} onPress={() => setActiveTab('quizzes')}>
          <HelpCircle size={15} color={activeTab === 'quizzes' ? '#000' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'quizzes' && styles.tabTextActive]}>Quizzes</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'cocs' && (
        <View>
          <TouchableOpacity style={styles.addMainBtn} onPress={openAddCOC}>
            <Plus size={16} color="#000" /><Text style={styles.addMainBtnText}>{activeSubject?.unlockType === 'flexible' ? 'Add Topic' : 'Add COC'}</Text>
          </TouchableOpacity>

          {subjectCOCs.map((coc) => {
            const isExpanded = expandedCOC === coc.id;
            const cocLOs = getCOCLOs(coc.id);
            return (
              <View key={coc.id} style={styles.cocSection}>
                <TouchableOpacity style={styles.cocHeader} onPress={() => setExpandedCOC(isExpanded ? null : coc.id)}>
                  <View style={styles.cocHeaderLeft}>
                    <Text style={styles.cocOrder}>{activeSubject?.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}</Text>
                    <Text style={styles.cocTitleText} numberOfLines={1}>{coc.title}</Text>
                    <Text style={styles.cocMeta}>{cocLOs.length} Learning Outcomes</Text>
                  </View>
                  <View style={styles.cocActions}>
                    <TouchableOpacity onPress={() => openEditCOC(coc)} style={styles.iconBtn}><Edit3 size={15} color={Colors.accent} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteCOC(coc.id, coc.title)} style={styles.iconBtn}><Trash2 size={15} color={Colors.error} /></TouchableOpacity>
                    {isExpanded ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.cocContent}>
                    {coc.description ? <Text style={styles.cocDescription}>{coc.description}</Text> : null}
                    <TouchableOpacity style={styles.addSubBtn} onPress={() => openAddLO(coc.id)}>
                      <Plus size={14} color={Colors.primary} /><Text style={styles.addSubText}>Add Learning Outcome</Text>
                    </TouchableOpacity>
                    {cocLOs.map((lo, loIdx) => {
                      const isLOExpanded = expandedLO === lo.id;
                      const loContents = getLOContents(lo.id);
                      const isFlexibleSubject = activeSubject?.unlockType === 'flexible';
                      const isDragging = draggedLOId === lo.id;
                      const isDropTarget = dropTargetLOId === lo.id && draggedLOId !== lo.id;
                      const dragProps = isFlexibleSubject && Platform.OS === 'web' ? {
                        draggable: true,
                        onDragStart: () => handleDragStart(lo.id),
                        onDragOver: (e: any) => handleDragOver(e, lo.id),
                        onDrop: () => handleDrop(coc.id, lo.id),
                      } : {};
                      return (
                        <View
                          key={lo.id}
                          style={[
                            styles.loSection,
                            isDragging && styles.loDragging,
                            isDropTarget && styles.loDropTarget,
                          ]}
                          {...dragProps}
                        >
                          <TouchableOpacity style={styles.loHeader} onPress={() => setExpandedLO(isLOExpanded ? null : lo.id)}>
                            <View style={styles.loHeaderLeft}>
                              {isFlexibleSubject && (
                                <View style={styles.loReorderControls}>
                                  {Platform.OS === 'web' && (
                                    <GripVertical size={14} color={Colors.textMuted} />
                                  )}
                                  <TouchableOpacity
                                    style={styles.moveBtn}
                                    onPress={() => handleMoveLO(coc.id, lo.id, 'up')}
                                    disabled={loIdx === 0 || reorderingCOCId !== null}
                                  >
                                    <ArrowUp size={12} color={loIdx === 0 ? Colors.textMuted : Colors.primary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.moveBtn}
                                    onPress={() => handleMoveLO(coc.id, lo.id, 'down')}
                                    disabled={loIdx === cocLOs.length - 1 || reorderingCOCId !== null}
                                  >
                                    <ArrowDown size={12} color={loIdx === cocLOs.length - 1 ? Colors.textMuted : Colors.primary} />
                                  </TouchableOpacity>
                                </View>
                              )}
                              <Text style={styles.loOrder}>LO {lo.order}</Text>
                              <Text style={styles.loTitleText} numberOfLines={1}>{lo.title}</Text>
                              <Text style={styles.loMeta}>{loContents.length} content items</Text>
                            </View>
                            <View style={styles.loActions}>
                              <TouchableOpacity onPress={() => openEditLO(lo)} style={styles.iconBtn}><Edit3 size={13} color={Colors.accent} /></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteLO(lo.id, lo.title)} style={styles.iconBtn}><Trash2 size={13} color={Colors.error} /></TouchableOpacity>
                              {isLOExpanded ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
                            </View>
                          </TouchableOpacity>
                          {isLOExpanded && (
                            <View style={styles.loContent}>
                              {lo.description ? <Text style={styles.loDescription}>{lo.description}</Text> : null}
                              {lo.performanceCriteria.length > 0 && (
                                <View style={styles.criteriaList}>
                                  <Text style={styles.criteriaLabel}>Performance Criteria:</Text>
                                  {lo.performanceCriteria.map((pc, idx) => (<Text key={idx} style={styles.criteriaItem}>• {pc}</Text>))}
                                </View>
                              )}
                              <TouchableOpacity style={styles.addSubBtn} onPress={() => openAddContent(lo.id, coc.id)}>
                                <Plus size={14} color={Colors.primary} /><Text style={styles.addSubText}>Add Content</Text>
                              </TouchableOpacity>
                              {loContents.map(c => (
                                <View key={c.id} style={styles.contentItem}>
                                  <View style={styles.contentItemLeft}>
                                    {c.type === 'youtube' ? <PlayCircle size={13} color={Colors.error} /> : <FileText size={13} color={Colors.accent} />}
                                    <View style={styles.contentItemInfo}>
                                      <Text style={styles.contentItemTitle} numberOfLines={1}>{c.title}</Text>
                                      <Text style={styles.contentItemType}>{c.type === 'youtube' ? 'YouTube' : 'Text'}</Text>
                                    </View>
                                  </View>
                                  <View style={styles.contentItemActions}>
                                    <TouchableOpacity onPress={() => openEditContent(c)} style={styles.iconBtn}><Edit3 size={12} color={Colors.accent} /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteContent(c.id, c.title)} style={styles.iconBtn}><Trash2 size={12} color={Colors.error} /></TouchableOpacity>
                                  </View>
                                </View>
                              ))}
                              {loContents.length === 0 && <Text style={styles.emptyContentText}>No content yet</Text>}
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {cocLOs.length === 0 && <Text style={styles.emptyContentText}>No Learning Outcomes yet</Text>}
                  </View>
                )}
              </View>
            );
          })}
          {subjectCOCs.length === 0 && (
            <View style={styles.emptyState}><Layers size={40} color={Colors.textMuted} /><Text style={styles.emptyText}>{activeSubject?.unlockType === 'flexible' ? 'No topics yet. Add your first topic.' : 'No COCs yet. Add your first competency.'}</Text></View>
          )}
        </View>
      )}

      {activeTab === 'quizzes' && (
        <View>
          {subjectCOCs.map((coc) => {
            const cocLOs = getCOCLOs(coc.id);
            return (
              <View key={coc.id} style={styles.cocSection}>
                <View style={styles.quizCocHeader}><Text style={styles.cocOrder}>{activeSubject?.unlockType === 'flexible' ? `Topic ${coc.order}` : `COC ${coc.order}`}</Text><Text style={styles.cocTitleText} numberOfLines={1}>{coc.title}</Text></View>
                {cocLOs.map((lo) => {
                  const isExpanded = expandedQuizLO === lo.id;
                  const quiz = getLOQuiz(lo.id);
                  const quizQs = quiz ? getQuizQuestions(quiz.id) : [];
                  return (
                    <View key={lo.id} style={styles.quizLoSection}>
                      <TouchableOpacity style={styles.loHeader} onPress={() => setExpandedQuizLO(isExpanded ? null : lo.id)}>
                        <View style={styles.loHeaderLeft}>
                          <Text style={styles.loOrder}>LO {lo.order}: {lo.title}</Text>
                          <Text style={styles.loMeta}>{quiz ? `${quizQs.length} questions · Pass: ${quiz.passingScore}%` : 'No quiz yet'}</Text>
                        </View>
                        <View style={styles.loActions}>
                          <TouchableOpacity onPress={() => openAddQ(lo.id)} style={styles.iconBtn}><Plus size={16} color={Colors.primary} /></TouchableOpacity>
                          {isExpanded ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
                        </View>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.loContent}>
                          {quiz && (
                            <View style={styles.quizInfoRow}>
                              <Text style={styles.quizInfoText}>Passing Score: {quiz.passingScore}%</Text>
                              <TouchableOpacity style={styles.deleteQuizBtn} onPress={() => Alert.alert('Delete Quiz', 'Delete this quiz and all questions?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteQuiz(quiz.id) }])}><Trash2 size={12} color={Colors.error} /></TouchableOpacity>
                            </View>
                          )}
                          {/* Schedule Section (Flexible Subjects Only) */}
                          {quiz && activeSubject?.unlockType === 'flexible' && (
                            <View style={styles.scheduleSection}>
                              <View style={styles.scheduleSectionHeader}>
                                <Calendar size={14} color={Colors.accent} />
                                <Text style={styles.scheduleSectionTitle}>Scheduled Access</Text>
                                {getScheduleStatusBadge(quiz.id)}
                              </View>
                              {quiz.schedule ? (
                                <View style={styles.scheduleInfo}>
                                  <View style={styles.scheduleInfoRow}>
                                    <CalendarClock size={12} color={Colors.success} />
                                    <Text style={styles.scheduleInfoText}>Opens: {formatScheduleDisplay(quiz.schedule.startDateTime)}</Text>
                                  </View>
                                  <View style={styles.scheduleInfoRow}>
                                    <CalendarX size={12} color={Colors.error} />
                                    <Text style={styles.scheduleInfoText}>Closes: {formatScheduleDisplay(quiz.schedule.endDateTime)}</Text>
                                  </View>
                                  <View style={styles.scheduleInfoRow}>
                                    <Clock size={12} color={Colors.textMuted} />
                                    <Text style={styles.scheduleInfoText}>Timezone: {quiz.schedule.timeZone}</Text>
                                  </View>
                                  {quiz.schedule.isExtendable && (
                                    <View style={styles.scheduleInfoRow}>
                                      <Timer size={12} color={Colors.warning} />
                                      <Text style={styles.scheduleInfoText}>End time can be extended</Text>
                                    </View>
                                  )}
                                  <TouchableOpacity style={styles.editScheduleBtn} onPress={() => openScheduleModal(quiz.id)}>
                                    <Edit3 size={12} color={Colors.primary} />
                                    <Text style={styles.editScheduleBtnText}>Edit Schedule</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={styles.noScheduleInfo}>
                                  <Text style={styles.noScheduleText}>No schedule set. Quiz is available anytime once lesson is done.</Text>
                                  <TouchableOpacity style={styles.setScheduleBtn} onPress={() => openScheduleModal(quiz.id)}>
                                    <Calendar size={12} color="#000" />
                                    <Text style={styles.setScheduleBtnText}>Set Schedule</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          )}
                          {quizQs.length === 0 && <Text style={styles.emptyContentText}>No questions yet.</Text>}
                          {quizQs.map((q, qIdx) => (
                            <View key={q.id} style={styles.questionItem}>
                              <Text style={styles.qNumber}>{qIdx + 1}.</Text>
                              <Text style={styles.qTextPreview} numberOfLines={2}>{q.question}</Text>
                              <TouchableOpacity onPress={() => openEditQ(q)} style={styles.iconBtn}><Edit3 size={12} color={Colors.accent} /></TouchableOpacity>
                              <TouchableOpacity onPress={() => Alert.alert('Delete Question', 'Delete this question?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteQuestion(q.id) }])} style={styles.iconBtn}><Trash2 size={12} color={Colors.error} /></TouchableOpacity>
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>Manage Subjects</Text>
          <Text style={styles.pageSubtitle}>{viewMode === 'subjects' ? 'Create and manage subjects' : 'COCs, LOs, content & quizzes'}</Text>
          {viewMode === 'subjects' ? renderSubjectsList() : renderContentManagement()}
        </ScrollView>

        <Modal visible={showCOCModal} transparent animationType="slide">
          <View style={styles.modalOverlay}><View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingCOCId ? (activeSubject?.unlockType === 'flexible' ? 'Edit Topic' : 'Edit COC') : (activeSubject?.unlockType === 'flexible' ? 'Add Topic' : 'Add COC')}</Text><TouchableOpacity onPress={() => setShowCOCModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity></View>
            <Text style={styles.inputLabel}>Title</Text><TextInput style={styles.modalInput} placeholder={activeSubject?.unlockType === 'flexible' ? 'Title of Topic' : 'COC title'} placeholderTextColor={Colors.textMuted} value={cocTitle} onChangeText={setCocTitle} />
            <Text style={styles.inputLabel}>Description</Text><TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Description" placeholderTextColor={Colors.textMuted} value={cocDesc} onChangeText={setCocDesc} multiline numberOfLines={3} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveCOC}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
          </View></View>
        </Modal>

        <Modal visible={showLOModal} transparent animationType="slide">
          <View style={styles.modalOverlay}><ScrollView><View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingLOId ? 'Edit LO' : 'Add LO'}</Text><TouchableOpacity onPress={() => setShowLOModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity></View>
            <Text style={styles.inputLabel}>Title</Text><TextInput style={styles.modalInput} placeholder="LO title" placeholderTextColor={Colors.textMuted} value={loTitle} onChangeText={setLoTitle} />
            <Text style={styles.inputLabel}>Description</Text><TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Description" placeholderTextColor={Colors.textMuted} value={loDesc} onChangeText={setLoDesc} multiline numberOfLines={3} />
            <Text style={styles.inputLabel}>Performance Criteria (one per line)</Text><TextInput style={[styles.modalInput, styles.modalTextAreaLarge]} placeholder="Enter criteria..." placeholderTextColor={Colors.textMuted} value={loPerformanceCriteria} onChangeText={setLoPerformanceCriteria} multiline numberOfLines={5} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveLO}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
          </View></ScrollView></View>
        </Modal>

        <Modal visible={showContentModal} transparent animationType="slide">
          <View style={styles.modalOverlay}><ScrollView><View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingContentId ? 'Edit Content' : 'Add Content'}</Text><TouchableOpacity onPress={() => setShowContentModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity></View>
            <Text style={styles.inputLabel}>Content Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'text' && styles.typeBtnActive]} onPress={() => setContentType('text')}><FileText size={14} color={contentType === 'text' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'text' && styles.typeBtnTextActive]}>Text</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'youtube' && styles.typeBtnActive]} onPress={() => setContentType('youtube')}><PlayCircle size={14} color={contentType === 'youtube' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'youtube' && styles.typeBtnTextActive]}>YouTube</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'pdf' && styles.typeBtnActive]} onPress={() => setContentType('pdf')}><FileType size={14} color={contentType === 'pdf' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'pdf' && styles.typeBtnTextActive]}>PDF</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'ppt' && styles.typeBtnActive]} onPress={() => setContentType('ppt')}><Presentation size={14} color={contentType === 'ppt' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'ppt' && styles.typeBtnTextActive]}>PPT</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'doc' && styles.typeBtnActive]} onPress={() => setContentType('doc')}><FileText size={14} color={contentType === 'doc' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'doc' && styles.typeBtnTextActive]}>Doc</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'image' && styles.typeBtnActive]} onPress={() => { setContentType('image'); pickImage(); }}><ImageIcon size={14} color={contentType === 'image' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'image' && styles.typeBtnTextActive]}>Image</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, contentType === 'video' && styles.typeBtnActive]} onPress={() => { setContentType('video'); pickDocument(); }}><Video size={14} color={contentType === 'video' ? '#000' : Colors.textMuted} /><Text style={[styles.typeBtnText, contentType === 'video' && styles.typeBtnTextActive]}>Video</Text></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Title</Text><TextInput style={styles.modalInput} placeholder="Content title" placeholderTextColor={Colors.textMuted} value={contentTitle} onChangeText={setContentTitle} />
            {(['pdf', 'ppt', 'doc', 'image', 'video'].includes(contentType)) ? (
              <>
                <Text style={styles.inputLabel}>File</Text>
                {contentFileName ? (
                  <View style={styles.filePreviewRow}>
                    <FileText size={18} color={Colors.accent} />
                    <View style={styles.filePreviewInfo}>
                      <Text style={styles.filePreviewName}>{contentFileName}</Text>
                      {contentFileSize > 0 && <Text style={styles.filePreviewSize}>{(contentFileSize / 1024 / 1024).toFixed(2)} MB</Text>}
                    </View>
                    <TouchableOpacity onPress={() => { setContentFileName(''); setContentFileUri(''); setContentFileUrl(''); setContentFileSize(0); }}><X size={16} color={Colors.textMuted} /></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.filePickerBtn} onPress={pickDocument}>
                    <Upload size={20} color={Colors.textSecondary} />
                    <Text style={styles.filePickerText}>Tap to select a file</Text>
                  </TouchableOpacity>
                )}
                {isUploading && (
                  <View style={styles.uploadProgressContainer}>
                    <View style={styles.uploadProgressBar}>
                      <View style={[styles.uploadProgressFill, { width: `${uploadProgress * 100}%` }]} />
                    </View>
                    <Text style={styles.uploadProgressText}>Uploading... {Math.round(uploadProgress * 100)}%</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>{contentType === 'youtube' ? 'YouTube URL' : 'Content'}</Text>
                <TextInput style={[styles.modalInput, contentType === 'text' && styles.modalTextAreaLarge]} placeholder={contentType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'Enter text content...'} placeholderTextColor={Colors.textMuted} value={contentBody} onChangeText={setContentBody} multiline={contentType === 'text'} numberOfLines={contentType === 'text' ? 6 : 1} autoCapitalize="none" />
              </>
            )}
            <TouchableOpacity style={[styles.saveBtn, isUploading && { opacity: 0.6 }]} onPress={saveContent} disabled={isUploading}><Text style={styles.saveBtnText}>{isUploading ? 'Uploading...' : 'Save'}</Text></TouchableOpacity>
          </View></ScrollView></View>
        </Modal>

        <Modal visible={showQModal} transparent animationType="slide">
          <View style={styles.modalOverlay}><ScrollView><View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingQId ? 'Edit Question' : 'Add Question'}</Text><TouchableOpacity onPress={() => setShowQModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity></View>
            <Text style={styles.inputLabel}>Question</Text><TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Question text" placeholderTextColor={Colors.textMuted} value={qText} onChangeText={setQText} multiline />
            <Text style={styles.inputLabel}>Options (tap radio for correct answer)</Text>
            {qOptions.map((opt, idx) => (
              <View key={idx} style={styles.optionRow}>
                <TouchableOpacity style={[styles.optionRadio, qCorrect === idx && styles.optionRadioSelected]} onPress={() => setQCorrect(idx)}>
                  {qCorrect === idx && <View style={styles.optionRadioDot} />}
                </TouchableOpacity>
                <TextInput style={[styles.modalInput, styles.optionInput]} placeholder={`Option ${String.fromCharCode(65 + idx)}`} placeholderTextColor={Colors.textMuted} value={opt} onChangeText={(v) => updateOption(idx, v)} />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={saveQ}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
          </View></ScrollView></View>
        </Modal>

        <Modal visible={showShareModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Generic Subject</Text>
                <TouchableOpacity onPress={() => setShowShareModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity>
              </View>
              <Text style={styles.adoptDesc}>Choose which Admins can see and adopt this Generic Subject. Revoke is available until an Admin creates their independent copy.</Text>
              <ScrollView style={styles.shareList} showsVerticalScrollIndicator={false}>
                {selectableAdmins.map(admin => {
                  const selected = selectedShareAdminIds.includes(admin.id);
                  return (
                    <TouchableOpacity key={admin.id} style={[styles.shareAdminRow, selected && styles.shareAdminRowActive]} onPress={() => setSelectedShareAdminIds(previous => selected ? previous.filter(id => id !== admin.id) : [...previous, admin.id])}>
                      <View style={styles.shareAdminCheck}>{selected ? <UserCheck size={15} color={Colors.primary} /> : null}</View>
                      <View style={styles.shareAdminInfo}><Text style={styles.shareAdminName}>{admin.fullName}</Text><Text style={styles.shareAdminMeta}>{admin.email}{admin.schoolOrganization ? ` · ${admin.schoolOrganization}` : ''}</Text></View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={saveSubjectSharing}><Text style={styles.saveBtnText}>Save Sharing</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showScheduleModal} transparent animationType="slide">
          <View style={styles.modalOverlay}><ScrollView><View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Quiz Access</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity>
            </View>
            <Text style={styles.adoptDesc}>Set when students can access this quiz. Before the start time, the quiz shows a countdown. After the end time, the quiz is closed.</Text>

            <Text style={styles.inputLabel}>Start Date & Time</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={Colors.textMuted}
              value={scheduleStart}
              onChangeText={setScheduleStart}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>End Date & Time</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={Colors.textMuted}
              value={scheduleEnd}
              onChangeText={setScheduleEnd}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Time Zone</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Asia/Manila"
              placeholderTextColor={Colors.textMuted}
              value={scheduleTimeZone}
              onChangeText={setScheduleTimeZone}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.extendableRow, scheduleExtendable && styles.extendableRowActive]}
              onPress={() => setScheduleExtendable(prev => !prev)}
            >
              <View style={[styles.extendableCheckbox, scheduleExtendable && styles.extendableCheckboxActive]}>
                {scheduleExtendable && <CheckCircle size={14} color="#000" />}
              </View>
              <View style={styles.extendableInfo}>
                <Text style={[styles.extendableTitle, scheduleExtendable && styles.extendableTitleActive]}>Allow extending end time</Text>
                <Text style={styles.extendableDesc}>Permit editing the end time even after students have started the quiz.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.formActions}>
              {getQuizSchedule(scheduleQuizId) && (
                <TouchableOpacity style={styles.clearScheduleBtn} onPress={handleClearSchedule}>
                  <Trash size={16} color={Colors.error} />
                  <Text style={styles.clearScheduleBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchedule} disabled={scheduleSaving}>
                {scheduleSaving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.saveBtnText}>Save Schedule</Text>}
              </TouchableOpacity>
            </View>
          </View></ScrollView></View>
        </Modal>

        <Modal visible={showAdoptModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Available Subjects</Text>
                <TouchableOpacity onPress={() => setShowAdoptModal(false)}><X size={22} color={Colors.text} /></TouchableOpacity>
              </View>
              <Text style={styles.adoptDesc}>Global subjects are master subjects from the Super Admin, available to every Admin. Generic subjects appear here only when the Super Admin has explicitly shared them with you. You can adopt any subject to create an independent, fully editable copy — or decline if you don't need it.</Text>
              <ScrollView style={styles.adoptList} showsVerticalScrollIndicator={false}>
                {adoptableSubjects.length === 0 ? (
                  <Text style={styles.emptyContentText}>No shared subjects available for adoption.</Text>
                ) : (
                  adoptableSubjects.map(subject => {
                    const sType = subject.subjectType ?? (subject.isGlobal ? 'global' : 'private');
                    const isGlobal = sType === 'global';
                    return (
                      <View key={subject.id} style={styles.adoptCard}>
                        <View style={styles.adoptCardInfo}>
                          <View style={styles.adoptCardBadgeRow}>
                            <View style={styles.codeBadge}><Text style={styles.codeText}>{subject.code}</Text></View>
                            <View style={styles.unlockBadge}>
                              {subject.unlockType === 'sequential' ? <Lock size={10} color={Colors.warning} /> : <Unlock size={10} color={Colors.primary} />}
                              <Text style={styles.unlockBadgeText}>{subject.unlockType === 'sequential' ? 'Sequential' : 'Flexible'}</Text>
                            </View>
                            {isGlobal ? (
                              <View style={styles.globalBadge}>
                                <Globe size={10} color={Colors.accent} />
                                <Text style={styles.globalBadgeText}>Global</Text>
                              </View>
                            ) : (
                              <View style={styles.genericBadge}>
                                <Shield size={10} color={Colors.warning} />
                                <Text style={styles.genericBadgeText}>Shared</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.adoptCardName}>{subject.name}</Text>
                          {subject.description ? <Text style={styles.adoptCardDesc} numberOfLines={2}>{subject.description}</Text> : null}
                        </View>
                        <View style={styles.adoptActionRow}>
                          <TouchableOpacity
                            style={styles.adoptBtn}
                            onPress={() => handleAdoptSubject(subject.id)}
                            disabled={adoptingId === subject.id}
                          >
                            {adoptingId === subject.id ? (
                              <ActivityIndicator color="#000" size="small" />
                            ) : (
                              <>
                                <UserCheck size={14} color="#000" />
                                <Text style={styles.adoptBtnText}>Adopt</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => handleDeclineSubject(subject.id, subject.name)}
                            disabled={decliningId === subject.id}
                          >
                            <XCircle size={14} color={Colors.textMuted} />
                            <Text style={styles.declineBtnText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, marginTop: 16 },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  backToSubjects: { paddingVertical: 8, marginBottom: 12 },
  backToSubjectsText: { fontSize: 14, color: Colors.primary, fontWeight: '600' as const },
  addMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 16 },
  addMainBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#000' },
  formCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  subjectTypeSelector: { gap: 8, marginBottom: 16 },
  subjectTypeOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  subjectTypeOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subjectTypeInfo: { flex: 1 },
  subjectTypeTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.text },
  subjectTypeTitleActive: { color: '#000' },
  subjectTypeDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  subjectTypeDescActive: { color: 'rgba(0,0,0,0.65)' },
  input: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, marginBottom: 12 },
  textArea: { height: 80, textAlignVertical: 'top' as const },
  unlockLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8 },
  unlockSelector: { gap: 8, marginBottom: 16 },
  unlockOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  unlockOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unlockOptionInfo: { flex: 1 },
  unlockOptionTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  unlockOptionTitleActive: { color: '#000' },
  unlockOptionDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  unlockOptionDescActive: { color: 'rgba(0,0,0,0.6)' },
  formActions: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  saveButton: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#000', fontSize: 14, fontWeight: '600' as const },
  subjectCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  codeText: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: Colors.surfaceLight },
  unlockBadgeText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
  subjectNameCard: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  subjectDescCard: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  subjectFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  studentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  studentCountText: { fontSize: 12, fontWeight: '500' as const, color: Colors.primary },
  subjectActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '15' },
  iconButtonDanger: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.error + '15' },
  subjectInfoCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '15', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.warning + '35' },
  readOnlyText: { flex: 1, color: Colors.warning, fontSize: 12, lineHeight: 17 },
  subjectInfoName: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  subjectInfoType: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted },
  tabTextActive: { color: '#000' },
  cocSection: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  cocHeaderLeft: { flex: 1 },
  cocOrder: { fontSize: 11, fontWeight: '700' as const, color: Colors.primary, marginBottom: 2 },
  cocTitleText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  cocMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  cocActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cocContent: { paddingHorizontal: 14, paddingBottom: 14 },
  cocDescription: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10, lineHeight: 17 },
  quizCocHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  loSection: { backgroundColor: Colors.surfaceLight, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  loDragging: { opacity: 0.5, transform: [{ scale: 0.98 }] },
  loDropTarget: { borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  loReorderControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, marginRight: 8 },
  moveBtn: { padding: 4, borderRadius: 4 },
  loHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  loHeaderLeft: { flex: 1 },
  loOrder: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent, marginBottom: 1 },
  loTitleText: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  loMeta: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  loActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loContent: { paddingHorizontal: 10, paddingBottom: 10 },
  loDescription: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8, lineHeight: 17 },
  criteriaList: { marginBottom: 8 },
  criteriaLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 4 },
  criteriaItem: { fontSize: 11, color: Colors.textMuted, marginBottom: 2, paddingLeft: 4 },
  quizLoSection: { overflow: 'hidden' },
  quizInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  quizInfoText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  deleteQuizBtn: { padding: 4 },
  iconBtn: { padding: 4 },
  addSubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' as const, marginBottom: 10 },
  addSubText: { fontSize: 12, color: Colors.primary, fontWeight: '500' as const },
  contentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background, borderRadius: 8, padding: 10, marginBottom: 6 },
  contentItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  contentItemInfo: { flex: 1 },
  contentItemTitle: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  contentItemType: { fontSize: 11, color: Colors.textMuted },
  contentItemActions: { flexDirection: 'row', gap: 4 },
  emptyContentText: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' as const, textAlign: 'center' as const, paddingVertical: 12 },
  questionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  qNumber: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted, width: 24 },
  qTextPreview: { flex: 1, fontSize: 13, color: Colors.text },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' as const },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '90%' as const },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  inputLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 14, marginBottom: 4 },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' as const },
  modalTextAreaLarge: { minHeight: 120, textAlignVertical: 'top' as const },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 12, fontWeight: '500' as const, color: Colors.textMuted },
  typeBtnTextActive: { color: '#000' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  optionRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  optionRadioSelected: { borderColor: Colors.primary },
  optionRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  optionInput: { flex: 1, marginBottom: 0 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' as const },
  filePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  filePreviewInfo: { flex: 1 },
  filePreviewName: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  filePreviewSize: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  filePickerBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' as const, paddingVertical: 24, marginBottom: 10 },
  filePickerText: { fontSize: 14, color: Colors.textSecondary },
  uploadProgressContainer: { marginBottom: 10 },
  uploadProgressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' as const },
  uploadProgressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  uploadProgressText: { fontSize: 12, color: Colors.textMuted, marginTop: 6, textAlign: 'center' as const },
  addBtnRow: { gap: 8, marginBottom: 16 },
  adoptMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 12 },
  filterTabsRow: { flexDirection: 'row' as const, gap: 6, marginBottom: 14, flexWrap: 'wrap' as const },
  filterTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary },
  filterTabTextActive: { color: '#000' },
  adaptedFromRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 4, marginBottom: 8 },
  adaptedFromText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' as const },
  globalBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  globalBadgeText: { fontSize: 10, color: Colors.accent, fontWeight: '600' as const },
  genericBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  genericBadgeText: { fontSize: 10, color: Colors.warning, fontWeight: '600' as const },
  adoptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adoptedBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' as const },
  subjectBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adoptDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  adoptList: { maxHeight: 400 },
  shareList: { maxHeight: 360 },
  shareAdminRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  shareAdminRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  shareAdminCheck: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  shareAdminInfo: { flex: 1 },
  shareAdminName: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  shareAdminMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  adoptCard: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  adoptCardInfo: { marginBottom: 10 },
  adoptCardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  adoptCardName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 2 },
  adoptCardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  adoptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, height: 38, flex: 1 },
  adoptBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#000' },
  adoptActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  declineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.surfaceLight, borderRadius: 10, height: 38, flex: 1, borderWidth: 1, borderColor: Colors.border },
  declineBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted },
  gradeLevelScroll: { marginBottom: 14, flexGrow: 0 },
  gradeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  gradeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gradeChipText: { fontSize: 12, fontWeight: '500' as const, color: Colors.text },
  gradeChipTextActive: { color: '#000' },
  integrateBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.accent + '12', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.accent + '30' },
  integrateBannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  integrateBannerTextWrap: { flex: 1 },
  integrateBannerTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  integrateBannerDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  integrateList: { marginBottom: 12 },
  integrateCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  integrateCardInfo: { marginBottom: 8 },
  integrateCardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  integrateCardName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 2 },
  integrateCardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  integrateAdoptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 8, height: 34 },
  integrateAdoptBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#000' },
  integrateDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 4 },
  integrateDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  integrateDividerText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' as const },
  scheduleSection: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  scheduleSectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 10 },
  scheduleSectionTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  scheduleStatusPill: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scheduleStatusPillText: { fontSize: 10, fontWeight: '700' as const },
  scheduleInfo: { gap: 6 },
  scheduleInfoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  scheduleInfoText: { fontSize: 12, color: Colors.textSecondary },
  editScheduleBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, alignSelf: 'flex-start' as const, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + '15' },
  editScheduleBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  noScheduleInfo: { gap: 8 },
  noScheduleText: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  setScheduleBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, alignSelf: 'flex-start' as const, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.primary },
  setScheduleBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#000' },
  extendableRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, marginTop: 4 },
  extendableRowActive: { borderColor: Colors.primary },
  extendableCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center' as const, alignItems: 'center' as const },
  extendableCheckboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  extendableInfo: { flex: 1 },
  extendableTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  extendableTitleActive: { color: Colors.primary },
  extendableDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
  clearScheduleBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.error + '40' },
  clearScheduleBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.error },
});
