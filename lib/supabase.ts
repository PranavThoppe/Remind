import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Supabase project credentials
const supabaseUrl = 'https://wnucyciacxqrbuthymbu.supabase.co'
const supabaseAnonKey = 'sb_publishable_LgyQ8IFRQqJ4gGX29-SVCA_PB-ZGQP8'

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})