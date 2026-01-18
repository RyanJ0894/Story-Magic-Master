/**
 * Test script fixtures for E2E testing
 */

export const SHORT_SCRIPT = `
INT. COFFEE SHOP - DAY

SARAH (30s, tired but determined) sits alone at a corner table, nursing a cold coffee.

SARAH
(to herself)
This is it. Today's the day.

The door CHIMES. MARCUS (40s, distinguished) enters and scans the room.

MARCUS
Sarah? Sarah Mitchell?

SARAH
(standing)
Mr. Thompson. Thank you for meeting me.

They shake hands. MARCUS sits across from her.

MARCUS
Your pitch intrigued me. Tell me more.

SARAH
(leaning forward)
Imagine a world where every story comes to life... not just on screen, but in sound.

MARCUS raises an eyebrow, intrigued.
`;

export const MEDIUM_SCRIPT = `
${SHORT_SCRIPT}

MARCUS
Go on.

SARAH
AI-powered audio production. Full cast, music, sound effects. A complete audio experience generated in minutes, not months.

MARCUS
(skeptical)
Sounds like science fiction.

SARAH
(pulling out tablet)
Let me show you.

She taps the screen. Audio FILLS the coffee shop - dialogue, music, ambient sounds.

MARCUS
(amazed)
That's... remarkable.

CUT TO:

INT. VENTURE CAPITAL OFFICE - LATER

A sleek conference room. SARAH stands at the head of the table, presenting to a row of INVESTORS.

SARAH (V.O.)
Six months later, we had our Series A.

INVESTOR #1
The technology is impressive, but what's the market?

SARAH
Film studios spend millions on ADR alone. Indies can't afford professional audio. Podcasters want cinematic quality.

INVESTOR #2
What's your unfair advantage?

SARAH
(smiling)
I wrote the algorithms myself. Fifteen years in audio engineering, five in machine learning.

The investors exchange glances.
`;

export const MULTI_SCENE_SCRIPT = `
FADE IN:

${MEDIUM_SCRIPT}

INVESTOR #1
We're in.

FADE TO:

INT. SARAH'S APARTMENT - NIGHT

Sarah sits on her couch, phone to her ear. Empty champagne bottles on the table.

SARAH
(into phone)
We did it, Mom. We actually did it.

MOM (V.O.)
I always knew you would, honey.

Sarah LAUGHS, tears in her eyes.

CUT TO:

EXT. SILICON VALLEY CAMPUS - DAY

A modern building with "STORY MAGIC" on the facade. Workers stream in and out.

SARAH (V.O.)
Building the team was the hardest part.

INT. STORY MAGIC - ENGINEERING BULLPEN - CONTINUOUS

DEVELOPERS work at standing desks. Whiteboards covered in diagrams.

MARCUS enters, now in casual startup attire.

MARCUS
Morning, team.

VARIOUS VOICES
Morning, Marcus!

He approaches SARAH's office, visible through glass walls.

INT. SARAH'S OFFICE - CONTINUOUS

SARAH
(on video call)
...and that's why we need the Series B.

VENTURE CAPITALIST (ON SCREEN)
How do you scale?

SARAH
Cloud infrastructure. Every script processed adds to our training data.

The VC nods, impressed.

FADE OUT.
`;

export const TEST_USER_CREDENTIALS = {
  email: 'test@storymagic.ai',
  password: 'TestPassword123!',
  fullName: 'Test User',
};
