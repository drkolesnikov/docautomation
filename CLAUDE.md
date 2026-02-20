# CLAUDE.md — ПНД.doc Clinical Documentation Automation

## Project Overview

React-based web tool for Russian psychiatric outpatient clinics (психоневрологический диспансер).
Transforms free-text clinical notes into structured, properly formatted Russian psychiatric
documentation ready for medical records.

**No backend. No data storage. Local processing only.**

## Target User

Psychiatrists in Russian dispensaries who produce standardized documentation from clinical observations.

## Document Types

| Code | Name | Description |
|------|------|-------------|
| `pervichny` | Первичный осмотр | Initial psychiatric examination |
| `povtorny` | Повторный осмотр | Follow-up examination |
| `vk` | Врачебная комиссия (ВК) | Medical board assessment |
| `msek` | МСЭК | Medical-social expert commission |

## Tech Stack

- React (functional components + hooks only)
- No backend, no database, no external API calls
- Plain textarea input → structured document output
- Must work offline (clinic environments have limited infrastructure)

## Core Workflow

1. Clinician types free-form notes in Russian into a textarea
2. Tool parses and maps content to required documentation fields
3. Output renders as a properly structured document in standard Russian psychiatric format
4. Clinician copies output into their medical records system

## Key Constraints

- **All UI text and output must be in Russian**
- **Output must follow official Russian psychiatric documentation standards**
- **No patient data stored or transmitted** — purely local, in-browser processing
- **Offline-capable** — avoid CDN dependencies or runtime network calls
- **No backend** — this is a pure frontend tool

## Code Style

- Functional React components with hooks (`useState`, `useCallback`, etc.)
- Keep components small and single-purpose
- Comments on non-obvious logic are welcome in Russian or English
- Avoid over-engineering: no Redux, no complex state management unless clearly needed

## Output Format Requirements

Generated documents must match standard Russian psychiatric records formatting:
- Formal Russian medical register language
- Proper section headers matching official form structure for each document type
- Dates in `DD.MM.YYYY` format
- Age expressed as `лет/год/года` (correct grammatical form)
- Diagnoses using ICD-10 codes with Russian names

## Development Notes

- When adding a new document type, follow the existing pattern for parsers and templates
- Parser logic (free text → fields) and template logic (fields → formatted output) should stay separated
- Test with realistic Russian clinical note examples, not placeholder Latin text
