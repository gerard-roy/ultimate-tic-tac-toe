/** A small catalogue of real stars. Figures are rounded; several are uncertain by 10% or more. */
export interface Star {
  name: string;
  constellation: string;
  /** Apparent magnitude: lower is brighter. */
  mag: number;
  /** Radius in Suns, or null when this catalogue has no figure for it. */
  radius: number | null;
  /** Surface temperature in kelvin. */
  temp: number;
  kind: string;
  /** Distance in light-years. */
  ly: number;
  note: string;
}

export const STARS: Star[] = [
  { name: 'Sirius', constellation: 'Canis Major', mag: -1.46, radius: 1.7, temp: 9900, kind: 'main-sequence star', ly: 8.6, note: 'The brightest star in the night sky.' },
  { name: 'Canopus', constellation: 'Carina', mag: -0.74, radius: 71, temp: 7400, kind: 'bright giant', ly: 310, note: 'Spacecraft use it to find their bearings.' },
  { name: 'Arcturus', constellation: 'Boötes', mag: -0.05, radius: 25, temp: 4300, kind: 'red giant', ly: 37, note: 'The brightest star in the northern sky.' },
  { name: 'Vega', constellation: 'Lyra', mag: 0.03, radius: 2.4, temp: 9600, kind: 'main-sequence star', ly: 25, note: 'It spins once every 16 hours or so.' },
  { name: 'Capella', constellation: 'Auriga', mag: 0.08, radius: 12, temp: 4970, kind: 'giant', ly: 43, note: 'Really four stars in two close pairs.' },
  { name: 'Rigel', constellation: 'Orion', mag: 0.13, radius: 79, temp: 12100, kind: 'blue supergiant', ly: 860, note: "Orion's foot, and tens of thousands of times brighter than the Sun." },
  { name: 'Procyon', constellation: 'Canis Minor', mag: 0.34, radius: 2.0, temp: 6530, kind: 'subgiant', ly: 11.5, note: 'It has a faint white dwarf companion.' },
  { name: 'Betelgeuse', constellation: 'Orion', mag: 0.5, radius: 760, temp: 3600, kind: 'red supergiant', ly: 550, note: 'So large it would swallow the orbit of Mars. It will end as a supernova.' },
  { name: 'Achernar', constellation: 'Eridanus', mag: 0.46, radius: 6.8, temp: 14500, kind: 'main-sequence star', ly: 139, note: 'It spins so fast that it bulges at the equator.' },
  { name: 'Altair', constellation: 'Aquila', mag: 0.76, radius: 1.8, temp: 7550, kind: 'main-sequence star', ly: 16.7, note: 'One corner of the Summer Triangle.' },
  { name: 'Aldebaran', constellation: 'Taurus', mag: 0.86, radius: 45, temp: 3900, kind: 'red giant', ly: 65, note: 'The eye of the Bull.' },
  { name: 'Antares', constellation: 'Scorpius', mag: 1.06, radius: 680, temp: 3660, kind: 'red supergiant', ly: 550, note: 'Its name means "rival of Mars", for its colour.' },
  { name: 'Spica', constellation: 'Virgo', mag: 0.97, radius: 7.5, temp: 25300, kind: 'blue giant', ly: 250, note: 'Two stars so close that they pull each other out of shape.' },
  { name: 'Pollux', constellation: 'Gemini', mag: 1.14, radius: 9.1, temp: 4590, kind: 'giant', ly: 34, note: 'It has at least one planet.' },
  { name: 'Fomalhaut', constellation: 'Piscis Austrinus', mag: 1.16, radius: 1.8, temp: 8590, kind: 'main-sequence star', ly: 25, note: 'Ringed by a wide belt of dust.' },
  { name: 'Deneb', constellation: 'Cygnus', mag: 1.25, radius: 200, temp: 8500, kind: 'white supergiant', ly: 2600, note: 'One of the most distant stars you can see easily by eye.' },
  { name: 'Regulus', constellation: 'Leo', mag: 1.36, radius: 4.2, temp: 11700, kind: 'subgiant', ly: 79, note: 'The heart of the Lion.' },
  { name: 'Castor', constellation: 'Gemini', mag: 1.58, radius: 2.1, temp: 10300, kind: 'main-sequence star', ly: 51, note: 'A system of six stars.' },
  { name: 'Bellatrix', constellation: 'Orion', mag: 1.64, radius: 5.8, temp: 21800, kind: 'blue giant', ly: 250, note: "Orion's left shoulder." },
  { name: 'Polaris', constellation: 'Ursa Minor', mag: 1.98, radius: 37, temp: 6000, kind: 'yellow supergiant', ly: 430, note: 'The North Star. It sits almost exactly above the north pole.' },
  { name: 'Mizar', constellation: 'Ursa Major', mag: 2.04, radius: 2.4, temp: 9000, kind: 'main-sequence star', ly: 83, note: 'Its partner Alcor was an old test of eyesight.' },
  { name: 'Alnilam', constellation: 'Orion', mag: 1.69, radius: 32, temp: 27000, kind: 'blue supergiant', ly: 1300, note: "The middle star of Orion's Belt." },
  { name: 'Alnitak', constellation: 'Orion', mag: 1.77, radius: 20, temp: 29500, kind: 'blue supergiant', ly: 1260, note: "The eastern star of Orion's Belt." },
  { name: 'Mira', constellation: 'Cetus', mag: 3.0, radius: 350, temp: 3000, kind: 'pulsing red giant', ly: 300, note: 'It fades from view and returns about every 11 months.' },
  { name: 'Alpha Centauri A', constellation: 'Centaurus', mag: -0.01, radius: 1.2, temp: 5790, kind: 'main-sequence star', ly: 4.4, note: 'Much like the Sun, in the nearest star system to us.' },
  { name: 'Proxima Centauri', constellation: 'Centaurus', mag: 11.1, radius: 0.15, temp: 3000, kind: 'red dwarf', ly: 4.2, note: 'The nearest star to the Sun, too faint to see by eye.' },
  { name: "Barnard's Star", constellation: 'Ophiuchus', mag: 9.5, radius: 0.19, temp: 3200, kind: 'red dwarf', ly: 6.0, note: 'It crosses our sky faster than any other star.' },
  { name: 'Tau Ceti', constellation: 'Cetus', mag: 3.5, radius: 0.79, temp: 5300, kind: 'main-sequence star', ly: 11.9, note: 'A close, steady star a little smaller than the Sun.' },
  { name: 'Epsilon Eridani', constellation: 'Eridanus', mag: 3.7, radius: 0.74, temp: 5080, kind: 'main-sequence star', ly: 10.5, note: 'A young star with a planet and belts of dust.' },
  { name: 'Alkaid', constellation: 'Ursa Major', mag: 1.86, radius: 3.4, temp: 15500, kind: 'main-sequence star', ly: 104, note: 'The tip of the handle of the Big Dipper.' },
  { name: 'Hadar', constellation: 'Centaurus', mag: 0.61, radius: 9, temp: 25000, kind: 'blue giant', ly: 390, note: 'With Alpha Centauri it points to the Southern Cross.' },
  { name: 'Acrux', constellation: 'Crux', mag: 0.76, radius: 7.8, temp: 28000, kind: 'blue subgiant', ly: 320, note: 'The foot of the Southern Cross.' },
  { name: 'Mimosa', constellation: 'Crux', mag: 1.25, radius: 8.4, temp: 27000, kind: 'blue giant', ly: 280, note: 'The left arm of the Southern Cross.' },
  { name: 'Gacrux', constellation: 'Crux', mag: 1.64, radius: 120, temp: 3690, kind: 'red giant', ly: 88, note: 'The nearest red giant to the Sun.' },
  { name: 'Shaula', constellation: 'Scorpius', mag: 1.62, radius: 8.8, temp: 25000, kind: 'blue subgiant', ly: 570, note: "The sting in the Scorpion's tail." },
  { name: 'Alphard', constellation: 'Hydra', mag: 1.98, radius: 50, temp: 4120, kind: 'giant', ly: 177, note: 'Its name means "the solitary one".' },
  { name: 'Algol', constellation: 'Perseus', mag: 2.12, radius: 2.7, temp: 13000, kind: 'eclipsing pair', ly: 90, note: 'It dims every 2.9 days when a companion passes in front.' },
  { name: 'Denebola', constellation: 'Leo', mag: 2.14, radius: 1.7, temp: 8500, kind: 'main-sequence star', ly: 36, note: "The tip of the Lion's tail." },
  { name: 'Rasalhague', constellation: 'Ophiuchus', mag: 2.07, radius: 2.6, temp: 8000, kind: 'giant', ly: 49, note: 'The head of the Serpent Bearer.' },
  { name: 'VY Canis Majoris', constellation: 'Canis Major', mag: 8.0, radius: 1420, temp: 3490, kind: 'red hypergiant', ly: 3900, note: 'Among the largest stars known. It would reach past Jupiter.' },
];

/** Approximate colour of a glowing body at a given temperature. */
export function tempToRgb(k: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [c(r), c(g), c(b)];
}

export function colourName(k: number): string {
  if (k >= 20000) return 'Blue';
  if (k >= 10000) return 'Blue-white';
  if (k >= 7500) return 'White';
  if (k >= 6000) return 'Yellow-white';
  if (k >= 5200) return 'Yellow';
  if (k >= 3700) return 'Orange';
  return 'Red';
}

export function brightnessWords(mag: number): string {
  if (mag < 0) return 'one of the very brightest';
  if (mag < 1.5) return 'very bright';
  if (mag < 3) return 'bright';
  if (mag < 6) return 'faint but visible by eye';
  return 'needs a telescope';
}

export function sizeWords(r: number): string {
  const n = r >= 100 ? Math.round(r / 10) * 10 : r >= 10 ? Math.round(r) : r;
  if (r > 1.15) return `${n.toLocaleString('en')} times as wide as the Sun`;
  if (r < 0.85) return `${Math.round(r * 100)}% as wide as the Sun`;
  return 'about as wide as the Sun';
}
