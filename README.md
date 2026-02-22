# TCU Course Scraper

CLI tool that scrapes [classes.tcu.edu](https://classes.tcu.edu) for semester course offerings. Generates `offerings-{term}.json` files used by the English and DCDA advising wizards.

## Usage

```bash
node scrape.mjs --term <term> [--subjects <list>] [--attribute <attr>] [--out <file>]
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--term` | `-t` | Term name or code (e.g. `"Spring 2026"` or `"4263"`) |
| `--subjects` | `-s` | Comma-separated subject prefixes (e.g. `"ENGL,CRWT,WRIT"`) |
| `--attribute` | `-a` | Class attribute code (e.g. `"DCDA"`) |
| `--out` | `-o` | Output file path (omit for stdout) |
| `--max-level` | `-l` | Max course number to include (e.g. `"49999"` for undergrad only) |
| `--all-sections` | | Keep all individual sections (don't collapse multi-section courses) |
| `--csv` | | Output CSV instead of JSON |
| `--dry-run` | | Print output to stdout, don't write file |

### Examples

**English wizard** (collapsed, undergrad only):
```bash
node scrape.mjs -t "Spring 2026" -s ENGL,CRWT,WRIT -l 49999 \
  -o ../english-advising-wizard/src/data/offerings-sp26.json
```

**DCDA wizard** (all sections, using DCDA attribute filter):
```bash
node scrape.mjs -t "Spring 2026" -a DCDA --all-sections \
  -o ../dcda-advising-wizard/data/offerings-sp26.json
```

**Dry run with CSV output:**
```bash
node scrape.mjs -t "Fall 2026" -s ENGL --csv --dry-run
```

## Output Format (JSON)

```json
{
  "term": "Spring 2026",
  "updated": "2026-02-22",
  "offeredCodes": ["ENGL 10103", "ENGL 10803", ...],
  "sections": [
    {
      "code": "ENGL 10103",
      "title": "Introductory Writing Seminar",
      "modality": "In Person",
      "status": "Open",
      "sectionCount": 12
    }
  ]
}
```

With `--all-sections`, each section is its own entry with `section`, `schedule`, and `enrollment` fields instead of `sectionCount`.

## How It Works

1. **GET** `classes.tcu.edu/psc/...` to obtain ASP.NET-style ViewState tokens and term dropdown values
2. **POST** with form fields (term code, subject/attribute filters) to retrieve the results table
3. **Parse** the HTML results table with Cheerio, extracting course code, title, section, schedule, modality, status, enrollment, and core codes
4. **Normalize** statuses: "Dept Permit" and "Instr Permit" become "Closed" (manifest schema only allows Open/Closed/Waitlist)
5. **Collapse** multi-section courses into a single entry with `sectionCount` (default) or keep all sections (`--all-sections`)

## Project Structure

```
scrape.mjs           # CLI entry point
lib/
  term-codes.mjs     # Term name ↔ code conversion (e.g. "Spring 2026" → "4263")
  fetcher.mjs        # HTTP GET/POST to classes.tcu.edu
  parser.mjs         # Cheerio HTML table parser
```

## Term Code Formula

TCU term codes: `base = (academicYear - 1599)`, digit = `{fall: 1, spring: 3, summer: 5}`.
Academic year = fall's calendar year (Spring/Summer 2026 → academic year 2025).
Example: Spring 2026 → academic year 2025 → `(2025 - 1599) = 426` → `4263`. See `lib/term-codes.mjs`.
