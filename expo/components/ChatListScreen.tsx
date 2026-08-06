import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, MessageCircle, X, Circle, WifiOff, Wifi, Users, ChevronRight, Trash2, Contact as ContactIcon, BellOff, Pin } from 'lucide-react-native';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Conversation, User, ChatContact } from '@/types';

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getAvatarText(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? '?';
}

function getRoleLabel(role: string): string {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin/Teacher';
  return 'Student';
}

export function ChatListScreen() {
  const router = useRouter();
  const { currentUser, allUsers } = useAuth();
  const { colors } = useTheme();
  const {
    conversations,
    totalUnread,
    connectionState,
    getOtherParticipant,
    getAvailableChatUsers,
    getOrCreateConversation,
    deleteConversation,
    refreshConversations,
    unreadCounts,
    isUserOnline,
    setActiveConversationId,
    getConversationName,
    getConversationAvatar,
    isConversationMuted,
    importDeviceContacts,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [creatingChat, setCreatingChat] = useState<string | null>(null);
  const [showContactsTab, setShowContactsTab] = useState<'users' | 'contacts'>('users');
  const [importedContacts, setImportedContacts] = useState<ChatContact[]>([]);
  const [importingContacts, setImportingContacts] = useState(false);

  const availableUsers = useMemo(() => getAvailableChatUsers(), [getAvailableChatUsers]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const lower = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const name = getConversationName(conv);
      return name.toLowerCase().includes(lower) ||
             conv.lastMessageText.toLowerCase().includes(lower);
    });
  }, [conversations, searchQuery, getConversationName]);

  const filteredUsers = useMemo(() => {
    if (!newChatSearch.trim()) return availableUsers;
    const lower = newChatSearch.toLowerCase();
    return availableUsers.filter(u =>
      u.fullName.toLowerCase().includes(lower) ||
      (u.email?.toLowerCase().includes(lower) ?? false) ||
      getRoleLabel(u.role).toLowerCase().includes(lower),
    );
  }, [availableUsers, newChatSearch]);

  const filteredContacts = useMemo(() => {
    if (!newChatSearch.trim()) return importedContacts;
    const lower = newChatSearch.toLowerCase();
    return importedContacts.filter(c => c.name.toLowerCase().includes(lower));
  }, [importedContacts, newChatSearch]);

  const handleConversationPress = useCallback((conv: Conversation) => {
    setActiveConversationId(conv.id);
    router.push(`/chat/${conv.id}` as any);
  }, [router, setActiveConversationId]);

  const handleStartChat = useCallback(async (user: User) => {
    setCreatingChat(user.id);
    const conv = await getOrCreateConversation(user.id, {
      fullName: user.fullName,
      role: user.role,
      profileImage: user.profileImage,
    });
    setCreatingChat(null);
    if (conv) {
      setShowNewChatModal(false);
      setNewChatSearch('');
      setActiveConversationId(conv.id);
      router.push(`/chat/${conv.id}` as any);
    }
  }, [getOrCreateConversation, router, setActiveConversationId]);

  const handleStartChatFromContact = useCallback(async (contact: ChatContact) => {
    if (!contact.matchedUserId) return;
    const user = allUsers.find(u => u.id === contact.matchedUserId);
    if (!user) return;
    await handleStartChat(user);
  }, [allUsers, handleStartChat]);

  const handleImportContacts = useCallback(async () => {
    setImportingContacts(true);
    const contacts = await importDeviceContacts();
    setImportedContacts(contacts);
    setImportingContacts(false);
    if (contacts.length === 0) {
      setShowContactsTab('users');
    }
  }, [importDeviceContacts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const handleDeleteConversation = useCallback((convId: string) => {
    void deleteConversation(convId);
  }, [deleteConversation]);

  const connectionColor = connectionState === 'connected' ? colors.success : connectionState === 'connecting' ? colors.warning : colors.error;
  const connectionLabel = connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting...' : connectionState === 'reconnecting' ? 'Reconnecting...' : 'Disconnected';

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    const isGroup = item.isGroup ?? false;
    const name = getConversationName(item);
    const avatar = getConversationAvatar(item);
    const unread = unreadCounts[item.id] ?? 0;
    const muted = isConversationMuted(item.id);
    const isOwnLastMessage = item.lastMessageSenderId === currentUser?.id;
    const hasPinned = (item.pinnedMessageIds?.length ?? 0) > 0;
    const onlineCount = isGroup
      ? item.participantInfo.filter(p => isUserOnline(p.userId)).length
      : 0;

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {avatar.image ? (
            <Image source={{ uri: avatar.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isGroup ? colors.accent : colors.primary }]}>
              {isGroup ? (
                <Users size={20} color="#000" />
              ) : (
                <Text style={styles.avatarText}>{avatar.initial}</Text>
              )}
            </View>
          )}
          {!isGroup && isUserOnline(item.participantInfo.find(p => p.userId !== currentUser?.id)?.userId ?? '') && (
            <View style={[styles.onlineDot, { borderColor: colors.surface }]} />
          )}
          {isGroup && onlineCount > 0 && (
            <View style={[styles.groupOnlineBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.groupOnlineText}>{onlineCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <View style={styles.convNameRow}>
              {isGroup && <Users size={13} color={colors.accent} style={{ marginRight: 4 }} />}
              <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              {muted && <BellOff size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />}
              {hasPinned && <Pin size={11} color={colors.warning} style={{ marginLeft: 3 }} />}
            </View>
            <Text style={[styles.convTime, { color: colors.textMuted }]}>
              {formatTimeAgo(item.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.convFooter}>
            <Text
              style={[
                styles.convPreview,
                { color: unread > 0 ? colors.text : colors.textMuted },
                unread > 0 && { fontWeight: '700' as const },
              ]}
              numberOfLines={1}
            >
              {isOwnLastMessage ? 'You: ' : ''}{item.lastMessageText || 'No messages yet'}
            </Text>
            {unread > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: muted ? colors.textMuted : colors.primary }]}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.convRole, { color: colors.textMuted }]} numberOfLines={1}>
            {isGroup
              ? `${item.participantIds.length} members${item.sectionId ? ' · Section' : ''}`
              : getRoleLabel(item.participantInfo.find(p => p.userId !== currentUser?.id)?.role ?? 'student')}
          </Text>
        </View>
        {!isGroup && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteConversation(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [colors, currentUser?.id, getConversationName, getConversationAvatar, isConversationMuted, isUserOnline, handleConversationPress, handleDeleteConversation, unreadCounts]);

  const renderUserItem = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleStartChat(item)}
      disabled={creatingChat === item.id}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{getAvatarText(item.fullName)}</Text>
          </View>
        )}
      </View>
      <View style={styles.userContent}>
        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
          {item.fullName}
        </Text>
        <Text style={[styles.userRole, { color: colors.textMuted }]} numberOfLines={1}>
          {getRoleLabel(item.role)} · {item.email}
        </Text>
      </View>
      {creatingChat === item.id ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <ChevronRight size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  ), [colors, creatingChat, handleStartChat]);

  const renderContactItem = useCallback(({ item }: { item: ChatContact }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleStartChatFromContact(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
          <ContactIcon size={20} color="#000" />
        </View>
      </View>
      <View style={styles.userContent}>
        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.userRole, { color: colors.success }]} numberOfLines={1}>
          ✓ Matched on AIRA
        </Text>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </TouchableOpacity>
  ), [colors, handleStartChatFromContact]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Connection Status Bar */}
      <View style={[styles.connectionBar, { backgroundColor: colors.surface }]}>
        <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
        <Text style={[styles.connectionText, { color: colors.textSecondary }]}>
          {connectionLabel}
        </Text>
        {totalUnread > 0 && (
          <View style={[styles.totalUnreadBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.totalUnreadText}>{totalUnread} unread</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageCircle size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No conversations yet
            </Text>
            <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
              Tap the button below to start a new conversation
            </Text>
            <TouchableOpacity
              style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowNewChatModal(true)}
            >
              <Users size={18} color="#000" />
              <Text style={styles.newChatBtnText}>Start a Conversation</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB for new chat */}
      {conversations.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewChatModal(true)}
          activeOpacity={0.85}
        >
          <Users size={24} color="#000" />
        </TouchableOpacity>
      )}

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Conversation</Text>
            <TouchableOpacity
              onPress={() => { setShowNewChatModal(false); setNewChatSearch(''); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.tab, showContactsTab === 'users' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setShowContactsTab('users')}
            >
              <Text style={[styles.tabText, { color: showContactsTab === 'users' ? colors.primary : colors.textMuted }]}>
                App Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, showContactsTab === 'contacts' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => {
                setShowContactsTab('contacts');
                if (importedContacts.length === 0 && !importingContacts) {
                  void handleImportContacts();
                }
              }}
            >
              <Text style={[styles.tabText, { color: showContactsTab === 'contacts' ? colors.primary : colors.textMuted }]}>
                Device Contacts
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Users */}
          <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={showContactsTab === 'users' ? "Search users by name, email, or role..." : "Search contacts..."}
              placeholderTextColor={colors.textMuted}
              value={newChatSearch}
              onChangeText={setNewChatSearch}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {newChatSearch.length > 0 && (
              <TouchableOpacity onPress={() => setNewChatSearch('')}>
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Available Users / Contacts */}
          {showContactsTab === 'users' ? (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item.id}
              renderItem={renderUserItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Users size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No users available
                  </Text>
                  <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
                    {availableUsers.length === 0
                      ? 'You do not have permission to message anyone yet.'
                      : 'No users match your search.'}
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={item => item.id}
              renderItem={renderContactItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  {importingContacts ? (
                    <>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        Importing contacts...
                      </Text>
                    </>
                  ) : (
                    <>
                      <ContactIcon size={48} color={colors.textMuted} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        {importedContacts.length === 0 ? 'No matched contacts' : 'No contacts match your search'}
                      </Text>
                      <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
                        {importedContacts.length === 0
                          ? 'Contacts from your device that have AIRA accounts will appear here.'
                          : ''}
                      </Text>
                      <TouchableOpacity
                        style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
                        onPress={() => void handleImportContacts()}
                      >
                        <ContactIcon size={18} color="#000" />
                        <Text style={styles.newChatBtnText}>Import Contacts</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  totalUnreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  totalUnreadText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative' as const,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  onlineDot: {
    position: 'absolute' as const,
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C9A7',
    borderWidth: 2,
  },
  groupOnlineBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(10,20,32,1)',
  },
  groupOnlineText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#000',
  },
  convContent: {
    flex: 1,
    gap: 2,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  convName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  convTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  convFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convPreview: {
    fontSize: 13,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#000',
  },
  convRole: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 8,
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  newChatBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
  fab: {
    position: 'absolute' as const,
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 20 : 50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
  },
  userContent: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  userRole: {
    fontSize: 13,
  },
});
