# @anies1212/specsentinel

SpecSentinel compares Flutter UI specs (static Dart source parsing) with Figma design specs. This package provides the CLI.

## Install
```
npm install -g @anies1212/specsentinel
```
or use without global install:
```
npx @anies1212/specsentinel check ...
```

## Usage
```
FIGMA_TOKEN=xxxxx npx @anies1212/specsentinel check \
  --screen LoginPage \
  --figma-file <FILE_KEY> \
  --figma-node <NODE_ID> \
  --mode static \
  --output-dir build/specsentinel \
  --cwd <project-root>
```
- Static only: parses `lib/**/<screen>.dart` for literal Text/Padding/SizedBox values and writes `<output-dir>/<screen>.json`.
- Fetches Figma via `/v1/files/{fileKey}/nodes?ids={nodeId}` and compares; writes `<output-dir>/<screen>.diff.json` on mismatch.

## Required env
- `FIGMA_TOKEN`: Figma Personal Access Token.

## License
MIT
