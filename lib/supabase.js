//lib/supabase.js - Mock client for toy app (no backend)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if we're in a browser environment and have the required env vars
const isBrowser = typeof window !== 'undefined';
const hasRequiredEnvVars = supabaseUrl && supabaseAnonKey;

let supabaseClient = null;

if (hasRequiredEnvVars) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // For web deployment, we don't need AsyncStorage
      storage: isBrowser ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isBrowser, // Only detect sessions in URL when in browser
    },
  });
} else {
  // Create a mock client for demo/portfolio mode - accepts any credentials
  let authStateCallback = null;

  supabaseClient = {
    auth: {
      signInWithPassword: ({ email }) => {
        // Accept any email/password combination for demo mode
        const mockUser = {
          id: 'mock-user-' + Date.now(),
          email: email,
          user_metadata: { name: email.split('@')[0] }
        };
        const mockSession = {
          user: mockUser,
          access_token: 'mock-token-' + Date.now(),
          refresh_token: 'mock-refresh-token'
        };

        // Trigger auth state change callback if registered
        if (authStateCallback) {
          setTimeout(() => authStateCallback('SIGNED_IN', mockSession), 0);
        }

        return Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null
        });
      },
      signUp: ({ email, options }) => {
        // Accept any signup for demo mode
        const mockUser = {
          id: 'mock-user-' + Date.now(),
          email: email,
          user_metadata: options?.data || { name: email.split('@')[0] }
        };
        const mockSession = {
          user: mockUser,
          access_token: 'mock-token-' + Date.now(),
          refresh_token: 'mock-refresh-token'
        };

        // Trigger auth state change callback if registered
        if (authStateCallback) {
          setTimeout(() => authStateCallback('SIGNED_IN', mockSession), 0);
        }

        return Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null
        });
      },
      signOut: () => {
        // Trigger auth state change callback if registered
        if (authStateCallback) {
          setTimeout(() => authStateCallback('SIGNED_OUT', null), 0);
        }
        return Promise.resolve({ error: null });
      },
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: (callback) => {
        // Store the callback so we can trigger it on auth events
        authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authStateCallback = null;
              }
            }
          }
        };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
        })
      }),
      update: () => ({
        eq: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
      }),
      delete: () => ({
        eq: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
      }),
    }),
  };
}

export const supabase = supabaseClient;

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => hasRequiredEnvVars;

// Development helper
if (process.env.NODE_ENV === 'development' && !hasRequiredEnvVars) {
  console.warn('⚠️ Supabase environment variables not found. Running in mock mode without backend.');
}


// lib/supabase.js for vercel version 1:
// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);

//supabase.js for vercel version 2: 
//lib/supabase.js
// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// // Check if we're in a browser environment and have the required env vars
// const isBrowser = typeof window !== 'undefined';
// const hasRequiredEnvVars = supabaseUrl && supabaseAnonKey;

// let supabaseClient = null;

// if (hasRequiredEnvVars) {
//   supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
//     auth: {
//       // For web deployment, we don't need AsyncStorage
//       storage: isBrowser ? window.localStorage : undefined,
//       autoRefreshToken: true,
//       persistSession: true,
//       detectSessionInUrl: isBrowser, // Only detect sessions in URL when in browser
//     },
//   });
// } else {
//   // Create a mock client that throws helpful errors
//   supabaseClient = {
//     auth: {
//       signInWithPassword: () => Promise.reject(new Error('Supabase not configured. Check environment variables.')),
//       signUp: () => Promise.reject(new Error('Supabase not configured. Check environment variables.')),
//       signOut: () => Promise.reject(new Error('Supabase not configured. Check environment variables.')),
//       resetPasswordForEmail: () => Promise.reject(new Error('Supabase not configured. Check environment variables.')),
//       getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') }),
//       getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') }),
//       onAuthStateChange: () => ({ 
//         data: { 
//           subscription: { 
//             unsubscribe: () => console.warn('Supabase not configured') 
//           } 
//         } 
//       }),
//     },
//     from: () => ({
//       select: () => ({ 
//         eq: () => ({ 
//           single: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
//         })
//       }),
//       insert: () => ({ 
//         select: () => ({ 
//           single: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
//         })
//       }),
//       update: () => ({ 
//         eq: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
//       }),
//       delete: () => ({ 
//         eq: () => Promise.reject(new Error('Supabase not configured. Check environment variables.'))
//       }),
//     }),
//   };
// }

// export const supabase = supabaseClient;

// Helper function to check if Supabase is properly configured
// export const isSupabaseConfigured = () => hasRequiredEnvVars;

// // Development helper
// if (process.env.NODE_ENV === 'development' && !hasRequiredEnvVars) {
//   console.warn('⚠️ Supabase environment variables not found. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
// }