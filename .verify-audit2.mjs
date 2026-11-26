// 2026-11 の総点検2(docs/調査記録/点検-総点検2-2026-11.md)で直した不具合を固定する。ポートは8231。
//   (A) コードブロックの中の「# 」「---」「- [ ]」を、見出し・区切り線・チェックボックスとして描かない
//   (B) 検索欄・コマンドパレットにいる間、本文を書き換えるショートカットが背後の本文に働かない
//   (C) Webページの文の一部(リンク・太字を含む)を貼ると、1つの段落のまま、リンクと太字が残る
//   (D) コードブロックの中・コードの文書では、貼り付けたHTMLをMarkdownへ変換しない
//   (E) 暗いテーマで、取扱説明書の検索の強調が、共通の mark の黄土色に負けない
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 8231;
const BASE = `http://localhost:${PORT}/index.html`;
let ng = 0;
const ok = (label, cond, detail) => {
  console.log(`${cond ? "OK  " : "NG  "} ${label}${cond || detail === undefined ? "" : `\n     実際: ${JSON.stringify(detail)}`}`);
  if (!cond) ng++;
};

const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: "dist", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => window.__paneDebugEditor);
  const setDoc = (t, at = null) => page.evaluate(([t, at]) => {
    const e = window.__paneDebugEditor; e.setValue(t);
    e.view.dispatch({ selection: { anchor: at ?? e.view.state.doc.length } }); e.view.focus();
  }, [t, at]);
  const doc = () => page.evaluate(() => window.__paneDebugEditor.view.state.doc.toString());

  // (A)
  await setDoc("本文\n\n```python\n# comment\n---\n- [ ] x\n```\n\n# 見出し\n\n最後");
  await page.waitForTimeout(300);
  const lines = await page.evaluate(() => [...document.querySelectorAll("#cm-host .cm-line")].map((l) => ({
    text: l.textContent, h: !!l.querySelector(".tok-h1"), hr: !!l.querySelector(".cm-hr"), cb: !!l.querySelector(".cm-checkbox"),
  })));
  ok("(A) コードの「# comment」は見出しにならず、「#」も見えている", lines.some((l) => l.text.includes("# comment") && !l.h), lines);
  ok("(A) コードの「---」は区切り線にならない", !lines.some((l) => l.hr), lines);
  ok("(A) コードの「- [ ] x」はチェックボックスにならない", !lines.some((l) => l.cb), lines);
  ok("(A) コードブロックの外の見出しは、これまでどおり見出しになる", lines.some((l) => l.text === "見出し" && l.h), lines);

  // (B) 検索欄で Ctrl+B / F5
  await setDoc("abc");
  await page.keyboard.press("Control+f");
  await page.waitForTimeout(200);
  const inInput = await page.evaluate(() => document.activeElement?.tagName);
  await page.keyboard.press("Control+b");
  await page.keyboard.press("F5");
  await page.waitForTimeout(200);
  ok("(B) 検索欄にいるとき、Ctrl+B・F5 が本文に働かない", inInput === "INPUT" && (await doc()) === "abc", { inInput, doc: await doc() });
  await page.keyboard.press("Escape");
  await setDoc("abc", 0);
  await page.evaluate(() => { const v = window.__paneDebugEditor.view; v.dispatch({ selection: { anchor: 0, head: 3 } }); v.focus(); });
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(200);
  ok("(B) 本文では Ctrl+B がこれまでどおり効く", (await doc()) === "**abc**", await doc());

  // (B) コマンドパレットを開いている間
  await setDoc("xyz");
  await page.keyboard.press("Control+Shift+p");
  await page.waitForTimeout(300);
  const palOpen = await page.evaluate(() => !!document.querySelector('.palette[aria-modal="true"]'));
  await page.keyboard.press("F5");
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(200);
  ok("(B) コマンドパレットを開いている間、F5・Ctrl+B が背後の本文に働かない", palOpen && (await doc()) === "xyz", { palOpen, doc: await doc() });
  await page.keyboard.press("Escape");

  // (C)(D) 貼り付け
  const paste = (html, plain) => page.evaluate(([html, plain]) => {
    const dt = new DataTransfer();
    dt.setData("text/html", html); dt.setData("text/plain", plain);
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    window.__paneDebugEditor.view.contentDOM.dispatchEvent(ev);
  }, [html, plain]);
  await setDoc("");
  await paste('<span>文の前半で、</span><a href="https://example.com/doc">公式の説明</a><span>を読むと</span><strong>重要</strong>', "文の前半で、公式の説明を読むと重要");
  await page.waitForTimeout(200);
  ok("(C) 文の一部の貼り付けは1段落のまま、リンクと太字が残る", (await doc()) === "文の前半で、[公式の説明](https://example.com/doc)を読むと**重要**", await doc());

  await setDoc("```js\n// top\n\n```", "```js\n// top\n".length);
  await paste("<pre><code>const a = 1;</code></pre>", "const a = 1;");
  await page.waitForTimeout(200);
  ok("(D) コードブロックの中では「```」をつけずにそのまま入る", (await doc()) === "```js\n// top\nconst a = 1;\n```", await doc());

  await page.evaluate(() => { window.__paneDebugEditor.setValue("// top\n"); window.__paneDebugEditor.setFileMode("a.js"); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const v = window.__paneDebugEditor.view; v.dispatch({ selection: { anchor: v.state.doc.length } }); v.focus(); });
  await paste("<pre><code>const a = 1;</code></pre><p><strong>x</strong></p>", "const a = 1;\nx");
  await page.waitForTimeout(200);
  ok("(D) コードの文書では変換せず、プレーンテキストが入る", (await doc()) === "// top\nconst a = 1;\nx", await doc());

  // (F) 中の不具合
  const type = async (t) => { for (const ch of t) await page.keyboard.type(ch); };
  await page.evaluate(() => window.__paneDebugEditor.setFileMode("a.md"));
  await page.waitForTimeout(200);
  await setDoc("");
  await page.keyboard.press("Control+b"); await type("太字"); await page.keyboard.press("Control+b"); await type("後");
  ok("(F) Ctrl+B→打つ→Ctrl+B で閉じ記号の外へ出る(「****」が増えない)", (await doc()) === "**太字**後", await doc());
  await setDoc("");
  await page.keyboard.press("Control+b"); await page.keyboard.press("Control+b");
  ok("(F) 何も打たずにもう一度 Ctrl+B を押すと、記号の組を外す", (await doc()) === "", await doc());
  await setDoc("");
  await type("cd ~/.config"); await page.keyboard.press("Enter");
  ok("(F) 「cd ~/.config」+改行で、閉じの「~」が残らない", (await doc()).startsWith("cd ~/.config\n") && !(await doc()).includes("config~"), await doc());
  await setDoc("");
  await type("ls *.txt を実行");
  ok("(F) 「ls *.txt を実行」の末尾に「*」が残らない", (await doc()) === "ls *.txt を実行", await doc());
  await setDoc("");
  await type("*強調*です");
  ok("(F) 「*強調*」はこれまでどおり対になる", (await doc()) === "*強調*です", await doc());

  // (E)
  const bg = await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    const m = document.createElement("mark"); m.className = "help-search-hit"; m.textContent = "x"; document.body.appendChild(m);
    const r = getComputedStyle(m).backgroundColor; m.remove(); return r;
  });
  ok("(E) 暗いテーマで、取扱説明書の検索の強調が黄土色(#8A7A2E)に置き換わらない", bg !== "rgb(138, 122, 46)", bg);

  ok("ページのエラーが無い", errors.length === 0, errors);
} finally {
  await browser.close();
  server.kill();
}
console.log(`\nNG=${ng}`);
process.exit(ng ? 1 : 0);
