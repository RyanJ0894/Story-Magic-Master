# Test Scripts

Ryan's curated sample scripts for pipeline testing and corpus ingestion.

**Source:** Ryan Jae — working/Sample Test Scripts/  
**Last synced:** 2026-05-26

---

## Scripts

| File | Pages | Project | Notes |
|------|-------|---------|-------|
| ANSWERS - 1 Page Sample 1.0.pdf | 1 | ANSWERS | Minimal smoke test |
| ANSWERS - 1 Page Sample 2.0.pdf | 1 | ANSWERS | Minimal smoke test (variant) |
| DIG - 1.5 Page Sample 1.0.pdf | 2 | DIG | Short smoke test |
| Amnesia - 3 Page Sample 1.0.pdf | 3 | Amnesia | Short integration test |
| Amnesia - 3 Page Sample 2.0.pdf | 3 | Amnesia | Short integration test (variant) |
| ANSWERS - 3 Page Sample 2.0.pdf | 3 | ANSWERS | Short integration test |
| DIG - 3 Page Sample 1.0.pdf | 3 | DIG | Short integration test |
| Amnesia - 4 Page Sample 1.0.pdf | 4 | Amnesia | Medium test (confirmed working) |
| Amnesia - 4 Page Sample 2.0.pdf | 4 | Amnesia | Medium test (variant) |
| ANSWERS - 4 Page Sample 1.0.pdf | 4 | ANSWERS | Medium test (confirmed working) |
| ANSWERS - 5 Page Sample 1.0.pdf | 5 | ANSWERS | Medium-large test |
| DIG - First 15 Pages.pdf | 14 | DIG | Long-form boundary test |

## Usage

### Corpus ingestion (batch)
These scripts are for populating the StoryScore calibration corpus.
Trigger at: https://storymagicapp.net/admin/corpus → "Ingest PDFs"

### E2E pipeline test (manual)
Upload any 1–4 page script via the dashboard for a quick smoke test.
Use a 14-page script to validate the chunking pipeline.

### Automated regression
```bash
# From story-magic/
./scripts/smoke-test.sh test-scripts/ANSWERS\ -\ 1\ Page\ Sample\ 1.0.pdf
```

## Status of longer scripts
- ≤5 pages: confirmed working (pre-Anthropic key rotation)
- 14 pages: to be confirmed after Anthropic key fix (2026-05-26)
- 100+ pages: blocked pending chunking diagnosis
