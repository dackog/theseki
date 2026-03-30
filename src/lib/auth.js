// src/lib/auth.js
// Supabase Auth ユーティリティ — email/password 認証

import { supabase } from './supabase.js';

const _redirectTo = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

/**
 * 新規ユーザー登録。
 * Email Confirmations が ON の場合は session: null（確認メール送信）。
 * OFF の場合は session あり（即ログイン）。
 */
export async function signUp(email, password, nickname = '') {
  const trimmed = nickname.trim().slice(0, 20);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: trimmed ? { nickname: trimmed } : {},
      emailRedirectTo: _redirectTo(),
    },
  });
  return { user: data?.user ?? null, session: data?.session ?? null, error: error ?? null };
}

/**
 * メールアドレス + パスワードでログイン。
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error: error ?? null };
}

/**
 * パスワードリセットメールを送信する。
 * ユーザーがリンクをクリックすると /theseki/ に戻り、
 * onAuthStateChange で PASSWORD_RECOVERY イベントが発火する。
 */
export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: _redirectTo(),
  });
  return { error: error ?? null };
}

/**
 * パスワードを更新する（PASSWORD_RECOVERY セッション中に呼ぶ）。
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ?? null };
}

/**
 * 現在のユーザーをサインアウトする。
 * TheSEKI の localStorage (theseki_v2) には触れない（呼び出し側で clearState する）。
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error ?? null };
}

/**
 * 現在のセッションを取得する。
 * 初回マウント時に既存ログイン状態を確認するために使う。
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session ?? null, error: error ?? null };
}

/**
 * ニックネームを更新する（ログイン中に呼ぶ）。
 * user_metadata.nickname を上書きする。
 */
export async function updateNickname(nickname) {
  const trimmed = nickname.trim().slice(0, 20);
  const { data, error } = await supabase.auth.updateUser({ data: { nickname: trimmed } });
  return { user: data?.user ?? null, error: error ?? null };
}

/**
 * auth 状態の変化を購読する。
 * useEffect 内で呼び出し、返り値の unsubscribe 関数を cleanup に渡す。
 * PASSWORD_RECOVERY / SIGNED_IN / SIGNED_OUT などを検知できる。
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
