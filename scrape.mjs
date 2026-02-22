#!/usr/bin/env node

// Usage:
//   node scrape.mjs --term "Spring 2026" --attribute DCDA --out ../dcda-advising-wizard/data/offerings-sp26.json
//   node scrape.mjs --term "Summer 2026" --subjects ENGL,CRWT,WRIT --out ../english-advising-wizard/src/data/offerings-su26.json
//   node scrape.mjs --term "Fall 2026" --subjects ENGL --dry-run

import { parseArgs } from 'node:util'
import { writeFileSync } from 'node:fs'
import { parseTerm } from './lib/term-codes.mjs'
import { getInitialTokens, searchCourses } from './lib/fetcher.mjs'
import { parseResultsTable } from './lib/parser.mjs'

const { values } = parseArgs({
  options: {
    term: { type: 'string', short: 't' },
    subjects: { type: 'string', short: 's' },
    attribute: { type: 'string', short: 'a' },
    out: { type: 'string', short: 'o' },
    'max-level': { type: 'string', short: 'l' },
    'all-sections': { type: 'boolean' },
    csv: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help || !values.term) {
  console.log(`TCU Course Scraper

Usage: node scrape.mjs --term <term> [--subjects <list>] [--attribute <attr>] [--out <file>]

Options:
  -t, --term       Term name or code (e.g. "Spring 2026" or "4263")
  -s, --subjects   Comma-separated subject prefixes (e.g. "ENGL,CRWT,WRIT")
  -a, --attribute  Class attribute code (e.g. "DCDA")
  -o, --out        Output file path (omit for stdout)
  -l, --max-level  Max course number to include (e.g. "49999" for undergrad only)
  --all-sections   Keep all individual sections (don't collapse multi-section courses)
  --csv            Output CSV instead of JSON
  --dry-run        Print JSON/CSV to stdout, don't write file
  -h, --help       Show this help

Examples:
  node scrape.mjs -t "Spring 2026" -a DCDA -o ../dcda-advising-wizard/data/offerings-sp26.json
  node scrape.mjs -t "Summer 2026" -s ENGL,CRWT,WRIT -l 49999 -o offerings.json
  node scrape.mjs -t "Fall 2026" -s ENGL --dry-run`)
  process.exit(values.help ? 0 : 1)
}

async function main() {
  const term = parseTerm(values.term)
  console.error(`Term: ${term.label} (code: ${term.code})`)

  // Build search queries
  const queries = []
  if (values.subjects) {
    for (const subj of values.subjects.split(',')) {
      queries.push({ subject: subj.trim(), attribute: '' })
    }
  }
  if (values.attribute) {
    queries.push({ subject: '', attribute: values.attribute.trim() })
  }
  if (queries.length === 0) {
    console.error('Error: provide --subjects and/or --attribute')
    process.exit(1)
  }

  // Execute searches
  const allSections = []
  for (const query of queries) {
    const label = query.subject || `attribute:${query.attribute}`
    console.error(`Searching: ${label}...`)

    // Fresh GET+POST per query (safest for ViewState)
    const tokens = await getInitialTokens()

    // Validate term code
    if (!tokens.termOptions.some(o => o.value === term.code)) {
      console.error(`Warning: term code ${term.code} not found in dropdown.`)
      console.error('Available:', tokens.termOptions.map(o => `${o.value}=${o.text}`).join(', '))
    }

    const html = await searchCourses(tokens, {
      termCode: term.code,
      subject: query.subject,
      attribute: query.attribute,
    })

    const sections = parseResultsTable(html)
    console.error(`  Found ${sections.length} sections`)
    allSections.push(...sections)

    // Polite delay between requests
    if (queries.indexOf(query) < queries.length - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  // Deduplicate (same code + section = same row)
  const seen = new Set()
  let deduped = allSections.filter(s => {
    const key = `${s.code}|${s.section}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Filter by max course level if specified
  if (values['max-level']) {
    const max = parseInt(values['max-level'])
    const before = deduped.length
    deduped = deduped.filter(s => {
      const num = parseInt(s.code.replace(/[A-Z]+\s*/, ''))
      return num <= max
    })
    console.error(`  Filtered to courses <= ${max}: ${deduped.length} sections (removed ${before - deduped.length})`)
  }

  // Build sections list — either all individual sections or collapsed
  let finalSections
  if (values['all-sections']) {
    finalSections = deduped.sort((a, b) => a.code.localeCompare(b.code))
  } else {
    // Collapse multi-section courses into one entry with sectionCount
    const byCourse = new Map()
    for (const s of deduped) {
      if (!byCourse.has(s.code)) {
        byCourse.set(s.code, { sections: [], first: s })
      }
      byCourse.get(s.code).sections.push(s)
    }

    const collapsed = []
    for (const [, { sections: secs, first }] of byCourse) {
      const coreCodes = [...new Set(secs.map(s => s.coreCode).filter(Boolean))]
      const entry = {
        code: first.code,
        title: first.title,
        modality: first.modality,
        status: first.status,
      }
      if (coreCodes.length) entry.coreCode = coreCodes.join(', ')
      if (secs.length > 1) {
        entry.sectionCount = secs.length
      } else {
        entry.section = first.section
        entry.schedule = first.schedule
        entry.enrollment = first.enrollment
      }
      collapsed.push(entry)
    }
    finalSections = collapsed.sort((a, b) => a.code.localeCompare(b.code))
  }

  // Build output
  const offeredCodes = [...new Set(deduped.map(s => s.code))].sort()

  let content
  if (values.csv) {
    const lines = ['Code,Title,Core,Modality,Status,Section,Schedule,Enrollment,Sections']
    for (const s of finalSections) {
      const row = [
        s.code,
        '"' + (s.title || '').replace(/"/g, '""') + '"',
        s.coreCode ? '"' + s.coreCode + '"' : '',
        s.modality || '',
        (s.status || '').replace(/\n/g, ' '),
        s.section ? s.section.replace(/\n/g, ' ') : '',
        s.schedule ? s.schedule.replace(/\n/g, ' ') : '',
        s.enrollment ? s.enrollment.replace(/\n/g, '/') : '',
        s.sectionCount || 1,
      ]
      lines.push(row.join(','))
    }
    content = lines.join('\n') + '\n'
  } else {
    // Strip status and enrollment from JSON — they're point-in-time snapshots
    // that go stale as students register. Keep them in CSV mode for reports.
    const cleanSections = finalSections.map(({ status, enrollment, ...rest }) => rest)
    const output = {
      term: term.label,
      updated: new Date().toISOString().split('T')[0],
      offeredCodes,
      sections: cleanSections,
    }
    content = JSON.stringify(output, null, 2) + '\n'
  }

  if (values['dry-run'] || !values.out) {
    console.log(content)
  } else {
    writeFileSync(values.out, content)
    console.error(`\nWrote ${finalSections.length} entries (${offeredCodes.length} unique courses) to ${values.out}`)
  }
}

main().catch(err => {
  console.error('Scraper error:', err.message)
  process.exit(1)
})
