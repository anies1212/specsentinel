# SpecSentinel (MVP)

SpecSentinel compares Flutter UI specs (exported from widget tests) with design specs from the Figma REST API to catch padding/gap/font/text mismatches in CI. It ships as a TypeScript CLI plus a GitHub Action that is triggered by PR comments containing Figma links.

## Architecture
- Monorepo layout: `packages/specsentinel-cli` (CLI) / `packages/specsentinel-action` (GitHub Action) / `examples/flutter_app` (Flutter sample).
- Static-only in this revision: CLI parses Dart sources to emit specs; no test execution is required.
- CLI flow: parse Dart source → call Figma API → compare → exit non-zero on diffs.
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
  --mode static \
  --output-dir ../../examples/flutter_app/build/specsentinel \
  --cwd ../../examples/flutter_app
```
Flow (static only):
1) Parses Dart source (default `lib/**/<screen>.dart`) to extract literal Text/Padding/SizedBox values and writes `<output-dir>/<screen>.json`.
2) Calls Figma REST API (`/v1/files/{fileKey}/nodes?ids={nodeId}`) to extract TEXT nodes, auto-layout padding, and itemSpacing.
3) Compares actual vs expected, prints diffs to stderr, writes `<output-dir>/<screen>.diff.json`, and exits non-zero on mismatch.

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
- `--mode` default: `static`
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

      - name: Run SpecSentinel
        uses: ./packages/specsentinel-action
        with:
          figma-token: ${{ secrets.FIGMA_TOKEN }}
          output-dir: build/specsentinel
          working-directory: examples/flutter_app
          mode: static
```

## Flutter sample
- Screen: `examples/flutter_app/lib/login_page.dart`
- Static mode: SpecSentinel parses `lib/login_page.dart` for literal Text/Padding/SizedBox values when run with `--mode static` (dynamic values are ignored). Add more screens by creating corresponding Dart files in `lib/**/`.

## Limitations and future work
- Current comparison is index-based (ordering differences are not handled).
- Figma parsing is simplified to TEXT / auto-layout padding / itemSpacing.
- Font-size comparison is strict equality (tolerance could be added).
- Future ideas: layout tree matching, color/weight/line-height checks, HTML diff reports, reply comments, batch multiple screens.

## Env vars
- `FIGMA_TOKEN`: Figma Personal Access Token (required).
