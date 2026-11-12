"""Render the cinematic intro (Python, numpy, soundfile with MP3 support).

Original instrumental/effects and adapted mix: CC BY-SA 3.0.
Engine source: public/audio/CREDITS.txt. Shared picture/audio cues:
components/fx/start-timing.json. Output is PCM to avoid encoder cue offsets.
"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
cues = json.loads((ROOT / 'components/fx/start-timing.json').read_text())
engine, rate = sf.read(ROOT / 'public/audio/brawn-start.mp3', always_2d=True)
length = round(cues['end'] / 1000 * rate)
t = np.arange(length) / rate
release = cues['release'] / 1000
music = np.zeros((length, 2))
effects = np.zeros_like(music)
engine_bus = np.zeros_like(music)
rng = np.random.default_rng(2026)


def add(bus, signal, start, gain=1, pan=0):
    offset = round(start * rate)
    count = min(len(signal), length - offset)
    if count <= 0:
        return
    signal = signal[:count]
    if signal.ndim == 1:
        signal = np.column_stack([signal * (1 - pan * .35), signal * (1 + pan * .35)])
    bus[offset:offset + count] += signal * gain


# Original minor-key electronic score. Detuned, layered harmonics give the pad
# width; the upper part opens as the cut frequency increases.
gate = np.clip(t / 1.4, 0, 1)
for voice, frequency in enumerate([82.4069, 123.4708, 164.8138, 195.9977, 246.9417]):
    tone = np.zeros(length)
    for harmonic in range(1, 6):
        opening = .2 + .8*np.clip((t - harmonic*.5)/6, 0, 1)
        phase = 2*np.pi*frequency*harmonic*t
        tone += (np.sin(phase) + .45*np.sin(phase*1.0018)) * opening / harmonic**2
    add(music, tone * gate, 0, .028, (-.7 if voice % 2 else .7))

# E-minor ostinato at 160 BPM, gentle ping-pong delays and increasing percussion.
beat = .375
for i, onset in enumerate(np.arange(.7, release-.35, beat)):
    u = np.arange(round(.5*rate)) / rate
    note = [164.8138, 246.9417, 329.6276, 293.6648, 195.9977, 246.9417, 391.9954, 329.6276][i % 8]
    env = np.minimum(u/.012, 1)*np.exp(-u*12)
    arp = (np.sin(2*np.pi*note*u) + .3*np.sin(2*np.pi*note*2*u)) * env
    add(music, arp, onset, .04, .7 if i % 2 else -.7)
    add(music, arp, onset+beat*.75, .013, -.7 if i % 2 else .7)
    if i % 2 == 0:
        kick = np.sin(2*np.pi*(43*u+5*(1-np.exp(-u*35))))*np.exp(-u*16)
        add(music, kick, onset, .16)
    if i % 4 == 2:
        noise = rng.normal(0, 1, len(u))
        snare = np.concatenate([[0], np.diff(noise)])*.5*np.exp(-u*32)
        snare += np.sin(2*np.pi*165*u)*np.exp(-u*25)*.4
        add(music, snare, onset, .035)
    if i >= 12:
        tick = np.concatenate([[0], np.diff(rng.normal(0,1,len(u)))])*np.exp(-u*110)
        add(music, tick, onset+beat/2, .012, (-1 if i % 2 else 1)*.7)

# Soft stereo air movement at picture cuts, with a slow rising texture.
for shot in cues['shots'][1:]:
    at = shot['at']/1000
    if at >= release:
        continue
    u = np.arange(round(.42*rate))/rate
    air = rng.normal(0,1,len(u))
    air = np.convolve(air, np.ones(12)/12, mode='same')
    env = np.sin(np.pi*np.clip(u/.42,0,1))**2
    add(music, air*env, max(0,at-.23), .045, .4)
noise = rng.normal(0,1,length)
noise = np.convolve(noise, np.ones(20)/20, mode='same')
rise = np.clip((t-3)/5.3,0,1)**2
add(music, noise*rise, 0, .028)

# Short reverberation gives depth. Cut the complete music bus before launch.
for delay,gain in [(.107,.12),(.219,.08),(.337,.045)]:
    samples = round(delay*rate)
    music[samples:] += music[:-samples,::-1].copy()*gain
# Separate instrumental stem, without the launch duck baked in.
# Runtime schedules this envelope with the selected lights-out cue.
(Path(ROOT/'public/audio/intro')).mkdir(exist_ok=True)
sf.write(ROOT/'public/audio/intro/music.wav', music, rate, subtype='PCM_16')
music *= (np.clip((release-.20-t)/.22,0,1)*gate)[:,None]

# True engine idle, extended with overlapping fades, then a deliberate breath.
idle = engine[round(.65*rate):round(2.65*rate)]
overlap = round(.12*rate)
cursor = 0
while cursor < round(release*rate):
    segment = idle.copy()
    segment[:overlap] *= np.linspace(0,1,overlap)[:,None]
    segment[-overlap:] *= np.linspace(1,0,overlap)[:,None]
    add(engine_bus, segment, cursor/rate, 1.5)
    cursor += len(idle)-overlap
engine_bus *= (np.clip((release-.07-t)/.12,0,1)*np.clip(t/.65,0,1))[:,None]

# Countdown effects: precise onset, rounded attack and restrained room tail.
for cue in cues['lights']:
    u = np.arange(round(.15*rate))/rate
    env = np.minimum(u/.003,1)*np.minimum((.15-u)/.025,1)
    tone = (.83*np.sin(2*np.pi*880*u)+.17*np.sin(2*np.pi*1760*u))*env
    add(effects,tone,cue/1000,.14)
    add(effects,tone,cue/1000+.045,.018,-.4)
    add(effects,tone,cue/1000+.09,.008,.4)

# The acceleration attack lands exactly on the lights-out sample.
launch = engine[round(cues['engineDepartureSource']/1000*rate):].copy()
attack = round(.005*rate)
launch[:attack] *= np.linspace(0,1,attack)[:,None]
add(engine_bus,launch,release,1.2)
u = np.arange(round((cues['end']/1000-release)*rate))/rate
impact = np.sin(2*np.pi*(38*u+2*(1-np.exp(-u*12))))*np.exp(-u*3)*np.minimum(u/.006,1)
add(effects,impact,release,.18)
# A final wide harmonic resolution sits beneath the car.
for frequency in [82.4069,123.4708,164.8138]:
    add(music,np.sin(2*np.pi*frequency*u)*np.exp(-u*2)*np.minimum(u/.1,1),release,.025)
mix = np.tanh((music+engine_bus+effects)*1.15)
mix *= np.clip((cues['end']/1000-t)/.7,0,1)[:,None]
peak = np.max(np.abs(mix))
if peak > .88:
    mix *= .88/peak
sf.write(ROOT/'public/audio/start-grid-mix-v3.wav',mix,rate,subtype='PCM_16')
print(f'Rendered {length/rate:.3f}s; peak {np.max(np.abs(mix)):.3f}; launch {release:.3f}s')
