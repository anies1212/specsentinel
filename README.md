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
  --output-dir ../../examples/flutter_app/build/specsentinel \
  --cwd ../../examples/flutter_app
```
Flow:
1) Runs `flutter test` for the screen’s `_test.dart`. If no `--flutter-test-path` is given, SpecSentinel searches `test/**/<screen>_test.dart` (screen lowercased snake_case) under the working directory.\n+2) Reads `<output-dir>/<screen>.json` into `ScreenSpec` (tests are expected to write there themselves).\n+3) Calls Figma REST API (`/v1/files/{fileKey}/nodes?ids={nodeId}`) to extract TEXT nodes, auto-layout padding, and itemSpacing.\n+4) Compares actual vs expected, prints diffs to stderr, writes `<output-dir>/<screen>.diff.json`, and exits non-zero on mismatch.

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
- Locates `test/**/login_page_test.dart` automatically (or you can pass `--flutter-test-path` to override)
- `--output-dir` from input (default `build/specsentinel`)

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
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1

      - uses: subosito/flutter-action@fd55f4c5af5b953cc57a2be44cb082c8f6635e8e # v2.21.0
      - name: Install dependencies
        run: npm install
      - name: Run SpecSentinel
        uses: ./packages/specsentinel-action
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          figma-token: ${{ secrets.FIGMA_TOKEN }}
          output-dir: build/specsentinel
          working-directory: examples/flutter_app
```

## Flutter sample
- Screen: `examples/flutter_app/lib/login_page.dart`
- Widget test: `examples/flutter_app/test/login_page_test.dart` writes `build/specsentinel/LoginPage.json`. Add more screens by creating corresponding `<screen>_test.dart` files that emit specs to the same output dir.

## Limitations and future work
- Current comparison is index-based (ordering differences are not handled).
- Figma parsing is simplified to TEXT / auto-layout padding / itemSpacing.
- Font-size comparison is strict equality (tolerance could be added).
- Future ideas: layout tree matching, color/weight/line-height checks, HTML diff reports, reply comments, batch multiple screens.

## Env vars
- `FIGMA_TOKEN`: Figma Personal Access Token (required).
