import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator,
  Modal, Platform, Pressable, Animated, Easing,
} from 'react-native';
import {
  Play, Pause, Maximize, Minimize, RotateCcw, Gauge, Volume2, VolumeX,
  PictureInPicture2, Subtitles, AlertCircle, RefreshCw, Wifi, WifiOff,
  FastForward, Rewind, Zap,
} from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import { savePlaybackPosition, getPlaybackPosition, getCachedFile } from '@/services/cloudSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import type { VideoSourceMode } from '@/types';

interface VideoPlayerProps {
  uri: string;
  contentId: string;
  thumbnail?: string;
  subtitleUrl?: string;
  subtitleLabel?: string;
  style?: object;
}

const VOLUME_KEY = 'aira_video_volume';
const SPEED_OPTIONS: number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 10;
const LONG_PRESS_SPEED = 2;
const OFFLINE_LOAD_TIMEOUT = 10000; // 10 seconds

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Detects whether the video source is online, offline/local, or cached */
function detectSourceMode(uri: string, isOnline: boolean, hasCache: boolean): VideoSourceMode {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    if (hasCache && !isOnline) return 'cached';
    return 'online';
  }
  if (uri.startsWith('file://') || uri.startsWith('blob:') || uri.startsWith('data:')) {
    return 'offline';
  }
  return 'unknown';
}

export default function VideoPlayer({ uri, contentId, thumbnail, subtitleUrl, subtitleLabel, style }: VideoPlayerProps) {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity();
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('unknown');
  const [effectiveUri, setEffectiveUri] = useState(uri);
  const [retryCount, setRetryCount] = useState(0);
  const [offlineTimeout, setOfflineTimeout] = useState(false);
  const [gestureToast, setGestureToast] = useState<{ text: string; icon: 'forward' | 'backward' | 'speed' } | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Gesture animation refs
  const gestureAnim = useRef(new Animated.Value(0)).current;
  const gestureScaleAnim = useRef(new Animated.Value(0.8)).current;
  const longPressAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ side: 'left' | 'right'; time: number } | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSpeedRef = useRef<number>(1);

  // Detect source mode and resolve effective URI (cached if available and offline)
  useEffect(() => {
    const checkSource = async () => {
      const cached = await getCachedFile(contentId);
      const mode = detectSourceMode(uri, isOnline, !!cached);
      setSourceMode(mode);
      if (mode === 'online' && !isOnline && cached) {
        setEffectiveUri(cached.uri);
      } else {
        setEffectiveUri(uri);
      }
    };
    void checkSource();
  }, [uri, contentId, isOnline]);

  // Load saved volume
  useEffect(() => {
    const loadVolume = async () => {
      const stored = await AsyncStorage.getItem(VOLUME_KEY);
      if (stored) {
        const v = parseFloat(stored);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          setVolume(v);
          setIsMuted(v === 0);
        }
      }
    };
    void loadVolume();
  }, []);

  const player = useVideoPlayer(effectiveUri, (instance) => {
    instance.loop = false;
  });

  // Load saved playback position
  useEffect(() => {
    const loadSavedPosition = async () => {
      if (!currentUser) return;
      const saved = await getPlaybackPosition(currentUser.id, contentId);
      if (saved && saved.position > 5 && saved.position < saved.duration) {
        setSavedPosition(saved.position);
      }
    };
    void loadSavedPosition();
  }, [currentUser, contentId]);

  const playerStatus = player.status;

  // Offline loading timeout - show error after 10 seconds if video not ready
  useEffect(() => {
    if (isLoading && (sourceMode === 'offline' || sourceMode === 'cached')) {
      setOfflineTimeout(false);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = setTimeout(() => {
        if (playerStatus !== 'readyToPlay') {
          setOfflineTimeout(true);
          setHasError(true);
          setIsLoading(false);
        }
      }, OFFLINE_LOAD_TIMEOUT);
      return () => {
        if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      };
    }
  }, [isLoading, sourceMode, playerStatus]);

  useEffect(() => {
    setIsLoading(playerStatus === 'loading' || playerStatus === 'idle');
    setIsBuffering(playerStatus === 'loading' && position > 0);
    if (playerStatus === 'readyToPlay') {
      setIsLoading(false);
      setHasError(false);
      setOfflineTimeout(false);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (duration === 0) {
        setDuration(player.duration);
      }
      if (savedPosition !== null && savedPosition > 5) {
        player.currentTime = savedPosition;
        setSavedPosition(null);
      }
    }
    if (playerStatus === 'error') {
      setIsLoading(false);
      setHasError(true);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    }
  }, [playerStatus, player, duration, savedPosition]);

  // Position polling - optimized for low-end devices (500ms interval)
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerStatus === 'readyToPlay') {
        setPosition(player.currentTime);
        if (duration === 0 && player.duration > 0) {
          setDuration(player.duration);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player, playerStatus, duration]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      void player.play();
      setIsPlaying(true);
    }
    setShowControls(true);
  }, [isPlaying, player]);

  const seekTo = useCallback((newPosition: number) => {
    const clamped = Math.max(0, Math.min(newPosition, duration));
    player.currentTime = clamped;
    setPosition(clamped);
  }, [player, duration]);

  const restart = useCallback(() => {
    player.currentTime = 0;
    setPosition(0);
  }, [player]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setShowControls(true);
  }, []);

  const selectSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    player.playbackRate = speed;
    setShowSpeedMenu(false);
  }, [player]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const newVolume = newMuted ? 0 : volume > 0 ? volume : 1;
    setVolume(newVolume);
    player.muted = newMuted;
    if (!newMuted) {
      AsyncStorage.setItem(VOLUME_KEY, String(newVolume)).catch(() => undefined);
    }
  }, [isMuted, volume, player]);

  const toggleSubtitles = useCallback(() => {
    setShowSubtitles((prev) => !prev);
  }, []);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setHasError(false);
    setOfflineTimeout(false);
    setIsLoading(true);
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    player.currentTime = 0;
    void player.play();
    setIsPlaying(true);
  }, [player]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isLongPressing) setShowControls(false);
    }, 4000);
  }, [isPlaying, isLongPressing]);

  // === Gesture: show toast animation ===
  const showGestureToast = useCallback((text: string, icon: 'forward' | 'backward' | 'speed') => {
    setGestureToast({ text, icon });
    gestureAnim.setValue(0);
    gestureScaleAnim.setValue(0.5);
    Animated.parallel([
      Animated.timing(gestureAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(gestureScaleAnim, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(gestureAnim, {
        toValue: 0,
        duration: 600,
        delay: 500,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setGestureToast(null));
    });
  }, [gestureAnim, gestureScaleAnim]);

  // === Gesture: double-tap skip ===
  const handleDoubleTap = useCallback((side: 'left' | 'right') => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    lastTapRef.current = { side, time: now };

    if (lastTap && lastTap.side === side && now - lastTap.time < 350) {
      // Double tap detected
      lastTapRef.current = null;
      if (side === 'right') {
        const newPos = position + SKIP_SECONDS;
        seekTo(Math.min(newPos, duration));
        showGestureToast(`+${SKIP_SECONDS}s`, 'forward');
      } else {
        const newPos = position - SKIP_SECONDS;
        seekTo(Math.max(newPos, 0));
        showGestureToast(`-${SKIP_SECONDS}s`, 'backward');
      }
    }
  }, [position, duration, seekTo, showGestureToast]);

  // === Gesture: long press for 2x speed ===
  const handleLongPressStart = useCallback(() => {
    longPressTimeoutRef.current = setTimeout(() => {
      setIsLongPressing(true);
      previousSpeedRef.current = playbackSpeed;
      player.playbackRate = LONG_PRESS_SPEED;
      Animated.timing(longPressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      showGestureToast(`${LONG_PRESS_SPEED}x Speed`, 'speed');
    }, 400);
  }, [playbackSpeed, player, longPressAnim, showGestureToast]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (isLongPressing) {
      setIsLongPressing(false);
      player.playbackRate = previousSpeedRef.current;
      Animated.timing(longPressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isLongPressing, player, longPressAnim]);

  // Save playback position periodically
  useEffect(() => {
    if (position > 5 && currentUser) {
      if (positionSaveTimeoutRef.current) clearTimeout(positionSaveTimeoutRef.current);
      positionSaveTimeoutRef.current = setTimeout(() => {
        void savePlaybackPosition(currentUser.id, contentId, position, duration);
      }, 3000);
    }
  }, [position, contentId, currentUser, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (positionSaveTimeoutRef.current) clearTimeout(positionSaveTimeoutRef.current);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (currentUser && position > 5 && duration > 0) {
        void savePlaybackPosition(currentUser.id, contentId, position, duration);
      }
    };
  }, []);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const sourceBadge = useMemo(() => {
    if (sourceMode === 'offline' || sourceMode === 'cached') {
      return (
        <View style={styles.sourceBadge}>
          <WifiOff size={12} color={Colors.warning} />
          <Text style={styles.sourceBadgeText}>Offline</Text>
        </View>
      );
    }
    if (sourceMode === 'online') {
      return (
        <View style={styles.sourceBadge}>
          <Wifi size={12} color={Colors.success} />
          <Text style={[styles.sourceBadgeText, { color: Colors.success }]}>Online</Text>
        </View>
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

  // Gesture toast overlay (for +10s, -10s, 2x speed)
  const gestureToastOverlay = gestureToast && (
    <Animated.View
      style={[
        styles.gestureToast,
        {
          opacity: gestureAnim,
          transform: [{ scale: gestureScaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      {gestureToast.icon === 'forward' && <FastForward size={28} color="#FFF" fill="#FFF" />}
      {gestureToast.icon === 'backward' && <Rewind size={28} color="#FFF" fill="#FFF" />}
      {gestureToast.icon === 'speed' && <Zap size={28} color={Colors.warning} fill={Colors.warning} />}
      <Text style={styles.gestureToastText}>{gestureToast.text}</Text>
    </Animated.View>
  );

  // Long press speed indicator
  const longPressOverlay = isLongPressing && (
    <Animated.View
      style={[
        styles.longPressOverlay,
        { opacity: longPressAnim },
      ]}
      pointerEvents="none"
    >
      <View style={styles.longPressBadge}>
        <Zap size={16} color={Colors.warning} fill={Colors.warning} />
        <Text style={styles.longPressText}>{LONG_PRESS_SPEED}x Speed</Text>
      </View>
    </Animated.View>
  );

  // Gesture capture zones (left and right halves of screen)
  const gestureZones = (
    <>
      <Pressable
        style={styles.leftTapZone}
        onPress={() => handleDoubleTap('left')}
        onLongPress={() => {}}
        onPressIn={handleLongPressStart}
        onPressOut={handleLongPressEnd}
        delayLongPress={400}
      />
      <Pressable
        style={styles.rightTapZone}
        onPress={() => handleDoubleTap('right')}
        onLongPress={() => {}}
        onPressIn={handleLongPressStart}
        onPressOut={handleLongPressEnd}
        delayLongPress={400}
      />
    </>
  );

  const videoView = (
    <VideoView
      player={player}
      style={isFullscreen ? styles.fullscreenVideo : [styles.video, style]}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={true}
    />
  );

  const errorOverlay = (
    <View style={styles.errorContainer}>
      <AlertCircle size={40} color={Colors.error} />
      <Text style={styles.errorTitle}>
        {offlineTimeout ? 'Offline Video Timeout' : 'Video Unavailable'}
      </Text>
      <Text style={styles.errorMessage}>
        {offlineTimeout
          ? 'Could not load the offline video after 10 seconds. The file may be corrupted or missing.'
          : sourceMode === 'online' && !isOnline
            ? 'This video requires an internet connection.'
            : 'Could not load the video. It may be corrupted or the source is unavailable.'}
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
        <RefreshCw size={16} color="#000" />
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const bufferingOverlay = (
    <View style={styles.bufferingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.bufferingText}>Buffering...</Text>
    </View>
  );

  const loadingOverlay = (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>
        {sourceMode === 'offline' || sourceMode === 'cached'
          ? 'Preparing offline video...'
          : 'Loading video...'}
      </Text>
    </View>
  );

  const controlsOverlay = (
    <View style={[styles.controlsOverlay, isFullscreen && styles.fullscreenControls]}>
      {hasError ? (
        errorOverlay
      ) : isLoading ? (
        loadingOverlay
      ) : (
        <>
          {isBuffering && bufferingOverlay}
          {gestureZones}
          {gestureToastOverlay}
          {longPressOverlay}

          {/* Center play/pause button - only when controls visible */}
          {showControls && (
            <TouchableOpacity style={styles.playButtonOverlay} onPress={togglePlayPause} activeOpacity={0.8}>
              {isPlaying ? (
                <View style={styles.playIconBg}>
                  <Pause size={28} color="#FFF" fill="#FFF" />
                </View>
              ) : (
                <View style={styles.playIconBg}>
                  <Play size={28} color="#FFF" fill="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Skip hint indicators when controls hidden */}
          {!showControls && (
            <View style={styles.skipHints} pointerEvents="none">
              <View style={styles.skipHintLeft}>
                <Rewind size={16} color="rgba(255,255,255,0.2)" />
                <Text style={styles.skipHintText}>-10s</Text>
              </View>
              <View style={styles.skipHintRight}>
                <FastForward size={16} color="rgba(255,255,255,0.2)" />
                <Text style={styles.skipHintText}>+10s</Text>
              </View>
            </View>
          )}

          {showControls && (
            <View style={[styles.controlsBar, isFullscreen && styles.fullscreenControlsBar]}>
              <View style={styles.seekContainer}>
                <TouchableOpacity
                  style={styles.seekBar}
                  activeOpacity={1}
                  onPress={(e) => {
                    const { locationX } = e.nativeEvent;
                    const seekBarWidth = Dimensions.get('window').width - (isFullscreen ? 32 : 28);
                    const pct = locationX / seekBarWidth;
                    seekTo(pct * duration);
                  }}
                >
                  <View style={styles.seekTrack}>
                    <View style={[styles.seekFill, { width: `${progress}%` }]} />
                    <View style={[styles.seekThumb, { left: `${progress}%` }]} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatTime(position)} / {formatTime(duration)}</Text>
              </View>
              <View style={styles.controlsButtons}>
                <TouchableOpacity onPress={restart} style={styles.controlBtn} accessibilityLabel="Restart video">
                  <RotateCcw size={16} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlayPause} style={styles.controlBtn} accessibilityLabel="Play or pause">
                  {isPlaying ? <Pause size={18} color="#FFF" fill="#FFF" /> : <Play size={18} color="#FFF" fill="#FFF" />}
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleMute} style={styles.controlBtn} accessibilityLabel="Mute or unmute">
                  {isMuted ? <VolumeX size={18} color="#FFF" /> : <Volume2 size={18} color="#FFF" />}
                </TouchableOpacity>
                {/* Speed control */}
                <TouchableOpacity
                  style={styles.speedBtn}
                  onPress={() => setShowSpeedMenu((prev) => !prev)}
                  accessibilityLabel={`Playback speed: ${playbackSpeed}x`}
                >
                  <Gauge size={16} color="#FFF" />
                  <Text style={styles.speedBtnText}>{playbackSpeed}x</Text>
                </TouchableOpacity>
                {showSpeedMenu && (
                  <View style={styles.speedMenu}>
                    {SPEED_OPTIONS.map((speed) => (
                      <TouchableOpacity
                        key={speed}
                        style={[styles.speedMenuItem, playbackSpeed === speed && styles.speedMenuItemActive]}
                        onPress={() => selectSpeed(speed)}
                      >
                        <Text style={[styles.speedMenuItemText, playbackSpeed === speed && styles.speedMenuItemTextActive]}>
                          {speed}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {subtitleUrl && (
                  <TouchableOpacity
                    onPress={toggleSubtitles}
                    style={[styles.controlBtn, showSubtitles && styles.controlBtnActive]}
                    accessibilityLabel="Toggle subtitles"
                  >
                    <Subtitles size={18} color={showSubtitles ? Colors.primary : '#FFF'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleFullscreen} style={styles.controlBtn} accessibilityLabel="Toggle fullscreen">
                  {isFullscreen ? <Minimize size={18} color="#FFF" /> : <Maximize size={18} color="#FFF" />}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );

  if (isFullscreen) {
    return (
      <Modal visible={true} animationType="fade" supportedOrientations={['landscape', 'portrait']}>
        <View style={styles.fullscreenContainer} onTouchStart={showControlsTemporarily}>
          {videoView}
          {controlsOverlay}
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, style]} onTouchStart={showControlsTemporarily}>
      {videoView}
      {controlsOverlay}
      {/* Source badge */}
      {sourceBadge}
      {/* Resume badge */}
      {savedPosition !== null && savedPosition > 5 && !isLoading && !hasError && (
        <View style={[styles.badge, styles.resumeBadge]}>
          <Text style={styles.resumeText}>Resume from {formatTime(savedPosition)}</Text>
        </View>
      )}
      {/* PiP badge */}
      <View style={[styles.badge, styles.pipBadge]}>
        <PictureInPicture2 size={12} color={Colors.textSecondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden' as const,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenControls: {
    justifyContent: 'flex-end',
  },
  // Gesture tap zones
  leftTapZone: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 1,
  },
  rightTapZone: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    width: '50%',
    height: '100%',
    zIndex: 1,
  },
  // Gesture toast
  gestureToast: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    zIndex: 10,
  },
  gestureToastText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  // Long press overlay
  longPressOverlay: {
    position: 'absolute' as const,
    top: 20,
    alignSelf: 'center' as const,
    zIndex: 10,
  },
  longPressBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  longPressText: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  // Skip hints (shown when controls hidden)
  skipHints: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
  },
  skipHintLeft: {
    alignItems: 'center' as const,
    gap: 2,
  },
  skipHintRight: {
    alignItems: 'center' as const,
    gap: 2,
  },
  skipHintText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  // Loading
  loadingContainer: {
    alignItems: 'center' as const,
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  bufferingContainer: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 5,
  },
  bufferingText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  // Error
  errorContainer: {
    alignItems: 'center' as const,
    gap: 12,
    padding: 20,
    zIndex: 5,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  // Play button
  playButtonOverlay: {
    padding: 16,
    zIndex: 5,
  },
  playIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  // Controls bar
  controlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 6,
  },
  fullscreenControlsBar: {
    paddingVertical: 16,
  },
  seekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  seekBar: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  seekFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginLeft: -6,
    top: -4,
  },
  timeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500' as const,
    minWidth: 70,
  },
  controlsButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlBtn: {
    padding: 8,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(0,201,167,0.2)',
    borderRadius: 8,
  },
  speedBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  speedBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  speedMenu: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    backgroundColor: 'rgba(11,22,35,0.95)',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
  },
  speedMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  speedMenuItemActive: {
    backgroundColor: Colors.primary + '20',
  },
  speedMenuItemText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  speedMenuItemTextActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  // Badges
  badge: {
    position: 'absolute' as const,
    top: 8,
    zIndex: 7,
  },
  sourceBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    right: 8,
    backgroundColor: 'rgba(11,22,35,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sourceBadgeText: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: '600' as const,
  },
  resumeBadge: {
    right: 8,
    backgroundColor: 'rgba(0,201,167,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    top: 38,
  },
  resumeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  pipBadge: {
    left: 8,
    backgroundColor: 'rgba(11,22,35,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
