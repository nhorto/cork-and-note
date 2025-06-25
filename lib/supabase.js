//lib/supabase.js THE OG
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
//import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    //storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});


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