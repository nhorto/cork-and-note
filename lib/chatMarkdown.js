// Markdown tables are designed for wide screens. In a phone chat bubble, four
// columns collapse to a few characters each and become unreadable. Convert GFM
// table blocks into stacked, labelled rows before rendering; the surrounding
// Markdown (headings, lists, links, emphasis) is left untouched.

function cells(line) {
  const trimmed = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
  const parts = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
    } else if (char === '|') {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function isDivider(line) {
  const parts = cells(line);
  return parts.length >= 2 && parts.every((part) => /^:?-{3,}:?$/.test(part));
}

function isTableRow(line) {
  return String(line || '').includes('|') && cells(line).length >= 2;
}

export function formatMarkdownForMobile(markdown) {
  const lines = String(markdown || '').split('\n');
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableRow(lines[index]) || !isDivider(lines[index + 1])) {
      output.push(lines[index]);
      continue;
    }

    const headers = cells(lines[index]);
    const rows = [];
    index += 2;
    while (index < lines.length && isTableRow(lines[index])) {
      rows.push(cells(lines[index]));
      index += 1;
    }
    index -= 1;

    for (const row of rows) {
      const title = row[0] || headers[0] || 'Item';
      output.push(`**${title}**`);
      for (let column = 1; column < headers.length; column += 1) {
        const value = row[column];
        if (!value) continue;
        output.push(`- **${headers[column]}:** ${value}`);
      }
      output.push('');
    }
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
