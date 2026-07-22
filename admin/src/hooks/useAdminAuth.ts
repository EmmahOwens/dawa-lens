import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  idToken: string | null;
}

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isAdmin: false,
    isLoading: true,
    idToken: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, isLoading: false, idToken: null });
        return;
      }

      try {
        // Force refresh to get latest custom claims
        const tokenResult = await user.getIdTokenResult(true);
        const isAdmin = tokenResult.claims.admin === true;
        const idToken = tokenResult.token;
        setState({ user, isAdmin, isLoading: false, idToken });
      } catch {
        setState({ user, isAdmin: false, isLoading: false, idToken: null });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}

/** Refreshes the ID token (call before API requests to ensure freshness) */
export async function getAdminToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
