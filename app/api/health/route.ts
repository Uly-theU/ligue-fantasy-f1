import { NextResponse } from 'next/server';

/** GET /api/health — sonde Docker, sans auth, Prisma ni Supabase. */
export function GET() {
  return NextResponse.json({ ok: true });
}
