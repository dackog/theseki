// src/components/PrivacyPage.jsx
import { useEffect } from 'react';
import AppFooter from './AppFooter.jsx';

export default function PrivacyPage() {
  useEffect(() => {
    // モバイルのoverflow:hidden設定を解除してスクロール可能にする
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
  }, []);

  return (
    <div style={{ background: 'var(--paper-warm)', minHeight: '100dvh' }}>
      <div className="policy-page">
        <div className="policy-content">
          <a href="#" className="policy-back-btn">← 一覧へ戻る</a>

          <h1>プライバシーポリシー</h1>

          <p>
            「The SEKI」（以下「本サービス」といいます）は、本サービスにおける利用者の個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>

          <h2>1. 取得する情報の種類</h2>
          <p>本サービスでは、以下の情報を取得・保存する場合があります。</p>
          <ul>
            <li>
              <strong>利用者が入力する情報</strong>：イベント名、参加者氏名、座席レイアウト、席割結果、NGペア情報など、利用者が本サービスに入力するすべてのデータ
            </li>
            <li>
              <strong>アカウント情報</strong>：メールアドレス、パスワード（暗号化済み）、ニックネーム（アカウント登録を行った場合）
            </li>
            <li>
              <strong>ブラウザ保存データ</strong>：本サービスはイベントデータをブラウザの localStorage に保存します（詳細は「4. 保存方法」参照）
            </li>
            <li>
              <strong>URL共有データ</strong>：共有リンク機能を利用した場合、イベントデータが Base64 エンコードまたはデータベース上のIDとしてURLに含まれます
            </li>
            <li>
              <strong>アクセス情報</strong>：サービス改善のため、ブラウザの種類・OS・アクセス日時等の技術情報を取得する場合があります
            </li>
          </ul>

          <h2>2. 利用目的</h2>
          <p>取得した情報は、以下の目的のために利用します。</p>
          <ul>
            <li>本サービスの提供・運営（席割機能、イベント管理機能の実現）</li>
            <li>クラウド同期機能の提供（ログイン済みの場合、データを安全に保存・復元するため）</li>
            <li>アカウント認証およびパスワード管理</li>
            <li>サービスの品質改善・不具合対応</li>
            <li>利用規約違反への対応</li>
          </ul>

          <h2>3. 第三者への提供</h2>
          <p>
            運営者は、以下の場合を除き、利用者の情報を第三者に提供しません。
          </p>
          <ul>
            <li>
              <strong>Supabase（データ処理委託先）</strong>：本サービスはデータベース・認証基盤として Supabase を利用しています。イベントデータおよびアカウント情報は Supabase のサーバーに保存されます。Supabase のプライバシーポリシーは Supabase 社の定めに従います。
            </li>
            <li>法令に基づき開示が必要な場合</li>
            <li>人の生命・身体・財産の保護のために必要で、本人の同意を得ることが困難な場合</li>
            <li>将来的に他の外部サービスとの連携を行う場合は、改めてお知らせします</li>
          </ul>

          <h2>4. 保存方法</h2>
          <ul>
            <li>
              <strong>ブラウザ（localStorage）</strong>：イベントデータはお使いのブラウザの localStorage に保存されます。ブラウザのキャッシュ・サイトデータを削除することで、このデータは消去されます。
            </li>
            <li>
              <strong>クラウド（Supabase）</strong>：アカウント登録・ログインを行った場合、イベントデータは Supabase のデータベースにも保存され、複数デバイス間での同期が可能になります。
            </li>
            <li>
              <strong>共有URL</strong>：「共有リンク」機能を利用した場合、リンクを知っている人誰でもイベントデータを閲覧できます。機密性の高い情報の入力はお控えください。
            </li>
          </ul>

          <h2>5. セキュリティ</h2>
          <p>
            運営者は、情報への不正アクセス・紛失・破損・改ざん等を防止するため、合理的なセキュリティ対策を講じます。ただし、インターネット上での完全な安全性を保証することはできません。利用者自身も適切なパスワード管理を行ってください。
          </p>

          <h2>6. ユーザーの権利</h2>
          <ul>
            <li>
              <strong>ローカルデータの削除</strong>：ブラウザの「サイトデータを削除」機能により、localStorage に保存されたデータを削除できます。
            </li>
            <li>
              <strong>アカウントデータの削除</strong>：クラウドに保存されたデータの削除をご希望の場合は、下記お問い合わせ先までご連絡ください。
            </li>
            <li>
              <strong>情報の訂正</strong>：ご自身のイベントデータはサービス内で直接編集・削除できます。
            </li>
          </ul>

          <h2>7. Cookie・トラッキング</h2>
          <p>
            現時点において、本サービスは広告目的のCookieやトラッキングツールを使用していません。将来的に導入する場合は、本ポリシーを改定の上お知らせします。
          </p>

          <h2>8. プライバシーポリシーの変更</h2>
          <p>
            運営者は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは本サービス上に掲載した時点で効力を生じます。重要な変更を行う場合は、サービス上でお知らせします。
          </p>
        </div>

        <AppFooter />
      </div>
    </div>
  );
}
