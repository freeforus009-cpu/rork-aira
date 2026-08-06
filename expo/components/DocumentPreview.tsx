import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions,
  ActivityIndicator, Pressable, Platform, Linking, Image as RNImage,
  SafeAreaView, Animated, Easing,
} from 'react-native';
import {
  X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, FileText,
  FileType, Presentation, FileWarning, Maximize2, Minimize2, RotateCw,
  BookOpen, CheckCircle2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { Content } from '@/types';
import { saveDocumentProgress, getDocumentProgress } from '@/services/cloudSync';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DocumentPreviewProps {
  visible: boolean;
  files: Content[];
  startIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
  onProgressUpdate?: (contentId: string, scrollPercent: number, isRead: boolean) => void;
}

type PreviewableType = 'pdf' | 'ppt' | 'doc' | 'image' | 'text';

function getPreviewableType(content: Content): PreviewableType | null {
  const type = content.type;
  const fileName = (content.fileName ?? '').toLowerCase();
  if (type === 'pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (type === 'ppt' || fileName.match(/\.pptx?$/)) return 'ppt';
  if (type === 'doc' || fileName.match(/\.docx?$/)) return 'doc';
  if (type === 'image') return 'image';
  if (fileName.match(/\.txt$/) || content.mimeType === 'text/plain') return 'text';
  return null;
}

function getFileUrl(content: Content): string {
  return content.fileUrl ?? content.content;
}

/** Loading skeleton shown while content is being fetched/rendered */
function PreviewSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[styles.skeletonBar, { opacity }]}>
          <View style={[styles.skeletonLine, { width: `${70 + (i % 3) * 10}%` }]} />
        </Animated.View>
      ))}
      <View style={styles.skeletonSpinner}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.skeletonText}>Loading preview...</Text>
      </View>
    </View>
  );
}

/** Fallback when preview is not available */
function PreviewFallback({ fileName, onDownload }: { fileName: string; onDownload: () => void }) {
  return (
    <View style={styles.fallbackContainer}>
      <FileWarning size={56} color={Colors.textMuted} />
      <Text style={styles.fallbackTitle}>Preview Not Available</Text>
      <Text style={styles.fallbackMessage}>
        {fileName ? `"${fileName}" cannot be previewed in-app.` : 'This file type cannot be previewed in-app.'}
      </Text>
      <Text style={styles.fallbackHint}>You can download it to view on your device.</Text>
      <TouchableOpacity style={styles.downloadFallbackBtn} onPress={onDownload} activeOpacity={0.8}>
        <Download size={20} color="#000" />
        <Text style={styles.downloadFallbackText}>Download File</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Text file viewer with readable formatting and scroll progress */
function TextViewer({ content, onLoad, onScrollProgress }: { content: Content; onLoad: () => void; onScrollProgress?: (percent: number) => void }) {
  const [textContent, setTextContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadText = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const url = getFileUrl(content);
        if (Platform.OS === 'web') {
          const response = await fetch(url);
          const text = await response.text();
          setTextContent(text);
        } else {
          setTextContent(content.content || 'Text content unavailable for preview.');
        }
        setIsLoading(false);
        onLoad();
      } catch {
        setError(true);
        setIsLoading(false);
      }
    };
    void loadText();
  }, [content, onLoad]);

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <PreviewFallback fileName={content.fileName ?? ''} onDownload={() => Linking.openURL(getFileUrl(content))} />;

  return (
    <ScrollView
      style={styles.textViewerScroll}
      contentContainerStyle={styles.textViewerContent}
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        const scrollable = contentSize.height - layoutMeasurement.height;
        if (scrollable > 0 && onScrollProgress) {
          const pct = (contentOffset.y / scrollable) * 100;
          onScrollProgress(Math.min(100, Math.max(0, pct)));
        }
      }}
      scrollEventThrottle={16}
    >
      <Text style={styles.textViewerText}>{textContent}</Text>
    </ScrollView>
  );
}

/** Image viewer with zoom and pan support */
function ImageViewer({ content, onLoad }: { content: Content; onLoad: () => void }) {
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const url = getFileUrl(content);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  return (
    <View style={styles.imageViewerContainer}>
      {isLoading && <PreviewSkeleton />}
      {error && <PreviewFallback fileName={content.fileName ?? ''} onDownload={() => Linking.openURL(url)} />}
      {!error && (
        <ScrollView
          style={styles.imageScroll}
          contentContainerStyle={styles.imageScrollContent}
          maximumZoomScale={4}
          minimumZoomScale={0.5}
          zoomScale={scale}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={scale > 1}
        >
          <RNImage
            source={{ uri: url }}
            style={[styles.previewImage, { transform: [{ scale }] }]}
            resizeMode="contain"
            onLoad={() => { setIsLoading(false); onLoad(); }}
            onError={() => { setError(true); setIsLoading(false); }}
          />
        </ScrollView>
      )}
      {!isLoading && !error && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} activeOpacity={0.7}>
            <ZoomOut size={18} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={resetZoom} activeOpacity={0.7}>
            <Text style={styles.zoomLabel}>{Math.round(scale * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} activeOpacity={0.7}>
            <ZoomIn size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** PDF viewer — renders via iframe on web, opens via Linking on mobile */
function PdfViewer({ content, onLoad }: { content: Content; onLoad: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const url = getFileUrl(content);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      onLoad();
    }, 600);
    return () => clearTimeout(timer);
  }, [url, onLoad]);

  if (error) return <PreviewFallback fileName={content.fileName ?? ''} onDownload={() => Linking.openURL(url)} />;

  return (
    <View style={styles.pdfContainer}>
      {isLoading && <PreviewSkeleton />}
      {Platform.OS === 'web' ? (
        <iframe
          src={`${url}#toolbar=1&navpanes=0`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
          title={content.title}
          onLoad={() => { setIsLoading(false); onLoad(); }}
          onError={() => { setError(true); setIsLoading(false); }}
        />
      ) : (
        <View style={styles.mobilePdfPlaceholder}>
          <FileType size={56} color={Colors.error} />
          <Text style={styles.mobilePdfTitle}>{content.fileName ?? content.title}</Text>
          <Text style={styles.mobilePdfHint}>PDF preview opens in your browser on mobile.</Text>
          <TouchableOpacity
            style={styles.openPdfBtn}
            onPress={() => {
              Linking.openURL(url).then(() => {
                setIsLoading(false);
                onLoad();
              }).catch(() => setError(true));
            }}
          >
            <Download size={20} color="#000" />
            <Text style={styles.openPdfText}>Open PDF</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Office document viewer — uses embedded viewer on web, Linking on mobile */
function OfficeViewer({ content, onLoad }: { content: Content; onLoad: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const url = getFileUrl(content);
  const fileType = getPreviewableType(content);
  const Icon = fileType === 'ppt' ? Presentation : FileText;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      onLoad();
    }, 600);
    return () => clearTimeout(timer);
  }, [url, onLoad]);

  if (error) return <PreviewFallback fileName={content.fileName ?? ''} onDownload={() => Linking.openURL(url)} />;

  return (
    <View style={styles.officeContainer}>
      {isLoading && <PreviewSkeleton />}
      {Platform.OS === 'web' ? (
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
          title={content.title}
          onLoad={() => { setIsLoading(false); onLoad(); }}
        />
      ) : (
        <View style={styles.mobilePdfPlaceholder}>
          <Icon size={56} color={fileType === 'ppt' ? '#FF8C42' : Colors.accent} />
          <Text style={styles.mobilePdfTitle}>{content.fileName ?? content.title}</Text>
          <Text style={styles.mobilePdfHint}>Office documents open in your browser on mobile.</Text>
          <TouchableOpacity
            style={styles.openPdfBtn}
            onPress={() => {
              Linking.openURL(url).then(() => {
                setIsLoading(false);
                onLoad();
              }).catch(() => setError(true));
            }}
          >
            <Download size={20} color="#000" />
            <Text style={styles.openPdfText}>Open Document</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function DocumentPreview({
  visible,
  files,
  startIndex,
  onClose,
  onNavigate,
  onProgressUpdate,
}: DocumentPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [hasLoaded, setHasLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const { currentUser } = useAuth();
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isRead, setIsRead] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{ scrollPercent: number; isRead: boolean } | null>(null);

  // Filter to only previewable files
  const previewableFiles = useMemo(() => {
    return files.filter((f) => getPreviewableType(f) !== null);
  }, [files]);

  // Load saved document progress when file changes
  useEffect(() => {
    if (visible && currentUser && previewableFiles[startIndex]) {
      const file = previewableFiles[startIndex];
      void getDocumentProgress(currentUser.id, file.id).then((saved) => {
        if (saved) {
          setSavedProgress(saved);
          setScrollPercent(saved.scrollPercent);
          setIsRead(saved.isRead);
        } else {
          setSavedProgress(null);
          setScrollPercent(0);
          setIsRead(false);
        }
      });
    }
  }, [visible, startIndex, currentUser, previewableFiles]);

  // Track scroll progress for text viewer and web iframe content
  const handleScrollProgress = useCallback((percent: number) => {
    if (!currentUser || !previewableFiles[currentIndex]) return;
    const clamped = Math.min(100, Math.max(0, percent));
    setScrollPercent(clamped);
    const read = clamped >= 90;
    if (read !== isRead) setIsRead(read);
    void saveDocumentProgress(currentUser.id, previewableFiles[currentIndex].id, clamped, read);
    onProgressUpdate?.(previewableFiles[currentIndex].id, clamped, read);
  }, [currentUser, currentIndex, previewableFiles, isRead, onProgressUpdate]);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      setHasLoaded(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, startIndex, fadeAnim, slideAnim]);

  // Keyboard shortcuts (web only)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentIndex, previewableFiles.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setHasLoaded(false);
      onNavigate?.(newIndex);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < previewableFiles.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setHasLoaded(false);
      onNavigate?.(newIndex);
    }
  }, [currentIndex, previewableFiles.length, onNavigate]);

  const handleLoaded = useCallback(() => {
    setHasLoaded(true);
  }, []);

  if (!visible || previewableFiles.length === 0) return null;

  const currentFile = previewableFiles[currentIndex];
  if (!currentFile) return null;

  const previewType = getPreviewableType(currentFile);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < previewableFiles.length - 1;

  const handleDownload = () => {
    const url = getFileUrl(currentFile);
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = url;
      link.download = currentFile.fileName ?? currentFile.title;
      link.click();
    } else {
      Linking.openURL(url).catch(() => undefined);
    }
  };

  const renderPreview = () => {
    switch (previewType) {
      case 'pdf':
        return <PdfViewer content={currentFile} onLoad={handleLoaded} />;
      case 'image':
        return <ImageViewer content={currentFile} onLoad={handleLoaded} />;
      case 'text':
        return <TextViewer content={currentFile} onLoad={handleLoaded} onScrollProgress={handleScrollProgress} />;
      case 'ppt':
      case 'doc':
        return <OfficeViewer content={currentFile} onLoad={handleLoaded} />;
      default:
        return <PreviewFallback fileName={currentFile.fileName ?? ''} onDownload={handleDownload} />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}
          accessibilityRole="alert"
          accessibilityLabel={`Document preview: ${currentFile.title}`}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} numberOfLines={1}>{currentFile.title}</Text>
              <View style={styles.headerMetaRow}>
                {previewableFiles.length > 1 && (
                  <Text style={styles.headerCounter}>
                    {currentIndex + 1} of {previewableFiles.length}
                  </Text>
                )}
                {isRead && (
                  <View style={styles.readBadge}>
                    <CheckCircle2 size={11} color={Colors.primary} />
                    <Text style={styles.readBadgeText}>Read</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={handleDownload} activeOpacity={0.7} accessibilityLabel="Download file">
                <Download size={20} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={onClose} activeOpacity={0.7} accessibilityLabel="Close preview">
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reading Progress Bar */}
          <View style={styles.readProgressBarContainer}>
            <View style={[styles.readProgressBar, { width: `${scrollPercent}%` }]} />
            <Text style={styles.readProgressText}>{Math.round(scrollPercent)}%</Text>
          </View>

          {/* Preview area */}
          <View style={styles.previewArea}>
            {renderPreview()}
          </View>

          {/* Navigation footer */}
          {previewableFiles.length > 1 && (
            <View style={styles.navFooter}>
              <TouchableOpacity
                style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
                onPress={handlePrev}
                disabled={!canGoPrev}
                activeOpacity={0.7}
                accessibilityLabel="Previous file"
              >
                <ChevronLeft size={22} color={canGoPrev ? Colors.text : Colors.textMuted} />
                <Text style={[styles.navBtnText, !canGoPrev && styles.navBtnTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <View style={styles.navDots}>
                {previewableFiles.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => { setCurrentIndex(i); setHasLoaded(false); onNavigate?.(i); }}
                    style={[styles.navDot, i === currentIndex && styles.navDotActive]}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
                onPress={handleNext}
                disabled={!canGoNext}
                activeOpacity={0.7}
                accessibilityLabel="Next file"
              >
                <Text style={[styles.navBtnText, !canGoNext && styles.navBtnTextDisabled]}>Next</Text>
                <ChevronRight size={22} color={canGoNext ? Colors.text : Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Keyboard shortcut hint (web only) */}
          {Platform.OS === 'web' && (
            <View style={styles.keyboardHint}>
              <Text style={styles.keyboardHintText}>
                ESC to close · ← → to navigate
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Platform.OS === 'web' ? '90%' : SCREEN_WIDTH - 16,
    maxWidth: 900,
    height: Platform.OS === 'web' ? '88%' : SCREEN_HEIGHT - 80,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
      default: { elevation: 20 },
    }),
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flexShrink: 1,
  },
  headerCounter: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  previewArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Skeleton
  skeletonContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  skeletonBar: {
    width: '100%' as const,
    marginBottom: 12,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
  },
  skeletonSpinner: {
    marginTop: 30,
    alignItems: 'center' as const,
    gap: 12,
  },
  skeletonText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  // Fallback
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 30,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 8,
  },
  fallbackMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  fallbackHint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  downloadFallbackBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 12,
  },
  downloadFallbackText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
  // Text viewer
  textViewerScroll: {
    flex: 1,
  },
  textViewerContent: {
    padding: 24,
  },
  textViewerText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  // Image viewer
  imageViewerContainer: {
    flex: 1,
    position: 'relative' as const,
  },
  imageScroll: {
    flex: 1,
  },
  imageScrollContent: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    minHeight: '100%' as const,
  },
  previewImage: {
    width: SCREEN_WIDTH - 32,
    height: 400,
    borderRadius: 8,
  },
  zoomControls: {
    position: 'absolute' as const,
    bottom: 16,
    alignSelf: 'center' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: 'rgba(11,22,35,0.9)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  zoomLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 50,
    textAlign: 'center' as const,
  },
  // PDF viewer
  pdfContainer: {
    flex: 1,
  },
  mobilePdfPlaceholder: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 30,
    gap: 14,
  },
  mobilePdfTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  mobilePdfHint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  openPdfBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  openPdfText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
  // Office viewer
  officeContainer: {
    flex: 1,
  },
  // Navigation
  navFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  navBtnTextDisabled: {
    color: Colors.textMuted,
  },
  navDots: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  navDotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  keyboardHint: {
    position: 'absolute' as const,
    bottom: 56,
    alignSelf: 'center' as const,
    backgroundColor: 'rgba(11,22,35,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keyboardHintText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  headerMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  readBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  readBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  readProgressBarContainer: {
    height: 28,
    backgroundColor: Colors.surfaceLight,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  readProgressBar: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    flex: 1,
  },
  readProgressText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    minWidth: 36,
    textAlign: 'right' as const,
  },
});
