# SpecSentinel (MVP)

SpecSentinel compares Flutter UI specs (exported from widget tests) with design specs from the Figma REST API to catch padding/gap/font/text mismatches in CI. It ships as a TypeScript CLI plus a GitHub Action that is triggered by PR comments containing Figma links.

## Architecture
- Monorepo layout: `packages/specsentinel-cli` (CLI) / `packages/specsentinel-action` (GitHub Action) / `examples/flutter_app` (Flutter sample).
- No Flutter wrapper widgets are required; a widget test writes a JSON spec.
- CLI flow: run Flutter test → read JSON → call Figma API → compare → exit non-zero on diffs.
- GitHub Action flow: parse `figma-spec:` PR comment → invoke CLI with parsed file/node → mark job success/failure based on comparison.

## JSON model (Flutter output)
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
TypeScript definitions live in `packages/specsentinel-cli/src/types.ts`: `TextSpec`, `PaddingSpec`, `GapSpec`, `ScreenSpec`.

## CLI usage (`packages/specsentinel-cli`)
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
Flow:
1) Runs `flutter test` (the provided test writes the JSON spec).
2) Reads JSON into `ScreenSpec`.
3) Calls Figma REST API (`/v1/files/{fileKey}/nodes?ids={nodeId}`) to extract TEXT nodes, auto-layout padding, and itemSpacing.
4) Compares actual vs expected, prints diffs to stderr, writes `<output>.diff.json`, and exits non-zero on mismatch.

## GitHub Action usage (`packages/specsentinel-action`)
See `packages/specsentinel-action/action.yml`.
PR comment example:
```
figma-spec: LoginPage https://www.figma.com/file/XXXXX?node-id=1234-567
```
Action parses the comment and calls the CLI with:
- `--screen` = `LoginPage`
- `--figma-file` = `XXXXX`
- `--figma-node` = `1234-567`
- `--flutter-test` default: `test/spec/login_page_spec.dart`
- `--output` default: `build/specsentinel/output.json`

Workflow example (`.github/workflows/specsentinel.yml`):
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

## Flutter sample
- Screen: `examples/flutter_app/lib/login_page.dart`
- Widget test: `examples/flutter_app/test/spec/login_page_spec.dart` uses `tester.widgetList` to gather `Text`/`Padding`/`SizedBox` and write `build/specsentinel/LoginPage.json`.

## Limitations and future work
- Current comparison is index-based (ordering differences are not handled).
- Figma parsing is simplified to TEXT / auto-layout padding / itemSpacing.
- Font-size comparison is strict equality (tolerance could be added).
- Future ideas: layout tree matching, color/weight/line-height checks, HTML diff reports, reply comments, batch multiple screens.

## Env vars
- `FIGMA_TOKEN`: Figma Personal Access Token (required).
