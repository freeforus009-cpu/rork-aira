import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Trash2, Link2, ExternalLink, CheckCircle, X, Upload, FileText, Video } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import Colors from '@/constants/colors';
import { uploadLocalFile } from '@/services/cloudSync';

export default function SubmissionsScreen() {
  const { loId } = useLocalSearchParams<{ loId: string }>();
  const { currentUser } = useAuth();
  const { learningOutcomes, getLOSubmissions, addSubmission, deleteSubmission } = useData();

  const lo = useMemo(() => learningOutcomes.find(l => l.id === loId), [learningOutcomes, loId]);
  const subs = useMemo(() => {
    if (!currentUser || !loId) return [];
    return getLOSubmissions(currentUser.id, loId);
  }, [currentUser, loId, getLOSubmissions]);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [linkName, setLinkName] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');

  if (!lo || !currentUser) return null;

  const handleAddLink = async () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      Alert.alert('Error', 'Please fill in both name and URL/link.');
      return;
    }
    await addSubmission({
      userId: currentUser.id,
      loId: loId ?? '',
      subjectId: lo.subjectId,
      type: 'link',
      name: linkName.trim(),
      url: linkUrl.trim(),
    });
    setLinkName('');
    setLinkUrl('');
    setShowAddForm(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('[Submission] Document picked:', file.name);
        const uploaded = await uploadLocalFile(file.uri, file.name || 'document', file.mimeType ?? 'application/octet-stream', currentUser.id).catch(() => null);
        await addSubmission({
          userId: currentUser.id,
          loId: loId ?? '',
          subjectId: lo.subjectId,
          type: 'document',
          name: file.name || 'Document',
          url: uploaded?.url ?? file.uri,
        });
        Alert.alert('Success', `Document "${file.name}" uploaded successfully.`);
      }
    } catch (err) {
      console.log('[Submission] Document picker error:', err);
      Alert.alert('Error', 'Could not pick document. Please try again.');
    }
  };

  const handlePickVideo = async () => {
    try {
      if (Platform.OS === 'web') {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['video/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const file = result.assets[0];
          await addSubmission({
            userId: currentUser.id,
            loId: loId ?? '',
            subjectId: lo.subjectId,
            type: 'video',
            name: file.name || 'Video',
            url: (await uploadLocalFile(file.uri, file.name || 'video', file.mimeType ?? 'video/mp4', currentUser.id).catch(() => null))?.url ?? file.uri,
          });
          Alert.alert('Success', `Video "${file.name}" uploaded successfully.`);
        }
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const file = result.assets[0];
          const fileName = file.fileName || file.uri.split('/').pop() || 'Video';
          await addSubmission({
            userId: currentUser.id,
            loId: loId ?? '',
            subjectId: lo.subjectId,
            type: 'video',
            name: fileName,
            url: (await uploadLocalFile(file.uri, fileName, file.mimeType ?? 'video/mp4', currentUser.id).catch(() => null))?.url ?? file.uri,
          });
          Alert.alert('Success', `Video "${fileName}" uploaded successfully.`);
        }
      }
    } catch (err) {
      console.log('[Submission] Video picker error:', err);
      Alert.alert('Error', 'Could not pick video. Please try again.');
    }
  };

  const handleDelete = (subId: string, name: string, validated: boolean) => {
    if (validated) {
      Alert.alert('Cannot Delete', 'This submission has been validated by admin and cannot be deleted.');
      return;
    }
    Alert.alert('Delete Submission', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSubmission(subId) },
    ]);
  };

  const openLink = (url: string) => {
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('content://')) {
      formattedUrl = 'https://' + url;
    }
    Linking.openURL(formattedUrl).catch(() => Alert.alert('Error', 'Could not open this file or link.'));
  };

  const getSubIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText size={16} color={Colors.accent} />;
      case 'video': return <Video size={16} color={Colors.error} />;
      default: return <Link2 size={16} color={Colors.accent} />;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Submissions - ${lo.title}` }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.topicTitle}>{lo.title}</Text>
          <Text style={styles.headerSubtext}>
            Submit links, documents (.doc, .docx, .pdf), or videos from your device below.
          </Text>
        </View>

        {subs.length > 0 && (
          <View style={styles.subsSection}>
            <Text style={styles.sectionTitle}>Your Submissions ({subs.length})</Text>
            {subs.map(sub => (
              <View key={sub.id} style={styles.subCard}>
                <View style={styles.subHeader}>
                  {getSubIcon(sub.type)}
                  <View style={styles.subInfo}>
                    <Text style={styles.subName}>{sub.name}</Text>
                    <Text style={styles.subType}>{sub.type}</Text>
                  </View>
                  {sub.validated ? (
                    <View style={styles.validatedBadge}>
                      <CheckCircle size={12} color={Colors.primary} />
                      <Text style={styles.validatedText}>Validated</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(sub.id, sub.name, sub.validated)}
                    >
                      <Trash2 size={16} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.linkRow} onPress={() => openLink(sub.url)}>
                  {getSubIcon(sub.type)}
                  <Text style={styles.linkText} numberOfLines={1}>{sub.type === 'link' ? sub.url : sub.name}</Text>
                  <ExternalLink size={14} color={Colors.accent} />
                </TouchableOpacity>
                <Text style={styles.subDate}>
                  Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {subs.length === 0 && !showAddForm && (
          <View style={styles.emptyState}>
            <Upload size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No submissions yet</Text>
            <Text style={styles.emptyText}>Upload your work to proceed to the quiz</Text>
          </View>
        )}

        <View style={styles.uploadSection}>
          <Text style={styles.uploadTitle}>Upload Files</Text>

          <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
            <FileText size={20} color={Colors.accent} />
            <View style={styles.uploadBtnInfo}>
              <Text style={styles.uploadBtnTitle}>Upload Document</Text>
              <Text style={styles.uploadBtnSubtitle}>.doc, .docx, .pdf files</Text>
            </View>
            <Upload size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadBtn} onPress={handlePickVideo}>
            <Video size={20} color={Colors.error} />
            <View style={styles.uploadBtnInfo}>
              <Text style={styles.uploadBtnTitle}>Upload Video</Text>
              <Text style={styles.uploadBtnSubtitle}>Select from phone storage</Text>
            </View>
            <Upload size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowAddForm(true)}>
            <Link2 size={20} color={Colors.primary} />
            <View style={styles.uploadBtnInfo}>
              <Text style={styles.uploadBtnTitle}>Add Link</Text>
              <Text style={styles.uploadBtnSubtitle}>Google Drive or any URL</Text>
            </View>
            <Plus size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={styles.addForm}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Add Link</Text>
              <TouchableOpacity onPress={() => setShowAddForm(false)}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="Link name (e.g., Activity 1 Report)"
              placeholderTextColor={Colors.textMuted}
              value={linkName}
              onChangeText={setLinkName}
            />
            <TextInput
              style={styles.formInput}
              placeholder="URL or Google Drive link"
              placeholderTextColor={Colors.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={styles.submitFormBtn} onPress={handleAddLink}>
              <Text style={styles.submitFormText}>Submit Link</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  headerCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  topicTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  headerSubtext: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  subsSection: { marginBottom: 20 },
  subCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  subInfo: { flex: 1 },
  subName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  subType: { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' as const },
  validatedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,201,167,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  validatedText: { fontSize: 11, color: Colors.primary, fontWeight: '600' as const },
  deleteBtn: { padding: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceLight, padding: 10, borderRadius: 8, marginBottom: 6 },
  linkText: { flex: 1, fontSize: 12, color: Colors.accent },
  subDate: { fontSize: 11, color: Colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary },
  uploadSection: { marginBottom: 20 },
  uploadTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  uploadBtnInfo: { flex: 1 },
  uploadBtnTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  uploadBtnSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  addForm: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  formInput: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 14, marginBottom: 12 },
  submitFormBtn: { backgroundColor: Colors.primary, borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center' },
  submitFormText: { color: '#000', fontSize: 15, fontWeight: '700' as const },
});
