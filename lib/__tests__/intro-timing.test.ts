import { describe, expect, it } from 'vitest';
import BASE from '@/components/fx/start-timing.json';
import { compileTiming, DEFAULT_SETTINGS, sanitizeSettings, visualState, audioEvents, remainingEvent } from '@/lib/intro-timing';

describe('calage de l’intro', () => {
  it('cale la nouvelle musique sur un départ à 5s et conserve ses 12s', () => {
    const timing = compileTiming(DEFAULT_SETTINGS);
    expect(timing.lights).toEqual([500, 1250, 2000, 2750, 3500]);
    expect(timing.release).toBe(5000);
    expect(timing.end).toBe(12000);
    expect(timing.shots).toHaveLength(BASE.shots.length);
    expect(timing.shots.at(-1)?.at).toBe(timing.release);
    expect(timing.engineAt).toBe(0);
    expect(timing.engineSource).toBe(0);
  });
  it('garde les bips sur les feux et la dernière coupe sur le départ après un changement de rythme', () => {
    const timing = compileTiming({...DEFAULT_SETTINGS, firstLight: 1200, interval: 900, hold: 2100});
    expect(audioEvents(timing).filter((e) => e.kind === 'beep').map((e) => e.at)).toEqual(timing.lights);
    expect(timing.release).toBe(6900);
    expect(timing.shots.at(-1)?.at).toBe(timing.release);
    expect(timing.shots.map((s) => s.at)).toEqual([...timing.shots.map((s) => s.at)].sort((a, b) => a - b));
    expect(timing.shots[0].at).toBe(0);
    expect(timing.holdAt).toBeLessThan(timing.release);
  });
  it('éteint les cinq feux sur le repère exact, y compris après un seek', () => {
    const timing = compileTiming(DEFAULT_SETTINGS);
    expect(visualState(timing.release - .01, timing).lit).toBe(5);
    expect(visualState(timing.release, timing)).toMatchObject({lit: 0, released: true, shotIndex: 7});
    expect(visualState(0, timing).lit).toBe(0);
  });
  it('sépare le décalage perceptif de l’image et le montage du moteur', () => {
    const timing = compileTiming({...DEFAULT_SETTINGS, engineOffset: 120, visualOffset: 80});
    expect(timing.engineAt).toBe(120);
    expect(visualState(timing.release, timing).released).toBe(false);
    expect(visualState(timing.release + 80, timing).released).toBe(true);
  });
  it('reprend le moteur au bon endroit sans rejouer les bips déjà terminés', () => {
    const timing = compileTiming(DEFAULT_SETTINGS);
    const events = audioEvents(timing);
    expect(events.filter((e) => e.kind === 'beep').every((e) => remainingEvent(e, timing.release) === null)).toBe(true);
    expect(remainingEvent(events.at(-1)!, timing.release + 500)).toEqual({delay: 0, offset: 5500, duration: 4500});
    expect(remainingEvent(events.at(-1)!, timing.release - 500)).toEqual({delay: 0, offset: 4500, duration: 5500});
  });
  it('garde le moteur à zéro quand la cadence et l’attente des feux changent', () => {
    const timing = compileTiming({...DEFAULT_SETTINGS, interval: 1400, hold: 2100});
    expect(timing.engineAt).toBe(0);
    const engine = audioEvents(timing).find((event) => event.kind === 'engine')!;
    expect(engine).toMatchObject({at: 0, source: 0, duration: 10000});
    expect(remainingEvent(engine, 10000)).toBeNull();
  });
  it('reprend la fin d’un bip si la tête de lecture est placée dans ce bip', () => {
    expect(remainingEvent({kind: 'beep', at: 700, source: 0, duration: 260}, 750)).toEqual({delay: 0, offset: 50, duration: 210});
  });
  it('écarte les valeurs non finies ou hors limites des brouillons', () => {
    const settings = sanitizeSettings({firstLight: -100, interval: Infinity, engineOffset: '500', engineSource: 100000});
    expect(settings.firstLight).toBe(300);
    expect(settings.interval).toBe(DEFAULT_SETTINGS.interval);
    expect(settings.engineOffset).toBe(0);
    expect(settings.engineSource).toBe(8000);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
