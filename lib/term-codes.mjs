// TCU term codes: base = (year - 1600), digit = {wintersession:1, spring:3, summer:5, fall:7}
// All semesters use the calendar year directly.
// Examples: Fall 2025=4257, Spring 2026=4263, Fall 2026=4267

const SEMESTER_DIGIT = { fall: 7, spring: 3, summer: 5, wintersession: 1 }

function termCode(semester, year) {
  const sem = semester.toLowerCase()
  const digit = SEMESTER_DIGIT[sem]
  if (digit === undefined) throw new Error(`Unknown semester: ${semester}`)

  const base = year - 1600
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
