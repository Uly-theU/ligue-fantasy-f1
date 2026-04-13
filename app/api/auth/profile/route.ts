import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const updateProfileSchema = z.object({
  username: z.string().min(1).max(30).optional(),
  display_name: z.string().max(50).optional(),
  avatar_url: z.string().url().optional(),
});

// GET /api/auth/profile — Mon profil complet
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: user!.id },
      include: {
        fantasy_teams: {
          select: {
            id: true,
            name: true,
            total_points: true,
            league: { select: { id: true, name: true, season: true } },
          },
        },
        leagues: {
          select: {
            league: { select: { id: true, name: true, status: true } },
            role: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ message: 'Profil introuvable' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('GET /api/auth/profile:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/auth/profile — Mettre à jour mon profil
export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const data = updateProfileSchema.parse(body);

    const profile = await prisma.profile.update({
      where: { id: user!.id },
      data,
    });

    return NextResponse.json({ message: 'Profil mis à jour', profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('PATCH /api/auth/profile:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
