const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a strict Indian bank SMS parser. Your only job is to extract real DEBIT payment transactions.

RULES:
1. ONLY process messages where money is going OUT (debited/paid/sent/deducted/withdrawn)
2. STRICTLY IGNORE: credited, received, OTPs, offers, promotions, data alerts, recharge confirmations, fraud warnings, balance enquiries, Jio/telecom messages, "not you" alerts
3. STRICTLY IGNORE any message where someone sent YOU money
4. For merchant: use REAL business name only. NEVER use UPI IDs like xyz@ybl or paytmqr123. NEVER use ref numbers. NEVER use bank names like BOB/SBI as merchant
5. If UPI ID contains a known brand (zomato, swiggy, uber, amazon, flipkart, netflix, spotify) use that brand name
6. If UPI ID is a personal ID (name@bank) → category is Transfer, merchant is the person's name from the SMS if available, else "Personal Transfer"
7. If UPI ID is a shop QR (paytmqr..., @ptys, @paytm) → merchant is "Local Shop", category is Shopping
8. Category must be one of: Food, Travel, Fuel, Shopping, Entertainment, Bills, Education, Health, Transfer, Other

Return ONLY raw JSON: {"amount": number, "merchant": string, "category": string}
If not a debit payment SMS, return exactly: null
No explanation. No markdown. No code blocks.

Examples:
"Rs 500 debited to zomato@icici" → {"amount": 500, "merchant": "Zomato", "category": "Food"}
"Rs 45 debited to paytmqr6hizow@ptys" → {"amount": 45, "merchant": "Local Shop", "category": "Shopping"}
"Rs 1500 debited to madurwarsakshi@oksbi" → {"amount": 1500, "merchant": "Sakshi Madurwar", "category": "Transfer"}
"credited INR 500 to your account" → null
"Your OTP is 1234" → null
"50% data quota used" → null
"Rs 239 recharge successful" → null`;

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
        max_tokens: 100,
      }),
    });

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content === "null") return null;

    // Strip markdown if present
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
    Food: "🍔", Travel: "🚗", Fuel: "⛽", Shopping: "🛍️",
    Entertainment: "🎬", Bills: "💡", Education: "📚",
    Health: "🏥", Transfer: "💸", Other: "📦",
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
