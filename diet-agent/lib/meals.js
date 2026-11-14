// Meal data access: download, schema validation and the filters used by
// option 1 (local, no LLM) and by the MCP tools (favorites / monthly summary).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const INPUT_DIR = path.join(ROOT, 'input');
export const MEALS_FILE = path.join(INPUT_DIR, 'meals.json');
const SHORT_URL = 'https://topt.al/r6cvQM';
const ALLOWED_HOSTS = ['git.toptal.com'];
const MAX_BYTES = 20 * 1024 * 1024;

// Spec says favorite is bool but also filters on str "true": accept both.
const boolish = z.union([z.boolean(), z.string()]).transform((v) => String(v).toLowerCase() === 'true');

// Source data ships some numeric fields as strings ("18", "91.88"): coerce them.
const int = z.coerce.number().int();
const num = z.coerce.number().finite();

const MealSchema = z.object({
  id: int,
  user_id: int,
  age: int,
  user_weight: num,
  name: z.string(),
  price: num,
  weight: int,
  calories: int,
  fat: num,
  carbs: num,
  protein: num,
  time_consumed: z.string().regex(/^\d{2}:\d{2}$/),
  date_consumed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  favorite: boolish,
  procedence: z.enum(['homemade', 'purchased']),
});

/** Resolve the short link redirect, then download the JSON into ./input/meals.json */
export async function ensureMealsFile(log = console.log) {
  if (fs.existsSync(MEALS_FILE)) return;
  log(`input/meals.json missing, resolving ${SHORT_URL} ...`);
  const head = await fetch(SHORT_URL, { redirect: 'manual' });
  const target = new URL(head.headers.get('location') || SHORT_URL, SHORT_URL);
  // Only follow the redirect to the known data host over https.
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname))
    throw new Error(`Refusing to download from unexpected location: ${target}`);
  log(`Downloading ${target} ...`);
  const res = await fetch(target, { redirect: 'error' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('Downloaded file is unexpectedly large');
  if (!Array.isArray(JSON.parse(text))) throw new Error('Downloaded data is not a JSON array'); // fail before writing
  fs.mkdirSync(INPUT_DIR, { recursive: true });
  fs.writeFileSync(MEALS_FILE, text);
  log(`Saved ${MEALS_FILE}`);
}

let cache = null;
/** Load + validate all meals once; invalid records are skipped and counted. */
export function loadMeals() {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(MEALS_FILE, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('meals.json must be a JSON array');
  const meals = [];
  let invalid = 0;
  for (const r of raw) {
    const p = MealSchema.safeParse(r);
    if (p.success) meals.push(p.data);
    else invalid++;
  }
  cache = { meals, invalid };
  return cache;
}

const stamp = (m) => `${m.date_consumed} ${m.time_consumed}`;
const byDateDesc = (a, b) => stamp(b).localeCompare(stamp(a));
export const mealsForUser = (userId) => loadMeals().meals.filter((m) => m.user_id === Number(userId));

/** Option 1: full history sorted desc, formatted lines (caller shows first/last 3). */
export function historyLines(userId) {
  return mealsForUser(userId)
    .sort(byDateDesc)
    .map((m) => `${m.date_consumed} ${m.time_consumed} ${m.type} ${m.procedence} ${m.name}`);
}

/** MCP tool 1: favorites only, 30 most recent, compact fields. */
export function recentFavorites(userId, limit = 30) {
  return mealsForUser(userId)
    .filter((m) => m.favorite)
    .sort(byDateDesc)
    .slice(0, limit)
    .map((m) => ({
      d: stamp(m),
      t: m.type,
      n: m.name,
      kcal: m.calories,
      p: m.protein,
      c: m.carbs,
      f: m.fat,
      src: m.procedence,
    }));
}


/** MCP tool 2: per-month total calories + highest/lowest priced meal. */
export function monthlySummary(userId) {
  const months = new Map();
  for (const m of mealsForUser(userId)) {
    const key = m.date_consumed.slice(0, 7);
    const s = months.get(key) ?? { month: key, meals: 0, kcal: 0, max: m, min: m };
    s.meals++;
    s.kcal += m.calories;
    if (m.price > s.max.price) s.max = m;
    if (m.price < s.min.price) s.min = m;
    months.set(key, s);
  }
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((s) => ({
      month: s.month,
      meals: s.meals,
      kcal: s.kcal,
      maxPrice: { n: s.max.name, price: s.max.price },
      minPrice: { n: s.min.name, price: s.min.price },
    }));
}
