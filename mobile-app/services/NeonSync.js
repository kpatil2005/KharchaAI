// During development: your PC's IP on port 3000
// After deployment: replace with your Vercel URL e.g. https://kharchaai.vercel.app
const API_BASE = "http://10.17.172.77:3000";

export async function syncExpenseToNeon(expense) {
  try {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: "kalpesh_rmx1925",
        amount: expense.amount,
        merchant: expense.merchant,
        category: expense.category,
        source: expense.source ?? "auto",
        created_at: expense.created_at ?? new Date().toISOString(),
      }),
    });
    return await res.json();
  } catch {
    // Silently fail — local SQLite is the source of truth
  }
}

export async function initNeonTable() {
  // Table is created automatically by the API on first request
}
