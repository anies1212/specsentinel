# SpecSentinel (MVP)

SpecSentinel は、Flutter の widget test で抽出した実装仕様と、Figma REST API から取得したデザイン仕様を比較し、ズレを CI で検知する OSS ツールです。TypeScript 製 CLI と GitHub Action を中心に構成され、PR コメントに含まれる Figma リンクをトリガーに自動検証します。

## アーキテクチャ概要
- mono-repo: `packages/specsentinel-cli` (CLI) / `packages/specsentinel-action` (GitHub Action) / `examples/flutter_app` (Flutter サンプル)
- Flutter 側にはラッパー Widget を追加せず、widget test が JSON を吐き出すのみ
- CLI フロー: Flutter widget test 実行 → JSON 読み込み → Figma API 取得 → 差分比較 → 非ゼロ終了で CI に通知
- GitHub Action フロー: PR コメント内の `figma-spec:` 行を解析し、CLI を呼び出して結果でジョブ成否を決定

## JSON モデル (Flutter 出力)
```json
{
  "screenName": "LoginPage",
  "texts": [
    { "text": "ログイン", "fontSize": 20 },
    { "text": "メールアドレス", "fontSize": 14 }
  ],
  "paddings": [
    { "left": 16, "top": 24, "right": 16, "bottom": 24 }
  ],
  "gaps": [
    { "height": 8, "width": null },
    { "height": 16, "width": null }
  ]
}
```
TypeScript 定義: `TextSpec`, `PaddingSpec`, `GapSpec`, `ScreenSpec` を `packages/specsentinel-cli/src/types.ts` に定義。

## CLI 使い方 (packages/specsentinel-cli)
```
cd packages/specsentinel-cli
npm install
npm run build
FIGMA_TOKEN=xxxxx npx specsentinel check \
  --screen LoginPage \
  --figma-file <FILE_KEY> \
  --figma-node <NODE_ID> \
  --flutter-test ../../examples/flutter_app/test/spec/login_page_spec.dart \
  --output ../../examples/flutter_app/build/specsentinel/LoginPage.json \
  --cwd ../../examples/flutter_app
```
処理内容:
1) `flutter test` を実行（指定テストが JSON を保存）
2) JSON を `ScreenSpec` として読み込み
3) Figma REST API (`/v1/files/{fileKey}/nodes?ids={nodeId}`) をコールし、TEXT/auto-layout padding/itemSpacing を抽出
4) Actual と Expected を比較し、差分を stderr に列挙。差分があれば `<output>.diff.json` を生成し非ゼロ終了

## GitHub Action 使い方 (packages/specsentinel-action)
`packages/specsentinel-action/action.yml` を参照。
PR コメント例:
```
figma-spec: LoginPage https://www.figma.com/file/XXXXX?node-id=1234-567
```
Action はコメントをパースし、以下を自動補完して CLI を呼びます。
- `--screen` = `LoginPage`
- `--figma-file` = `XXXXX`
- `--figma-node` = `1234-567`
- `--flutter-test` (input 既定: `test/spec/login_page_spec.dart`)
- `--output` (input 既定: `build/specsentinel/output.json`)

`.github/workflows/specsentinel.yml` 例:
```yaml
name: SpecSentinel
on:
  issue_comment:
    types: [created]
jobs:
  specsentinel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dart-lang/setup-dart@v1
      - uses: subosito/flutter-action@v2
      - name: Install dependencies
        run: npm install
      - name: Run SpecSentinel
        uses: ./packages/specsentinel-action
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
        with:
          working-directory: examples/flutter_app
          flutter-test: test/spec/login_page_spec.dart
          output: build/specsentinel/LoginPage.json
```

## Flutter 側サンプル
- 画面: `examples/flutter_app/lib/login_page.dart`
- テスト: `examples/flutter_app/test/spec/login_page_spec.dart`
  - `tester.widgetList` で Text/ Padding/ SizedBox を列挙し、`build/specsentinel/LoginPage.json` を生成

## 制約と拡張案
- 現状はインデックス順比較（並び順差異は検出不可）
- Figma 解析は TEXT / auto-layout padding / itemSpacing のみを簡略抽出
- フォントサイズ比較は完全一致（必要に応じて許容誤差を拡張可能）
- 今後: レイアウト階層のマッチング、色/weight/line-height 等の比較、差分レポートの HTML 化、コメント返信ボット追加、複数画面バッチ処理など

## 環境変数
- `FIGMA_TOKEN`: Figma Personal Access Token (required)
