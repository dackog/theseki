// src/lib/auth.js
// Supabase Auth ユーティリティ — Magic Link 前提
// 将来の Phase 2 でログイン UI から呼び出す想定

import { supabase } from './supabase.js';

/**
 * Magic Link メールを送信する。
 * emailRedirectTo は BASE_URL を含めて /theseki/ サブパスまで指定する。
 * window.location.origin だけだと GitHub Pages でトップドメインに戻ってしまう。
 *
 * @param {string} email
 * @returns {Promise<{ error: Error | null }>}
 */
export async function sendMagicLink(email) {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return { error: error ?? null };
}

/**
 * 現在のユーザーをサインアウトする。
 * TheSEKI の localStorage (theseki_v2) には触れない。
 *
 * @returns {Promise<{ error: Error | null }>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error ?? null };
}

/**
 * 現在のセッションを取得する。
 * 初回マウント時に既存ログイン状態を確認するために使う。
 * 継続的な監視には onAuthChange を使うこと。
 *
 * @returns {Promise<{ session: import('@supabase/supabase-js').Session | null, error: Error | null }>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session ?? null, error: error ?? null };
}

/**
 * auth 状態の変化を購読する。
 * useEffect 内で呼び出し、返り値の unsubscribe 関数を cleanup に渡す。
 *
 * @param {(event: string, session: import('@supabase/supabase-js').Session | null) => void} callback
 * @returns {() => void} unsubscribe 関数
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
