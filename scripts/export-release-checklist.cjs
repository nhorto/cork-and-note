// Run after npm ci: node scripts/export-release-checklist.cjs [output.html]
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const MarkdownIt = require('markdown-it');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/business/app-store-readiness-2026-09-10.md'), 'utf8');
const md = new MarkdownIt({ html: false, linkify: true });
const escape = md.utils.escapeHtml;
const headings = [];
md.renderer.rules.heading_open = (tokens, index) => {
  const token = tokens[index];
  const title = tokens[index + 1].content;
  const id = 'section-' + headings.length;
  headings.push({ title, id, level: token.tag });
  return `<${token.tag} id="${id}">`;
};
let body = md.render(source).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
// Stable content-based IDs preserve personal progress when the file is regenerated.
const crypto = require('node:crypto');
body = body.replace(/<li>\[([ x])\] ([\s\S]*?)<\/li>/g, (_, checked, text) => {
  const id = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  return `<li class="task"><input type="checkbox" id="task-${id}" ${checked === 'x' ? 'checked' : ''}><label for="task-${id}">${text}</label></li>`;
});
const toc = headings.filter(h => h.level === 'h2').map(h => `<a href="#${h.id}">${escape(h.title)}</a>`).join('');
const logo = fs.readFileSync(path.join(root, 'assets/images/cork_and_note_logo.png')).toString('base64');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cork &amp; Note · Store launch checklist</title>
<style>
:root{color-scheme:light;--purple:#54258a;--gold:#d6b45d;--ink:#251b30;--paper:#faf8f4}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:var(--purple);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}
header{background:var(--purple);color:white;padding:38px max(6vw,24px);display:flex;align-items:center;gap:24px;border-bottom:5px solid var(--gold)}
header img{width:96px;height:96px}header h1{font:600 clamp(28px,4vw,44px)/1.15 Georgia,serif;margin:0 0 8px}header p{margin:0;color:#eee3ff}
.layout{display:grid;grid-template-columns:250px minmax(0,960px);gap:48px;max-width:1360px;margin:40px auto;padding:0 28px}
aside{position:sticky;top:20px;align-self:start}nav{display:grid;gap:10px;margin-top:20px}nav a{font-size:14px;text-decoration:none;padding:7px 0;border-bottom:1px solid #e6dfeb}
.tools{display:flex;gap:8px;flex-wrap:wrap}button{cursor:pointer;border:1px solid var(--purple);border-radius:8px;padding:9px 12px;background:white;color:var(--purple);font:600 13px system-ui}
progress{width:100%;accent-color:var(--purple);height:10px}.progress-text,.save-note{font-size:12px;color:#6b6074}.progress-text{margin:12px 0 0}.save-note{line-height:1.5}
main{min-width:0}main>h1{font:600 32px/1.25 Georgia,serif;margin-top:0}h2{font:600 27px/1.3 Georgia,serif;margin:46px 0 18px;padding-top:24px;border-top:2px solid var(--gold)}h3{font-size:19px;margin-top:28px}p{margin:16px 0}strong{font-weight:650}
table th:first-child,table td:first-child{min-width:125px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:24px 0;background:white;overflow-wrap:anywhere}th,td{padding:12px 14px;text-align:left;vertical-align:top;border:1px solid #e6dfeb}th{background:#eee7f5;color:#402066}tr:nth-child(even) td{background:#fcfaff}
ul{padding-left:22px}li{margin:12px 0}.task{display:flex;align-items:flex-start;gap:12px;list-style:none;margin:0 0 14px;padding:16px;border:1px solid #e6dfeb;border-radius:10px;background:white}ul:has(>.task){padding:0}.task input{width:19px;height:19px;flex:0 0 19px;margin-top:4px;accent-color:var(--purple)}.task label{cursor:pointer;min-width:0}.task:has(input:checked){background:#f0f5ee;border-color:#cdddc4}.task:has(input:checked) label{color:#4f6047}
code{font-size:.88em;padding:2px 5px;border-radius:4px;background:#eee8f1;overflow-wrap:anywhere}blockquote{margin:20px 0;padding:4px 20px;border-left:4px solid var(--gold);background:#fff}footer{font-size:13px;color:#6b6074;padding:28px;text-align:center}
@media(max-width:850px){.layout{display:block;padding:0 18px;margin-top:22px}aside{position:static;margin-bottom:30px}nav{grid-template-columns:1fr 1fr;gap:4px 16px}header img{width:64px;height:64px}header{gap:16px;padding:26px 18px}table{font-size:12px}td,th{padding:8px}h2{font-size:24px}}
@media print{header{background:white;color:var(--purple);padding:0 0 20px}header p{color:#555}.layout{display:block;margin:20px 0;padding:0}aside,footer{display:none}body{font-size:11px;background:white}.task{break-inside:avoid;padding:8px}h2{break-after:avoid;font-size:21px}h3{break-after:avoid}table{font-size:10px}a{color:inherit}.task input{appearance:auto}main>h1{display:none}@page{margin:16mm}}
</style></head><body>
<header><img alt="Cork &amp; Note" src="data:image/png;base64,${logo}"><div><h1>From here to launch.</h1><p>Cork &amp; Note · iPhone + Google Play · September 10, 2026</p></div></header>
<div class="layout"><aside><div class="tools"><button id="print">Print / Save PDF</button><button id="reset">Reset my checks</button></div><p class="progress-text" id="count"></p><progress id="progress" value="0" max="1"></progress><p class="save-note" id="save-note">Checks save in this browser when local storage is available. They do not change the project checklist or store accounts.</p><nav aria-label="Document sections">${toc}</nav></aside><main>${body}</main></div><footer>Prepared from the project readiness checklist. Source links open the original Apple, Google and service documentation.</footer>
<script>
const boxes=[...document.querySelectorAll('.task input')];const defaults=new Map(boxes.map(b=>[b.id,b.checked]));
function update(){const done=boxes.filter(b=>b.checked).length;document.getElementById('count').textContent=done+' of '+boxes.length+' steps checked';document.getElementById('progress').max=boxes.length;document.getElementById('progress').value=done}
for(const b of boxes){try{const saved=localStorage.getItem('corknote-release-'+b.id);if(saved!==null)b.checked=saved==='true'}catch{document.getElementById('save-note').textContent='This browser cannot save checks for local files. Keep this tab open or print your progress.'}b.addEventListener('change',()=>{try{localStorage.setItem('corknote-release-'+b.id,String(b.checked))}catch{}update()})}
document.getElementById('print').onclick=()=>window.print();document.getElementById('reset').onclick=()=>{if(!confirm('Reset your personal checks to the document defaults?'))return;for(const b of boxes){b.checked=defaults.get(b.id);try{localStorage.removeItem('corknote-release-'+b.id)}catch{}}update()};update();
</script></body></html>`;
const output = path.resolve(process.argv[2] || path.join(os.homedir(), 'Downloads/Cork-and-Note-Store-Launch-Checklist.html'));
fs.writeFileSync(output, html);
console.log(output);
