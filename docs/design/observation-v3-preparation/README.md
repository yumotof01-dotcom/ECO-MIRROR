# Observation Interface V3 準備状況：画像未受領

## 完成判定
未完了。今回受領できた添付は指示テキストのみ。指定の森林・水膜・横長水滴のPNGはattachments/shared/library-filesを含めて見つからず、代替画像・架空のURLを設定していない。現時点のUIは保存済みV2のままであり、画像素材版V3として完成したとは扱わない。

必要ファイル：image(6).png（または同一のimage(7).png）、image(8).png、image(9).png。依頼文上のサイズは1672×941、1086×1448、1774×887だが、実ファイルの寸法・アルファ・容量・出典はまだ検証していない。再添付後、原本ハッシュ・重複・透明度・圧縮画質を確認してから導入する。水膜のダミー表示枠は除去または輪郭マスク化し、正式情報はReactで描く。科学計算に画像の内容を混ぜない。

## 環境と旧作業の保全
クラウド環境は復旧し、旧ローカル14c6c32/fd22a20、feat/observation-droplet-v2、/tmp/eco-droplet-v2の画像と記録の残存を確認した。旧水滴デザインの方針は撤回済みであり採用しない。

旧チェックアウトとブランチは変更・削除せず、/workspace/backups/eco-mirror-droplet-recovery/へ完全履歴bundleと画像を保全。git bundle verify成功。recovery.jsonはその記録であり、bundleそのものは新アプリへ混入させない。

新作業場所は/workspace/ECO-MIRROR-observation-v3。新ブランチfeat/observation-interface-v3-image-assetsはGitHub保存済みV2の73762fcbfb66091009776f705330d61a466138ffから作成した。14c6c32は新ブランチの祖先ではない。旧水滴のテスト修正も自動cherry-pickしていない。

開始時のGitHub：main b558a1e、PR #11 open、PR #12 open/head73762fc/base chore/phase-12-release-readiness。新PRのbaseはfeat/observation-interface-v2。mainへのpush・無断マージ・公開は行わない。

## 互換テストの修正
既存scripts/release/extended-browser.mjsは旧ホーム導線の完全一致名を使い、V2の長いリンク名でtimeoutしていた。さらに、詳細条件dialogを閉じずに背面ナビへ移動する手順と、空間比較画面で旧分析見出しを待つ手順を持っていた。

修正はテストの操作経路だけ：
- ホーム導線を現在の表示名に対応する先頭一致で選択。
- dialogの表示完了を待ち、閉じてからナビへ移動。
- 詳細条件の表示と実行後URLを待機。
- 統計・二部比較・正式保存を持つ「記録」モードへ移動して元の検証を実施。

アサーション、全試行、期待ハッシュ、資源寿命、0/100%ケースは削除・スキップしていない。アプリのソース・データ・数理仕様・依存はV2と同一。

## 検証結果
Node24.19.0/npm11.9.0、Git完全履歴。
- npm ci：成功。
- data:check：全3882件・原本/生成物/来歴一致。
- npm test：24ファイル316件成功。
- npm run build / npm run check：成功。
- 修正後互換スクリプト：Chromiumで5条件成功（R2/100/1000、0/50/100%）、正式JSONハッシュ一致、取消後Worker/URL0、pageerror0。
- 原データ、src、数理仕様、package/lockの差分なし。これはV2基盤の検証であり、未受領画像の表示・透過・加工・V3レスポンシブ成功を示さない。

WebKit取得はPlaywright公式のcdn.playwright.devとplaywright.download.prss.microsoft.comが403 Domain forbiddenで失敗。TLS・チェックサム検証は無効化していない。必要な2ドメイン追加は環境設定の下書きへ保存したが、ランタイム反映は未確認。実機iPad/Safariと画像素材版のWebKitは未検証。

PR #12の既存CIはrun40056789055のwebkit失敗が確認されていた。今回テスト経路の問題はChromiumで修正・再検証したが、WebKit成功やGitHub CI全体成功とは呼ばない。

## 再開時
画像3点を実際に受領し、まず目視・寸法・アルファ・重複・ライセンス/提供元を記録する。旧SVG水滴案を正式画像として復元しない。3画像の導入、読み込み失敗時の操作、ダミー枠除去、各端末サイズ、正式JSON再現を検証してからUI実装と証跡を別コミットで保存する。
