# YXO film — music brief

Soundtrack for the ~46-second YXO film. The film cuts on the downbeat every two bars,
so the song should hold a steady **75 BPM in 4/4** (one bar = 3.2 s).

## Style prompt

```
uplifting cinematic electronica, 75 bpm, 4/4, D major, warm analog synth pads, plucked arpeggios that double in speed, soft felt piano, glassy bell melody, gentle sub bass, light brushed percussion building to a full four-on-the-floor kick, airy youthful vocals, choir swell on the chorus, hopeful, curious, optimistic, wide stereo, clean modern mix, quiet intro, steady build, sudden full stop before the final chord, long reverb tail ending
```

Shorter version, if the generator caps the prompt length:

```
hopeful cinematic electronica, 75 bpm, warm synth pads, doubling plucked arpeggios, bell melody, building kick, airy youthful vocals, choir swell, sudden silence, final ringing chord
```

## Lyrics

The lines come from the YXO site copy. Section tags follow the usual `[Section]`
format. Bar counts line up with the film's shots.

```
[Intro]
(instrumental — soft pads, single bell notes, 2 bars)

[Verse]
Young minds, extraordinary
Think ten times bigger than before
Change is accelerating
Don't get disrupted, open the door

[Build]
AI is a superpower
One you can master, one you can steer
Find the problems in your city
Build the answer, start it here

[Chorus]
Unleash, unleash
Young extraordinary potential

[Break]
(full stop — one breath of silence)

[Outro]
(final chord rings out)
Your odyssey starts now
```

## Timing the film expects

| Time        | Bars  | Section | Shot         |
| ----------- | ----- | ------- | ------------ |
| 0.0 – 6.4   | 1–2   | Intro   | the field    |
| 6.4 – 12.8  | 3–4   | Verse   | the doubling |
| 12.8 – 19.2 | 5–6   | Verse   | the curve    |
| 19.2 – 25.6 | 7–8   | Build   | the current  |
| 25.6 – 32.0 | 9–10  | Build   | the city     |
| 32.0 – 38.4 | 11–12 | Chorus  | the spiral   |
| 38.4 – ~40  | —     | Break   | the hole     |
| ~40 – 46.4  | 13–14 | Outro   | the mark     |

Generators usually return a longer track, so you'll need to pick a 46-second window from it.
`film/analyze.mjs` scans the whole file for the window with the best arc (quiet
open, build, drop-out near the end) and rebuilds `score.js` and `score.mp3` from it.
