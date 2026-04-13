import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

type Params = { params: { id: string } }; // league_id

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// GET /api/leagues/[id]/chat — Récupérer les messages (paginé)
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    // Vérifier membership
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });
    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100);

    const messages = await prisma.leagueMessage.findMany({
      where: { league_id: params.id },
      include: {
        profile: { select: { username: true, display_name: true, avatar_url: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return NextResponse.json({
      messages: messages.reverse(), // ordre chronologique
      next_cursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (error) {
    console.error('GET /api/leagues/[id]/chat:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/leagues/[id]/chat — Envoyer un message
export async function POST(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { content } = sendMessageSchema.parse(body);

    // Vérifier membership
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });
    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const message = await prisma.leagueMessage.create({
      data: {
        league_id: params.id,
        user_id: user!.id,
        content,
      },
      include: {
        profile: { select: { username: true, display_name: true, avatar_url: true } },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/leagues/[id]/chat:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
