import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function getExpenses() {
  try {
    return await sql`SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100`;
  } catch {
    return [];
  }
}

function formatAmount(amount: number) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food 🍔": "#FF6B6B",
  "Travel 🚗": "#4ECDC4",
  "Fuel ⛽": "#FFE66D",
  "Shopping 🛍️": "#A78BFA",
  "Entertainment 🎬": "#F97316",
  "Bills 💡": "#60A5FA",
  "Other 📦": "#94A3B8",
};

export default async function Dashboard() {
  const expenses = await getExpenses();

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  const byCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    const cat = e.category || "Other 📦";
    acc[cat] = (acc[cat] || 0) + Number(e.amount);
    return acc;
  }, {});

  const categoryStats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">KharchaAI</h1>
          <p className="text-gray-500 mt-1">Expense Dashboard</p>
        </div>

        {/* Total Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <p className="text-sm text-gray-400 uppercase tracking-wide font-medium">Total Spent</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">{formatAmount(total)}</p>
          <p className="text-sm text-gray-400 mt-1">{expenses.length} transactions</p>
        </div>

        {/* Category Breakdown */}
        {categoryStats.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Category</h2>
            <div className="space-y-4">
              {categoryStats.map(([cat, amount]) => (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat}</span>
                    <span className="text-sm font-bold text-gray-900">{formatAmount(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min((amount / total) * 100, 100)}%`,
                        backgroundColor: CATEGORY_COLORS[cat] ?? "#94A3B8",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transactions</h2>
          </div>
          {expenses.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-400">No transactions yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {expenses.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[e.category] ?? "#94A3B8" }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{e.merchant || "Unknown"}</p>
                      <p className="text-xs text-gray-400">{e.category} · {formatDate(e.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatAmount(Number(e.amount))}</p>
                    <p className="text-xs text-gray-400">{e.source}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
