import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { saveExpense, loadExpenses, getDB } from "../../db";
import { parsePaymentNotification, parseSmsPayment, getCategory } from "../../services/Catcher";

const { NotificationModule, SmsModule } = NativeModules;

type Expense = {
  id?: number;
  amount: number;
  merchant: string;
  category: string;
  source?: string;
  created_at?: string;
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

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "#94A3B8";
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) +
    " · " + d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatAmount(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}

export default function Home() {
  const [input, setInput] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalThisMonth, setTotalThisMonth] = useState(0);

  useEffect(() => {
    getDB().then(fetchExpenses);
    NotificationModule?.startListening();
    setupSms();

    const notifSub = DeviceEventEmitter.addListener("onNotification", async (event) => {
      const parsed = await parsePaymentNotification(event.packageName, event.title, event.text);
      if (parsed) {
        await saveExpense(parsed);
        fetchExpenses();
      }
    });

    const smsSub = DeviceEventEmitter.addListener("onSmsReceived", async (event) => {
      const parsed = await parseSmsPayment(event.sender, event.body);
      if (parsed) {
        await saveExpense(parsed);
        fetchExpenses();
      }
    });

    return () => {
      notifSub.remove();
      smsSub.remove();
    };
  }, []);

  const setupSms = async () => {
    if (Platform.OS !== "android") return;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: "SMS Permission",
        message: "KharchaAI needs SMS access to auto-track payments",
        buttonPositive: "Allow",
      }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    SmsModule?.startListening();
    const messages = await SmsModule?.readInbox();
    for (const sms of messages || []) {
      const parsed = await parseSmsPayment(sms.sender, sms.body);
      if (parsed) await saveExpense(parsed);
    }
    fetchExpenses();
  };

  const fetchExpenses = useCallback(async () => {
    const rows = await loadExpenses();
    setExpenses(rows);
    const now = new Date();
    const total = rows
      .filter((r: Expense) => {
        if (!r.created_at) return false;
        const d = new Date(r.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum: number, r: Expense) => sum + r.amount, 0);
    setTotalThisMonth(total);
  }, []);

  const addExpense = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const words = input.trim().split(" ");
    let amount = 0;
    let merchant = "";
    words.forEach((w) => {
      if (!isNaN(Number(w)) && Number(w) > 0) amount = Number(w);
      else merchant += w + " ";
    });
    merchant = merchant.trim() || "Unknown";
    await saveExpense({ amount, merchant, category: getCategory(merchant), source: "manual" });
    setInput("");
    await fetchExpenses();
    setLoading(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerLabel}>Spent this month</Text>
      <Text style={styles.headerAmount}>{formatAmount(totalThisMonth)}</Text>
      <Text style={styles.headerSub}>{expenses.length} transactions</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>💸</Text>
      <Text style={styles.emptyText}>No expenses yet</Text>
      <Text style={styles.emptySubText}>Your transactions will appear here automatically</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.categoryBar, { backgroundColor: getCategoryColor(item.category) }]} />
            <View style={styles.cardContent}>
              <View style={styles.cardTop}>
                <Text style={styles.merchant} numberOfLines={1}>{item.merchant}</Text>
                <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.inputBar}>
        <TextInput
          placeholder="e.g. 500 zomato"
          placeholderTextColor="#aaa"
          value={input}
          onChangeText={setInput}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={addExpense}
        />
        <TouchableOpacity style={styles.addButton} onPress={addExpense} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addButtonText}>+</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  listContent: {
    paddingBottom: 90,
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
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  categoryBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  merchant: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A2E",
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  category: {
    fontSize: 12,
    color: "#94A3B8",
  },
  time: {
    fontSize: 11,
    color: "#C0C0C0",
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
  inputBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A1A2E",
  },
  addButton: {
    backgroundColor: "#2563EB",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 28,
  },
});
