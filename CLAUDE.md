# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (TypeScript/React)
```bash
npm install          # install dependencies
npm run dev          # start Vite dev server
npm run build        # tsc -b && vite build (type-check + bundle)
npm run test         # run all Vitest tests once
npm run test:watch   # run Vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/validation/runValidation.test.ts
```

### Python CLI
```bash
python3 scd_validator.py --input path/to/file.scd --out-dir ./out
python3 -m pytest tests/ -v           # all Python tests
python3 -m pytest tests/test_integration.py::test_iec001 -v  # single test
```

## Architecture

This is a dual-stack project: a **React/TypeScript browser app** and a **Python CLI** that share the same IEC 61850 SCD/SCL parsing and validation domain.

### TypeScript frontend

**Data flow:** `File → parseSclDocument() → SclModel → UI state → rendered panels`

- `src/parser/sclParser.ts` — parses SCD XML into `SclModel` (ieds, subNetworks, gseControls, svControls, edges, substations, dataTypeTemplates, etc.)
- `src/model/types.ts` — all TypeScript domain types; the `SclModel` interface is the central data structure
- `src/state/uiStore.tsx` — React context holding selection/focus/filter state (IED filter, protocol, direction, depth, search)
- `src/state/validationStore.tsx` — React context holding validation issues + sub-view state
- `src/state/useModelValidation.ts` — triggers `runValidation()` + `runLandsnetValidation()` whenever model changes; writes issues to both stores

**Validation pipeline (TypeScript):**
- `src/validation/validators.ts` — orchestrates all rule runners; deduplicates issues by ID
- `src/validation/rules/` — generic structural rules: `identityRules`, `communicationRules`, `gooseRules`, `controlBlockRules` (kept minimal — duplicate checks were removed in V2 to avoid overlapping with LNET codes)
- `src/validation/landsnet/checks.ts` — **27 checks**: LNET_001–018 (Landsnet site rules) + IEC_001–009 (general IEC 61850); `checkCode()` maps check IDs to codes
- `src/validation/landsnet/runLandsnetValidation.ts` — entry point; returns `LandsnetValidationReport`
- `src/validation/landsnet/buildDictionaries.ts` — builds MMS/GOOSE/SV dictionaries from model for check logic

**UI layout (V2 dark-pro three-pane):**
- `src/App.tsx` — always-visible `ThreePaneLayout`; center panel has icon-based view switcher (`appMode` drives Graph ⬡ / Validation ✓ / Compare ⟷ / Network ⋯ / Statistics ≡)
- `src/components/SubstationTree.tsx` — left pane; shows Substation→VoltageLevel→Bay→IED hierarchy with inline ✓/✗N validation status; falls back to flat IED list when no substation section present
- `src/components/ValidationMatrix.tsx` — center pane for Validation/Matrix sub-view; 27-check × IED grid
- `src/components/GraphCanvas.tsx` — ReactFlow graph (center pane, Graph mode)
- `src/components/InspectorPanel.tsx` — right pane; Summary/Dataset/Diff/XML tabs for selected IED/edge/control block
- `src/components/ThreePaneLayout.tsx` — drag-resizable three-pane layout, widths persisted to localStorage

**Design system:**
- `src/design-tokens.css` — single source of truth for all CSS variables (dark-pro palette: bg `#0f172a`, surface `#1e293b`, accent `#38bdf8`, protocol colors `--goose`, `--sv`, `--mms`)
- `src/styles.css` — imports design tokens; all component styles live here (no CSS modules)

### Python CLI

- `scd_parser.py` — parses SCD XML into `ParseOutput` dataclass using `xml.etree.ElementTree`
- `scd_validations.py` — **27 checks**: LNET_001–018 + IEC_001–009; loads thresholds from `validation_config.json` at runtime
- `scd_validator.py` — CLI entry point; exit codes: 0=OK, 1=validation errors, 2=parse/IO error; uses `logging` not `print`
- `scd_export.py` — writes CSV outputs
- `validation_config.json` — GOOSE/SV VLAN/timing thresholds (Landsnet defaults); edit here rather than in code
- `scd_utils.py` — IP/MAC/APPID helper functions

**Python tests:** `tests/test_integration.py` (38 tests) covers parse→validate→export pipeline end-to-end.

### Validation rule codes

All issues must use `LNET_XXX` or `IEC_XXX` codes — not generic codes like `DUPLICATE_IED_NAME`. The TypeScript generic rule files (`identityRules`, `communicationRules`, `gooseRules`) were trimmed in V2 to remove checks already covered by LNET codes.

| Prefix | Range | Scope |
|--------|-------|-------|
| `LNET_` | 001–018 | Landsnet site-specific rules |
| `IEC_`  | 001–009 | General IEC 61850 structural checks |

### Compare mode

- `src/diff/` — `buildIndex.ts` indexes model entities; `computeDiff.ts` produces `DiffReport` with changes (added/modified/removed); `applyDiffDecorations.ts` annotates graph nodes

### Export

- `src/utils/exportCsv.ts` — GOOSE matrix, detailed flows, protocol summary, changes, validation CSV
- `src/utils/exportExcel.ts` — Excel workbook with sheets: IP Address, Report/GOOSE/SMV Signals + Overviews, Export issues; uses `xlsx` library; honours `ExportSheetsOption` (`all` | `ip_only` | `signals_only`)
- `src/utils/exportLandsnetJson.ts` — Landsnet compliance JSON export
