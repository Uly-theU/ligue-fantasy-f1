import { describe, expect, it } from 'vitest';
import { chosenUsername, profileUsername, usernameLooksGenerated } from '@/lib/ensure-profile';

describe('profil local depuis un compte Supabase', () => {
  it('garde un identifiant court, stable et sans caractères spéciaux', () => {
    const name = profileUsername({
      id: '11111111-2222-4333-8444-555555555555',
      email: 'Ulysse.F1+beta@example.com',
    });
    expect(name).toBe('ulyssef1beta11111111');
    expect(name.length).toBeLessThanOrEqual(30);
    expect(profileUsername({
      id: '11111111-2222-4333-8444-555555555555',
      email: 'Ulysse.F1+beta@example.com',
    })).toBe(name);
  });

  it('retombe sur un préfixe quand l’e-mail est absent', () => {
    expect(profileUsername({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', email: null })).toBe(
      'piloteaaaaaaaa',
    );
  });
});

describe('chosenUsername', () => {
  it('garde le pseudo d’un joueur de test', () => {
    expect(chosenUsername({ user_metadata: { username: 'camille' } })).toBe('camille');
  });

  it('ignore un pseudo libre ou orné', () => {
    expect(chosenUsername({ user_metadata: { username: 'Camille Morel' } })).toBeNull();
    expect(chosenUsername({ user_metadata: {} })).toBeNull();
  });
});

describe('usernameLooksGenerated', () => {
  const id = '11111111-2222-4333-8444-555555555555';

  it('reconnaît le pseudo fabriqué depuis l’e-mail et depuis l’id seul', () => {
    expect(usernameLooksGenerated(profileUsername({
      id,
      email: 'Ulysse.F1+beta@example.com',
    }), id)).toBe(true);
    expect(usernameLooksGenerated(
      profileUsername({ id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', email: null }),
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    )).toBe(true);
  });

  it('accepte un préfixe nettoyé d’au plus 20 caractères collé aux 8 hex', () => {
    expect(usernameLooksGenerated(`${'a'.repeat(20)}11111111`, id)).toBe(true);
    expect(usernameLooksGenerated(`${'a'.repeat(21)}11111111`, id)).toBe(false);
  });

  it('ignore un pseudo déjà choisi', () => {
    expect(usernameLooksGenerated('ulysse', id)).toBe(false);
    expect(usernameLooksGenerated('Ulysse11111111', id)).toBe(false);
    expect(usernameLooksGenerated('11111111', id)).toBe(false);
    expect(usernameLooksGenerated('ulyssef1beta11111111', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe(false);
  });
});
