// Shared CSV export helpers

export type CsvColumn<T> = [header: string, read: (row: T) => string | number]

// Text a spreadsheet would run as a formula when the file is opened
// (=, @, tab, CR, or +/- followed by more than a plain number or phone)
const FORMULA_START = /^(?:[=@\t\r]|[+-](?![\d\s().]*$))/

// One cell: quoted when it holds a separator, quote or line break, and
// defused when it would start a formula (CSV injection)
export function csvCell(value: string | number) {
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Header row plus one row per item, CRLF line endings for Excel
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  return [
    columns.map(([header]) => csvCell(header)).join(','),
    ...rows.map((row) => columns.map(([, read]) => csvCell(read(row))).join(',')),
  ].join('\r\n')
}
