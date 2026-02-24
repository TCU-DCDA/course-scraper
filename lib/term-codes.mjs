// TCU term codes follow this pattern (derived from known values):
// Fall 2025 = 4257, Wintersession 2026 = 4261, Spring 2026 = 4263
// Formula: base = (academicYear - 1599), digit = {fall:7, wintersession:1(next base), spring:3, summer:5}
// Academic year = fall's calendar year (Spring/Summer/Wintersession 2026 → academic year 2025-26, base=426)
// Note: Wintersession uses the NEXT academic year's base with digit 1

const SEMESTER_DIGIT = { fall: 7, spring: 3, summer: 5, wintersession: 1 }

function termCode(semester, year) {
  const sem = semester.toLowerCase()
  const digit = SEMESTER_DIGIT[sem]
  if (digit === undefined) throw new Error(`Unknown semester: ${semester}`)

  const academicYear = sem === 'fall' ? year : year - 1
  const base = academicYear - 1599
  // Wintersession uses next base (e.g. Wintersession 2026 = 426+1 = base 426, digit 1 → 4261)
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
