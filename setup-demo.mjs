#!/usr/bin/env node
/* ==========================================================================
   تجهيز نسخة الديمو
   - ينسخ ملفات المصدر لكل مشروع إلى projects/ بدون بيانات حقيقية أو مفاتيح
   - يجهّز node_modules مشتركة في جذر الديمو (Express فقط) للتشغيل دون إنترنت
   الاستخدام: node setup-demo.mjs [--force]
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(DEMO_ROOT, "..", "مشروعات ويب");
const PROJECTS_DIR = path.join(DEMO_ROOT, "projects");
const config = JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, "demo-projects.json"), "utf8"));

const EXCLUDED_DIRS = new Set([
  "node_modules", "data", "backups", "keys", "license-keys", "license-output",
  ".tmp", ".git", "coverage", "dist-desktop", "dist-electron", "electron",
  "release", "pathc", "docs-tools", "adala-desktop", "adala-license-manager",
  "adala-license-server", "cafe-manager-desktop", "cafe-manager-mobile",
  "cafe-manager-license-server", "supabase", "preview",
]);
const EXCLUDED_FILE_RE =
  /\.db$|\.db-wal$|\.db-shm$|\.sqlite$|\.log$|\.key$|\.pem$|\.caplic$|^\.env$|^\.port$|^backup-.*\.json$|^secret/i;

function shouldSkip(name, isDir) {
  if (isDir && EXCLUDED_DIRS.has(name)) return true;
  if (!isDir && EXCLUDED_FILE_RE.test(name)) return true;
  return false;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkip(entry.name, entry.isDirectory())) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/* نسخ شجرة تبعيات Express من مشروع موجود (يعمل بدون إنترنت) */
function copyDependencyTree(srcModules, destModules, roots) {
  const done = new Set();
  function copyOne(name) {
    if (done.has(name)) return;
    const src = path.join(srcModules, name);
    const dest = path.join(destModules, name);
    if (!fs.existsSync(path.join(src, "package.json"))) return;
    done.add(name);
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        fs.cpSync(from, to, { recursive: true, force: true });
      } else {
        fs.copyFileSync(from, to);
      }
    }
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8")); } catch {}
    for (const dep of Object.keys(pkg.dependencies || {})) copyOne(dep);
  }
  roots.forEach(copyOne);
  return done.size;
}

function main() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  let copied = 0;
  for (const project of config.projects) {
    const src = path.join(SOURCE_ROOT, project.id);
    const dest = path.join(PROJECTS_DIR, project.id);
    if (!fs.existsSync(path.join(src, project.entry))) {
      console.log(`  [skip] ${project.id}: entry missing`);
      continue;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    copyDir(src, dest);
    copied += 1;
    console.log(`  [copy] ${project.id}`);
  }

  /* إصلاحات صغيرة خاصة بالديمو (لا تُمس الملفات الأصلية) */
  function patch(rel, from, to) {
    const file = path.join(PROJECTS_DIR, rel);
    if (!fs.existsSync(file)) return;
    let text = fs.readFileSync(file, "utf8");
    if (text.includes(to) || !text.includes(from)) return;
    fs.writeFileSync(file, text.replaceAll(from, to), "utf8");
    console.log(`  [patch] ${rel}`);
  }
  patch("auto-car/lib/crud.js", "data.created_at = db.now();", "if (db.all(`PRAGMA table_info(${table})`).some((c) => c.name === 'created_at')) data.created_at = db.now();");
  patch("auto-car/lib/crud.js", "data.updated_at = db.now();", "if (db.all(`PRAGMA table_info(${table})`).some((c) => c.name === 'updated_at')) data.updated_at = db.now();");

  /* محتوى تجريبي غني للملف التعريفي: يظهر للعميل كبيانات شركة حقيقية،
     ويمكنه تعديل كل عنصر من لوحة التحكم. يُعاد تثبيته مع كل نسخة جديدة. */
  const profilePatchDir = path.join(DEMO_ROOT, "demo-patches", "smart-profile-cms");
  if (fs.existsSync(profilePatchDir)) {
    const profileTargets = [
      ["src/db.js", "db.js"],
      ["public/app.js", "app.js"],
      ["public/index.html", "index.html"],
      ["public/admin.js", "admin.js"],
    ];
    for (const [rel, name] of profileTargets) {
      const from = path.join(profilePatchDir, name);
      const to = path.join(PROJECTS_DIR, "smart-profile-cms", rel);
      if (fs.existsSync(from) && fs.existsSync(to)) {
        fs.copyFileSync(from, to);
        console.log(`  [content] smart-profile-cms/${rel}`);
      }
    }
  }

  /* أيقونة تاب المتصفح لتسوق والملف التعريفي */
  const iconRoot = path.join(DEMO_ROOT, "demo-patches", "icons");
  const faviconTargets = [
    { id: "Tasawuq", icon: "tasawuq.svg" },
    { id: "smart-profile-cms", icon: "smart-profile.svg" },
  ];
  const faviconLink = '  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
  for (const item of faviconTargets) {
    const pub = path.join(PROJECTS_DIR, item.id, "public");
    const icon = path.join(iconRoot, item.icon);
    if (!fs.existsSync(pub) || !fs.existsSync(icon)) continue;
    fs.copyFileSync(icon, path.join(pub, "favicon.svg"));
    for (const name of fs.readdirSync(pub)) {
      if (!/\.html$/i.test(name)) continue;
      const file = path.join(pub, name);
      let text = fs.readFileSync(file, "utf8");
      if (/rel=["']icon["']/i.test(text)) continue;
      text = /<head[^>]*>/i.test(text)
        ? text.replace(/<head[^>]*>/i, (m) => `${m}\n${faviconLink}`)
        : `${faviconLink}\n${text}`;
      fs.writeFileSync(file, text, "utf8");
      console.log(`  [favicon] ${item.id}/${path.basename(file)}`);
    }
  }

  /* Express مشترك لكل المشاريع التي تعتمد عليه */
  const destModules = path.join(DEMO_ROOT, "node_modules");
  if (!fs.existsSync(path.join(destModules, "express", "package.json"))) {
    const donors = [
      path.join(SOURCE_ROOT, "adala-platform", "node_modules"),
      path.join(SOURCE_ROOT, "miftah-studio", "node_modules"),
    ];
    let count = 0;
    for (const donor of donors) {
      if (!fs.existsSync(donor)) continue;
      count = copyDependencyTree(donor, destModules, ["express"]);
      if (count) break;
    }
    console.log(`  [deps] shared node_modules ready (${count} packages)`);
  } else {
    console.log("  [deps] shared node_modules already present");
  }

  /* الملف التعريفي يحتاج Express + cookie-parser + ejs + nodemailer */
  const cmsSource = path.join(SOURCE_ROOT, "smart-profile-cms", "node_modules");
  const cmsDest = path.join(PROJECTS_DIR, "smart-profile-cms", "node_modules");
  if (fs.existsSync(cmsSource) && !fs.existsSync(path.join(cmsDest, "express", "package.json"))) {
    const count = copyDependencyTree(cmsSource, cmsDest, ["express", "cookie-parser", "ejs", "nodemailer"]);
    console.log(`  [deps] smart-profile-cms (${count} packages)`);
  }

  /* مجلد بيانات الديمو يُنشأ فارغاً؛ يُعاد تعبئته تلقائياً عند التشغيل */
  fs.mkdirSync(path.join(DEMO_ROOT, "runtime-data"), { recursive: true });
  console.log(`\n تم تجهيز ${copied} نسخة ديمو داخل: ${DEMO_ROOT}`);
}

main();
