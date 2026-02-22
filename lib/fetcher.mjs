import * as cheerio from 'cheerio'

const BASE_URL = 'https://classes.tcu.edu/'

export async function getInitialTokens() {
  const response = await fetch(BASE_URL)
  const html = await response.text()

  // Extract cookies from response
  const setCookies = response.headers.getSetCookie?.() || []
  const cookies = setCookies.map(c => c.split(';')[0]).join('; ')

  const $ = cheerio.load(html)

  return {
    viewState: $('#__VIEWSTATE').val(),
    viewStateGenerator: $('#__VIEWSTATEGENERATOR').val(),
    eventValidation: $('#__EVENTVALIDATION').val(),
    cookies,
    html,
    termOptions: extractOptions($, '#ddlTerm'),
    subjectOptions: extractOptions($, '#ddlSubject'),
    attributeOptions: extractOptions($, '#ddlAttribute'),
  }
}

function extractOptions($, selector) {
  const opts = []
  $(`${selector} option`).each((_, el) => {
    const $el = $(el)
    opts.push({ value: $el.attr('value'), text: $el.text().trim() })
  })
  return opts
}

export async function searchCourses(tokens, { termCode, subject, attribute }) {
  const body = new URLSearchParams()
  body.set('__VIEWSTATE', tokens.viewState)
  body.set('__VIEWSTATEGENERATOR', tokens.viewStateGenerator)
  body.set('__EVENTVALIDATION', tokens.eventValidation)
  body.set('ddlTerm', termCode)
  body.set('ddlSubject', subject || 'ANY')
  body.set('ddlAttribute', attribute || 'ANY')
  body.set('ddlSession', 'ANY')
  body.set('ddlLocation', 'ANY')
  body.set('ddlLevel', 'ANY')
  body.set('ddlDay', 'ANY')
  body.set('ddlStartTime', 'ANY')
  body.set('ddlEndtime', '2000')
  body.set('txtCrsNumber', '')
  body.set('txtSection', '')
  body.set('rbStatus', 'rbStatusAny')
  body.set('btnSearch', 'Search')
  body.set('hdnShowBldg', 'Y')

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': tokens.cookies,
    },
    body: body.toString(),
    redirect: 'follow',
  })

  return response.text()
}
