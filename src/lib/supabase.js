// src/lib/supabase.js
// Supabase クライアント singleton
// 全モジュールはここから import する（直接 createClient しない）

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[TheSEKI] Supabase env vars missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// Supabase の auth セッションは sb-<ref>-auth-token キーで localStorage に保存される。
// TheSEKI の theseki_v2 キーとは競合しない。
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
