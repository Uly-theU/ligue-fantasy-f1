import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const feedbackSchema = z.object({
  category: z.enum(['bug', 'suggestion', 'ui', 'autre']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  page_url: z.string().max(500).optional(),
});

// POST /api/beta — Soumettre un feedback
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const data = feedbackSchema.parse(body);

    const feedback = await prisma.betaFeedback.create({
      data: {
        user_id: user!.id,
        ...data,
      },
    });

    return NextResponse.json({ message: 'Feedback envoyé, merci !', feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/beta:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/beta — Liste des feedbacks de l'utilisateur
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const feedbacks = await prisma.betaFeedback.findMany({
      where: { user_id: user!.id },
      orderBy: { created_at: 'desc' },
      include: { profile: { select: { username: true, display_name: true } } },
    });

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('GET /api/beta:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
