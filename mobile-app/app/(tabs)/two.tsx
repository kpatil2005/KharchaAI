import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { loadExpenses } from "../../db";

type Expense = {
  id?: number;
  amount: number;
  merchant: string;
  category: string;
  source?: string;
  created_at?: string;
};

type CategoryStat = {
  category: string;
  total: number;
  count: number;
  color: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Food 🍔": "#FF6B6B",
  "Travel 🚗": "#4ECDC4",
  "Fuel ⛽": "#FFE66D",
  "Shopping 🛍️": "#A78BFA",
  "Entertainment 🎬": "#F97316",
  "Bills 💡": "#60A5FA",
  "Other 📦": "#94A3B8",
};

function formatAmount(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}

function getMonthName() {
  return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Summary() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [topMerchants, setTopMerchants] = useState<{ merchant: string; amount: number }[]>([]);

  const fetchStats = useCallback(async () => {
    const rows: Expense[] = await loadExpenses();
    const now = new Date();

    const thisMonth = rows.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthTotal = thisMonth.reduce((s, r) => s + r.amount, 0);
    setTotal(monthTotal);
    setTotalCount(thisMonth.length);

    // Category breakdown
    const catMap: Record<string, { total: number; count: number }> = {};
    thisMonth.forEach((r) => {
      const cat = r.category || "Other 📦";
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
      catMap[cat].total += r.amount;
      catMap[cat].count += 1;
    });

    const catStats = Object.entries(catMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        color: CATEGORY_COLORS[category] ?? "#94A3B8",
      }))
      .sort((a, b) => b.total - a.total);

    setStats(catStats);

    // Top merchants
    const merchantMap: Record<string, number> = {};
    thisMonth.forEach((r) => {
      const m = r.merchant || "Unknown";
      merchantMap[m] = (merchantMap[m] || 0) + r.amount;
    });

    const top = Object.entries(merchantMap)
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    setTopMerchants(top);
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerLabel}>{getMonthName()}</Text>
        <Text style={styles.headerAmount}>{formatAmount(total)}</Text>
        <Text style={styles.headerSub}>{totalCount} transactions</Text>
      </View>

      {stats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category</Text>
          {stats.map((item) => (
            <View key={item.category} style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.statInfo}>
                <View style={styles.statTop}>
                  <Text style={styles.statCategory}>{item.category}</Text>
                  <Text style={styles.statAmount}>{formatAmount(item.total)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: item.color,
                        width: `${Math.min((item.total / total) * 100, 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statCount}>{item.count} transactions</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {topMerchants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Merchants</Text>
          {topMerchants.map((item, index) => (
            <View key={item.merchant} style={styles.merchantRow}>
              <View style={styles.merchantRank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <Text style={styles.merchantName} numberOfLines={1}>{item.merchant}</Text>
              <Text style={styles.merchantAmount}>{formatAmount(item.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {stats.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No data this month</Text>
          <Text style={styles.emptySubText}>Your spending summary will appear here</Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1A1A2E",
    marginTop: 4,
  },
  headerSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statCategory: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1A1A2E",
  },
  statAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  barTrack: {
    height: 4,
    backgroundColor: "#F0F0F0",
    borderRadius: 2,
    marginBottom: 4,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  statCount: {
    fontSize: 11,
    color: "#94A3B8",
  },
  merchantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  merchantRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  merchantName: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A2E",
    fontWeight: "500",
  },
  merchantAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  emptySubText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
