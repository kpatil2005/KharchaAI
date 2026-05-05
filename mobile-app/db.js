import * as SQLite from "expo-sqlite";
import { syncExpenseToNeon } from "./services/NeonSync";

let db;
const recentlySaved = new Set(); // dedup cache

export async function getDB() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("kharchaai.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        merchant TEXT,
        category TEXT,
        source TEXT DEFAULT 'manual',
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  }
  return db;
}

export async function saveExpense({ amount, merchant, category, source = "auto" }) {
  // Dedup: same amount + merchant within 10 seconds = duplicate
  const key = `${amount}-${merchant}`;
  if (recentlySaved.has(key)) return;
  recentlySaved.add(key);
  setTimeout(() => recentlySaved.delete(key), 10000);

  const database = await getDB();
  await database.runAsync(
    "INSERT INTO expenses (amount, merchant, category, source) VALUES (?, ?, ?, ?)",
    [amount, merchant, category, source]
  );

  syncExpenseToNeon({ amount, merchant, category, source }).catch(() => {});
}

export async function loadExpenses() {
  const database = await getDB();
  return await database.getAllAsync("SELECT * FROM expenses ORDER BY id DESC LIMIT 100");
}
