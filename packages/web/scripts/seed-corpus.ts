/**
 * Seed Script Corpus
 *
 * Populates the script_corpus table with metadata for well-known screenplays.
 * Generates OpenAI embeddings for each logline automatically via addToCorpus().
 *
 * Usage:
 *   cd packages/web
 *   npx tsx scripts/seed-corpus.ts              # Insert + generate embeddings
 *   npx tsx scripts/seed-corpus.ts --dry-run    # Preview without inserting
 *   npx tsx scripts/seed-corpus.ts --no-embed   # Insert without embeddings (faster)
 *
 * Requirements:
 *   - DATABASE_URL set (Render PostgreSQL)
 *   - OPENAI_API_KEY set (for embedding generation, unless --no-embed)
 *   - pgvector extension enabled on the database
 *   - script_corpus table exists (via Prisma migrations)
 */

import { PrismaClient } from '@prisma/client';

interface SeedEntry {
  title: string;
  logline: string;
  genre: string[];
  tone: string;
  writer: string;
  year: number;
  productionStatus: string;
  studio: string | null;
  budgetTier: string;
  boxOfficeMillions: number | null;
}

// =============================================================================
// Seed Data — 57 screenplays spanning 1920s–2020s (incl. 7 TV pilots)
// =============================================================================

const SEED_ENTRIES: SeedEntry[] = [
  // --- Classics (pre-1970) ---
  {
    title: 'Nosferatu',
    logline: 'A real estate agent travels to Transylvania to finalize a property deal with a mysterious count, unwittingly unleashing an ancient vampire upon his hometown.',
    genre: ['horror'],
    tone: 'eerie, expressionist, dread',
    writer: 'Henrik Galeen',
    year: 1922,
    productionStatus: 'produced',
    studio: 'Prana Film',
    budgetTier: 'micro',
    boxOfficeMillions: null,
  },
  {
    title: 'Metropolis',
    logline: 'In a futuristic mega-city divided between wealthy industrialists above ground and oppressed workers below, the son of the city master falls in love with a worker prophet and sparks a revolution.',
    genre: ['sci-fi', 'drama'],
    tone: 'epic, dystopian, visionary',
    writer: 'Thea von Harbou, Fritz Lang',
    year: 1927,
    productionStatus: 'produced',
    studio: 'UFA',
    budgetTier: 'tentpole',
    boxOfficeMillions: null,
  },
  {
    title: 'It Happened One Night',
    logline: 'A spoiled heiress running away from her father meets a roguish newspaper reporter on a cross-country bus trip, and their clashing personalities give way to an unexpected romance.',
    genre: ['comedy', 'romance'],
    tone: 'witty, charming, lighthearted',
    writer: 'Robert Riskin',
    year: 1934,
    productionStatus: 'produced',
    studio: 'Columbia Pictures',
    budgetTier: 'indie',
    boxOfficeMillions: 2.5,
  },
  {
    title: 'Citizen Kane',
    logline: 'Following the death of publishing tycoon Charles Foster Kane, a reporter investigates the meaning of his final word — "Rosebud" — uncovering a complex portrait of power, ambition, and lost innocence.',
    genre: ['drama', 'mystery'],
    tone: 'reflective, epic, melancholic',
    writer: 'Herman J. Mankiewicz, Orson Welles',
    year: 1941,
    productionStatus: 'produced',
    studio: 'RKO Radio Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 1.6,
  },
  {
    title: 'Casablanca',
    logline: 'A cynical American expatriate running a nightclub in Casablanca during World War II must choose between his love for a woman and helping her husband, a Czech resistance leader, escape the Nazis.',
    genre: ['drama', 'romance', 'war'],
    tone: 'romantic, bittersweet, tension',
    writer: 'Julius J. Epstein, Philip G. Epstein, Howard Koch',
    year: 1942,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 10.6,
  },
  {
    title: 'Sunset Boulevard',
    logline: 'A struggling screenwriter becomes entangled with a faded silent-film star who is determined to make a comeback, leading to obsession, delusion, and a fatal reckoning with Hollywood itself.',
    genre: ['drama', 'noir', 'thriller'],
    tone: 'dark, satirical, gothic',
    writer: 'Charles Brackett, Billy Wilder, D.M. Marshman Jr.',
    year: 1950,
    productionStatus: 'produced',
    studio: 'Paramount Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 5.0,
  },
  {
    title: '12 Angry Men',
    logline: 'A dissenting juror in a murder trial slowly persuades the other eleven jurors to reconsider the evidence, revealing their own prejudices and forcing them to question the meaning of reasonable doubt.',
    genre: ['drama', 'courtroom'],
    tone: 'tense, cerebral, claustrophobic',
    writer: 'Reginald Rose',
    year: 1957,
    productionStatus: 'produced',
    studio: 'Orion-Nova Productions',
    budgetTier: 'indie',
    boxOfficeMillions: 1.0,
  },
  {
    title: 'Night of the Living Dead',
    logline: 'A group of strangers barricade themselves inside a rural farmhouse as reanimated corpses rise from the dead, forcing them to confront both the undead and their own inability to cooperate.',
    genre: ['horror', 'thriller'],
    tone: 'bleak, relentless, claustrophobic',
    writer: 'George A. Romero, John A. Russo',
    year: 1968,
    productionStatus: 'produced',
    studio: 'Image Ten',
    budgetTier: 'micro',
    boxOfficeMillions: 30.0,
  },

  // --- New Hollywood & Blockbusters (1970s–1990s) ---
  {
    title: 'The Godfather',
    logline: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
    genre: ['crime', 'drama'],
    tone: 'epic',
    writer: 'Mario Puzo, Francis Ford Coppola',
    year: 1972,
    productionStatus: 'produced',
    studio: 'Paramount Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 250,
  },
  {
    title: 'Chinatown',
    logline: "A private investigator in 1930s Los Angeles specializing in marital infidelity uncovers a vast conspiracy involving murder, corruption, and the city's water supply.",
    genre: ['mystery', 'thriller', 'drama'],
    tone: 'noir',
    writer: 'Robert Towne',
    year: 1974,
    productionStatus: 'produced',
    studio: 'Paramount Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 30,
  },
  {
    title: 'Jaws',
    logline: 'When a massive killer shark unleashes chaos on a beach community, the local police chief, a marine biologist, and an old seafarer must hunt the beast down.',
    genre: ['thriller', 'adventure'],
    tone: 'suspenseful',
    writer: 'Peter Benchley, Carl Gottlieb',
    year: 1975,
    productionStatus: 'produced',
    studio: 'Universal Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 472,
  },
  {
    title: 'Blade Runner',
    logline: 'In a dystopian future, a grizzled bounty hunter is called out of retirement to track down rogue replicants who have come to Earth searching for their creator.',
    genre: ['sci-fi', 'thriller'],
    tone: 'noir',
    writer: 'Hampton Fancher, David Peoples',
    year: 1982,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 42,
  },
  {
    title: 'Aliens',
    logline: 'When communications are lost with a human colony on the moon where her crew first encountered alien creatures, sole survivor Ellen Ripley agrees to return with a unit of Colonial Marines to investigate.',
    genre: ['action', 'sci-fi', 'horror'],
    tone: 'intense',
    writer: 'James Cameron',
    year: 1986,
    productionStatus: 'produced',
    studio: '20th Century Fox',
    budgetTier: 'mid',
    boxOfficeMillions: 183,
  },
  {
    title: 'Die Hard',
    logline: 'A New York City police detective becomes entangled in a terrorist takeover of a Los Angeles skyscraper while visiting his estranged wife during a Christmas Eve party.',
    genre: ['action', 'thriller'],
    tone: 'thrilling',
    writer: 'Jeb Stuart, Steven E. de Souza',
    year: 1988,
    productionStatus: 'produced',
    studio: '20th Century Fox',
    budgetTier: 'mid',
    boxOfficeMillions: 140,
  },
  {
    title: 'Groundhog Day',
    logline: 'A weatherman finds himself stuck in a time loop, reliving the same day over and over again.',
    genre: ['comedy', 'romance', 'fantasy'],
    tone: 'lighthearted',
    writer: 'Danny Rubin, Harold Ramis',
    year: 1993,
    productionStatus: 'produced',
    studio: 'Columbia Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 105,
  },
  {
    title: 'The Shawshank Redemption',
    logline: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
    genre: ['drama'],
    tone: 'hopeful',
    writer: 'Frank Darabont',
    year: 1994,
    productionStatus: 'produced',
    studio: 'Columbia Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 58,
  },
  {
    title: 'Pulp Fiction',
    logline: "The lives of two mob hit men, a boxer, a gangster's wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    genre: ['crime', 'drama'],
    tone: 'dark comedy',
    writer: 'Quentin Tarantino',
    year: 1994,
    productionStatus: 'produced',
    studio: 'Miramax',
    budgetTier: 'indie',
    boxOfficeMillions: 214,
  },
  {
    title: 'Toy Story',
    logline: "A cowboy doll is profoundly threatened and jealous when a new spaceman action figure supplants him as top toy in a boy's room.",
    genre: ['animation', 'comedy', 'family'],
    tone: 'heartwarming',
    writer: 'John Lasseter, Andrew Stanton, Joel Cohen, Alec Sokolow',
    year: 1995,
    productionStatus: 'produced',
    studio: 'Pixar / Disney',
    budgetTier: 'mid',
    boxOfficeMillions: 394,
  },
  {
    title: 'The Big Lebowski',
    logline: "A slacker's life is turned upside down by a case of mistaken identity involving a millionaire with the same name.",
    genre: ['comedy', 'crime'],
    tone: 'irreverent',
    writer: 'Joel Coen, Ethan Coen',
    year: 1998,
    productionStatus: 'produced',
    studio: 'Gramercy Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 46,
  },
  {
    title: 'The Matrix',
    logline: 'When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth that the life he knows is an elaborate deception of an evil cyber-intelligence.',
    genre: ['sci-fi', 'action'],
    tone: 'mind-bending',
    writer: 'Lana Wachowski, Lilly Wachowski',
    year: 1999,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'tentpole',
    boxOfficeMillions: 467,
  },

  // --- Modern Era (2000s–2020s) ---
  {
    title: 'Eternal Sunshine of the Spotless Mind',
    logline: 'When a man discovers his girlfriend has undergone a procedure to erase him from her memory, he decides to do the same, but realizes he still loves her as his memories fade away.',
    genre: ['romance', 'sci-fi', 'drama'],
    tone: 'bittersweet',
    writer: 'Charlie Kaufman',
    year: 2004,
    productionStatus: 'produced',
    studio: 'Focus Features',
    budgetTier: 'mid',
    boxOfficeMillions: 72,
  },
  {
    title: 'No Country for Old Men',
    logline: 'Violence and mayhem ensue after a hunter stumbles upon the aftermath of a drug deal gone wrong and over two million dollars in cash near the Rio Grande.',
    genre: ['thriller', 'crime', 'drama'],
    tone: 'bleak',
    writer: 'Joel Coen, Ethan Coen',
    year: 2007,
    productionStatus: 'produced',
    studio: 'Miramax / Paramount Vantage',
    budgetTier: 'mid',
    boxOfficeMillions: 171,
  },
  {
    title: 'There Will Be Blood',
    logline: 'Silver miner Daniel Plainview leads a hardscrabble life until he discovers oil in a Western town, becoming a self-made tycoon who deviates into moral bankruptcy as his fortune grows.',
    genre: ['drama'],
    tone: 'intense',
    writer: 'Paul Thomas Anderson',
    year: 2007,
    productionStatus: 'produced',
    studio: 'Paramount Vantage',
    budgetTier: 'mid',
    boxOfficeMillions: 76,
  },
  {
    title: 'WALL-E',
    logline: 'A lonely robot on a deserted planet falls in love with another robot while humanity has evacuated Earth and forgotten to turn him off.',
    genre: ['animation', 'sci-fi', 'romance'],
    tone: 'wistful',
    writer: 'Andrew Stanton, Pete Docter',
    year: 2008,
    productionStatus: 'produced',
    studio: 'Pixar / Disney',
    budgetTier: 'tentpole',
    boxOfficeMillions: 533,
  },
  {
    title: 'Her',
    logline: 'In the near future, a lonely writer develops an unlikely relationship with an operating system designed to meet his every need.',
    genre: ['romance', 'sci-fi', 'drama'],
    tone: 'melancholic',
    writer: 'Spike Jonze',
    year: 2013,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 48,
  },
  {
    title: 'The Grand Budapest Hotel',
    logline: 'A writer encounters the owner of an aging high-class hotel, who tells him of his early years serving as a lobby boy under an exceptional concierge.',
    genre: ['comedy', 'drama'],
    tone: 'whimsical',
    writer: 'Wes Anderson',
    year: 2014,
    productionStatus: 'produced',
    studio: 'Fox Searchlight',
    budgetTier: 'mid',
    boxOfficeMillions: 175,
  },
  {
    title: 'Whiplash',
    logline: "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student's potential.",
    genre: ['drama', 'music'],
    tone: 'relentless',
    writer: 'Damien Chazelle',
    year: 2014,
    productionStatus: 'produced',
    studio: 'Sony Pictures Classics',
    budgetTier: 'indie',
    boxOfficeMillions: 49,
  },
  {
    title: 'Mad Max: Fury Road',
    logline: 'After escaping the clutches of a fascist leader, a desert survivalist teams up with a rogue and her cargo, and together they attempt to outrun their brutal pursuers.',
    genre: ['action', 'sci-fi'],
    tone: 'visceral',
    writer: 'George Miller, Brendan McCarthy, Nick Lathouris',
    year: 2015,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'tentpole',
    boxOfficeMillions: 380,
  },
  {
    title: 'Inside Out',
    logline: "A young girl adapts to her family's relocation as five personified emotions inside her mind administer her thoughts and actions.",
    genre: ['animation', 'comedy', 'drama'],
    tone: 'emotional',
    writer: 'Pete Docter, Meg LeFauve, Josh Cooley',
    year: 2015,
    productionStatus: 'produced',
    studio: 'Pixar / Disney',
    budgetTier: 'tentpole',
    boxOfficeMillions: 857,
  },
  {
    title: 'Arrival',
    logline: 'A linguist is enlisted by the military to discover how to communicate with extraterrestrials who have arrived on Earth before tensions lead to war.',
    genre: ['sci-fi', 'drama'],
    tone: 'contemplative',
    writer: 'Eric Heisserer',
    year: 2016,
    productionStatus: 'produced',
    studio: 'Paramount Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 203,
  },
  {
    title: 'Moonlight',
    logline: 'A chronicle of the childhood, adolescence and burgeoning adulthood of a young African-American gay man growing up in a rough neighborhood of Miami.',
    genre: ['drama'],
    tone: 'intimate',
    writer: 'Barry Jenkins',
    year: 2016,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 65,
  },
  {
    title: 'Get Out',
    logline: "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception of him eventually reaches a boiling point.",
    genre: ['horror', 'thriller'],
    tone: 'suspenseful',
    writer: 'Jordan Peele',
    year: 2017,
    productionStatus: 'produced',
    studio: 'Universal Pictures',
    budgetTier: 'indie',
    boxOfficeMillions: 255,
  },
  {
    title: 'Lady Bird',
    logline: 'A high school senior from the wrong side of the tracks longs for adventure and sophistication but finds none of that in her Sacramento Catholic high school.',
    genre: ['drama', 'comedy'],
    tone: 'coming-of-age',
    writer: 'Greta Gerwig',
    year: 2017,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 79,
  },
  {
    title: 'Hereditary',
    logline: 'When the matriarch of the Graham family passes away, her daughter and grandchildren begin to unravel cryptic and increasingly terrifying secrets about their ancestry.',
    genre: ['horror'],
    tone: 'dread',
    writer: 'Ari Aster',
    year: 2018,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 80,
  },
  {
    title: 'Spider-Man: Into the Spider-Verse',
    logline: 'When five web-slingers from different dimensions are tossed into his world, teenager Miles Morales must balance his new life as Spider-Man with the great responsibilities his great power brings.',
    genre: ['animation', 'action', 'adventure'],
    tone: 'energetic',
    writer: 'Phil Lord, Rodney Rothman',
    year: 2018,
    productionStatus: 'produced',
    studio: 'Sony Pictures',
    budgetTier: 'tentpole',
    boxOfficeMillions: 384,
  },
  {
    title: 'Parasite',
    logline: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.',
    genre: ['thriller', 'drama'],
    tone: 'dark',
    writer: 'Bong Joon-ho, Han Jin-won',
    year: 2019,
    productionStatus: 'produced',
    studio: 'CJ Entertainment',
    budgetTier: 'indie',
    boxOfficeMillions: 266,
  },
  {
    title: 'Knives Out',
    logline: 'When a renowned crime novelist is found dead at his estate just after his 85th birthday, a master detective investigates the family gathering gone awry.',
    genre: ['mystery', 'comedy', 'thriller'],
    tone: 'witty',
    writer: 'Rian Johnson',
    year: 2019,
    productionStatus: 'produced',
    studio: 'Lionsgate',
    budgetTier: 'mid',
    boxOfficeMillions: 312,
  },
  {
    title: 'Everything Everywhere All at Once',
    logline: 'A Chinese-American immigrant, while being audited by the IRS, discovers that she must connect with parallel universe versions of herself to prevent a powerful being from destroying the multiverse.',
    genre: ['sci-fi', 'action', 'comedy'],
    tone: 'chaotic',
    writer: 'Daniel Kwan, Daniel Scheinert',
    year: 2022,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 141,
  },

  // --- Prestige TV Pilots ---
  {
    title: 'The Sopranos (Pilot)',
    logline: 'A New Jersey mob boss begins seeing a psychiatrist to manage his anxiety and depression while balancing the demands of his criminal family and his increasingly dysfunctional home life.',
    genre: ['tv_drama', 'crime', 'drama'],
    tone: 'dark, sardonic, introspective, violent',
    writer: 'David Chase',
    year: 1999,
    productionStatus: 'produced',
    studio: 'HBO',
    budgetTier: 'mid',
    boxOfficeMillions: null,
  },
  {
    title: 'Breaking Bad (Pilot)',
    logline: 'A mild-mannered high school chemistry teacher, upon learning he has terminal cancer, partners with a former student to cook methamphetamine in order to secure his family\'s financial future.',
    genre: ['tv_drama', 'crime', 'thriller'],
    tone: 'tense, darkly comedic, tragic',
    writer: 'Vince Gilligan',
    year: 2008,
    productionStatus: 'produced',
    studio: 'AMC',
    budgetTier: 'mid',
    boxOfficeMillions: null,
  },
  {
    title: 'The Wire (Pilot)',
    logline: 'A Baltimore detective receives unusual latitude to investigate the Barksdale drug organization using long-term surveillance, revealing the systemic failures that bind law enforcement and drug dealers together.',
    genre: ['tv_drama', 'crime', 'noir'],
    tone: 'gritty, procedural, humanist, unflinching',
    writer: 'David Simon, Ed Burns',
    year: 2002,
    productionStatus: 'produced',
    studio: 'HBO',
    budgetTier: 'mid',
    boxOfficeMillions: null,
  },
  {
    title: 'Mad Men (Pilot)',
    logline: 'In 1960 Manhattan, a charming and enigmatic ad agency executive navigates the golden age of advertising while concealing a fabricated identity and a secret past.',
    genre: ['tv_drama', 'period', 'drama'],
    tone: 'stylized, melancholic, sharp, nostalgic',
    writer: 'Matthew Weiner',
    year: 2007,
    productionStatus: 'produced',
    studio: 'AMC',
    budgetTier: 'mid',
    boxOfficeMillions: null,
  },
  {
    title: 'Succession (Pilot)',
    logline: 'The aging patriarch of a global media empire contemplates retirement, triggering a vicious power struggle among his four adult children — each convinced they are the rightful heir.',
    genre: ['tv_drama', 'satire', 'drama'],
    tone: 'sharp, darkly comic, Shakespearean, caustic',
    writer: 'Jesse Armstrong',
    year: 2018,
    productionStatus: 'produced',
    studio: 'HBO',
    budgetTier: 'mid',
    boxOfficeMillions: null,
  },
  {
    title: 'Atlanta (Pilot)',
    logline: 'A Princeton dropout tries to manage his cousin\'s rising rap career in Atlanta while navigating the absurdities of the city\'s music scene and his own aimless existence.',
    genre: ['tv_comedy', 'tv_drama', 'comedy'],
    tone: 'surreal, understated, culturally sharp, deadpan',
    writer: 'Donald Glover',
    year: 2016,
    productionStatus: 'produced',
    studio: 'FX',
    budgetTier: 'indie',
    boxOfficeMillions: null,
  },
  {
    title: 'The Bear (Pilot)',
    logline: 'A fine-dining chef returns to Chicago to run his late brother\'s chaotic Italian beef sandwich shop, confronting grief, debt, and a volatile kitchen crew while trying to transform the struggling business.',
    genre: ['tv_drama', 'drama'],
    tone: 'kinetic, pressurized, raw, emotionally intense',
    writer: 'Christopher Storer',
    year: 2022,
    productionStatus: 'produced',
    studio: 'FX',
    budgetTier: 'indie',
    boxOfficeMillions: null,
  },

  // --- Notable Specs & Indie Scripts ---
  {
    title: 'Moonlight',
    logline: 'In three chapters, a young Black man raised by a crack-addicted mother in Miami navigates childhood, adolescence, and adulthood while struggling to reconcile his identity, sexuality, and place in the world.',
    genre: ['drama'],
    tone: 'lyrical, tender, elliptical, quietly devastating',
    writer: 'Barry Jenkins',
    year: 2016,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 65,
  },
  {
    title: 'Lady Bird',
    logline: 'A strong-willed Sacramento teenager navigates her senior year — first love, friendships, college ambitions, and a volatile relationship with her self-sacrificing mother — as she prepares to leave home.',
    genre: ['drama', 'comedy'],
    tone: 'tender, funny, honest, bittersweet',
    writer: 'Greta Gerwig',
    year: 2017,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 79,
  },
  {
    title: 'Aftersun',
    logline: 'A woman revisits memories of a holiday she took with her father as a child, gradually realizing that the warmth of those recollections hid a man in the grip of a private despair she could not yet see.',
    genre: ['drama'],
    tone: 'melancholic, impressionistic, tender, elliptical',
    writer: 'Charlotte Wells',
    year: 2022,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'micro',
    boxOfficeMillions: 5,
  },
  {
    title: 'Past Lives',
    logline: 'Two childhood sweethearts from Seoul reunite in New York two decades later, confronting questions of identity, belonging, and the lives not lived when one emigrated and the other stayed behind.',
    genre: ['drama', 'romance'],
    tone: 'restrained, achingly tender, philosophical, naturalistic',
    writer: 'Celine Song',
    year: 2023,
    productionStatus: 'produced',
    studio: 'A24',
    budgetTier: 'indie',
    boxOfficeMillions: 23,
  },
  {
    title: 'Tár',
    logline: 'One of the world\'s greatest conductors, a woman at the height of her power, finds her carefully constructed persona unraveling as allegations of past abuse surface and her grip on reality loosens.',
    genre: ['drama'],
    tone: 'cerebral, unsettling, morally ambiguous, austere',
    writer: 'Todd Field',
    year: 2022,
    productionStatus: 'produced',
    studio: 'Focus Features',
    budgetTier: 'indie',
    boxOfficeMillions: 38,
  },
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const noEmbed = process.argv.includes('--no-embed');

  if (isDryRun) {
    console.log('=== DRY RUN — No data will be inserted ===\n');
  }

  console.log(`Seed corpus: ${SEED_ENTRIES.length} entries\n`);

  if (isDryRun) {
    for (const entry of SEED_ENTRIES) {
      console.log(`  [${entry.year}] "${entry.title}" — ${entry.genre.join(', ')}`);
      console.log(`    Writer: ${entry.writer}`);
      console.log(`    Logline: ${entry.logline.slice(0, 80)}...`);
      console.log(`    Status: ${entry.productionStatus} | Studio: ${entry.studio || 'N/A'} | Budget: ${entry.budgetTier}`);
      console.log(`    Box Office: ${entry.boxOfficeMillions !== null ? `$${entry.boxOfficeMillions}M` : 'N/A'}`);
      console.log();
    }
    console.log('=== DRY RUN complete. Re-run without --dry-run to insert. ===');
    return;
  }

  const prisma = new PrismaClient();

  try {
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of SEED_ENTRIES) {
      // Check if already exists by title (idempotent seeding)
      const existing = await prisma.scriptCorpus.findFirst({
        where: { title: entry.title },
      });

      if (existing) {
        console.log(`  SKIP: "${entry.title}" (already in corpus)`);
        skipped++;
        continue;
      }

      if (noEmbed) {
        // Insert without embedding — generate later via /api/admin/corpus/populate
        await prisma.scriptCorpus.create({
          data: {
            title: entry.title,
            logline: entry.logline,
            genre: entry.genre,
            tone: entry.tone,
            writer: entry.writer,
            saleDate: new Date(`${entry.year}-01-01`),
            productionStatus: entry.productionStatus,
            studio: entry.studio,
            budgetTier: entry.budgetTier,
            boxOfficeMillions: entry.boxOfficeMillions,
            isPublic: true,
            source: 'seed',
          },
        });
        console.log(`  OK: "${entry.title}" (no embedding)`);
      } else {
        // Insert with embedding via addToCorpus (calls OpenAI)
        try {
          const { addToCorpus } = await import('../lib/comparable/service');
          const id = await addToCorpus({
            title: entry.title,
            logline: entry.logline,
            genre: entry.genre,
            tone: entry.tone,
            productionStatus: entry.productionStatus as 'produced',
            studio: entry.studio ?? undefined,
            budgetTier: entry.budgetTier as 'micro' | 'indie' | 'mid' | 'tentpole',
            boxOfficeMillions: entry.boxOfficeMillions ?? undefined,
            isPublic: true,
          });
          console.log(`  OK: "${entry.title}" → ${id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  FAIL: "${entry.title}" — ${msg}`);
          failed++;
          continue;
        }

        // Small delay to avoid OpenAI rate limits
        await new Promise((r) => setTimeout(r, 200));
      }

      inserted++;
    }

    console.log(`\n=== Done ===`);
    console.log(`Inserted: ${inserted} | Skipped: ${skipped} | Failed: ${failed}`);

    const total = await prisma.scriptCorpus.count();
    console.log(`Total corpus size: ${total} scripts`);

    if (noEmbed) {
      console.log('\nNext: Run without --no-embed or call POST /api/admin/corpus/populate to generate embeddings.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
