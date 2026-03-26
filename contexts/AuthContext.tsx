import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/reminder';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  createProfile: (user: User) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event);
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      // Token refresh should not retrigger heavy profile loading or UI loading states.
      // Keep existing profile and just update auth session/user in memory.
      if (event === 'TOKEN_REFRESHED') {
        if (!initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
        }
        return;
      }

      if (session?.user) {
        await fetchProfile(session.user);
      } else {
        setProfile(null);
      }

      // INITIAL_SESSION is the source of truth for startup auth state.
      if (!initialLoadDone) {
        initialLoadDone = true;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (!data) {
        console.log('Profile not found for user:', user.id);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      setProfile(null);
    }
  };

  const createProfile = async (user: User) => {
    try {
      console.log('Creating initial profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          pro: false,
          has_onboarded: false
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        setProfile(null);
      } else {
        console.log('Successfully created profile:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
      setProfile(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } as Profile : null);
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    createProfile,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
