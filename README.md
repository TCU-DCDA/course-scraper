# AddRan Course Scraper

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

TCU term codes: `base = (academicYear - 1599)`, digit = `{fall: 7, spring: 3, summer: 5, wintersession: 1}`.
Academic year = fall's calendar year (Spring/Summer/Wintersession 2026 → academic year 2025).
Examples:
- Spring 2026 → academic year 2025 → `(2025 - 1599) = 426` → `4263`
- Fall 2025 → academic year 2025 → `(2025 - 1599) = 426` → `4257`
- Fall 2026 (draft) → use `--term 4267 --term-hint "26-fall-4267"` for unpublished semesters

See `lib/term-codes.mjs`.

## Generating Frequency Data

To build a course frequency JSON from multiple offerings files:

```bash
node -e "
const fs = require('fs');
const files = [
  { path: '../english-advising-wizard/src/data/offerings-fa25.json', term: 'Fall 2025' },
  { path: '../english-advising-wizard/src/data/offerings-sp26.json', term: 'Spring 2026' },
  { path: '../english-advising-wizard/src/data/offerings-fa26.json', term: 'Fall 2026' },
];
const terms = [], courses = {};
for (const { path, term } of files) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  terms.push(term);
  for (const code of data.offeredCodes) {
    if (!courses[code]) courses[code] = [];
    courses[code].push(term);
  }
}
const sorted = Object.fromEntries(Object.entries(courses).sort(([a],[b]) => a.localeCompare(b)));
fs.writeFileSync('../english-advising-wizard/src/data/course-frequency.json', JSON.stringify({ terms, courses: sorted }, null, 2));
"
```

This produces the format expected by the admin Frequency Tracker: `{ terms: string[], courses: Record<string, string[]> }`.
