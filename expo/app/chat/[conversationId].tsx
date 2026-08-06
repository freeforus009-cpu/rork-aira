import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Modal,
  ScrollView,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Send,
  ArrowLeft,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Trash2,
  Edit2,
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
  X,
  Search,
  ChevronDown,
  BellOff,
  Bell,
  Settings as SettingsIcon,
  Users,
  Pin,
  Smile,
  Reply,
  ExternalLink,
  UserMinus,
  VolumeX,
  Volume2,
  Palette,
  Copy,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import { useToast } from '@/contexts/ToastContext';
import { ChatMessage, ChatReaction, MessageDeliveryStatus, MessageAttachment, Conversation, ConversationParticipant } from '@/types';

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Animated three-dot typing indicator for the header subtitle */
const TypingDots = React.memo(function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 400, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    const sub1 = animate(dot1, 0).start();
    const sub2 = animate(dot2, 200).start();
    const sub3 = animate(dot3, 400).start();
    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: dot,
            transform: [{ scale: dot.interpolate({ inputRange: [0.3, 1], outputRange: [0.7, 1.2] }) }],
          }}
        />
      ))}
    </View>
  );
});

function getDeliveryIcon(status: MessageDeliveryStatus, colors: any) {
  switch (status) {
    case 'sending': return <Clock size={12} color={colors.textMuted} />;
    case 'sent': return <Check size={14} color={colors.textMuted} />;
    case 'delivered': return <CheckCheck size={14} color={colors.textMuted} />;
    case 'read': return <CheckCheck size={14} color={colors.primary} />;
    case 'failed': return <AlertCircle size={14} color={colors.error} />;
    default: return null;
  }
}

/** Group reactions by emoji for display */
function groupReactions(reactions: ChatReaction[] | undefined): Array<{ emoji: string; count: number; userIds: string[] }> {
  if (!reactions || reactions.length === 0) return [];
  const grouped: Record<string, { count: number; userIds: string[] }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, userIds: [] };
    grouped[r.emoji].count += 1;
    grouped[r.emoji].userIds.push(r.userId);
  }
  return Object.entries(grouped).map(([emoji, data]) => ({ emoji, ...data }));
}

function renderAttachment(att: MessageAttachment, colors: any, onImagePress?: (url: string) => void) {
  if (att.type === 'image') {
    return (
      <TouchableOpacity key={att.id} onPress={() => onImagePress?.(att.url)} activeOpacity={0.85}>
        <Image source={{ uri: att.url }} style={styles.messageImage} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  const icon = att.type === 'video' ? <VideoIcon size={20} color={colors.accent} /> : <FileText size={20} color={colors.accent} />;
  return (
    <View key={att.id} style={[styles.attachmentCard, { backgroundColor: colors.surfaceLight }]}>
      {icon}
      <View style={styles.attachmentInfo}>
        <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>{att.name}</Text>
        {att.size != null && (
          <Text style={[styles.attachmentSize, { color: colors.textMuted }]}>{(att.size / 1024).toFixed(1)} KB</Text>
        )}
      </View>
    </View>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  colors: any;
  onRetry: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onReply: () => void;
  showAvatar: boolean;
  senderName: string;
  senderImage?: string;
  onImagePress: (url: string) => void;
  isGroupAdmin: boolean;
  canPin: boolean;
  onCopy: () => void;
}

const MessageBubble = React.memo(function MessageBubble({
  message, isOwn, colors, onRetry, onDelete, onEdit, onReact, onPin, onReply,
  showAvatar, senderName, senderImage, onImagePress, canPin, onCopy,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showQuickReact, setShowQuickReact] = useState(false);

  const reactions = groupReactions(message.reactions);

  const handleLongPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      const opts: string[] = [];
      const acts: Array<() => void> = [];
      if (message.text) { opts.push('Copy Text'); acts.push(onCopy); }
      opts.push('React'); acts.push(() => setShowReactionPicker(true));
      opts.push('Reply'); acts.push(onReply);
      if (canPin) { opts.push('Pin'); acts.push(onPin); }
      if (isOwn && message.text) { opts.push('Edit'); acts.push(() => Alert.prompt('Edit Message', '', (text) => { if (text && text.trim()) onEdit(text.trim()); })); }
      if (isOwn) { opts.push('Delete'); acts.push(onDelete); }
      opts.push('Cancel');
      const cancelButtonIndex = opts.length - 1;
      const destructiveButtonIndex = isOwn ? opts.length - 2 : undefined;
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex, destructiveButtonIndex },
        (buttonIndex) => { if (buttonIndex >= 0 && buttonIndex < acts.length) acts[buttonIndex](); },
      );
    } else {
      setShowActions(!showActions);
      setShowQuickReact(false);
    }
  }, [canPin, isOwn, message.text, onDelete, onEdit, onPin, onReply, showActions, onCopy]);

  const handleReact = useCallback((emoji: string) => {
    onReact(emoji);
    setShowReactionPicker(false);
    setShowQuickReact(false);
  }, [onReact]);

  return (
    <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwn && (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            senderImage ? (
              <Image source={{ uri: senderImage }} style={styles.msgAvatar} />
            ) : (
              <View style={[styles.msgAvatarPlaceholder, { backgroundColor: colors.accent }]}>
                <Text style={styles.msgAvatarText}>{senderName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
              </View>
            )
          ) : (
            <View style={styles.avatarSpacer} />
          )}
        </View>
      )}

      <View style={styles.bubbleContainer}>
        <TouchableOpacity
          onLongPress={handleLongPress}
          onPress={() => { setShowActions(false); setShowReactionPicker(false); setShowQuickReact(false); }}
          activeOpacity={0.8}
          style={[styles.messageBubble, isOwn
            ? { backgroundColor: colors.primary, borderTopRightRadius: 4 }
            : { backgroundColor: colors.surface, borderTopLeftRadius: 4 }]}
        >
          {/* Pinned indicator */}
          {message.pinned && (
            <View style={styles.pinnedIndicator}>
              <Pin size={10} color={isOwn ? 'rgba(0,0,0,0.5)' : colors.warning} />
              <Text style={[styles.pinnedText, { color: isOwn ? 'rgba(0,0,0,0.5)' : colors.warning }]}>Pinned</Text>
            </View>
          )}

          {/* Reply indicator */}
          {message.replyToText && (
            <View style={[styles.replyIndicator, { borderLeftColor: colors.accent }]}>
              <Text style={[styles.replyText, { color: isOwn ? 'rgba(0,0,0,0.6)' : colors.textMuted }]} numberOfLines={2}>
                {message.replyToText}
              </Text>
            </View>
          )}

          {!isOwn && showAvatar && (
            <Text style={[styles.messageSender, { color: colors.accent }]} numberOfLines={1}>{senderName}</Text>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {message.attachments.map(att => renderAttachment(att, colors, onImagePress))}
            </View>
          )}
          {message.text ? (
            <Text style={[styles.messageText, { color: isOwn ? '#000' : colors.text }]}>{message.text}</Text>
          ) : null}

          {/* Link Preview */}
          {message.linkPreview && (
            <TouchableOpacity
              style={[styles.linkPreview, { backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : colors.surfaceLight }]}
              onPress={() => { void Linking.openURL(message.linkPreview!.url); }}
              activeOpacity={0.7}
            >
              {message.linkPreview.thumbnail && (
                <Image
                  source={{ uri: message.linkPreview.thumbnail }}
                  style={styles.linkPreviewThumb}
                  resizeMode="cover"
                />
              )}
              <View style={styles.linkPreviewInfo}>
                <Text style={[styles.linkPreviewTitle, { color: isOwn ? '#000' : colors.text }]} numberOfLines={2}>
                  {message.linkPreview.title}
                </Text>
                {message.linkPreview.description ? (
                  <Text style={[styles.linkPreviewDesc, { color: isOwn ? 'rgba(0,0,0,0.6)' : colors.textMuted }]} numberOfLines={2}>
                    {message.linkPreview.description}
                  </Text>
                ) : null}
                <View style={styles.linkPreviewUrlRow}>
                  {message.linkPreview.siteName ? (
                    <Text style={[styles.linkPreviewSite, { color: isOwn ? 'rgba(0,0,0,0.5)' : colors.textMuted }]}>
                      {message.linkPreview.siteName}
                    </Text>
                  ) : null}
                  <ExternalLink size={11} color={isOwn ? 'rgba(0,0,0,0.5)' : colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {message.edited && (
            <Text style={[styles.editedLabel, { color: isOwn ? 'rgba(0,0,0,0.5)' : colors.textMuted }]}>edited</Text>
          )}
          {isOwn && (
            <View style={styles.messageMeta}>
              {getDeliveryIcon(message.deliveryStatus, colors)}
            </View>
          )}

          {/* Reaction picker */}
          {showReactionPicker && (
            <View style={[styles.reactionPicker, { backgroundColor: colors.surfaceElevated }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '✅'].map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleReact(emoji)}
                    style={styles.reactionEmojiBtn}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action buttons for non-iOS */}
          {showActions && Platform.OS !== 'ios' && (
            <View style={styles.messageActions}>
              {message.text && (
                <TouchableOpacity onPress={() => { setShowActions(false); onCopy(); }} style={styles.messageActionBtn}>
                  <Copy size={14} color={colors.textMuted} />
                  <Text style={[styles.messageActionText, { color: colors.textMuted }]}>Copy</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setShowActions(false); setShowReactionPicker(true); }} style={styles.messageActionBtn}>
                <Smile size={14} color={colors.textMuted} />
                <Text style={[styles.messageActionText, { color: colors.textMuted }]}>React</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowActions(false); onReply(); }} style={styles.messageActionBtn}>
                <Reply size={14} color={colors.textMuted} />
                <Text style={[styles.messageActionText, { color: colors.textMuted }]}>Reply</Text>
              </TouchableOpacity>
              {canPin && (
                <TouchableOpacity onPress={() => { setShowActions(false); onPin(); }} style={styles.messageActionBtn}>
                  <Pin size={14} color={colors.warning} />
                  <Text style={[styles.messageActionText, { color: colors.warning }]}>Pin</Text>
                </TouchableOpacity>
              )}
              {isOwn && message.text && (
                <TouchableOpacity
                  onPress={() => { setShowActions(false); Alert.prompt('Edit Message', '', (text) => { if (text && text.trim()) onEdit(text.trim()); }); }}
                  style={styles.messageActionBtn}
                >
                  <Edit2 size={14} color={colors.textMuted} />
                  <Text style={[styles.messageActionText, { color: colors.textMuted }]}>Edit</Text>
                </TouchableOpacity>
              )}
              {isOwn && (
                <TouchableOpacity onPress={() => { setShowActions(false); onDelete(); }} style={styles.messageActionBtn}>
                  <Trash2 size={14} color={colors.error} />
                  <Text style={[styles.messageActionText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              )}
              {message.deliveryStatus === 'failed' && (
                <TouchableOpacity onPress={() => { setShowActions(false); onRetry(); }} style={styles.messageActionBtn}>
                  <AlertCircle size={14} color={colors.warning} />
                  <Text style={[styles.messageActionText, { color: colors.warning }]}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {message.deliveryStatus === 'failed' && !showActions && (
            <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
              <AlertCircle size={12} color={colors.error} />
              <Text style={[styles.retryText, { color: colors.error }]}>Tap to retry</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Reactions display below bubble */}
        {reactions.length > 0 && (
          <View style={[styles.reactionsRow, isOwn ? styles.reactionsRowOwn : styles.reactionsRowOther]}>
            {reactions.map(r => (
              <TouchableOpacity
                key={r.emoji}
                onPress={() => onReact(r.emoji)}
                style={[styles.reactionChip, { backgroundColor: colors.surfaceLight }]}
              >
                <Text style={styles.reactionChipEmoji}>{r.emoji}</Text>
                <Text style={[styles.reactionChipCount, { color: colors.textSecondary }]}>{r.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timestamp below bubble */}
        <Text style={[
          styles.bubbleTimestamp,
          { color: colors.textMuted },
          isOwn ? styles.bubbleTimestampOwn : styles.bubbleTimestampOther,
        ]}>
          {formatMessageTime(message.createdAt)}{message.edited ? ' · edited' : ''}
        </Text>

        {/* Quick react bar */}
        <View style={[styles.quickReactBar, isOwn ? styles.quickReactBarOwn : styles.quickReactBarOther]}>
          <TouchableOpacity
            onPress={() => { setShowQuickReact(!showQuickReact); setShowActions(false); setShowReactionPicker(false); }}
            hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
            style={styles.quickReactToggle}
          >
            <Smile size={13} color={showQuickReact ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
          {showQuickReact && (
            <View style={[styles.quickReactEmojis, { backgroundColor: colors.surfaceElevated }]}>
              {['\ud83d\udc4d', '\u2764\ufe0f', '\ud83d\ude02'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleReact(emoji)}
                  style={styles.quickReactEmojiBtn}
                >
                  <Text style={styles.quickReactEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

export default function ChatViewScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { currentUser, allUsers } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = useConnectivity();
  const { show: showToast } = useToast();
  const {
    getMessages, fetchMessages, sendMessage, retryMessage, deleteMessage, editMessage,
    markConversationRead, sendTyping, getOtherParticipant, conversations,
    isUserOnline, getTypingUsers, connectionState, setActiveConversationId,
    uploadAttachment, updatePresence, toggleReaction, togglePin, toggleMute,
    isConversationMuted, updateConversationSettings, getConversationSettings,
    addMember, removeMember, toggleMemberMute, getGroupMembers, isGroupAdmin,
    getConversationName, getConversationAvatar, emojiReactions, backgroundPresets,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedRef = useRef(false);

  const conversation = useMemo(
    () => conversations.find(c => c.id === conversationId),
    [conversations, conversationId],
  );

  const isGroup = conversation?.isGroup ?? false;
  const groupAdmin = isGroup ? isGroupAdmin(conversation ?? {} as Conversation) : false;
  const otherParticipant = useMemo(
    () => conversation ? getOtherParticipant(conversation) : null,
    [conversation, getOtherParticipant],
  );

  const convName = conversation ? getConversationName(conversation) : '';
  const convAvatar = conversation ? getConversationAvatar(conversation) : { initial: '?' };

  const allMessages = useMemo(() => getMessages(conversationId ?? ''), [getMessages, conversationId]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages;
    const lower = searchQuery.toLowerCase();
    return allMessages.filter(m => m.text?.toLowerCase().includes(lower));
  }, [allMessages, searchQuery]);

  const typingUserIds = useMemo(
    () => conversation ? getTypingUsers(conversation.id) : [],
    [conversation, getTypingUsers],
  );

  const convSettings = useMemo(
    () => getConversationSettings(conversationId ?? ''),
    [getConversationSettings, conversationId],
  );

  const muted = isConversationMuted(conversationId ?? '');
  const members = conversation ? getGroupMembers(conversation) : [];

  // Set active conversation and mark as read on mount
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      void markConversationRead(conversationId);
      void updatePresence('online');
    }
    return () => { setActiveConversationId(null); };
  }, [conversationId, markConversationRead, setActiveConversationId, updatePresence]);

  useEffect(() => {
    if (conversationId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      void fetchMessages(conversationId).then(msgs => { setHasMore(msgs.length >= 50); });
    }
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (allMessages.length > 0 && !searchQuery) {
      const timer = setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
      return () => clearTimeout(timer);
    }
  }, [allMessages.length, searchQuery]);

  useEffect(() => {
    if (conversationId && allMessages.length > 0) void markConversationRead(conversationId);
  }, [allMessages.length, conversationId, markConversationRead]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    const text = inputText.trim();
    const attachments = pendingAttachments.length > 0 ? pendingAttachments : undefined;
    void sendMessage(conversationId ?? '', text, attachments, replyTo?.id, replyTo?.text?.slice(0, 100));
    setInputText('');
    setPendingAttachments([]);
    setReplyTo(null);
    void sendTyping(conversationId ?? '', false);
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
  }, [conversationId, inputText, pendingAttachments, sendMessage, sendTyping, replyTo]);

  const handleTextChanged = useCallback((text: string) => {
    setInputText(text);
    void sendTyping(conversationId ?? '', true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { void sendTyping(conversationId ?? '', false); }, 3000);
  }, [conversationId, sendTyping]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !conversationId || allMessages.length === 0) return;
    setIsLoadingMore(true);
    const firstMsg = allMessages[0];
    const older = await fetchMessages(conversationId, firstMsg?.id);
    setHasMore(older.length >= 50);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, conversationId, allMessages, fetchMessages]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const attachment = await uploadAttachment(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
      setUploading(false);
      if (attachment) setPendingAttachments(prev => [...prev, attachment]);
    } catch (e) { setUploading(false); }
  }, [uploadAttachment]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const fileName = `image_${Date.now()}.jpg`;
      const attachment = await uploadAttachment(asset.uri, fileName, 'image/jpeg');
      setUploading(false);
      if (attachment) setPendingAttachments(prev => [...prev, attachment]);
    } catch (e) { setUploading(false); }
  }, [uploadAttachment]);

  const handleRemoveAttachment = useCallback((attId: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attId));
  }, []);

  const handleRetry = useCallback((msgId: string) => { void retryMessage(conversationId ?? '', msgId); }, [conversationId, retryMessage]);
  const handleDelete = useCallback((msgId: string) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteMessage(conversationId ?? '', msgId) },
    ]);
  }, [conversationId, deleteMessage]);
  const handleEdit = useCallback((msgId: string, newText: string) => { void editMessage(conversationId ?? '', msgId, newText); }, [conversationId, editMessage]);
  const handleReact = useCallback((msgId: string, emoji: string) => { void toggleReaction(conversationId ?? '', msgId, emoji); }, [conversationId, toggleReaction]);
  const handlePin = useCallback((msgId: string) => {
    const msg = allMessages.find(m => m.id === msgId);
    void togglePin(conversationId ?? '', msgId, !msg?.pinned);
  }, [conversationId, allMessages, togglePin]);
  const handleReply = useCallback((msg: ChatMessage) => { setReplyTo(msg); }, []);
  const handleCopy = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast('success', 'Copied to clipboard');
  }, [showToast]);

  const handleMuteToggle = useCallback(() => {
    void toggleMute(conversationId ?? '', !muted);
  }, [conversationId, muted, toggleMute]);

  const handleRemoveMember = useCallback((userId: string) => {
    Alert.alert('Remove Member', 'Remove this member from the group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeMember(conversationId ?? '', userId) },
    ]);
  }, [conversationId, removeMember]);

  const handleMuteMember = useCallback((userId: string, currentMuted: boolean) => {
    void toggleMemberMute(conversationId ?? '', userId, !currentMuted);
  }, [conversationId, toggleMemberMute]);

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const prevMsg = filteredMessages[index - 1];
    const showDateSeparator = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
    const isOwn = item.senderId === currentUser?.id;
    const showAvatar = !prevMsg || prevMsg.senderId !== item.senderId;
    const canPin = isGroup ? groupAdmin : true;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateSeparatorText, { color: colors.textMuted }]}>{formatDateSeparator(item.createdAt)}</Text>
            <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <MessageBubble
          message={item}
          isOwn={isOwn}
          colors={colors}
          onRetry={() => handleRetry(item.id)}
          onDelete={() => handleDelete(item.id)}
          onEdit={(text) => handleEdit(item.id, text)}
          onReact={(emoji) => handleReact(item.id, emoji)}
          onPin={() => handlePin(item.id)}
          onReply={() => handleReply(item)}
          showAvatar={showAvatar}
          senderName={item.senderName}
          senderImage={item.senderProfileImage}
          onImagePress={(url) => setImageViewerUrl(url)}
          isGroupAdmin={groupAdmin}
          canPin={canPin}
          onCopy={() => handleCopy(item.text ?? '')}
        />
      </View>
    );
  }, [filteredMessages, currentUser?.id, colors, isGroup, groupAdmin, handleRetry, handleDelete, handleEdit, handleReact, handlePin, handleReply, handleCopy]);

  if (!conversation) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading conversation...</Text>
      </View>
    );
  }

  const otherOnline = otherParticipant ? isUserOnline(otherParticipant.userId) : false;
  const typingLabel = typingUserIds.length > 0
    ? isGroup
      ? `${members.find(m => m.userId === typingUserIds[0])?.fullName ?? 'Someone'} is typing...`
      : (typingUserIds.includes(otherParticipant?.userId ?? '') ? `${otherParticipant?.fullName} is typing...` : null)
    : null;

  const bgColor = convSettings.backgroundColor || 'transparent';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatarContainer}>
            {convAvatar.image ? (
              <Image source={{ uri: convAvatar.image }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: isGroup ? colors.accent : colors.accent }]}>
                {isGroup ? <Users size={16} color="#000" /> : <Text style={styles.headerAvatarText}>{convAvatar.initial}</Text>}
              </View>
            )}
            {!isGroup && otherOnline && <View style={[styles.headerOnlineDot, { borderColor: colors.surface }]} />}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{convName}</Text>
            {typingLabel ? (
              <View style={styles.headerTypingRow}>
                <TypingDots color={colors.primary} />
                <Text style={[styles.headerStatus, { color: colors.primary }]} numberOfLines={1}>
                  {typingLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.headerStatus, { color: colors.textMuted }]} numberOfLines={1}>
                {isGroup
                  ? `${members.length} members${muted ? ' · Muted' : ''}`
                  : otherOnline ? 'Online' : 'Offline'}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleMuteToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
            {muted ? <BellOff size={20} color={colors.textMuted} /> : <Bell size={20} color={colors.textMuted} />}
          </TouchableOpacity>
          {isGroup && (
            <TouchableOpacity onPress={() => setShowMembers(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
              <Users size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
            <SettingsIcon size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search in conversation..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}><X size={16} color={colors.textMuted} /></TouchableOpacity>
          )}
        </View>
      )}

      {/* Connection warning */}
      {connectionState !== 'connected' && (
        <View style={[styles.connectionWarning, { backgroundColor: colors.warningSoft }]}>
          <Text style={[styles.connectionWarningText, { color: colors.warning }]}>
            {connectionState === 'connecting' ? 'Connecting...' : connectionState === 'reconnecting' ? 'Reconnecting...' : 'Disconnected — messages will send when reconnected'}
          </Text>
        </View>
      )}

      {/* Messages List */}
      <View style={{ flex: 1, backgroundColor: bgColor || undefined }}>
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListHeaderComponent={isLoadingMore ? <View style={styles.loadMoreIndicator}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>No messages yet. Say hello!</Text>
            </View>
          }
          inverted={false}
        />
      </View>

      {/* Typing indicator above input bar */}
      {typingLabel && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingDotsContainer, { backgroundColor: colors.surface }]}>
            <TypingDots color={colors.primary} />
            <Text style={[styles.typingIndicatorText, { color: colors.textSecondary }]} numberOfLines={1}>
              {typingLabel}
            </Text>
          </View>
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}>
          <View style={styles.replyPreviewContent}>
            <Reply size={14} color={colors.accent} />
            <View style={styles.replyPreviewText}>
              <Text style={[styles.replyPreviewSender, { color: colors.accent }]}>{replyTo.senderName}</Text>
              <Text style={[styles.replyPreviewMsg, { color: colors.textMuted }]} numberOfLines={1}>{replyTo.text}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <View style={[styles.pendingAttachments, { backgroundColor: colors.surface }]}>
          <FlatList
            data={pendingAttachments}
            keyExtractor={item => item.id}
            horizontal
            renderItem={({ item }) => (
              <View style={[styles.pendingAttItem, { backgroundColor: colors.surfaceLight }]}>
                {item.type === 'image' ? (
                  <Image source={{ uri: item.url }} style={styles.pendingAttImage} />
                ) : (
                  <View style={styles.pendingAttFile}>
                    <FileText size={24} color={colors.accent} />
                    <Text style={[styles.pendingAttName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  </View>
                )}
                <TouchableOpacity style={[styles.pendingAttRemove, { backgroundColor: colors.error }]} onPress={() => handleRemoveAttachment(item.id)}>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* Upload indicator */}
      {uploading && (
        <View style={[styles.uploadingBar, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.uploadingText, { color: colors.textMuted }]}>Uploading...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={handlePickDocument} style={styles.attachBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Paperclip size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ImageIcon size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={handleTextChanged}
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() && pendingAttachments.length === 0}
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (!inputText.trim() && pendingAttachments.length === 0) && { opacity: 0.4 }]}
        >
          <Send size={18} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Image Viewer Modal */}
      <Modal visible={imageViewerUrl !== null} transparent animationType="fade" onRequestClose={() => setImageViewerUrl(null)}>
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUrl(null)}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {imageViewerUrl && <Image source={{ uri: imageViewerUrl }} style={styles.imageViewerImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.settingsOverlay}>
          <View style={[styles.settingsModal, { backgroundColor: colors.surface }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Chat Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.settingsBody} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Mute toggle */}
              <TouchableOpacity style={styles.settingsItem} onPress={handleMuteToggle}>
                {muted ? <BellOff size={20} color={colors.error} /> : <Bell size={20} color={colors.textMuted} />}
                <Text style={[styles.settingsItemText, { color: colors.text }]}>
                  {muted ? 'Unmute notifications' : 'Mute notifications'}
                </Text>
              </TouchableOpacity>

              {/* Background color picker */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textMuted }]}>Chat Background</Text>
              <View style={styles.backgroundPresets}>
                {backgroundPresets.map(preset => (
                  <TouchableOpacity
                    key={preset.name}
                    onPress={() => { void updateConversationSettings(conversationId ?? '', { ...convSettings, backgroundColor: preset.color, wallpaperImage: undefined }); }}
                    style={[
                      styles.backgroundPreset,
                      { backgroundColor: preset.color || colors.background },
                      convSettings.backgroundColor === preset.color && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                  >
                    {convSettings.backgroundColor === preset.color && <Check size={14} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Search in conversation */}
              <TouchableOpacity style={styles.settingsItem} onPress={() => { setShowSettings(false); setShowSearch(true); }}>
                <Search size={20} color={colors.textMuted} />
                <Text style={[styles.settingsItemText, { color: colors.text }]}>Search in conversation</Text>
              </TouchableOpacity>

              {/* Pinned messages */}
              {conversation.pinnedMessageIds && conversation.pinnedMessageIds.length > 0 && (
                <View style={styles.pinnedSection}>
                  <Text style={[styles.settingsSectionTitle, { color: colors.textMuted }]}>
                    Pinned messages ({conversation.pinnedMessageIds.length})
                  </Text>
                  {conversation.pinnedMessageIds.map(msgId => {
                    const msg = allMessages.find(m => m.id === msgId);
                    if (!msg) return null;
                    return (
                      <View key={msgId} style={[styles.pinnedMsgItem, { backgroundColor: colors.surfaceLight }]}>
                        <Pin size={12} color={colors.warning} />
                        <Text style={[styles.pinnedMsgText, { color: colors.text }]} numberOfLines={2}>{msg.text}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Members Modal (group only) */}
      <Modal visible={showMembers} animationType="slide" transparent onRequestClose={() => setShowMembers(false)}>
        <View style={styles.settingsOverlay}>
          <View style={[styles.settingsModal, { backgroundColor: colors.surface }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Group Members ({members.length})</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={item => item.userId}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }: { item: ConversationParticipant }) => (
                <View style={[styles.memberItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.memberAvatarContainer}>
                    {item.profileImage ? (
                      <Image source={{ uri: item.profileImage }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.accent }]}>
                        <Text style={styles.memberAvatarText}>{item.fullName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
                      </View>
                    )}
                    {isUserOnline(item.userId) && <View style={[styles.memberOnlineDot, { borderColor: colors.surface }]} />}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{item.fullName}</Text>
                    <Text style={[styles.memberRole, { color: colors.textMuted }]}>
                      {item.role === 'admin' ? 'Admin/Teacher' : 'Student'}
                      {item.isAdmin ? ' · Group Admin' : ''}
                      {item.isMuted ? ' · Muted' : ''}
                    </Text>
                  </View>
                  {groupAdmin && item.userId !== currentUser?.id && !item.isAdmin && (
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        onPress={() => handleMuteMember(item.userId, item.isMuted ?? false)}
                        style={styles.memberActionBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                      >
                        {item.isMuted ? <Volume2 size={16} color={colors.success} /> : <VolumeX size={16} color={colors.warning} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(item.userId)}
                        style={styles.memberActionBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                      >
                        <UserMinus size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, paddingTop: Platform.OS === 'web' ? 12 : 50,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: { padding: 6 },
  headerAvatarContainer: { position: 'relative' as const },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#000' },
  headerOnlineDot: {
    position: 'absolute' as const, bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00C9A7', borderWidth: 2,
  },
  headerTextContainer: { flex: 1, gap: 2 },
  headerName: { fontSize: 15, fontWeight: '700' as const },
  headerStatus: { fontSize: 12 },
  headerTypingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  connectionWarning: { paddingHorizontal: 16, paddingVertical: 6 },
  connectionWarningText: { fontSize: 12, fontWeight: '600' as const, textAlign: 'center' },
  messagesList: { paddingHorizontal: 12, paddingVertical: 12 },
  loadMoreIndicator: { paddingVertical: 10, alignItems: 'center' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyChatText: { fontSize: 15 },
  dateSeparator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 10,
  },
  dateSeparatorLine: { flex: 1, height: 0.5 },
  dateSeparatorText: { fontSize: 12, fontWeight: '600' as const },
  messageRow: { flexDirection: 'row', marginBottom: 4, maxWidth: '100%' as any },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  avatarSlot: { marginRight: 8 },
  avatarSpacer: { width: 32 },
  msgAvatar: { width: 32, height: 32, borderRadius: 16 },
  msgAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  msgAvatarText: { fontSize: 12, fontWeight: '700' as const, color: '#000' },
  bubbleContainer: { maxWidth: '80%' as any, gap: 2 },
  messageBubble: {
    maxWidth: '100%' as any, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  pinnedIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  pinnedText: { fontSize: 10, fontWeight: '600' as const },
  replyIndicator: { borderLeftWidth: 2, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4, borderRadius: 4 },
  replyText: { fontSize: 12, fontStyle: 'italic' as const },
  messageSender: { fontSize: 12, fontWeight: '700' as const, marginBottom: 2 },
  attachmentsContainer: { gap: 6, marginBottom: 4 },
  messageImage: { width: 200, height: 150, borderRadius: 8 },
  attachmentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  attachmentInfo: { flex: 1, gap: 2 },
  attachmentName: { fontSize: 13, fontWeight: '600' as const },
  attachmentSize: { fontSize: 11 },
  messageText: { fontSize: 15, lineHeight: 20 },
  linkPreview: { flexDirection: 'row', gap: 8, borderRadius: 8, padding: 8, marginTop: 4 },
  linkPreviewThumb: { width: 50, height: 50, borderRadius: 6 },
  linkPreviewInfo: { flex: 1, gap: 2 },
  linkPreviewTitle: { fontSize: 13, fontWeight: '600' as const, lineHeight: 17 },
  linkPreviewDesc: { fontSize: 11, lineHeight: 14 },
  linkPreviewUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  linkPreviewSite: { fontSize: 10, fontWeight: '500' as const },
  editedLabel: { fontSize: 10, fontStyle: 'italic' as const },
  messageMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  messageTime: { fontSize: 11 },
  bubbleTimestamp: { fontSize: 10, marginTop: 3, letterSpacing: 0.3 },
  bubbleTimestampOwn: { alignSelf: 'flex-end', textAlign: 'right' as const },
  bubbleTimestampOther: { alignSelf: 'flex-start', textAlign: 'left' as const },
  quickReactBar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  quickReactBarOwn: { justifyContent: 'flex-end' as const },
  quickReactBarOther: { justifyContent: 'flex-start' as const },
  quickReactToggle: { padding: 2 },
  quickReactEmojis: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 14 },
  quickReactEmojiBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  quickReactEmojiText: { fontSize: 18 },
  reactionPicker: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, marginTop: 4,
    borderRadius: 12,
  },
  reactionEmojiBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmojiText: { fontSize: 22 },
  messageActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6, paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  messageActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  messageActionText: { fontSize: 12, fontWeight: '600' as const },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  retryText: { fontSize: 12, fontWeight: '600' as const },
  reactionsRow: { flexDirection: 'row', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  reactionsRowOwn: { justifyContent: 'flex-end' },
  reactionsRowOther: { justifyContent: 'flex-start' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  reactionChipEmoji: { fontSize: 13 },
  reactionChipCount: { fontSize: 11, fontWeight: '600' as const },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 4 },
  typingDotsContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, alignSelf: 'flex-start',
  },
  typingIndicatorText: { fontSize: 12, fontWeight: '500' as const, marginLeft: 6 },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12,
    paddingVertical: 8, borderLeftWidth: 3,
  },
  replyPreviewContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  replyPreviewText: { flex: 1, gap: 1 },
  replyPreviewSender: { fontSize: 12, fontWeight: '600' as const },
  replyPreviewMsg: { fontSize: 12 },
  pendingAttachments: {
    paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  pendingAttItem: { position: 'relative' as const, marginRight: 8, borderRadius: 8, padding: 8, minWidth: 80 },
  pendingAttImage: { width: 64, height: 64, borderRadius: 6 },
  pendingAttFile: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 120 },
  pendingAttName: { fontSize: 12, flex: 1 },
  pendingAttRemove: {
    position: 'absolute' as const, top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  uploadingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6,
  },
  uploadingText: { fontSize: 13 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, gap: 6,
    borderTopWidth: 1, paddingBottom: Platform.OS === 'web' ? 12 : 24,
  },
  attachBtn: { padding: 8 },
  input: { flex: 1, fontSize: 15, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: { position: 'absolute' as const, top: 50, right: 20, zIndex: 10, padding: 10 },
  imageViewerImage: { width: '100%' as any, height: '100%' as any },
  settingsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  settingsModal: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' as any, paddingBottom: Platform.OS === 'web' ? 20 : 40,
  },
  settingsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingsTitle: { fontSize: 17, fontWeight: '700' as const },
  settingsBody: { paddingHorizontal: 16, paddingTop: 12 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  settingsItemText: { fontSize: 15, fontWeight: '500' as const },
  settingsSectionTitle: { fontSize: 13, fontWeight: '600' as const, marginTop: 16, marginBottom: 8 },
  backgroundPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  backgroundPreset: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pinnedSection: { marginTop: 16 },
  pinnedMsgItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 6 },
  pinnedMsgText: { fontSize: 12, flex: 1 },
  memberItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    borderBottomWidth: 0.5,
  },
  memberAvatarContainer: { position: 'relative' as const },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#000' },
  memberOnlineDot: {
    position: 'absolute' as const, bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00C9A7', borderWidth: 2,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 14, fontWeight: '600' as const },
  memberRole: { fontSize: 12 },
  memberActions: { flexDirection: 'row', gap: 8 },
  memberActionBtn: { padding: 6 },
});
