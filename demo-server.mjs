#!/usr/bin/env node
/* ==========================================================================
   Demo Suite Server
   - يشغّل كل نسخ الديمو بخوادمها الحقيقية (CRUD كامل بدون تعديل منطق التطبيق)
   - يعزل البيانات في runtime-data/ ويعيد توليدها عند كل بداية أو ضبط
   - يوفّر بوابة واحدة على منفذ واحد (8000) سهلة النشر + منافذ مباشرة اختيارية
   - يحقن شريط ديمو ويزر «دخول تجريبي» و«إعادة ضبط البيانات»
   ========================================================================== */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEMO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORTAL_PORT = Number(process.env.DEMO_PORT || 8000);
const HOST = process.env.DEMO_HOST || "0.0.0.0";
const DIRECT_PORTS = process.env.DEMO_DIRECT_PORTS === "1";
const CONFIG = JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, "demo-projects.json"), "utf8"));
const PROJECTS = CONFIG.projects;
const BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));
const states = new Map();
const proxyServers = [];

function log(msg) {
  console.log(`[demo] ${msg}`);
}

function dataDirFor(project) {
  return path.join(DEMO_ROOT, "runtime-data", project.id);
}

function envFor(project) {
  const env = { ...process.env };
  /* منع أي اتصال بقاعدة بيانات حقيقية */
  delete env.DATABASE_URL;
  delete env.DB_URL;
  delete env.MYSQL_URL;
  const data = dataDirFor(project);
  env.PORT = String(project.internalPort);
  env.HOST = "127.0.0.1";
  env.NODE_ENV = env.NODE_ENV || "production";
  env.DEMO_MODE = "1";
  for (const [key, raw] of Object.entries(project.env || {})) {
    if (raw === null) delete env[key];
    else env[key] = String(raw).replaceAll("{DATA}", data);
  }
  return env;
}

async function waitPort(port, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
      res.body?.cancel?.();
      return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startProject(project, options = {}) {
  let state = states.get(project.id);
  if (!state) {
    state = { project, child: null, stopping: false, ready: false, restarts: 0 };
    states.set(project.id, state);
  }
  if (state.child && state.child.exitCode == null && state.ready) return true;

  const dir = dataDirFor(project);
  if (!options.keepData) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    log(`بيانات جديدة: ${project.id}`);
  }

  const cwd = path.join(DEMO_ROOT, "projects", project.id);
  const child = spawn(process.execPath, [project.entry], {
    cwd,
    env: envFor(project),
    stdio: ["ignore", "pipe", "pipe"],
  });
  state.child = child;
  state.ready = false;
  child.stdout.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`  [${project.id}] ${text}`);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.error(`  [${project.id}!] ${text}`);
  });
  child.on("exit", (code) => {
    if (state.child === child) state.child = null;
    state.ready = false;
    if (!state.stopping && !options.noRestart && state.restarts < 5) {
      state.restarts += 1;
      log(`إعادة تشغيل تلقائية: ${project.id} (خرج بـ ${code})`);
      setTimeout(() => startProject(project, { keepData: true }), 1200);
    }
  });

  const ok = await waitPort(project.internalPort);
  if (ok) {
    state.ready = true;
    state.restarts = 0;
    log(`جاهز: ${project.label} → /${project.id}/`);
  } else {
    log(`تعذّر بدء ${project.id} على المنفذ الداخلي ${project.internalPort}`);
  }
  return ok;
}

function stopProject(project) {
  const state = states.get(project.id);
  if (!state || !state.child) return;
  state.stopping = true;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(state.child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      state.child.kill("SIGTERM");
    }
  } catch {}
  state.child = null;
  state.ready = false;
}

async function resetProject(project) {
  stopProject(project);
  await new Promise((r) => setTimeout(r, 500));
  const state = states.get(project.id);
  if (state) state.stopping = false;
  return startProject(project);
}

/* ---------------- شريط الديمو ---------------- */
function injectionFor(project, prefix) {
  const pairs = String(project.login || "admin / admin123").split("|").map((s) => s.split("/").map((x) => x.trim()));
  const [u, p] = pairs[0];
  const seen = {};
  const users = [];
  for (const pair of pairs) {
    const key = pair.join("/");
    if (!seen[key]) { seen[key] = 1; users.push({ u: pair[0], p: pair[1] }); }
  }
  const creds = JSON.stringify({ u, p, users, prefix, id: project.id, portalPort: PORTAL_PORT });
  const css = `<style id="__demo_css">
#__demo_launcher{position:fixed;left:14px;bottom:14px;z-index:2147483647;height:40px;padding:0 14px;border-radius:20px;border:2px solid #ffffffaa;background:linear-gradient(135deg,#1d4ed8,#0f766e);color:#fff;box-shadow:0 6px 22px #0006;cursor:pointer;font:700 12px/1 system-ui,Tahoma,sans-serif;direction:rtl}
#__demo_launcher:hover{filter:brightness(1.12)}
#__demo_panel{position:fixed;left:14px;bottom:64px;z-index:2147483647;width:min(330px,calc(100vw - 28px));box-sizing:border-box;background:#0f172af5;color:#fff;border:1px solid #334155;border-radius:14px;padding:14px;box-shadow:0 12px 40px #0008;direction:rtl;font:13px/1.6 system-ui,Tahoma,sans-serif}
#__demo_panel[hidden]{display:none}
#__demo_panel b{font-size:14px}
#__demo_panel p{margin:8px 0;color:#cbd5e1;font-size:12px}
#__demo_panel .__demo_actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
#__demo_panel button,#__demo_panel a{background:#ffffff1f;border:1px solid #ffffff55;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font:12px system-ui;text-decoration:none}
#__demo_panel button:hover,#__demo_panel a:hover{background:#ffffff3d}
#__demo_panel .__demo_close{position:absolute;top:8px;left:8px;background:transparent;border:0;padding:2px 6px;font-size:16px}
</style>`;
  const script = `<script>(function(){
var C=${creds};window.__DEMO_PREFIX__=C.prefix||'';var AUTO=(function(){try{return sessionStorage.getItem('__demo_auto')===C.id}catch(e){return false}})();
function visible(el){return !!el&&!el.disabled&&el.offsetParent!==null;}
function setVal(el,v){
  var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  var setter=Object.getOwnPropertyDescriptor(proto,'value').set;
  setter.call(el,v);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function allInputs(){return Array.prototype.slice.call(document.querySelectorAll('input'));}
function loginClickables(){
  return Array.prototype.slice.call(document.querySelectorAll('button,a')).filter(function(b){
    var x=(b.textContent||'')+' '+(b.getAttribute('aria-label')||'');
    return b.id!=='__demo_login'&&/دخول|تسجيل الدخول|sign in|login|log in/i.test(x)&&visible(b);
  });
}
var credIdx=0;
function tryFill(){
  var cr=C.users[credIdx%C.users.length];
  var pw=allInputs().filter(function(i){return i.type==='password'&&visible(i)})[0];
  if(!pw){var b=loginClickables()[0];if(b)b.click();return false;}
  var list=allInputs().filter(visible);
  var user=list.filter(function(i){
    var s=((i.name||'')+' '+(i.id||'')+' '+(i.placeholder||'')).toLowerCase();
    return /user|email|login|phone|username|بريد|اسم|جوال/.test(s);
  })[0]||list.filter(function(i){return i.type!=='password'})[0];
  if(user)setVal(user,cr.u);
  setVal(pw,cr.p);
  var f=pw.form;
  if(f){
    try{f.requestSubmit()}catch(e){
      var sub=f.querySelector('button[type=submit],input[type=submit],button');
      if(sub)sub.click();
    }
  }else{
    var cands=loginClickables().filter(function(b){return !/auth-tab/i.test((b.className||''))});
    var near=cands.filter(function(b){return /login|submit/i.test(((b.id||'')+' '+(b.className||'')))})[0]||cands[0]||(pw.parentElement&&pw.parentElement.querySelector('button'));
    if(near)near.click();
  }
  credIdx++;
  return true;
}
function showHelp(){
  var old=document.getElementById('__demo_help');if(old)old.remove();
  var h=document.createElement('div');h.id='__demo_help';
  h.style.cssText='position:fixed;left:14px;bottom:64px;z-index:2147483647;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:14px;padding:14px;font:13px system-ui;direction:rtl;max-width:300px;box-shadow:0 10px 40px #0008';
  h.innerHTML='<b>بيانات الدخول التجريبي</b><div style="margin:8px 0;direction:ltr;text-align:left;font-family:monospace">'+C.u+' / '+C.p+'</div>'+
   '<div style="font-size:12px;color:#9fb4da;margin-bottom:8px">من صفحة الدخول اضغط الزر مرة تانية، أو جرّب الروابط:</div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
   ['/login','/auth/login','/admin/login'].map(function(x){return '<a href="'+C.prefix+x+'" style="background:#1d4ed8;color:#fff;padding:5px 9px;border-radius:7px;text-decoration:none;font-size:12px">'+x+'</a>'}).join('')+
   '</div><button id="__demo_closehelp" style="margin-top:10px;background:transparent;border:1px solid #475569;color:#cbd5e1;border-radius:7px;padding:4px 9px;cursor:pointer">إغلاق</button>';
  document.body.appendChild(h);
  document.getElementById('__demo_closehelp').onclick=function(){h.remove()};
  setTimeout(function(){h.remove()},8000);
}
function addBar(){
 if(document.getElementById('__demo_launcher'))return;
 var panel=document.createElement('div');panel.id='__demo_panel';panel.hidden=true;
 panel.innerHTML='<button type="button" class="__demo_close" id="__demo_close" aria-label="إغلاق">✕</button>'+
  '<b>Smart Activity Group — نسخة تجريبية</b>'+
  '<p>جرّب التسجيل والحذف والتعديل بحرية.<br>بياناتك التجريبية تُعاد تلقائياً عند إعادة الضبط.</p>'+
  '<div class="__demo_actions">'+
    '<button type="button" id="__demo_login">دخول تجريبي</button>'+
    '<button type="button" id="__demo_reset">إعادة ضبط البيانات</button>'+
    '<a href="'+location.origin+'/" target="_blank">كل الديمو</a>'+
  '</div>';
 document.body.appendChild(panel);
 var launcher=document.createElement('button');launcher.type='button';launcher.id='__demo_launcher';
 launcher.textContent='ديمو';launcher.setAttribute('aria-label','أدوات الديمو');
 document.body.appendChild(launcher);
 launcher.onclick=function(){panel.hidden=!panel.hidden;};
 document.getElementById('__demo_close').onclick=function(){panel.hidden=true;};
 var btn=document.getElementById('__demo_login'),tries=0,timer=null;
 btn.onclick=function(){
   if(timer){clearInterval(timer);timer=null;btn.textContent='دخول تجريبي';try{sessionStorage.removeItem('__demo_auto')}catch(e){}return;}
   try{sessionStorage.setItem('__demo_auto',C.id)}catch(e){}
   btn.textContent='جاري تجهيز الدخول...';tries=0;
   timer=setInterval(function(){
     tries++;
     if(tryFill()){clearInterval(timer);timer=null;try{sessionStorage.removeItem('__demo_auto')}catch(e){}btn.textContent='تم الدخول ✓';setTimeout(function(){btn.textContent='دخول تجريبي'},2500);}
     else if(tries>=20){clearInterval(timer);timer=null;try{sessionStorage.removeItem('__demo_auto')}catch(e){}btn.textContent='دخول تجريبي';showHelp();}
     else btn.textContent='جاري تجهيز الدخول... ('+tries+')';
   },500);
 };
 document.getElementById('__demo_reset').onclick=function(){
   if(!confirm('سيتم مسح كل التعديلات التجريبية وإرجاع البيانات الأصلية. متابعة؟'))return;
   this.textContent='جاري الإعادة...';
   fetch(C.prefix+'/__demo/reset?id='+encodeURIComponent(C.id),{method:'POST'}).then(function(r){return r.json()}).then(function(){location.href=C.prefix||('http://localhost:'+C.portalPort+'/')}).catch(function(){alert('تعذّرت إعادة الضبط')});
 };
  if(AUTO)setTimeout(function(){if(document.getElementById('__demo_login'))btn.click()},300);
}
/* تعديل الطلبات المطلقة لتعمل داخل المسار على الاستضافة السحابية */
function patchUrl(u){
 if(typeof u!=='string')return u;
 if(u.indexOf('/__demo/')===0||u.charAt(0)!=='/')return u;
 if(C.prefix&&u.indexOf(C.prefix+'/')===0)return u;
 return C.prefix?C.prefix+u:u;
}
if(C.prefix){
 var of=window.fetch;
 if(of)window.fetch=function(u,o){return of.call(this,patchUrl(u),o)};
 var oo=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(m,u){return oo.apply(this,[m,patchUrl(u)].concat(Array.prototype.slice.call(arguments,2)))};
 document.addEventListener('click',function(e){
   var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;
   var h=a.getAttribute('href');if(h&&h.charAt(0)==='/')a.setAttribute('href',patchUrl(h));
 },true);
 document.addEventListener('submit',function(e){if(e.target.action)e.target.action=patchUrl(e.target.getAttribute('action')||'/')},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addBar);else addBar();
})();<\/script>`;
  return css + script;
}

/* يحوّل المسارات المطلقة داخل نداءات fetch/XHR إلى المسار الخاص بالديمو،
   بشرط ألا تكون مسبوقة بالبادئة أصلاً أو من مسارات التحكم __demo */
function prefixAbsoluteCalls(text, prefix) {
  if (!prefix) return text;
  const id = prefix.slice(1);
  const apply = (lead, q, r) =>
    (/^__demo\//.test(r) || r.indexOf(id + '/') === 0)
      ? `${lead}${q}/${r}${q}`
      : `${lead}${q}${prefix}/${r}${q}`;
  let out = text.replace(/(\bfetch\s*\(\s*)(["'`])\/([^"'`]*)\2/g, (m, a, q, r) => apply(a, q, r));
  out = out.replace(/(\.open\s*\(\s*["'][^"']*["']\s*,\s*)(["'`])\/([^"'`]*)\2/g, (m, a, q, r) => apply(a, q, r));
  return out;
}

function rewriteHtmlAssets(html, prefix) {
  if (!prefix) return html;
  const out = html
    .replace(/(\b(?:src|href)\s*=\s*["'])\/(?!\/|__demo\/)/g, `$1${prefix}/`)
    .replace(/(url\(\s*["']?)\/(?!\/|__demo\/)/g, `$1${prefix}/`)
    .replace(/(location\s*\.\s*href\s*=\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`)
    .replace(/(location\s*\.\s*replace\(\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`);
  let doc = prefixAbsoluteCalls(out, prefix);
  if (!/<base\b/i.test(doc)) {
    doc = doc.replace(/<head([^>]*)>/i, (m) => `${m}\n  <base href="${prefix}/">`);
  }
  return doc;
}
function rewriteJsAssets(text, prefix) {
  if (!prefix) return text;
  let out = text.replace(/([\"'(])\/(assets|static|fonts|images|uploads)\//g, `$1${prefix}/$2/`);
  out = out.replace(/(location\s*\.\s*href\s*=\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`);
  out = out.replace(/(location\s*\.\s*replace\(\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`);
  out = out.replace(/(serviceWorker\s*\.\s*register\(\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`);
  out = out.replace(/(\bnew\s+Worker\(\s*)(["'])\/([^"']*)\2/g, (m, a, q, r) => (/^__demo\//.test(r) || r.indexOf(prefix.slice(1) + '/') === 0) ? m : `${a}${q}${prefix}/${r}${q}`);
  out = prefixAbsoluteCalls(out, prefix);
  // اجعل راوتر React يقرأ البادئة كـ basename بدل اعتبارها صفحة 404
  out = out.replace(/(basename:)([A-Za-z_$][\w$]*)(,children:[A-Za-z_$][\w$]*,future:[A-Za-z_$][\w$]*,window:[A-Za-z_$][\w$]*\}=e,l=p\.useRef\(\);)/g, `$1$2$3$2=window.__DEMO_PREFIX__||$2;`);
  out = out.replace(/(\{basename:)([A-Za-z_$][\w$]*)(,children:[A-Za-z_$][\w$]*,useTransitions:[A-Za-z_$][\w$]*,window:[A-Za-z_$][\w$]*\}\)\{)/g, `$1$2$3$2=window.__DEMO_PREFIX__||$2;`);
  out = out.replace(/(basename:)(t\?\.basename)/g, `$1(window.__DEMO_PREFIX__||$2)`);
  return out;
}

function injectHtml(html, project, prefix) {
  const injection = injectionFor(project, prefix);
  const doc = rewriteHtmlAssets(html, prefix);
  if (/<\/body\s*>/i.test(doc)) return doc.replace(/<\/body\s*>/i, `${injection}</body>`);
  return doc + injection;
}

/* ---------------- الوكيل ---------------- */
function proxyRequest(req, res, project, prefix) {
  let incomingPath = req.url || "/";
  let upstreamPath = incomingPath;
  if (prefix) {
    /* incomingPath يبدأ بـ /<id> */
    upstreamPath = incomingPath.slice(prefix.length) || "/";
    if (!upstreamPath.startsWith("/")) upstreamPath = "/" + upstreamPath;
  }
  const headers = { ...req.headers };
  headers.host = `127.0.0.1:${project.internalPort}`;
  headers["accept-encoding"] = "identity";

  const upstream = http.request(
    { host: "127.0.0.1", port: project.internalPort, method: req.method, path: upstreamPath, headers },
    (upstreamRes) => {
      const chunks = [];
      upstreamRes.on("data", (c) => chunks.push(c));
      upstreamRes.on("end", () => {
        const body = Buffer.concat(chunks);
        const outHeaders = { ...upstreamRes.headers };
        delete outHeaders["content-length"];
        delete outHeaders["transfer-encoding"];
        delete outHeaders["connection"];
        delete outHeaders["content-encoding"];
        outHeaders["cache-control"] = "no-store";
        outHeaders["pragma"] = "no-cache";
        const type = String(outHeaders["content-type"] || "");
        let payload = body;
        if (type.includes("text/html")) {
          payload = Buffer.from(injectHtml(body.toString("utf8"), project, prefix), "utf8");
        } else if (prefix && (type.includes("javascript") || type.includes("css") || type.includes("json"))) {
          payload = Buffer.from(rewriteJsAssets(body.toString("utf8"), prefix), "utf8");
        }
        if (prefix) {
          const cookie = `__demo_active=${project.id}; Path=/; SameSite=Lax`;
          outHeaders["set-cookie"] = outHeaders["set-cookie"]
            ? [].concat(outHeaders["set-cookie"], cookie)
            : cookie;
        }
        res.writeHead(upstreamRes.statusCode || 200, outHeaders);
        res.end(payload);
      });
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/html; charset=utf-8", "refresh": "3" });
      res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${project.label}</title><body style="font-family:system-ui;background:#0b1220;color:#e8eefc;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h2>جاري تجهيز ${project.label}…</h2><p style="color:#9aabc9">سيتم فتح الصفحة تلقائياً خلال ثوانٍ.</p></div></body></html>`);
    } else res.end();
  });
  req.on("data", (c) => upstream.write(c));
  req.on("end", () => upstream.end());
  req.on("error", () => upstream.destroy());
}

/* ---------------- نقاط التحكم ---------------- */
function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function handleControl(req, res, url) {
  const pathname = url.pathname;
  if (pathname === "/__demo/health") {
    const ids = url.searchParams.get("ids");
    const list = ids ? ids.split(",").map((id) => BY_ID.get(id)).filter(Boolean) : PROJECTS;
    const result = {};
    for (const p of list) result[p.id] = { online: Boolean(states.get(p.id)?.ready), port: p.port };
    return sendJson(res, 200, { ok: true, projects: result });
  }
  if (pathname === "/__demo/reset") {
    const id = url.searchParams.get("id") || "";
    const project = BY_ID.get(id);
    if (!project) return sendJson(res, 404, { ok: false, error: "unknown demo" });
    try {
      const ok = await resetProject(project);
      log(`تمت إعادة ضبط: ${project.id}`);
      return sendJson(res, ok ? 200 : 500, { ok, id });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: String(error) });
    }
  }
  if (pathname === "/__demo/info") return sendJson(res, 200, { ok: true, projects: PROJECTS.map((p) => ({ id: p.id, label: p.label, subtitle: p.subtitle, icon: p.icon, category: p.category, color: p.color, port: p.port, login: p.login, description: p.description })) });
  return sendJson(res, 404, { ok: false });
}

function servePortal(req, res, url) {
  if (req.url.startsWith("/__demo/")) return handleControl(req, res, url);

  /* مطابقة /<id>/... */
  const match = req.url.match(/^\/([a-zA-Z0-9-]+)(\/.*)?$/);
  if (match && BY_ID.has(match[1])) {
    const project = BY_ID.get(match[1]);
    const prefix = "/" + match[1];
    if (!states.get(project.id)?.ready) {
      return startProject(project).then(() => proxyRequest(req, res, project, prefix));
    }
    return proxyRequest(req, res, project, prefix);
  }

  /* ملفات البوابة الثابتة (اللوجو/Avatar/أي أيقونة) */
  const assetName = url.pathname === "/" ? "" : url.pathname.slice(1);
  if (assetName && /^[a-zA-Z0-9._-]+$/.test(assetName)) {
    const assetPath = path.join(DEMO_ROOT, "portal", assetName);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      const ext = path.extname(assetPath).toLowerCase();
      const type = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".ico" ? "image/x-icon" : "application/octet-stream";
      return fs.readFile(assetPath, (err, data) => {
        if (err) { res.writeHead(500); return res.end(); }
        res.writeHead(200, { "content-type": type + "; charset=utf-8", "cache-control": "no-store" });
        res.end(data);
      });
    }
  }

  const filePath = path.join(DEMO_ROOT, "portal", "index.html");
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      return res.end("portal/index.html missing");
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(data);
  });
}

/* ---------------- التشغيل ---------------- */
async function main() {
  log(`بدء تشغيل ${PROJECTS.length} نسخة ديمو...`);
  for (const project of PROJECTS) await startProject(project);

  const portal = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); return res.end(); }
    servePortal(req, res, url);
  });
  await new Promise((resolve) => portal.listen(PORTAL_PORT, HOST, resolve));
  log(`البوابة جاهزة: http://localhost:${PORTAL_PORT}/`);

  if (DIRECT_PORTS) {
    for (const project of PROJECTS) {
      const server = http.createServer((req, res) => {
        if (req.url.startsWith("/__demo/")) {
          let url;
          try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); return res.end(); }
          return handleControl(req, res, url);
        }
        proxyRequest(req, res, project, "");
      });
      await new Promise((resolve) => server.listen(project.port, HOST, resolve));
      proxyServers.push(server);
      log(`منفذ مباشر: http://localhost:${project.port}/  (${project.id})`);
    }
  }

  log("اضغط Ctrl+C للإيقاف.");
}

function shutdown() {
  for (const project of PROJECTS) stopProject(project);
  for (const server of proxyServers) server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => { console.error(error); shutdown(); });
