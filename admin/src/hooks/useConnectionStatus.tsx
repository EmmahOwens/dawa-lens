import { createContext, useContext, useState, useCallback } from 'react';

interface ConnectionContextValue {
  isConnected: boolean;
  setConnected: (v: boolean) => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  isConnected: false,
  setConnected: () => {},
});

export const useConnectionStatus = () => useContext(ConnectionContext).isConnected;
export const useSetConnectionStatus = () => useContext(ConnectionContext).setConnected;

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const setConnected = useCallback((v: boolean) => setIsConnected(v), []);
  return (
    <ConnectionContext.Provider value={{ isConnected, setConnected }}>
      {children}
    </ConnectionContext.Provider>
  );
}
