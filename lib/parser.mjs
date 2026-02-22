import * as cheerio from 'cheerio'

// Column indices in the results table
const COL = {
  classNbr: 0,
  course: 1,
  section: 3,   // "Sec.Ses." — e.g. "060<br>REG"
  coreCode: 5,  // "CoreCode" — TCU Core attributes (e.g. "WEM", "HT", "NSC")
  title: 6,     // "Title / Topic"
  mode: 8,      // "InstructionMode"
  schedule: 9,  // "DaysTime" — e.g. "MW<br>14:00-15:20"
  status: 10,
  enrMax: 11,   // enrollment<br>max — e.g. "20<br>20"
}

export function parseResultsTable(html) {
  const $ = cheerio.load(html)
  const resultsTable = $('table.results')
  if (!resultsTable.length) return []

  const sections = []

  resultsTable.find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 11) return // skip spacer rows

    // Replace <br> with \n before extracting text
    cells.each((_, cell) => {
      $(cell).find('br').replaceWith('\n')
    })

    const classNbr = $(cells[COL.classNbr]).text().trim()
    if (!classNbr) return // skip empty/spacer rows

    const code = $(cells[COL.course]).text().trim()
    const section = $(cells[COL.section]).text().trim()
    const coreCode = $(cells[COL.coreCode]).text().trim()
    const title = $(cells[COL.title]).text().trim()
    const modality = $(cells[COL.mode]).text().trim()
    const schedule = $(cells[COL.schedule]).text().trim()
    const rawStatus = $(cells[COL.status]).text().trim()
    // Normalize: "Dept\nPermit", "Instr\nPermit" → "Closed"
    const status = /permit/i.test(rawStatus) ? 'Closed' : rawStatus.replace(/\n/g, ' ')
    const enrollment = $(cells[COL.enrMax]).text().trim()

    const entry = { code, section, title, schedule, modality, enrollment, status }
    if (coreCode) entry.coreCode = coreCode
    sections.push(entry)
  })

  return sections
}
