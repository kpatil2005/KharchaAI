import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      amount NUMERIC NOT NULL,
      merchant TEXT,
      category TEXT,
      source TEXT DEFAULT 'auto',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { device_id, amount, merchant, category, source, created_at } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO expenses (device_id, amount, merchant, category, source, created_at)
      VALUES (${device_id ?? "unknown"}, ${amount}, ${merchant}, ${category}, ${source ?? "auto"}, ${created_at ?? new Date().toISOString()})
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0].id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureTable();
    const rows = await sql`SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await sql`TRUNCATE TABLE expenses RESTART IDENTITY`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
