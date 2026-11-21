// Tiny, safe markdown renderer for AI answers: bold, headings, lists, tables, links.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, (_m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noreferrer">${/sec\.gov/.test(url) ? "SEC filing" : "link"}</a>`);

export function md(src: string): string {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(`<table class="tbl md-tbl"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^\s*[-*] /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*] /, ""))}</li>`); i++; }
      out.push(`<ul class="md-ul">${items.join("")}</ul>`);
      continue;
    }
    const h = l.match(/^#{1,4}\s+(.*)/);
    if (h) out.push(`<h5>${inline(h[1])}</h5>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return out.join("");
}
