import * as SQLite from "expo-sqlite";
import { syncExpenseToNeon, initNeonTable } from "./services/NeonSync";

let db;

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
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
    initNeonTable();
  }
  return db;
}

export async function saveExpense({ amount, merchant, category, source = "auto" }) {
  const database = await getDB();
  await database.runAsync(
    "INSERT INTO expenses (amount, merchant, category, source) VALUES (?, ?, ?, ?)",
    [amount, merchant, category, source]
  );

  // Sync to Neon in background — don't block UI
  syncExpenseToNeon({ amount, merchant, category, source }).catch(() => {});
}

export async function loadExpenses() {
  const database = await getDB();
  return await database.getAllAsync("SELECT * FROM expenses ORDER BY id DESC LIMIT 100");
}
