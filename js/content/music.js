// Background music, written as code and played live by js/host/music.js with the same synth as the
// sound effects (no audio files, nothing downloaded). Each song is a chord progression plus a few
// 16-step patterns; the tune on top is made up from the chords when the song starts, so it changes
// a little every time.
//
// Fields
//   id, title, scenes: where it plays ('lobby' | 'board' | 'minigame')
//   key: root note of the scale, scale: 'major' | 'minor' | 'minorPent' | 'majorPent'
//   bpm, swing (0 = straight, 0.3 = shuffle), gain (evens loud and quiet songs out)
//   chords: one per bar, e.g. 'G', 'Em', 'A5' (power chord), 'D7'
//   drums: { kick, snare, hat } as 16-step strings: x = hit, o = open hat, . = rest
//   bass: 16 steps, R = root, 3 / 5 / 8 = third, fifth, octave, - = rest (.)
//   comp: the chords' instrument ('keys' | 'pluck' | 'strum' | 'power' | 'trem') and its 16-step rhythm
//   lead: the tune's instrument ('whistle' | 'chip' | 'twang' | 'rock' | 'surf'), density 0..1, range [low, high] in MIDI
export const SONGS = [
  {
    id: 'arvo', title: 'Arvo at the Pub', scenes: ['lobby'],
    key: 'G', scale: 'majorPent', bpm: 88, swing: 0.3, gain: 1,
    chords: ['G', 'G', 'C', 'C', 'G', 'Em', 'C', 'D'],
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'R.....5.R...3.5.',
    comp: { inst: 'keys', rhythm: '....x.......x...' },
    lead: { inst: 'whistle', density: 0.45, range: [67, 86] },
  },
  {
    id: 'servo', title: 'Servo Run', scenes: ['board'],
    key: 'C', scale: 'major', bpm: 112, swing: 0, gain: 1,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    bass: 'R..R..R.5..5..5.',
    comp: { inst: 'pluck', rhythm: '..x...x...x...x.' },
    lead: { inst: 'chip', density: 0.6, range: [67, 88] },
  },
  {
    id: 'ute', title: 'Dusty Ute', scenes: ['board', 'lobby'],
    key: 'D', scale: 'majorPent', bpm: 124, swing: 0.12, gain: 1.25,
    chords: ['D', 'D', 'G', 'A', 'D', 'D', 'A', 'D'],
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x...x...x...x...' },
    bass: 'R.......5.......',
    comp: { inst: 'strum', rhythm: '....x.x.....x.x.' },
    lead: { inst: 'twang', density: 0.5, range: [62, 83] },
  },
  {
    id: 'flatout', title: 'Flat Out', scenes: ['minigame'],
    key: 'E', scale: 'minorPent', bpm: 152, swing: 0, gain: 0.85,
    chords: ['E5', 'E5', 'G5', 'A5', 'E5', 'E5', 'D5', 'B5'],
    drums: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'R.R.R.R.R.R.R.R.',
    comp: { inst: 'power', rhythm: 'x.x.x.x.x.x.x.x.' },
    lead: { inst: 'rock', density: 0.55, range: [64, 84] },
  },
  {
    id: 'thongs', title: 'Thongs On', scenes: ['minigame'],
    key: 'A', scale: 'minor', bpm: 140, swing: 0, gain: 1,
    chords: ['Am', 'Am', 'G', 'G', 'F', 'F', 'E', 'E'],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo' },
    bass: 'R.5.8.5.R.5.8.5.',
    comp: { inst: 'trem', rhythm: 'x.......x.......' },
    lead: { inst: 'surf', density: 0.5, range: [64, 84] },
  },
];
