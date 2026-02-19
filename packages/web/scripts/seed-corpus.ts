/**
 * Seed Script Corpus
 *
 * Populates the script_corpus table with metadata for well-known public domain
 * and classic screenplays. Does NOT include actual screenplay text (copyrighted).
 * Embeddings can be generated afterwards via POST /api/admin/corpus/populate.
 *
 * Usage:
 *   pnpm seed:corpus              # Insert seed data
 *   pnpm seed:corpus --dry-run    # Preview without inserting
 */

import { PrismaClient } from '@prisma/client';

// =============================================================================
// Seed Data
// =============================================================================

interface CorpusSeedEntry {
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
  pageCount: number;
}

const SEED_ENTRIES: CorpusSeedEntry[] = [
  {
    title: 'Casablanca',
    logline:
      'A cynical American expatriate running a nightclub in Casablanca during World War II must choose between his love for a woman and helping her husband, a Czech resistance leader, escape the Nazis.',
    genre: ['drama', 'romance', 'war'],
    tone: 'romantic, bittersweet, tension',
    writer: 'Julius J. Epstein, Philip G. Epstein, Howard Koch',
    year: 1942,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 10.6,
    pageCount: 102,
  },
  {
    title: 'Citizen Kane',
    logline:
      'Following the death of publishing tycoon Charles Foster Kane, a reporter investigates the meaning of his final word — "Rosebud" — uncovering a complex portrait of power, ambition, and lost innocence.',
    genre: ['drama', 'mystery'],
    tone: 'reflective, epic, melancholic',
    writer: 'Herman J. Mankiewicz, Orson Welles',
    year: 1941,
    productionStatus: 'produced',
    studio: 'RKO Radio Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 1.6,
    pageCount: 119,
  },
  {
    title: '12 Angry Men',
    logline:
      'A dissenting juror in a murder trial slowly persuades the other eleven jurors to reconsider the evidence, revealing their own prejudices and forcing them to question the meaning of reasonable doubt.',
    genre: ['drama', 'courtroom'],
    tone: 'tense, cerebral, claustrophobic',
    writer: 'Reginald Rose',
    year: 1957,
    productionStatus: 'produced',
    studio: 'Orion-Nova Productions',
    budgetTier: 'indie',
    boxOfficeMillions: 1.0,
    pageCount: 96,
  },
  {
    title: 'Sunset Boulevard',
    logline:
      'A struggling screenwriter becomes entangled with a faded silent-film star who is determined to make a comeback, leading to obsession, delusion, and a fatal reckoning with Hollywood itself.',
    genre: ['drama', 'noir', 'thriller'],
    tone: 'dark, satirical, gothic',
    writer: 'Charles Brackett, Billy Wilder, D.M. Marshman Jr.',
    year: 1950,
    productionStatus: 'produced',
    studio: 'Paramount Pictures',
    budgetTier: 'mid',
    boxOfficeMillions: 5.0,
    pageCount: 110,
  },
  {
    title: 'It Happened One Night',
    logline:
      'A spoiled heiress running away from her father meets a roguish newspaper reporter on a cross-country bus trip, and their clashing personalities give way to an unexpected romance.',
    genre: ['comedy', 'romance'],
    tone: 'witty, charming, lighthearted',
    writer: 'Robert Riskin',
    year: 1934,
    productionStatus: 'produced',
    studio: 'Columbia Pictures',
    budgetTier: 'indie',
    boxOfficeMillions: 2.5,
    pageCount: 105,
  },
  {
    title: 'His Girl Friday',
    logline:
      'A fast-talking newspaper editor schemes to prevent his star reporter and ex-wife from remarrying by luring her back into covering one last sensational story.',
    genre: ['comedy', 'romance'],
    tone: 'rapid-fire, screwball, energetic',
    writer: 'Charles Lederer',
    year: 1940,
    productionStatus: 'produced',
    studio: 'Columbia Pictures',
    budgetTier: 'indie',
    boxOfficeMillions: 2.0,
    pageCount: 92,
  },
  {
    title: 'The Maltese Falcon',
    logline:
      'A hardboiled San Francisco private detective takes on a case involving a priceless statuette, navigating a web of lies spun by a cast of ruthless treasure hunters willing to kill for the prize.',
    genre: ['mystery', 'noir', 'thriller'],
    tone: 'hard-boiled, cynical, suspenseful',
    writer: 'John Huston',
    year: 1941,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 3.5,
    pageCount: 100,
  },
  {
    title: 'A Streetcar Named Desire',
    logline:
      'A fading Southern belle moves in with her sister and brutish brother-in-law in New Orleans, where the collision of her fragile illusions with harsh reality leads to a devastating breakdown.',
    genre: ['drama'],
    tone: 'intense, raw, tragic',
    writer: 'Tennessee Williams',
    year: 1951,
    productionStatus: 'produced',
    studio: 'Warner Bros.',
    budgetTier: 'mid',
    boxOfficeMillions: 8.0,
    pageCount: 122,
  },
  {
    title: 'All About Eve',
    logline:
      'An ambitious young fan insinuates herself into the life of an aging Broadway star, methodically maneuvering to steal her career, her friends, and her identity.',
    genre: ['drama'],
    tone: 'sharp, sophisticated, biting',
    writer: 'Joseph L. Mankiewicz',
    year: 1950,
    productionStatus: 'produced',
    studio: '20th Century Fox',
    budgetTier: 'mid',
    boxOfficeMillions: 8.4,
    pageCount: 138,
  },
  {
    title: 'The Third Man',
    logline:
      'An American pulp novelist arrives in post-war Vienna to visit an old friend, only to discover the friend is dead — and that uncovering the truth about his death means confronting a black-market conspiracy.',
    genre: ['mystery', 'noir', 'thriller'],
    tone: 'atmospheric, suspenseful, morally ambiguous',
    writer: 'Graham Greene',
    year: 1949,
    productionStatus: 'produced',
    studio: 'London Film Productions',
    budgetTier: 'mid',
    boxOfficeMillions: 4.7,
    pageCount: 104,
  },
  {
    title: 'Rashomon',
    logline:
      'Four witnesses give contradictory accounts of a violent crime in feudal Japan, challenging the very nature of truth and the reliability of human memory.',
    genre: ['drama', 'mystery'],
    tone: 'philosophical, haunting, ambiguous',
    writer: 'Akira Kurosawa, Shinobu Hashimoto',
    year: 1950,
    productionStatus: 'produced',
    studio: 'Daiei Film',
    budgetTier: 'indie',
    boxOfficeMillions: 0.5,
    pageCount: 88,
  },
  {
    title: 'Night of the Living Dead',
    logline:
      'A group of strangers barricade themselves inside a rural farmhouse as reanimated corpses rise from the dead, forcing them to confront both the undead and their own inability to cooperate.',
    genre: ['horror', 'thriller'],
    tone: 'bleak, relentless, claustrophobic',
    writer: 'George A. Romero, John A. Russo',
    year: 1968,
    productionStatus: 'produced',
    studio: 'Image Ten',
    budgetTier: 'micro',
    boxOfficeMillions: 30.0,
    pageCount: 86,
  },
  {
    title: 'Nosferatu',
    logline:
      'A real estate agent travels to Transylvania to finalize a property deal with a mysterious count, unwittingly unleashing an ancient vampire upon his hometown.',
    genre: ['horror'],
    tone: 'eerie, expressionist, dread',
    writer: 'Henrik Galeen',
    year: 1922,
    productionStatus: 'produced',
    studio: 'Prana Film',
    budgetTier: 'micro',
    boxOfficeMillions: null,
    pageCount: 63,
  },
  {
    title: 'Metropolis',
    logline:
      'In a futuristic mega-city divided between wealthy industrialists above ground and oppressed workers below, the son of the city master falls in love with a worker prophet and sparks a revolution.',
    genre: ['sci-fi', 'drama'],
    tone: 'epic, dystopian, visionary',
    writer: 'Thea von Harbou, Fritz Lang',
    year: 1927,
    productionStatus: 'produced',
    studio: 'UFA',
    budgetTier: 'tentpole',
    boxOfficeMillions: null,
    pageCount: 110,
  },
  {
    title: 'The Cabinet of Dr. Caligari',
    logline:
      'A hypnotist at a carnival uses a somnambulist to commit murders, but the truth behind the madness is far stranger than anyone expects in this tale told through the eyes of an unreliable narrator.',
    genre: ['horror', 'mystery'],
    tone: 'surreal, unsettling, expressionist',
    writer: 'Hans Janowitz, Carl Mayer',
    year: 1920,
    productionStatus: 'produced',
    studio: 'Decla-Bioscop',
    budgetTier: 'micro',
    boxOfficeMillions: null,
    pageCount: 72,
  },
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('=== DRY RUN — No data will be inserted ===\n');
  }

  console.log(`Seed corpus: ${SEED_ENTRIES.length} entries\n`);

  for (const entry of SEED_ENTRIES) {
    const summary = `  [${entry.year}] "${entry.title}" — ${entry.genre.join(', ')} (${entry.pageCount} pp)`;
    console.log(summary);

    if (isDryRun) {
      console.log(`    Logline: ${entry.logline.slice(0, 80)}...`);
      console.log(`    Writer: ${entry.writer}`);
      console.log(`    Status: ${entry.productionStatus} | Studio: ${entry.studio || 'N/A'} | Budget: ${entry.budgetTier}`);
      console.log(`    Box Office: ${entry.boxOfficeMillions !== null ? `$${entry.boxOfficeMillions}M` : 'N/A'}`);
      console.log();
    }
  }

  if (isDryRun) {
    console.log('=== DRY RUN complete. Re-run without --dry-run to insert. ===');
    return;
  }

  const prisma = new PrismaClient();

  try {
    let inserted = 0;
    let skipped = 0;

    for (const entry of SEED_ENTRIES) {
      // Check if already exists by title (idempotent seeding)
      const existing = await prisma.scriptCorpus.findFirst({
        where: { title: entry.title },
      });

      if (existing) {
        console.log(`  Skipped (already exists): ${entry.title}`);
        skipped++;
        continue;
      }

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

      console.log(`  Inserted: ${entry.title}`);
      inserted++;
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    console.log(
      '\nNext step: Call POST /api/admin/corpus/populate to generate embeddings.'
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
