// Real Supabase client for the mobile app. Unlike the web app (which routes
// everything through TanStack Start server functions using the service-role
// key), mobile talks straight to Supabase with the anon key + a real
// supabase.auth session — there's no server-function layer reachable from
// React Native. RLS is the trust boundary here, same as it would be for any
// mobile-first Supabase app. See supabase/migrations/0005_place_order_mobile_rpc.sql
// for the one place a direct client write needed a SECURITY DEFINER escape
// hatch (orders — RLS only grants authenticated SELECT, not INSERT).
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — check mobile/.env.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
