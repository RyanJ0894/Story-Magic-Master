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

/**
 * ONE_PAGE_SCRIPT — minimal single-scene script (~1 page)
 * Used in 1-page E2E tests to verify single-segment processing.
 */
export const ONE_PAGE_SCRIPT = `
FADE IN:

INT. DETECTIVE'S OFFICE - NIGHT

Rain hammers the window. DETECTIVE COLE (50s, rumpled suit) sits behind a cluttered desk,
studying a photograph. A knock at the door.

COLE
(not looking up)
It's open.

MAYA CHEN (30s, sharp eyes) enters, shaking rain from her umbrella.

MAYA
Detective Cole? My name is Maya Chen. I need your help.

Cole finally looks up. Something in her face makes him set down the photograph.

COLE
Sit down, Ms. Chen. Tell me everything.

She sits. Her hands are trembling.

MAYA
Three days ago, my brother disappeared. The police say he ran away but I know
he didn't. David would never—

Her voice cracks. Cole leans forward.

COLE
(quietly)
Start from the beginning.

Maya takes a breath. The rain intensifies outside.

FADE TO BLACK.
`;

/**
 * FIFTEEN_PAGE_SCRIPT — multi-scene screenplay (~15 pages, 8 scenes)
 * Used in 15-page E2E tests to verify multi-segment processing, progressive
 * playback (Fast Start), and final audio stitching.
 */
export const FIFTEEN_PAGE_SCRIPT = `
FADE IN:

INT. DETECTIVE'S OFFICE - NIGHT

Rain hammers the window. DETECTIVE COLE (50s, rumpled suit) sits behind a cluttered desk,
studying a photograph. A knock at the door.

COLE
(not looking up)
It's open.

MAYA CHEN (30s, sharp eyes) enters, shaking rain from her umbrella.

MAYA
Detective Cole? My name is Maya Chen. I need your help.

COLE
Sit down, Ms. Chen. Tell me everything.

MAYA
Three days ago, my brother disappeared. The police say he ran away.
I know he didn't. David would never leave without telling me.

Cole slides a notepad across the desk.

COLE
Last place you saw him?

MAYA
The Meridian Club. Downtown. He was meeting a business contact.

COLE
(writing)
Name of the contact?

MAYA
He didn't tell me. Just said it was important. Life-changing, he called it.

A beat. Cole looks at the photograph again.

CUT TO:

INT. MERIDIAN CLUB - NIGHT

Expensive. Dark wood, low lighting, the murmur of old money. Cole moves through the crowd,
showing David's photo to the BARTENDER (40s, immaculate).

COLE
Seen this man? Three nights ago.

BARTENDER
(barely glancing)
We get a lot of people.

Cole slides a business card across the bar.

COLE
You remember someone who left with him, you call me. Day or night.

The bartender pockets the card without looking at it.

COLE (CONT'D)
You see a man named Harlan Bishop tonight?

The bartender's expression flickers — barely, but enough.

BARTENDER
Never heard of him.

Cole nods slowly, unconvinced.

CUT TO:

EXT. MERIDIAN CLUB - CONTINUOUS

Cole steps out into the rain. He dials his phone.

COLE
(into phone)
Maya, I need you to pull together everything David told you about this meeting.
Every detail. I think I have a name.

MAYA (V.O.)
Who?

COLE
Harlan Bishop. Ring any bells?

A long pause.

MAYA (V.O.)
(quietly)
Cole... that's the man who owns the building where David works.

Cole stops walking.

CUT TO:

INT. POLICE PRECINCT - DAY

Cole sits across from CAPTAIN REYES (50s, tired eyes) in her glass-walled office.

REYES
You're not on this case, Cole.

COLE
I know.

REYES
I'm serious. Bishop has lawyers. Important lawyers. We go in without solid evidence—

COLE
His employee went missing after meeting with him. The bartender at Bishop's own club
recognized the name and lied about it.

REYES
(sighing)
That's not enough.

COLE
I know. I just need you to run Bishop's financials through the system. Quietly.

Reyes studies him.

REYES
If this blows up—

COLE
It won't.

A beat.

REYES
Give me forty-eight hours.

CUT TO:

INT. MAYA'S APARTMENT - EVENING

Small but warm. Books everywhere. Maya makes tea while Cole reviews documents spread
across her kitchen table.

MAYA
David had been nervous for weeks. I thought it was work stress.

COLE
Did he mention any numbers? A figure? An amount?

MAYA
He said... he said if this worked out, we could take care of Mom. Finally.
She needs the surgery but the insurance—

She stops herself.

COLE
(gently)
It's okay. What kind of work was David doing for Bishop?

MAYA
Data analysis. Risk assessment. He was good at finding things that didn't add up.

Cole looks at the documents.

COLE
That's what I'm afraid of.

CUT TO:

EXT. BISHOP TOWER - DAY

Glass and steel. Cole watches the building from across the street, hands in his pockets.
His phone buzzes.

COLE
(answering)
Tell me you have something, Reyes.

REYES (V.O.)
Bishop's company moved forty million through three shell corporations last quarter.
It's not illegal. On the surface.

COLE
What's under the surface?

REYES (V.O.)
Two of those corporations list the same registered agent. A man named—

COLE
David Chen.

A beat.

REYES (V.O.)
How did you know?

COLE
Because David found it first.

CUT TO:

INT. BISHOP TOWER - EXECUTIVE FLOOR - DAY

Cole stands in a sleek lobby. HARLAN BISHOP (60s, silver-haired, the kind of powerful
that doesn't need to announce itself) approaches with a practiced smile.

BISHOP
Detective Cole. I've been expecting you.

COLE
(cautious)
Mr. Bishop.

BISHOP
Walk with me.

They move through a corridor lined with abstract art.

BISHOP (CONT'D)
David Chen was a talented young man. Ambitious. But ambitious people sometimes
overestimate their leverage.

COLE
Is that what happened? He tried to leverage you?

BISHOP
(smiling)
I wouldn't know. I haven't seen Mr. Chen since our meeting.

COLE
What was the meeting about?

BISHOP
Standard business. A consulting arrangement that didn't work out.
(beat)
Is there something specific you're investigating, Detective?

Cole meets his gaze. Neither man blinks.

COLE
Not yet.

CUT TO:

INT. DETECTIVE'S OFFICE - NIGHT

Cole stares at the photograph again. Now we see what's in it: David Chen, smiling,
arm around Maya at what looks like a graduation ceremony.

His phone rings.

COLE
(answering)
Cole.

MAYA (V.O.)
(barely audible)
He called me.

Cole goes still.

COLE
David?

MAYA (V.O.)
He's alive. He said — he said he found proof. Real proof. But he needs time
to get it out safely.

COLE
Where is he?

MAYA (V.O.)
He wouldn't say. Cole—
(voice breaking)
He said to trust you. He said you were the only one who would know what to do with it.

Cole closes his eyes for a moment.

COLE
Tell him I'm listening.

He looks out at the rain-soaked city.

COLE (V.O.)
Some cases start with a missing person. They end with something much bigger.
The rain never cared either way. But I did.

FADE TO BLACK.

TITLE CARD: "THE MERIDIAN"

FADE OUT.
`;

export const TEST_USER_CREDENTIALS = {
  email: 'test@storymagic.ai',
  password: 'TestPassword123!',
  fullName: 'Test User',
};
