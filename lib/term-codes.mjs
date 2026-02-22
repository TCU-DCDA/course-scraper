// TCU term codes follow this pattern (derived from known values):
// Spring 2026 = 4263, Fall 2025 = 4261
// Formula: base = (academicYear - 1599), digit = {fall:1, spring:3, summer:5}
// Academic year = fall's calendar year (Spring/Summer 2026 → academic year 2025)

const SEMESTER_DIGIT = { fall: 1, spring: 3, summer: 5 }

function termCode(semester, year) {
  const sem = semester.toLowerCase()
  const digit = SEMESTER_DIGIT[sem]
  if (digit === undefined) throw new Error(`Unknown semester: ${semester}`)

  const academicYear = sem === 'fall' ? year : year - 1
  const base = academicYear - 1599
  return `${base}${digit}`
}

export function parseTerm(input) {
  if (/^\d{4}$/.test(input)) return { code: input, label: input }
  const match = input.match(/^(spring|summer|fall)\s+(\d{4})$/i)
  if (!match) throw new Error(`Cannot parse term: "${input}". Use "Spring 2026" or a numeric code like "4263".`)
  const semester = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
  const year = parseInt(match[2])
  const code = termCode(match[1], year)
  return { code, label: `${semester} ${year}` }
}
