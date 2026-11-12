import { describe, expect, it } from 'vitest';
import { audioClip, delayDeparture, dragClip, editAudioClip, timecode } from '@/lib/intro-studio';
import { compileTiming, DEFAULT_SETTINGS } from '@/lib/intro-timing';

describe('montage dans le studio', () => {
  it('ajoute dix secondes d’attente sans déplacer le moteur ni les allumages', () => {
    const original = compileTiming(DEFAULT_SETTINGS);
    const extended = compileTiming(delayDeparture(DEFAULT_SETTINGS, 10000));
    expect(extended.release).toBe(15000);
    expect(extended.end).toBe(22000);
    expect(extended.lights).toEqual(original.lights);
    expect(extended.engineAt).toBe(0);
    expect(extended.musicOffset).toBe(0);
    expect(extended.shots.at(-1)?.at).toBe(15000);
  });
  it('décale la musique de la durée réellement ajoutée si demandé', () => {
    const moved = delayDeparture(DEFAULT_SETTINGS, 3000, true);
    expect(moved.musicOffset).toBe(3000);
    expect(moved.engineOffset).toBe(0);
    const clamped = delayDeparture(DEFAULT_SETTINGS, -10000, true);
    expect(clamped.hold).toBe(100);
    expect(clamped.musicOffset).toBe(0);
  });
  it('rogne le début sans déplacer la fin et conserve l’entrée source au seek', () => {
    const clip = audioClip(DEFAULT_SETTINGS, 'engine');
    const trimmed = dragClip(clip, 'left', 2000);
    expect(trimmed).toMatchObject({at: 2000, source: 2000, duration: 8000});
    expect(trimmed.at + trimmed.duration).toBe(10000);
    const settings = editAudioClip(DEFAULT_SETTINGS, 'engine', trimmed);
    expect(audioClip(settings, 'engine')).toEqual(trimmed);
  });
  it('empêche les bords de dépasser le fichier ou de produire une durée négative', () => {
    const clip = {at: 1000, source: 500, duration: 3000, available: 10000};
    expect(dragClip(clip, 'left', -5000)).toMatchObject({at: 500, source: 0, duration: 3500});
    expect(dragClip(clip, 'left', 5000)).toMatchObject({at: 3900, source: 3400, duration: 100});
    expect(dragClip(clip, 'right', 50000).duration).toBe(9500);
    expect(dragClip(clip, 'move', -5000).at).toBe(0);
  });
  it('affiche un timer précis y compris au passage de la minute', () => {
    expect(timecode(59999)).toBe('00:59.999');
    expect(timecode(60000)).toBe('01:00.000');
    expect(timecode(-1)).toBe('00:00.000');
  });
});
