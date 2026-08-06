import { useEffect, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import createContextHook from '@nkzw/create-context-hook';

export type ConnectivityState = 'online' | 'offline' | 'unknown';

export const [ConnectivityProvider, useConnectivity] = createContextHook(() => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectivityState, setConnectivityState] = useState<ConnectivityState>('unknown');
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const prevOnlineRef = useRef<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      setConnectivityState(online ? 'online' : 'offline');
      if (!online && prevOnlineRef.current) {
        setWasOffline(true);
      }
      if (online && !prevOnlineRef.current) {
        console.log('[Connectivity] Connection restored');
      }
      prevOnlineRef.current = online;
    });

    void NetInfo.fetch().then((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      setConnectivityState(online ? 'online' : 'offline');
      prevOnlineRef.current = online;
    });

    return () => unsubscribe();
  }, []);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    connectivityState,
    wasOffline,
    resetWasOffline,
  };
});
