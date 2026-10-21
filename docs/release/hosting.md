# 無料静的配信・来歴・ロールバック

**この手順は準備のみ。外部公開・DNS変更・デプロイ有効化には所有者の別途承認が必要。**

## 候補と最新条件

2026-10-21にCloudflare公式資料を確認した。Pages Freeは月500ビルド、サイト20,000ファイル、1アセット25MiB。Direct Uploadのドラッグ&ドロップは1,000ファイル上限。利用条件/枠は公開直前にも再確認する。計算結果86MBは端末内生成のBlobであり配信アセットとしてアップロードしない。有料サービス・Functions・R2・DB・独自ドメイン購入は必要ない。

根拠：
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/rollbacks/

## ビルドと検証

1. 承認されたコミットを完全履歴でcheckout。浅いcloneなら `git fetch --unshallow origin`、必要ブランチ/タグもfetch。コードを含む作業ツリーをcleanにする。
2. `.nvmrc`のNodeを利用し `npm ci`、`npm run check`。
3. `node scripts/release/build.mjs`。shallow/dirty/来歴不一致なら停止する。Git IDを置換して通さない。
4. `.release/build-manifest.json`のsource_revision、application_git_revision、計算版、全distファイルSHA-256を保存。manifestはdist外に置き自己循環しない。ノード/仕様/データの来歴は既存メタデータのまま。public配信設定等はアプリ来歴とは別にsource_revisionとdistハッシュで追跡する。
5. scripts/release/static-smoke.mjsに一時的なTLS証明書/鍵を指定し、ローカルHTTPSでSPA/Worker/WebCrypto/CSP/保存を検証。これはCloudflareやiPad実機の代替証明ではない。
6. distにはindex、ハッシュ付きJS/CSS/Worker/実データ、favicon、帰属・ライセンス・_headersだけを許可。開発プレビュー・モック・秘密・ソースマップは出さない。

CIはfetch-depth:0で独立参照検算と本番成果物検証まで実行し、アップロードや自動デプロイは行わない。公開は検証済みdistと同じmanifestを所有者が保持してDirect Uploadする方式を推奨。これによりホスト側の浅いGit履歴で再ビルドする必要がない。新規Pagesプロジェクトを作る操作自体も今回は行わない。

## SPA・キャッシュ・HTTPS

ルート配置を前提とし、サブディレクトリ配信は未対応。Pages標準のSPAフォールバックを使用するためトップレベル404.htmlを置かない。/simulation、/results、/researchを直接開いてもindexへ到達。未知URLはReactの404画面（HTTPステータスは通常200、真のHTTP404とは区別）。再読み込みで結果は消えるとUIで説明する。

HTTPSはWebCryptoの前提。ブラウザのlocalhost特例を公開HTTPSの代わりにしない。Pages既定の再検証キャッシュを維持し、独自の長期キャッシュやService Workerを導入しない。更新時に古いタブでアセット取得が失敗したらエラーを表示し、保存済み出力を確保後に再読み込みして再実行する。異なる版の結果のハッシュ一致を約束しない。

公開承認後、実ホストで直接URL、TLS、各ヘッダー、Worker、0/100/50%、JSON/来歴/CSVダウンロード、出典リンク、未知URL、iPadを確認する。実配信ファイルのSHA-256をmanifestと照合し、確認に失敗した版は公開完了としない。

## ロールバックと更新

直前に検証済みのdist+manifest+ソースコミットを一組で保管する。問題時は所有者承認でPagesの既存成功デプロイへrollback、または同じ保管distを再アップロードする。設定/ヘッダーもその版に戻す。再ビルドで代用する場合は同一lock・Node・Git履歴で再検証しバイト差を記録する。戻した後にWorker/保存/来歴/ルーティングを再確認。データ更新は別版としてハッシュ・監査・数理適用範囲を見直し、原本を上書きしない。
