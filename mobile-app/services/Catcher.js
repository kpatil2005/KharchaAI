const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a financial SMS parser for Indian bank messages.
Extract payment info and return ONLY a raw JSON object with these keys:
- amount: number (the debited amount)
- merchant: string (who was paid, use UPI ID if no name found)
- category: string (one of exactly: Food, Travel, Fuel, Shopping, Entertainment, Bills, Other)
If this is NOT a debit/payment SMS, return exactly: null
No explanation. No markdown. No code blocks. Just raw JSON or null.`;

async function parseWithGroq(text) {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content === "null") return null;

    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(content);
    if (!parsed?.amount || parsed.amount <= 0) return null;

    return {
      amount: Number(parsed.amount),
      merchant: parsed.merchant || "Unknown",
      category: `${parsed.category || "Other"} ${getCategoryEmoji(parsed.category)}`,
    };
  } catch {
    return null;
  }
}

function getCategoryEmoji(category = "") {
  const map = {
    Food: "🍔", Travel: "🚗", Fuel: "⛽",
    Shopping: "🛍️", Entertainment: "🎬", Bills: "💡", Other: "📦",
  };
  return map[category] || "📦";
}

export function getCategory(merchant = "") {
  const m = merchant.toLowerCase();
  if (m.includes("zomato") || m.includes("swiggy") || m.includes("food")) return "Food 🍔";
  if (m.includes("uber") || m.includes("ola") || m.includes("rapido")) return "Travel 🚗";
  if (m.includes("petrol") || m.includes("fuel")) return "Fuel ⛽";
  if (m.includes("amazon") || m.includes("flipkart") || m.includes("myntra")) return "Shopping 🛍️";
  if (m.includes("netflix") || m.includes("spotify") || m.includes("prime")) return "Entertainment 🎬";
  if (m.includes("electricity") || m.includes("water") || m.includes("bill")) return "Bills 💡";
  return "Other 📦";
}

const PAYMENT_APPS = [
  "com.google.android.apps.nbu.paisa.user",
  "net.one97.paytm",
  "com.phonepe.app",
  "in.amazon.mShop.android.shopping",
  "com.whatsapp",
  "com.axis.mobile",
  "com.sbi.lotusintouch",
  "com.hdfc.mobilebanking",
  "com.icici.mobilebanking",
  "com.kotak.mobilebanking",
];

const BANK_SENDERS = [
  "BOBSMS", "BOBTXN", "SBIUPI", "ICICIB", "AXISBK",
  "KOTAKB", "HDFCBK", "PNBSMS", "CBSSBI", "PAYTM",
  "GPAY", "PHONEPE", "YESBNK",
];

const DEBIT_KEYWORDS = ["debited", "paid", "sent", "deducted", "spent", "payment of", "withdrawn"];

export async function parsePaymentNotification(packageName, title, text) {
  if (!text) return null;
  const isPaymentApp = PAYMENT_APPS.includes(packageName);
  const isDebit = DEBIT_KEYWORDS.some((k) => text.toLowerCase().includes(k));
  if (!isPaymentApp && !isDebit) return null;
  return await parseWithGroq(text);
}

export async function parseSmsPayment(sender, body) {
  if (!body) return null;
  const senderUpper = (sender || "").toUpperCase();
  const isBank = BANK_SENDERS.some((s) => senderUpper.includes(s));
  const isDebit = DEBIT_KEYWORDS.some((k) => body.toLowerCase().includes(k));
  if (!isBank && !isDebit) return null;
  const result = await parseWithGroq(body);
  return result ? { ...result, source: "auto" } : null;
}
