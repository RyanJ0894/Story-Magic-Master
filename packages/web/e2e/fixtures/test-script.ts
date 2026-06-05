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


/**
 * THIRTY_PAGE_SCRIPT — ~31 pages of "Good Will Hunting" (first act).
 *
 * Source: docs/StoryScore Scripts/Good Will Hunting.pdf (extracted via pdftotext)
 * Length: ~69,932 chars = ~31.8 pages at 2,200 c/p
 *
 * Exercises the three capacity fixes from PR #149:
 *   1. Page-estimate gate: old 500 c/p formula → 140 pages (REJECTED);
 *      fixed 2,200 c/p formula → 31.8 pages (ACCEPTED).
 *   2. Chunk concurrency: ~69 scenes → 5 processing chunks at 14 scenes/chunk.
 *   3. Voice-assignment iterations: scaling to character count.
 */
export const THIRTY_PAGE_SCRIPT = `GOOD WILL HUNTING
by
Matt Damon & Ben Affleck

FADE IN:

EXT. SOUTH BOSTON ST. PATRICK'S DAY PARADE -- DAY
CUT TO:

INT. L STREET BAR & GRILLE, SOUTH BOSTON -- EVENING
The bar is dirty, more than a little run down. If there is ever
a cook on duty, he's not here now. As we pan across several
empty tables, we can almost smell the odor of last nights beer
and crushed pretzels on the floor.
CHUCKIE
Oh my God, I got the most fucked up
thing I been meanin' to tell you.
As the camera rises, we find FOUR YOUNG MEN seated around a
table near the back of the bar.
ALL
Oh Jesus. Here we go.
The guy holding court is CHUCKIE SULLIVAN, 20, and the largest
of the bunch. He is loud, boisterous, a born entertainer. Next
to him is WILL HUNTING, 20, handsome and confident, a softspoken leader. On Will's right sits BILLY MCBRIDE, 22, heavy,
quiet, someone you definitely wouldn't want to tangle with.
Finally there is MORGAN O'MALLY, 19, smaller than the other
guys. Wiry and anxious, Morgan listens to Chuckie's horror
stories with eager disgust.
All four boys speak with thick Boston accents. This is a rough,
working class Irish neighborhood and these boys are its product.
CHUCKIE
You guys know my cousin Mikey Sullivan?
ALL
Yeah.
CHUCKIE
Well you know how he loves animals
right? Anyway, last week he's drivin'
home... (laughs)
ALL
What? Come on!
CHUCKIE
(trying not to laugh)
I'm sorry, 'cause you know Mikey, the
fuckin guy loves animals, and this is
the last person you'd want this to
happen to.

WILL
Chuckie, what the fuck happened?
CHUCKIE
Okay. He's driving along and this
fuckin' cat jumps in front of his car,
and so he hits this cat-Chuckie is really laughing now.
MORGAN
--That isn't funny-CHUCKIE
--and he's like "shit! Motherfucker!"
And he looks in his rearview and sees
this cat-- I'm sorry-BILLY
Fuckin' Chuckie!
CHUCKIE
So he sees this cat tryin to make it
across the street and it's not lookin'
so good.
WILL
It's walkin' pretty slow at this point.
MORGAN
You guys are fuckin' sick.
CHUCKIE
So Mikey's like "Fuck, I gotta put this
thing out of its misery"--So he gets a
hammer-WILL/MORGAN/BILLY
OH!
CHUCKIE
--out of his tool box, and starts
chasin' the cat and starts whackin' it
with the hammer. You know, tryin' to put
the thing out of its misery.
MORGAN
Jesus.
CHUCKIE
And all the time he's apologizin' to the
cat, goin' "I'm sorry." BANG, "I'm
sorry." BANG!
BILLY
Like it can understand.

CHUCKIE
And this Samoan guy comes runnin' out of
his house and he's like "What the fuck
are you doing to my cat?!" Mikey's like
"I'm sorry"--BANG--" I hit your cat with
my truck, and I'm just trying to put it
out of it's misery"-- BANG! And the cat
dies. So Mikey's like "Why don't you
come look at the front of the truck."
'Cause the other guy's all fuckin
flipped out about-WILL
Watching his cat get brained.
Morgan gives Will a look, but Will only smiles.
CHUCKIE
Yeah, so he's like "Check the front of
my truck, I can prove I hit it 'cause
there's probably some blood or
something"-WILL
--or a tail-MORGAN
WILL!
CHUCKIE
And so they go around to the front of
his truck...and there's another cat on
the grille.
WILL/MORGAN/BILLY
No! Ugh!
CHUCKIE
Is that unbelievable? He brained an
innocent cat!
BLACKOUT:

The opening credits roll over a series of shots of the city and
the real people who live and work there, going about their daily
lives.
We see a panoramic view of South Boston.
Will sits in his apartment, walls completely bare. A bed, a
small night table and an empty basket adorn the room. A stack
of twenty or so LIBRARY BOOKS sit by his bed. He is flipping
through a book at about a page a second.
Chuckie stands on the porch to Will's house. His Caddilac idles
by the curb. Will comes out and they get in the car.

We travel across crowded public housing and onto downtown.
Finally, we gaze across the river and onto the great cementdomed buildings that make up the M.I.T. campus.
CUT TO:

INT. M.I.T. CLASSROOM -- DAY
The classroom is packed with graduate students and TOM.
PROFESSOR LAMBEAU (52) is at the lectern. The chalkboard behind
him is covered with theorems.
LAMBEAU
Please finish McKinley by next month.
Many of you probably had this as
undergraduates in real analysis. It
won't hurt to brush up. I am also
putting an advanced fourier system on
the main hallway chalkboard-Everyone groans.
LAMBEAU (cont'd)
I'm hoping that one of you might prove
it by the end of the semester. The first
person to do so will not only be in my
good graces, but go on to fame and
fortune by having their accomplishment
recorded and their name printed in the
auspicious "M.I.T. Tech."
Prof. Lambeau holds up a thin publication entitled "M.I.T.
Tech." Everyone laughs.
LAMBEAU (cont'd)
Former winners include Nobel Laureates,
world renowned astro-physicists, Field's
Medal winners and lowly M.I.T.
professors.
More laughs.
LAMBEAU (cont'd)
Okay. That is all.
A smattering of applause. Students pack their bags.
CUT TO:

INT. FUNLAND – LATER
The place is a monster indoor funpark. Will, Chuckie, Morgan,
and Billy are in adjoining batting cages. Will has disabled the
pitching machine in his and pitches to Chuckie. The boys have
been drinking. Will throws one to Chuckie, high and tight.
Several empty beer cans sit by the cage.

CHUCKIE
Will!
Another pitch, inside.
CHUCKIE (cont'd)
You're gonna get charged!
WILL
You think I'm afraid of you, you big
fuck? You're crowdin' the plate.
Will guns another one, way inside.
CHUCKIE
Stop brushin' me back!
WILL
Stop crowdin the plate!
Chuckie laughs and steps back.
CHUCKIE
Casey's bouncin' at a bar up Harvard. We
should go there sometime.
WILL
What are we gonna do up there?
CHUCKIE
I don't know, we'll fuck up some smart
kids.
(stepping back in)
You'd prob'ly fit right in.
WILL
Fuck you.
Will fires a pitch at Chuckie's head. Chuckie dives to avoid
being hit. He gets up and whips his batting helmet at Will.
CUT TO:

EXT. SOUTH BOSTON ROOFTOP -- EARLY AFTERNOON
SEAN McGUIRE (52) sits, FORMALLY DRESSED, on the roof of his
apartment building in a beat-up lawn chair. Well-built and
fairly muscular, he stares blankly out over the city.
On his lap rests an open invitation that reads "M.I.T. CLASS OF
'67 REUNION."
While the morning is quiet and Sean sits serenely, there is a
look about his that tells us he has faced hard times. This is a
man who fought his way through life. On his lonely stare we:
CUT TO:

EXT. M.I.T. CAMPUS LAWN -- DAY
A thirty year REUNION PARTY has taken over the lawn. A well
dressed throng mill about underneath a large banner that reads
"WELCOME BACK CLASS OF '72." We find Professor Lambeau standing
with a drink in his hand, surveying the crowd. He is interrupted
by an approaching STUDENT.
STUDENT
Excuse me, Professor Lambeau?
LAMBEAU
Yes.
STUDENT
I'm in your applied theories class.
We're all down at the Math and Science
building.
LAMBEAU
It's Saturday.
STUDENT
I know. We just couldn't wait 'till
Monday to find out.
LAMBEAU
Find out what?
STUDENT
Who proved the theorem.

EXT. TOM FOLEY PARK, S. BOSTON -- AFTERNOON
In the bleachers of the visiting section we find our boys,
drinking and smoking cigarettes. Will pops open a beer. The boys
have been here a while and it shows.
Billy sees something that catches his interest.
BILLY
Who's that? She's got a nice ass.
Their P.O.V. reveals a girl in stretch pants talking to a beefy
looking ITALIAN GUY (BOBBY CHAMPA)
MORGAN
Yah, that is a nice ass.
CHUCKIE
You could put a pool in that backyard.
BILLY
Who's she talking to?
MORGAN
That fuckin' guinea, Will knows him.

WILL
Yah, Bobby Champa. He used to beat the
shit outta' me in Kindergarten.
BILLY
He's a pretty big kid.
WILL
Yah, he's the same size now as he was in
Kindergarten.
MORGAN
Fuck this, let's get something to eat...
CHUCKIE
What Morgan, you're not gonna go talk to
her?
MORGAN
Fuck her.
The boys get up and walk down the bleachers.
WILL
I could go for a Whopper.
MORGAN
(nonchalant)
Let's hit "Kelly's."
CHUCKIE
Morgan, I'm not goin' to "Kelly's Roast
Beef" just cause you like the take-out
girl. It's fifteen minutes out of our
way.
MORGAN
What else we gonna do we can't spare
fifteen minutes?
CHUCKIE
All right Morgan, fine. I'll tell you
why we're not going to "Kelly's." It's
because the take-out bitch is a fuckin'
idiot. I'm sorry you like her but she's
dumb as a post and she has never got our
order right, never once.
MORGAN
She's not stupid.
WILL
She's sharp as a marble.
CHUCKIE
We're not goin'.
(beat)
I don't even like "Kelly's."

CUT TO:

INT. M.I.T. HALLWAY -- LATER
Lambeau, still in his reunion formal-wear, strides down the
hallway, carrying some papers. A group of students have gathered
by the chalkboard. They part like the red sea as he approaches
the board. Using the papers in hand, he checks the proof.
Satisfied, he turns to the class.
LAMBEAU
This is correct? Who did this?
Dead silence. Lambeau turns to an INDIAN STUDENT.
LAMBEAU (cont'd)
Nemesh?
Nemesh shakes his head in awe.
NEMESH
No way.
Lambeau erases the proof and starts putting up a new one.
LAMBEAU
Well, whoever You are, I'm sure you'll
find this one challenging enough to
merit coming forward with your identity.
That is, if you can do it.

INT. CHUCKIE'S CAR, DRIVING IN SOUTH BOSTON -- CONTINUOUS
The street is crowded as our boys drive down Broadway. They move
slowly through heavy traffic, windows down. Chuckie sorts
through a large "KELLY'S ROAST BEEF" BAG as he drives.
MORGAN
Double Burger.
Will holds the wheel for Chuckie as he looks through the bag.
MORGAN (cont'd)
(same tone)
Double Burger.
Chuckie gets out fries for himself, hands Will his fries.
MORGAN (cont'd)
I, I had a Kelly's Double Burger.
CHUCKIE
Would you shut the fuck up! I know what
you ordered, I was there!

MORGAN
So why don't you give me my sandwhich?
CHUCKIE
What do you mean "your sandwhich?" I
bought it.
MORGAN
(sarcastic)
Yah, all right...
CHUCKIE
How much money you got?
MORGAN
I told you, I just got change.
CHUCKIE
Well give me your fuckin' change and
we'll put your fuckin' sandwhich on layaway.
MORGAN
Why you gotta be an asshole Chuckie?
CHUCKIE
I think you should establish a good line
of credit.
Laughter, Chuckie goes back searching through the bag.
CHUCKIE (cont'd)
Oh motherfucker...
WILL
She didn't do it again did she?
CHUCKIE
Jesus Christ. Not even close.
MORGAN
Did she get my Double Burger?
CHUCKIE
NO SHE DIDN'T GET YOUR DOUBLE BURGER!!
IT'S ALL FUCKIN' FLYIN' FISH FILET!!
Chuckie whips a FISH SANDWHICH back to Morgan, then to Billy.
WILL
Jesus, that's really bad, did anyone
even order a Flyin' Fish?
CHUCKIE
No, and we got four of 'em.

BILLY
You gotta' be kiddin' me. Why do we even
go to her?
CHUCKIE
Cause fuckin' Morgan's got a crush on
her, we always go there and when we get
to the window he never says a fuckin'
word to her, he never even gets out of
the car, and she never gets our order
right cause she's the goddamn MISSING
LINK!
WILL
Well, she out did herself today...
MORGAN
I don't got a crush on her.
Push in on Will who sees something O.S.
Will's P.O.V. reveals BOBBY CHAMPA and his friends walking down
the street. One of them casually lobs a bottle into a wire
garbage can. It SHATTERS and some of the glass hits a FEMALE
PASSERBY who, although unhurt, is upset.
CHUCKIE
What do we got?
WILL
I don't know yet.
Will's P.O.V.: The woman says something to Bobby. He says
something back. By the look on her face, it was something
unpleasant.
MORGAN
Come on, Will...
CHUCKIE
Shut up.
MORGAN
No, why didn't you fight him at the park
if you wanted to? I'm not goin' now, I'm
eatin' my snack.
WILL
(smiles)
So don't go.
Will is out of the door, jogging toward Bobby Champa. Billy gets
out, following Will with a look of casual indifference.
CHUCKIE
Morgan, Let's go.

MORGAN
I'm serious Chuckie, I ain't goin'.
Leaving the car, Chuckie opens his door to follow.
CHUCKIE
(spins in his seat)
You're goin'. And if you're not out
there in two fuckin' seconds, when I'm
done with them you're next!
And with that, Chuckie is out the door.
CUT TO:

EXT. SIDEWALK --CONTINUOUS
Will comes jogging up towards BOBBY CHAMPA, calling out from
across the street,
WILL
(smiling, good naturedly)
Hey, Bobby Champa! I went to
Kindergarten with you right? Sister
Margaret's class...
Bobby is bewildered by this strange interruption and unsure of
Will's intentions. Just when it looks as though Bobby might
remember him, Will DRILLS HIM with a sucker-punch which begins
the
FIGHT SEQUENCE: 40 FRAMES OVER M. GAYE'S "LET'S GET IT ON."
Will's momentum and respectable strength serve to knock the
hapless Champa out cold.
As soon as Will hits Bobby, his friends CONVERGE ON WILL. Billy
JUMPS IN and wrestles one guy to the ground. The two exchange
messy punches on the sidewalk.
Will is in trouble, back pedaling, dodging punches, trying to
avoid being overrun.
When Will goes for one guy, another has an open shot and he
HAMMERS WILL with a right hand to the head.
Will is staggered and bleary, as a second guy winds up for a
shot he is BLIND SIDED by Chuckie who hits the kid like he was a
tackling sled, lifting him off the ground.
Chuckie turns to see Will still outnumbered. It's all Will can
do to stay standing as Morgan DROP KICKS one of Champa's boys
from the hood of a car.
Contrary to what we might think, Morgan is actually quite a
fighter. He peppers the kid with a flurry of blows.

The fight is messy, ugly and chaotic. Most punches are thrown
wildly and miss, heads are banged against concrete, someone
throws a bottle.
In the end, it's our guys who are left standing, while Bobby's
friends stagger off. Chuckie and Morgan turn to see Will,
standing over the unconscious Bobby Champa, still POUNDING him.
ANGLE ON WILL: SAVAGE, UGLY, VICIOUS, AND VIOLENT
Whatever demons must be raging inside Will, he is taking them
out on Bobby Champa. He pummels the helpless, unconscious
Champa, fury in his eyes. Chuckie and Billy pull Will away.
The POLICE finally arrive on the scene and having only witnessed
Will's vicious attack on Champa, they grab him.

EXT. SIDEWALK (FULL SPEED) -- CONTINUOUS
A crowd of onlookers have gathered. Chuckie addresses them.
CHUCKIE
Hey, thanks for comin' out.
WILL
Yeah, you're all invited over to
Morgan's house for a complementary fish
sandwhich.
The Police slam Will into the hood of a car.
WILL (cont'd)
(to Police)
Hey, I know it's not a French cruller,
but it's free.
The cop holding Will SLAMS his [Will's] face into the hood,
another cop uses a baton to press Will's face into the car. The
look of rage returns to Will's eye.
WILL (cont'd)
Get the fuck off me!
Will resists. Another cop comes over. Will KICKS HIM IN THE
KNEE, dropping the cop. Momentarily freed, Will engages in a
fracas with three cops. More converge on Will, who -- though he
struggles -- takes a beating.
CUT TO:

EXT. SEAN'S ROOF -- NIGHT
Sean sits, exactly as we first saw him, except his tie is now
loose and an empty bottle of BUSHMILLS is at his side. He
stares out over the City. A MATRONLY LANDLADY comes out of a
doorway on the roof.

LANDLADY
Sean?
Sean doesn't answer.
LANDLADY (cont'd)
Sean? You okay?
SEAN
Yeah.
A beat.
LANDLADY
It's getting cold.
After a moment, she retreats back down the stairs. Sean doesn't
move.
DISSOLVE:

EXT. CHARLES RIVER, ESTABLISHING SHOT -- MORNING
The morning sun reflects brilliantly off the river.
CUT TO:

EXT. COURTHOUSE -- NEXT MORNING
Will emerges from the courthouse. Chuckie is waiting for him in
the Cadillac with two cups of DUNKIN' DOUGHNUTS coffee. He hands
one of them to Will. This feels routine.
CHUCKIE
When's the arraignment?
WILL
Next week.
Chuckie pulls away.
CUT TO:

EXT. M.I.T. CAMPUS, ESTABLISHING SHOT -- MORNING
Students walk to class, carrying bags. More than any other,
students seem to be heading into one PARTICULAR CLASSROOM.

INT. M.I.T. CLASSROOM -- MORNING
The classroom is even more crowded than last we saw it. Tom
takes notes as Lambeau plays along with the excited environment
with mock pomposity and good humor.

LAMBEAU
Is it my imagination, or has my class
grown considerably?
Laughter.
LAMBEAU (cont'd)
I look around and see young people who
are my students, young people who are
not my students as well as some of my
colleagues. And by no stretch of my
imagination do I think you've all come
to hear me lecture.
More laughter.
LAMBEAU (cont'd)
But rather to ascertain the identity of
who our esteemed "The Tech" has come to
call "The Mystery Math Magician."
He holds up the M.I.T. Tech featuring a silhouetted figure,
emblazoned with a large, white question mark. The headline reads
"Mystery Math Magician strikes again."
LAMBEAU (cont'd)
Whoever you are, you've solved four of
the most difficult theorems I've ever
given a class. So without further ado,
come forward silent rogue, and receive
thy prize.
The class waits in breathless anticipation. A STUDENT shifts his
weight in his chair, making a noise.
LAMBEAU (cont'd)
Well, I'm sorry to disappoint my
spectators, but it appears there will be
no unmasking here today. I'm going to
have to ask those of you not enrolled in
the class to make your escape now or,
for the next three hours be subjected to
the mundities of eigenvectors.
People start to gather their things and go. Lambeau picks up a
piece of chalk and starts writing on the board.
LAMBEAU (cont'd)
However, my colleagues and I have
conferred. There is a problem on the
board, right now, that took us two years
to prove. So let this be said; the
gauntlet has been thrown down. But the
faculty have answered the challenge and
answered with vigor.
CUT TO:

19 OMITTED

INT. M.I.T. HALLWAY -- NIGHT
Lambeau comes out of his office with Tom and locks the door. As
he turns to walk down the hallway, he stops. A faint TICKING
SOUND can be heard. He turns and walks down the hall.
Lambeau and Tom come around a corner. His P.O.V. reveals a
figure in silhouette blazing through the proof on the
chalkboard. There is a mop and a bucket beside him. As Lambeau
draws closer, reveal that the figure is Will, in his janitor's
uniform. There is a look of intense concentration in his eyes.
LAMBEAU
Excuse me!
Will looks up, immediately starts to shuffle off.
WILL
Oh, I'm sorry.
LAMBEAU
What're you doing?
WILL
(walking away)
I'm sorry.
Lambeau follows Will down the hall.
LAMBEAU
What's your name?
(beat)
Don't you walk away from me. This is
people's work, you can't graffiti here.
WILL
Hey fuck you.
LAMBEAU
(flustered)
Well... I'll be speaking to your
supervisor.
Will walks out. Lambeau goes to "fix" the proof, scanning the
blackboard for whatever damage Will caused. He stops, scans the
board again. Amazement registers on his face.
LAMBEAU (cont'd)
My God.
Down the hall, we hear the DOOR CLOSE. He turns to look for
Will, who is gone.
CUT TO:

EXT. BOW AND ARROW PUB, CAMBRIDGE -- THAT NIGHT
A crowded Harvard Bar. Will and our gang walk by a line of
several Harvard students, waiting to be carded.
MORGAN
What happened?
(beat)
You got fired, huh?
WILL
Yeah, Morgan. I got fired.
MORGAN
(starts laughing)
How fuckin' retarded do you have to be
to get shit-canned from that job? How
hard is it to push a fuckin' broom?
CHUCKIE
You got fired from pushing a broom, you
little bitch.
MORGAN
Yah, that was different. Management was
restructurin'-BILLY
--Yah, restructurin' the amount of
retards they had workin' for them.
MORGAN
Fuck you, you fat fuck.
BILLY
Least I work for a livin'.
(to Will)
Why'd you get fired?
WILL
Management was restructurin'.
Laughter.
CHUCKIE
My uncle can probably get you on my demo
team.
MORGAN
What the fuck? I just asked you for a
job yesterday!
CHUCKIE
I told you "no" yesterday!
After two students flash their ID's to the doorman (CASEY) our
boys file past him.

ALL
(one after another)
What's up Case.
With an imperceptible nod, Casey waves our boys through. A fifth
kid, a HARVARD STUDENT, tries to follow. He is stopped by
Casey's massive, outstretched arm:
CASEY
ID?

INT. BOW AND ARROW -- CONTINUOUS
Chuckie is collecting money from the guys to buy a pitcher, all
but Morgan cough up some crumpled dollars.
CHUCKIE
So, this is a Harvard bar, huh? I
thought there'd be equations and shit on
the wall.

INT. BACK SECTION, BOW AND ARROW -- MOMENTS LATER
Chuckie returns to a table where Will, Morgan and Billy have
made themselves comfortable. He [Chuckie] spots two ATTRACTIVE
YOUNG HARVARD WOMEN sitting together at the end of the bar.
Chuckie struts his way toward the women and pulls up a chair. He
flashes a smile and tries to submerge his thick Boston accent.
CHUCKIE
Hey, how's it goin'?
LYDIA
Fine.
SKYLAR
Okay.
CHUCKIE
So, you ladies ah, go to school here?
LYDIA
Yes.
CHUCKIE
Yeah, cause I think I had a class with
you.
At this point, several interested parties materialize. Morgan
Billy and Will try, as inconspicuously as possible, to situate
themselves within listening distance. A rather large student in
a HARVARD LACROSSE sweatshirt, CLARK (22) notices Chuckie. He
[Clark] walks over to Skylar and Lydia, nobly hovering over them
as protector. This gets Will, Morgan, and Billy's attention.

SKYLAR
What class?
CHUCKIE
Ah, history I think.
SKYLAR
Oh...
CHUCKIE
Yah, it's not a bad school...
At this point, Clark can't resist and steps in.
CLARK
What class did you say that was?
CHUCKIE
History.
CLARK
How'd you like that course?
CHUCKIE
Good, it was all right.
CLARK
History? Just "history?" It must have
been a survey course then.
Chuckie nods. Clark notices Chuckie's clothes. Will and Billy
exchange a look and move subtly closer.
CLARK (cont'd)
Pretty broad. "History of the World?"
CHUCKIE
Hey, come on pal we're in classes all
day. That's one thing about Harvard
never seizes to amaze me, everybody's
talkin' about school all the time.
CLARK
Hey, I'm the last guy to want to talk
about school at the bar. But as long as
you're here I want to "seize" the
opportunity to ask you a question.
Billy shifts his beer into his left hand. Will and Morgan see
this. Morgan rolls his eyes as if to say "not again..."
CLARK (cont'd)
Oh, I'm sure you covered it in your
history class.
Clark looks to see if the girls are impressed. They are not.
When Clark looks back to Chuckie, Skylar turns to Lydia and
rolls her [own] eyes. They laugh. Will sees this and smiles.

CHUCKIE
To tell you the truth, I wasn't there
much. The class was rather elementary.
CLARK
Elementary? Oh, I don't doubt that it
was. I remember the class, it was just
between recess and lunch.
Will and Billy come forward, stand behind Chuckie.
CHUCKIE
All right, are we gonna have a problem?
CLARK
There's no problem. I was just hoping
you could give me some insight into the
evolution of the market economy in the
early colonies. My contention is that
prior to the Revolutionary War the
economic modalities especially of the
southern colonies could most aptly be
characterized as agrarian precapitalist and...
Will, who at this point has migrated to Chuckie's side and is
completely fed-up, includes himself in the conversation.
WILL
Of course that's your contention. You're
a first year grad student. You just
finished some Marxian historian, Pete
Garrison prob'ly, and so naturally
that's what you believe until next month
when you get to James Lemon and get
convinced that Virginia and Pennsylvania
were strongly entrepreneurial and
capitalist back in 1740. That'll last
until sometime in your second year, then
you'll be in here regurgitating Gordon
Wood about the Pre-revolutionary utopia
and the capital-forming effects of
military mobilization.
CLARK
(taken aback)
Well, as a matter of fact, I won't,
because Wood drastically underestimates
the impact of--

WILL
--"Wood drastically underestimates the
impact of social distinctions predicated
upon wealth, especially inheriated
wealth..." You got that from "Work in
Essex County," Page 421, right? Do you
have any thoughts of your own on the
subject or were you just gonna plagerize
the whole book for me?
Clark is stunned.
WILL(cont'd)
Look, don't try to pass yourself off as
some kind of an intellect at the expense
of my friend just to impress these
girls.
Clark is lost now, searching for a graceful exit, any exit.
WILL (cont'd)
The sad thing is, in about 50 years you
might start doin' some thinkin' on your
own and by then you'll realize there are
only two certainties in life.
CLARK
Yeah? What're those?
WILL
One, don't do that. Two-- you dropped a
hundred and fifty grand on an education
you coulda' picked up for a dollar fifty
in late charges at the Public Library.
Will catches Skylar's eye.
CLARK
But I will have a degree, and you'll be
serving my kids fries at a drive through
on our way to a skiing trip.
WILL(smiles)
Maybe. But at least I won't be a prick.
(beat)
And if you got a problem with that, I
guess we can step outside and deal with
it that way.
While Will is substantially smaller than Clark, he [Clark]
decides not to take Will up on his [Will's] offer.
WILL (cont'd)
If you change your mind, I'll be over by
the bar.
He turns and walks away. Chuckie follows, throwing Clark a look.
Morgan turns to a nearby girl.

MORGAN
My boy's wicked smart.

INT. BOW AND ARROW, AT THE BAR --LATER
Will sits with Morgan at the bar watching with some amusement as
Chuckie and Billy play bar basketball game where the players
shoot miniature balls at a small basket. In the B.G.
Occasionally we hear Chuckie shouting "Larry!" When he scores.
Skylar emerges from the crowd and approaches Will.
SKYLAR
You suck.
WILL
What?
SKYLAR
I've been sitting over there for fortyfive minutes waiting for you to come
talk to me. But I'm just tired now and I
have to go home and I wasn't going to
keep sitting there waiting for you.
WILL
I'm Will.
SKYLAR
Skylar. And by the way. That guy over
there is a real dick and I just wanted
you to know he didn't come with us.
WILL
I kind of got that impression.
SKYLAR
Well, look, I have to go. Gotta' get up
early and waste some more money on my
overpriced education.
WILL
I didn't mean you. Listen, maybe...
SKYLAR
Here's my number.
Skylar produces a folded piece of paper and offers it to Will.
SKYLAR (cont'd)
Maybe we could go out for coffee
sometime?
WILL
Great, or maybe we could go somewhere
and just eat a bunch of caramels.

SKYLAR
What?
WILL
When you think about it, it's just as
arbitrary as drinking coffee.
SKYLAR
(laughs)
Okay, sounds good.
She turns.
WILL
Five minutes.
SKYLAR
What?
WILL
I was trying to be smooth.
(indicates clock)
But at twelve-fifteen I was gonna come
over there and talk to you.
SKYLAR
See, it's my life story. Five more
minutes and I would have got to hear
your best pick-up line.
WILL
The caramel thing is my pick-up line.
A beat.
SKYLAR
Glad I came over.
CUT TO:

EXT. BOW AND ARROW -- LATER
Our boys are walking out of the bar teasing one another about
their bar-ball exploits. Across the street is another bar with a
glass front. Morgan spots Clark sitting by the window with some
friends.
MORGAN
There goes that fuckin' Barney right
now, with his fuckin' "skiin' trip." We
should'a kicked that dude's ass.
WILL
Hold up.

Will crosses the street and approaches the plate glass window
and stands across from Clark, separated only by the glass. He
POUNDS THE GLASS to get Clark's attention.
WILL (cont'd)
Hey!
Clark turns toward Will.
WILL (cont'd)
DO YOU LIKE APPLES?
Clark doesn't get it.
WILL (cont'd)
DO YOU LIKE APPLES?!
CLARK
Yeah?
Will SLAMS SKYLAR'S PHONE NUMBER against the glass.
WILL
WELL I GOT HER NUMBER! HOW DO YA LIKE
THEM APPLES?!!
Will's boys erupt into laughter. Angle on Clark, deflated.

EXT. STREET -- NIGHT
The boys make their way home, piled into Chuckie's car, laughing
together.

EXT. CHARLES STREET BRIDGE -- DAWN
Shot of car crossing over the Charles St. Bridge, overtaking a
red-line train.

EXT. CHARLESTON BACKROAD -- DAWN
Travelling through narrow back roads in Charlestown, passing the
Bunker Hill monument.

EXT. WILL'S APARTMENT -- DAY
Arriving at Will's house and dropping him off.
DISSOLVE TO:

INT. M.I.T. BUILDING AND GROUNDS GARAGE -- DAY
Lambeau walks into a small garage facility. The area stores lawn
machinery and various tools. An older man, TERRY (58) sits

behind the desk reading the BOSTON HERALD sports page. Lambeau
has obviously never been here before. He takes in the
surroundings, somewhat uncomfortable. Gets dirty.
LAMBEAU
Excuse me. Is this the buildings and
grounds office?
TERRY
Yeah, can I help you?
LAMBEAU
I'm trying to find the name of a student
who works here.
TERRY
No students work for me.
LAMBEAU
Could you just check, because the young
man who works in my building-TERRY
Which one's your building?
LAMBEAU
Building two.
Terry checks a list behind his [own] desk. Looks up.
TERRY
Well, if something was stolen, I should
know about it.
LAMBEAU
No, no. Nothing like that. I just need
his name. TERRY I can't give you his
name unless you have a complaint.
LAMBEAU
Please, I'm a professor here and it's
very important.
TERRY
Well, he didn't show up for work
today...
Terry takes a beat. Holding all the cards.
TERRY (cont'd)
Look, he got his job through his P.O. so
you can call him.
Terry goes through a stack of paper on his desk. Takes out a
card and hands it to Lambeau. Lambeau looks blankly at the card
which reads: "PAROLE EMPLOYMENT PROGRAM."

INT. COURTROOM -- DAY
Will stands before JUDGE MALONE (40) being arraigned. It is
fairly unceremoniuous, the coutroom nearly empty, save Will and
the PROSECUTOR. Lambeau walks in from the back.
WILL
There is a lengthy legal precedent, Your
Honor, going back to 1789, whereby a
defendent may claim self-defense against
an agent of the government where the act
is shown to be a defense against
tyranny, a defense of liberty-The Judge interrupts to address the prosecutor.
JUDGE MALONE
Mr. Simmons, Officer McNeely who signed
the complaint isn't in my courtroom. Why
is that?
PROSECUTOR
He's in the hospital with a broken knee,
Your Honor. But I have depositions from
the other officers.
WILL
Henry Ward Beecher proclaimed, in his
Proverbs From Plymouth Pulpit back in
1887, that "Every American citizen is by
birth, a sworn officer of the state.
Every man is a policeman." As for the
other officers, even William Congrave
said; "he that first cries out 'stop
thief' is 'oft he that has stolen the
treasure."
PROSECUTOR
Your Honor-Will cranks it up.
WILL
(to Prosecutor)
I am afforded the right to speak in my
own defense by our constitution, Sir.
The same document which guarantees my
right to liberty. "Liberty," in case
you've forgotten, is "the soul's right
to breathe, and when it cannot take a
long breath laws are girded too tight.
Without liberty, man is a syncope."
(beat, to Judge)
Ibid. Your Honor.
PROSECUTOR
Man is a what?

WILL
Julius Caesar proclaimed-- Though he be
wounded--"Magna..."
The Judge interrupts.
JUDGE MALONE
Son,
(a beat)
My turn.
The Judge opens Will's CASE HISTORY.
JUDGE MALONE (cont'd)
(reading)
June, '93, assault, Sept. '93
assault...Grand theft auto February '94.
A beat, the Judge takes particular notice.
JUDGE MALONE (cont'd)
Where, appearantly, you defended
yourself and had the case thrown out by
citing "free property rights of horse
and carriage" from 1798...
Lambeau has to smile, impressed. The Judge shakes his head.
JUDGE MALONE (cont'd)
March, '94 public drunkenness, public
nudity, assault. 10/94 mayhem. November
'94, assault. Jan. '95 impersonating a
police officer, mayhem, theft,
resisting-- overturned-The Judge takes a beat. Gives Will a look.
JUDGE MALONE (cont'd)
You're in my courtroom, now and I am
aware of your priors.
(beat)
I'm also aware that you're an orphan. You've been through
several foster homes. The state removed you from three because
of serious physical abuse.
The Judge holds a look to Will, who looks down.
JUDGE MALONE (cont'd)
Another Judge might care. You hit a cop,
you go in.
(beat)
Motion to dismiss denied.
The Bailiff goes to remove Will from the courtroom.
JUDGE MALONE (cont'd)
Keep workin' on your arguments, son. A
word of advice for trial; speak English.

As Will is removed from the courtroom, Lambeau approaches Judge
Malone who is stepping down from the bench.
LAMBEAU
Excuse me, your Honor.
(offers hand)
Gerald Lambeau.
An awkward beat. Lambeau waits for some sign of recognition.
LAMBEAU (cont'd)
I'm a professor at M.I.T.
(beat)
Combunatorial Mathematics.
The Judge offers only a blank look.
JUDGE MALONE
Oh. Pleased to meet you.
LAMBEAU
Do you have a minute?
CUT TO:

INT. MIDDLESEX COUNTY JAIL, HOLDING AREA -- SAME
A GUARD walks Will down a hallway toward a group of phones.
GUARD
One call, to an attorney.
(beat)
One.
The Guard gives Will a hard look for a beat. Then leaves.
WILL
How many?
Will picks up the phone, dials.
WILL (cont'd)
Hey, Skylar?

INT. SKYLAR'S DORM -- DAY
SKYLAR
Yeah?
WILL
It's Will, the really funny good looking
guy you met at the bar?
SKYLAR
I'm sorry, I don't recall meeting anyone
who fits that description.

WILL
Okay, you got me. It's the ugly,
obnoxious, toothless loser who got drunk
and wouldn't leave you alone all night.
SKYLAR
Oh Will! I was wondering when you'd
call.
WILL
Yeah, I figured maybe sometime this week
we could go to a cafe and have some
caramels.
SKYLAR
Sounds good, where are you now?
WILL
You aren't, by any chance, Pre-law? Are
you?
CUT TO:

INT. MIDDLESEX COUNTY JAIL, INTERROGATION ROOM -- LATER
Professor Lambeau sits, waiting. Will is brought in, shackled,
by the guard.
LAMBEAU
Hello. Gerald Lambeau, M.I.T.
WILL
Fuck do you want?
LAMBEAU
I've spoken with the judge and he's
agreed to release you under my
supervision.
WILL
(suspicious)
Really?
LAMBEAU
(beat)
Yes. Under two conditions.
WILL
What're those?
LAMBEAU
That you meet with me twice a week—
(a beat)
- and you meet with a therapist.

WILL
If I agree to this, I walk right now?
LAMBEAU
That's right.
WILL
I'll do the work. I'm not going to meet
with a therapist.
LAMBEAU
Now, it won't be as bad as it sounds,
Will.
(beat)
I've already spoken to one therapist,
his name is Henry Lipkin and he's a
friend of mine. He's also published four
books and is widely considered to be one
of the brightest men in his field.
(beat)
I'm sure it'll be better than spending
the next six months in jail.
CUT TO:

INT. FUNLAND -- DAY
Will and Chuckie walk up to an enclosed trampoline. Billy and
Morgan prefer to use it for their own version of "Wrestlemania."
As Will and Chuckie approach, Billy is on top of a bloodied
Morgan and has him in the "Cobra Clutch." Will and Chuckie watch
for a beat. Billy tightens his grip.
BILLY
Submit, bitch! Submit! Submit!
MORGAN
(being strangled)
Suck my cock!
BILLY
Oh, Morgan!
Chuckie turns to Will, conspiratorially as they wait for the
fight to finish.
CHUCKIE
What'd you get? You get leniency?
WILL
Probation, counselin', few days a week.
CHUCKIE
You're fuckin' good.
Will smiles.

CHUCKIE (cont'd)
Just submit, Morgan. He's got you in the
Cobra Clutch.
MORGAN
(to Chuckie)
Fuck your mother too!

INT. WILL'S APARTMENT -- NIGHT
Will sits alone in his one room apartment, reading. A closer
look reveals he is reading a self-help PSYCHOLOGY BOOK. Will is
flipping through the book at about a page per second. He shakes
his head and smiles. Upon finishing the book, he throws it in a
nearby WASTEBASKET. Push in on the back of the book where a
SMILING PSYCHOLOGIST is pictured.

INT. PSYCHOLOGIST'S OFFICE -- CONTINUOUS
Will sits in a well decorated Psychologist's Office. Across from
Will sits the same PSYCHOLOGIST, HENRY LIPKIN (40), from the
book. They are in mid-session.
WILL
That's why I love stock-car racin'. That
Dale Ernhart's real good.
PSYCHOLOGIST
Now you know Will, and I know, what you
need to be doing. You have a gift.
WILL
I could work the pit maybe, but I could
never drive like Dale Ernhart-PSYCHOLOGIST
--you have a quality-- something you
were born with, that you have no control
over- and you are, in a sense, hiding
that by becoming a janitor. And I'm not
saying that's wrong. I'm friends with
the janitor that works in my building.
He's been to my house for dinner. As a
matter of fact I did some free
consultation for "Mike" -- that's not
his real name. That's in my book.
WILL
Yeah, I read your book. "Mike" had the
same problems as "Chad" the stockbroker.

PSYCHOLOGIST
Yes. The pressures you feel, and again,
I am neither labeling nor judging them,
are keeping you from fulfilling your
potential -- you're in a rut. So stop
the Tom Foolery -- the Shenanigan's,
Will.
WILL
You're right. I know.
PSYCHOLOGIST
Will, your not getting off that easy.
WILL
No, but, I mean you know...I do other
things. That no one knows about.
PSYCHOLOGIST
Like what, Will?
WILL
I go places, I interact.
PSYCHOLOGIST
What places?
WILL
Certain, clubs.
(beat)
Like, Paradise. It's not bad.
Will gives the Psychologist a furtive look.
WILL (cont'd)
It's just that feeling when you can
take your shirt off and really dance.
(beat)
When the music owns you. Do you
understand?
PSYCHOLOGIST
I might understand that.
WILL
Do you find it hard to hide the fact
that you're gay?
PSYCHOLOGIST
What?
WILL
C'mon, I read your book. I talked to
you. It's just something I know to be
true.
PSYCHOLOGIST
That's very presumptuous.

WILL
Buddy, two seconds ago you were ready to
give me a jump.
PSYCHOLOGIST
(a little laugh)
Well, I'm sorry to disappoint you, but
I'm married and I have two children.
WILL
I'm sure you do. You probably got a real
nice house, nice car -- your book's a
best seller.
PSYCHOLOGIST
You're getting defensive, Will.
WILL
Look, man. I don't care if you're
putting from the rough. There are solid
arguments that some of the greatest
people in history were gay; Alexander
the Great, Caeser, Shakespeare, Oscar
Wilde, Napoleon, Gertrude Stein, not to
mention Danny Terrio, not many straight
men can dance like that.
PSYCHOLOGIST
Who is "Danny Terrio?"
WILL
If you wanna hit "Ramrod," take your
shot. Take some pride in it. You go to
church? So fuckin' what, God loves you.
I mean, Christ. A guy as well known as
you? By the time you put your disguise
on and skulk out of the house Sunday
nights you probably look like "Inspector
Cluseau."
The Psychologist calmly packs his things.
PSYCHOLOGIST
Well, I can see this is pointless...
WILL
You're getting defensive...Henry. And
hey, cheif--tell the wife, at least.
Christ, set her free.
The shrink gets up and walks out.
WILL (cont'd)
Fuckin' hypocrite...

INT. HALLWAY -- CONTINUOUS
The Psychologist comes walking out, much to the surprise of
Lambeau and Tom who have been waiting in the lobby.
LAMBEAU
Henry?
The Psychologist keeps walking.
PSYCHOLOGIST
No. You know what, Gerry? This is why I
don't do pro-bono anymore. It's not
worth it to me.
LAMBEAU
What happened?
PSYCHOLOGIST
I don't have the time. I'm going on
national television this week.
LAMBEAU
Wait a minute, Henry...
He [Henry] is out the door. Lambeau looks to Tom.
CUT TO:

INT. LAMBEAU'S OFFICE -- DAY
Will is in Lambeau's office. Lambeau is at the board, working on
a diagram as Tom takes notes. Will seems disinterested.
LAMBEAU
This rectangle is subdivided into
rectangles. One edge of an inner
rectangle is an integer. Can you prove
that one edge of the larger rectangle is
an integer?
WILL
Of course.
LAMBEAU
Okay. How?
WILL
It's an integer proof.
Lambeau smiles.
WILL (cont'd)
What? Hey, look buddy my time's almost
up. You want me to sit here for an hour
and write it out?

Lambeau says nothing. Will gets up and goes to the board.
WILL (cont'd)
Look, I'll give you the key steps to it
but I'm not gonna do the whole thing.
Lambeau keeps smiling.
LAMBEAU
That would be a monumental waste of
time, wouldn't it, Will?
WILL
I think so.
LAMBEAU
I happen to know so.
Lambeau rises and goes to the board.
LAMBEAU (cont'd)
You're thinking too hard. What if I did
this?
He draws a vertical line through the diagram.
LAMBEAU (cont'd)
Now, what if I do this?
He draws a horizontal line through the diagram. He hands Will
the chalk.
LAMBEAU (cont'd)
Have you ever played checkers?
Will realizes what Lambeau is getting at. In a flash he starts
drawing lines through the diagram, energized.
WILL
You color-code it. Half-red, halfblack. If that's an integer-Lambeau steps in, writing with him [Will].
LAMBEAU
What's that?
WILL
Half-red, half-black-LAMBEAU
--that?-WILL
--Half-red, half-black-LAMBEAU
--That edge!

WILL
An integer.
The two stop. They are silent for a moment. Like two gunfighters
after a duel, they put down the chalk.
LAMBEAU
(checks his watch)
It would appear we got that proof in
under the wire after all. It's not how
hard you look at things, young man, it's
the way you look at them. If you take
aim before you fire, you will find the
most difficult problems become, quite
literally, child's play.
Will gets his coat.
LAMBEAU (cont'd)
Will, you've managed to offend four of
my colleagues so much that they refused
to come back. You're meeting with the
leading hypnotist in the country next
week and Tom and I plan to sit in on the
sessions, so I expect you to behave
appropriately.
CUT TO:

INT. LAMBEAU'S OFFICE -- DAY
Will sits in a chair across from Lambeau and the HYPNOTIST.
Lambeau's assistant, TOM (33) takes notes. The Hypnotist makes
small talk with Lambeau, who checks his watch.
LAMBEAU
Shall we start the, uh...
WILL
Yeah, when do I get my hypnosis? You
guys been talkin' for twenty minutes.
HYPNOTIST
Yes, Will. We'll get to that. But first,
why don't you go to sleep for me.
He SNAPS HIS FINGERS and instantly Will's head goes BACK and his
EYES CLOSE. The Hypnotist gives Lambeau a look.
HYPNOTIST (cont'd)
Would you mind standing on one leg?
Will gets up and stands on one leg. Lambeau is impressed.
TIME CUT TO:

INT. LAMBEAU'S OFFICE -- LATER
Will is reclining, eyes closed, in a trance-like state. The mood
is more serious now.
HYPNOTIST
Okay, you're in your bed, Will. Now how
old are you?
WILL
Seven.
HYPNOTIST
And what do you see?
WILL
Somethin's in my room.
HYPNOTIST
What is it?
WILL
It's like a small figure, hoverin' over
me. Gettin' closer.
Will flinches.
HYPNOTIST
You're in a safe place, Will.
WILL
It's touching me.
Lambeau makes a sound. The Hypnotist shushes him [Lambeau] with
his [Hypnotist's] finger. Tom returns to his note-taking.
HYPNOTIST
Where is it touching you?
WILL
Down there.
(indicating genitals)
And I'm nervous.
HYPNOTIST
You don't have to be nervous, Will.
Lambeau and the Therapist trade looks. This is working.
WILL
'Cause I'm not ready.
(calming)
But the figure tells me everything's
gonna be all right. 'Cause the figure's
a Libra too. And we start dancin' and
it's beautiful-Will breaks into song at full volume.

WILL (cont'd)
"SKY ROCKETS IN FLIGHT!"
LAMBEAU
(getting up)
Oh Jesus.
The Hypnotist gets up and starts heading towards the door. Will
is still singing from "Sky Rockets."
LAMBEAU (cont'd)
Wait a minute, Barry.
HYPNOTIST
I have better ways to spend my time.
He is gone. Will stops singing, laughs.
LAMBEAU
Oh, for God's sake, Will.
WILL
Oh, come on! You're not pinnin' this one
on me. He left, I wanted to talk to him
for another twenty minutes. I was havin'
fun.
LAMBEAU
I told you to cooperate with these
people.
WILL
C'mon, that guy was a fuckin' piece of
work.
Will gets up and adopts a hypnotic persona in front of Lambeau.
WILL (cont'd)
(spooky voice)
Look into my eyes. I don't need therapy.
LAMBEAU
Get out, Will.
WILL
Okay...don't forget to get another
therapist for next week.
LAMBEAU
That's enough.
Will is out the door. Lambeau turns to Tom.
TOM
I called Mel Weintraub this morning, to
check for availability.

LAMBEAU
What's the point?
TOM
What do you want to do?
LAMBEAU
There is somebody...
TOM
Who is he?
LAMBEAU
He was my roommate in college.

INT. BUNKER HILL CAMPUS -- DAY
This is SEAN MAGUIRE'S "Dying and Bereavement" class. Emblazoned
on the door is "room 101." While the lecture hall could hold
sixty students, there are less than fifteen here today.
Sean Maguire lectures to the class in a resigned tone. Tired of
teaching, tired of life, he finds himself resigned to the tedium
of teaching core classes to an indifferent student body.
SEAN
Establishing trust is the most important
component in making breakthroughs with a
patient. Why?
A beat.
SEAN (cont'd)
Maureen?
MAUREEN'S only response is an empty stare.
SEAN (cont'd)
Keep up the good work, Maureen. Vinnie?
VINNIE looks up.
VINNIE
Because trust is an important thing.
SEAN
Don't bullshit me, Vinnie. Didn't your
brother give you the notes? Okay. If a
patient doesn't trust you then they
won't feel safe enough to be honest with
you--then there's no point to them being
in therapy. It's like saying -- "Fine,
come here and don't tell me a thing but
go home feeling like you're doing
something about your problems-- and give
me my fifty bucks before you leave will
ya'!"

He looks around the room for approval. No one is listening.
SEAN (cont'd)
If you don't help them trust you -- then
there's no way you'll ever get them to
sleep with you. And that should be the
goal of any good therapist. Insecure
women, you know...nail 'em when they're
vulnerable, that's always been my motto.
The students look up, somewhat stunned.
SEAN (cont'd)
See, I got Vinnie's attention.
Laughter. Sean starts to resume his lecture, when he notices
LAMBEAU standing in the back of the room. There is an awkward
moment.
SEAN (cont'd)
Gerry.
LAMBEAU
Sean.
SEAN
(to class)
Well, it seems we're in the presence of
greatness. Professor Gerald Lambeau is a
Field's Medal winner. Combunatorial
Mathematics. 1986.
The students stare blankly.
LAMBEAU
Hello.
SEAN
The Field's Medal is the Nobel Prize for
math.
(beat)
But it's only given out every four
years.
A beat.
SEAN (cont'd)
Okay, that's all for today. Try and get
through Fernald by Monday.
The class starts to pack up and file out. Lambeau approaches
Sean who steps down from the lecturn.
LAMBEAU
Good to see you.
SEAN
Good to see you.

LAMBEAU
Is there someplace we can talk?
CUT TO:

EXT. HARVARD SQUARE -- NIGHT
Will and Skylar on their first date. They watch a street
MAGICIAN doing tricks with a rabbit. The guy's tricks are pretty
good, but his on-stage persona could use some work. He is
incessantly repeating the phrase "this is the rabbit, the rabbit
really does the tricks." Will gives Skylar a look and they move
on.
CUT TO:

INT. TOY STORE -- LATER
Will and Skylar walk into the small shop.
SKYLAR
I don't know, it was just kind of the
boring suburban thing. Private school,
Harvard, and now Med. School.
(Beat)
I actually figured out that at the end
of it, my brain will be worth a quarter
of a million dollars. I shouldn't have
told you that...
WILL
I bet your parents were happy to pay.
SKYLAR
I was happy to pay. I inherited the
money.
WILL
Is Harvard gettin' all that money?
SKYLAR
Stanford. I'm leaving in June after I
graduate.
WILL
So you just want to use me and go?
SKYLAR
Well, I'm gonna experiment on you for my
anatomy class, then go.
WILL
In that case, fine.
(beat)
Want to see my magic trick?

SKYLAR
Sure.
Will, pulls out a bulging HANDFUL OF CARAMELS.
WILL
Now, I'm gonna make all these caramels
disappear.
SKYLAR
Okay...
Will goes into all manner of hocus-pocus theatrics. Then shakes
his hand wildly. The trick doesn't pan out and the caramels go
flying all over the store. Skylar laughs.
WILL
It works better when I have my rabbit.
CUT TO:

INT. LOCKOBER RESTAURANT -- NIGHT
Lambeau and Sean share a table at this exclusive restaurant.
Sean seems slightly out of place in his wrinkled sport coat.
LAMBEAU
I didn't see you at the reunion.
SEAN
I've been busy.
LAMBEAU
You were missed.
(beat)
How long has it been since we've seen
each other?
SEAN
Since Nancy died.
LAMBEAU
I'm sorry, that damn conference-SEAN
I got your card.

INT. HARVARD SQ. DINER: "THE TASTY" -- NIGHT
A FRY COOK hands Will and Skylar a pair of CHEESEBURGERS.
SKYLAR
Have you ever seen Annie Hall?
WILL
No.

SKYLAR
Well, there's this part of the movie
that's about how there's always this
tension on a first date where both
people are thinking about what's going
to happen with the whole 'good night
kiss' thing.
Will smiles.
WILL
I really don't 'date' that much.
SKYLAR
(laughs)
You know what I mean. I know you've at
least thought about it.
WILL
No I haven't...
SKYLAR
Yes you have. You were thinking you were
gonna get a good night kiss.
WILL
(mock protest)
No I wasn't...
SKYLAR
Yes you were.
WILL
I was kinda' hopin' to get a "good night
laid" but...I'll take a kiss.
She laughs.
SKYLAR
Oh, you will?
WILL
No...I was hoping to get a kiss.
SKYLAR
Then why don't we just get it out of the
way.
He looks at her.
WILL
Now?
Both of them have cheeseburger in their mouths.
SKYLAR
Yeah.

They kiss, mouths full of burger. It's nice. A beat.
SKYLAR (cont'd)
That had to be the worst good night
kiss...
Will laughs.
WILL
Hey, look lady, I'm just here for the
free food.
She smiles.
SKYLAR
Free?
WILL
Hey, I spent all my money on those
caramels.
She laughs.
CUT TO:

INT. LOCKOBER RESTAURANT -- SAME
Lambeau and Sean, having finished their meal. Lambeau has been
pitching Sean.
SEAN
I've been busy, Gerry. I got a full
schedule.
LAMBEAU
This kid's special, Sean. I've never
seen anything like him.
SEAN
Not much free time, Gerry.
LAMBEAU
Have you ever heard of a man named
Ramanujan?
Sean nods his head.
SEAN
Yeah.
LAMBEAU
He was alive over a hundred years ago.
He was Indian. Dots, not feathers...
Sean finishes the joke. Lambeau chuckles.

LAMBEAU (cont'd)
So this Ramanujan lived in a tiny hut in
India. No formal education, no access to
other works. But he came across an old
math book and from this basic text he
was able to extrapolate theories that
had baffled mathematicians for years.
SEAN
And he mailed it to Hardy-LAMBEAU
--That's right, Sean. He mailed it to a
professor at Cambridge who immediately
recognized the brilliance in his work
and brought Ramanujan to England.
SEAN
Where he contracted pneumonia and died
at a young age-LAMBEAU
They worked together for the remainder
of their lives, producing some of the
most exciting math theory ever done.
Ramanujan's genius was unparalleled,
Sean. This boy is like that. But he's
very defensive and I need someone who
can get through to him.
SEAN
Why me?
LAMBEAU
I need someone with your kind of
background.
SEAN
My kind of background?
LAMBEAU
You're from the same neighborhood. South
Boston.
SEAN
He's from Southie? How many people did
you try before you came to me?
LAMBEAU
(looks squarely at Sean)
Five.
Sean gives a slight, knowing smile.
SEAN
Who? Barry, Henry, Rick...
Lambeau nods.

SEAN
Not Rick? You didn't send him to Rick?
LAMBEAU
Just meet with the boy once a week.
SEAN
Can we do it at my office?
LAMBEAU
That would be fine.
The waiter comes with the CHECK. Each man reaches for it.
LAMBEAU (cont'd)
Sean, please.
SEAN
I got it.
LAMBEAU
It's on the college.
Sean relents.
CUT TO:

EXT. BUNKER HILL CAMPUS -- MORNING
Establishing shot of the red-brick campus. Planes land at nearby
Logan airport. Will walks up the steps.
CUT TO:

INT. SEAN'S OFFICE -- DAY
Sean's office is comfortable. Books are stacked against the
wall. There is a PAINTING on the wall behind Sean. Sean is
seated behind a desk. Lambeau sits in a chair in the back of the
room, next to Tom. A long beat passes, they wait.
LAMBEAU
Any vulnerability he senses, he'll
exploit.
SEAN
I'll be okay.
LAMBEAU
It's a poker game with this young man.
Don't let him see what you've got.
Sean nods. Will walks in. Everyone stands to greet Will.

LAMBEAU (cont'd)
Hello, Will. Any trouble finding the
place?
WILL
No.
LAMBEAU
Will, this is Sean Maguire. Sean, Will
Hunting.
Sean and Will nod. An awkward moment as the four men stand.
LAMBEAU (cont'd)
Well, let's get started.
WILL
Yeah, let's let the healing begin.
Lambeau is slightly embarrassed. Sean smiles at Will's joke.
SEAN
Would you excuse us?
LAMBEAU
Tom.
SEAN
You too, Gerry.
Lambeau looks at Sean, surprised. Sean's stare is unwavering.
After an awkward moment, Lambeau goes, leaving Sean and Will
alone. Will doesn't look at Sean for more than a second. He
seems more interested in the room. There is a long silence as
Sean watches Will.
SEAN (cont'd)
Hello, Will. I'm Sean Maguire.
A smile crosses Will's face as he walks to his chair and sits.
He lights a cigarette. Sean continues to watch him. FinallySEAN (cont'd)
Where are you from in Southie?
WILL
Did you buy all these books retail, or
do you send away for like a "shrink kit"
that comes with all these volumes
included?
SEAN
Have you read all these books, Will?
WILL
Probably not.

SEAN
(indicating a shelf)
How about the ones on that shelf?
Will's eyes flicker up to the shelf for an instant.
WILL
Yeah, I read those.
SEAN
What did you think?
WILL
I'm not here for a fuckin' book report.
They're your books, why don't you read
'em?
SEAN
I did.
WILL
That must have taken you a long time.
SEAN
Yeah, it did take me a long time.
Sean says this with pride. His determined stare and confident
manner catch Will a bit off guard. Will rises from his chair and
goes to the shelf.
WILL
(looking at book)
"A History of the United States, Volume
I." If you want to read a real history
book, read Howard Zinn's "A People's
History of the United States." That book
will knock you on your ass.
SEAN
How about Noam Chomsky's "Manufacturing
Consent?"
WILL
You people baffle me. You spend all this
money on beautiful, fancy books-- and
they're the wrong fuckin' books.
SEAN
You think so?
WILL
Whatever blows your hair back.
Will returns to his chair. Pause.

SEAN
(indicating cigarette)
Guy your age shouldn't smoke so much.
Stunt your growth.
WILL
You're right. It really gets in the way
of my jazzercizing.
Sean does not seem at all affected by Will's attitude. He
remains behind the big desk with almost half a smile on his
face. Will is aware of Sean's confidence.
WILL (cont'd)
Do you lift?
SEAN
Yes, I do.
WILL
Nautilus?
SEAN
Free weights.
WILL
Oh yeah? Me too. What do you bench?
SEAN
285.
WILL
Oh.
Will gets up again and moves around his chair to Sean's
painting. It is a picture of an old sailboat in a tremendous
storm--by no means a masterpiece. Will studies it.
WILL (cont'd)
You paint this?
SEAN
Yeah. Do you paint?
WILL
No.
SEAN
Crayons?
WILL
This is a real piece of shit.
SEAN
Tell me what you really think.

WILL
Poor color composition, lousy use of
space. But that shit doesn't really
concern me.
SEAN
What does?
WILL
The color here, see how dark it is? It's
interesting.
SEAN
What is?
WILL
I think you're one step away from
cutting your ear off.
SEAN
Oh, "Starry Night" time, huh?
WILL
You ever heard the saying, "any port in
a storm?"
SEAN
Sure, how 'bout "still waters run deep"WILL
--Well, maybe that means you.
SEAN
Maybe what mea-WILL
Maybe you were in the middle of a
storm, a big fuckin' storm-- the waves
were crashing over the bow, the
Goddamned mast was about to snap, and
you were crying for the harbor. So you
did what you had to do, to get out.
Maybe you became a psychologist.
SEAN
Maybe you should be a patient and sit
down.
WILL
Maybe you married the wrong woman.
SEAN
Watch your mouth.

WILL
That's it isn't it? You married the
wrong woman. She leave you? Was she
bangin' someone else?
Sean is walking slowly towards Will.
WILL (cont'd)
How are the seas now, D-In a flash, Sean has Will by the throat. Will is helpless.
SEAN
If you ever disrespect my wife again...I
will end you.
WILL
Time's up.
CUT TO:

INT. HALLWAY -- CONTINUOUS
Will walks out of Sean's office past Lambeau and Tom who are
sitting in the hallway.
WILL
At ease, gentlemen.
CUT TO:

INT. SEAN'S OFFICE -- DAY
Sean stands behind his desk in his office, still very much on
edge. Lambeau walks in.
LAMBEAU
Five minutes, Sean. Are you okay?
A pause, Sean is staring at his painting.
LAMBEAU (cont'd)
I'll understand if you don't want to
meet with him again.
SEAN
Thursday, four o'clock. Make sure the
kid is here.
CUT TO:

EXT. WONDERLAND RACETRACK -- DAY
Will and Skylar sit in the stands watching the dogs run. They ad
lib teasing one another about England, Ireland, and America.

SKYLAR
You grew up around here?
WILL
Not far from here, South Boston.
SKYLAR
How was that?
WILL
Pretty boring, I guess.
She smiles.
SKYLAR
I bet you have a great family.
WILL
You know, nothing special.
SKYLAR
You have a lot of brothers and sisters?
WILL
Do I have a lot of brothers and sisters?
SKYLAR
Yeah.
WILL
Well, Irish Catholic. What do you think?
SKYLAR
How many?
WILL
You wouldn't believe me if I told you.
SKYLAR
What, five?
Will shakes his head.
SKYLAR (cont'd)
Seven?
Will shakes his head. Smiles.
SKYLAR (cont'd)
Come on.
WILL
I have twelve big brothers.
SKYLAR
Not a chance.

WILL
Yup, you're lookin' at lucky thirteen.
SKYLAR
Bullshit.
WILL
I swear to God.
SKYLAR
Your house must have been a zoo.
WILL
It was great. There was always someone
to play with, give you advice.
SKYLAR
Do you know all their names?
WILL
'Course I do, they're my brothers.
SKYLAR
Well...
WILL
Marky, Ricky, Danny, Terry, Mikey,
Davey, Timmy, Tommy, Joey, Robby,
Johnny, and Brian.
SKYLAR
(laughing)
Do you keep in touch with them?
WILL
All the time. We all live in Southie. I
live with three of them now.
Skylar smiles.
SKYLAR
I want to meet them.
WILL
We'll do that.
CUT TO:

INT. SEAN'S APARTMENT -- NIGHT
As we pan across Sean's small apartment, we find it strewn with
dirty clothes and the sink full of dishes. Although, if it
weren't for the clutter, the place would feel pretty bare. A
framed SPORTS ILLUSTRATED cover featuring a screaming Larry Bird
and entitled "CELTIC PRIDE" hangs on the wall. Sean sits at the
table next to another nearly empty bottle of BUSHMILL'S IRISH
WHISKEY. He is deep in thought.

CUT TO:

INT. SEAN'S OFFICE -- DAY
Will strolls into the office. Sean is waiting there behind his
desk. He seems different. More calm. Will and Sean stare at each
other for a long moment.
WILL
You again. How the paintin' coming?
Sean stands up.
SEAN
Come with me.
CUT TO:

EXT. BOSTON COMMON -- MINUTES LATER
Sean and Will sit in the bleachers at the mostly empty park.
They look out over a small pond, in which a group of
schoolchildren on a field trip ride the famous Swan Boats.
WILL
So what's with this place? You have a
swan fetish? Is this something you'd
like to talk about?
SEAN
I was thinking about what you said to me
the other day, about my painting. I
stayed up half the night thinking about
it and then something occured to me and
I fell into a deep peaceful sleep and
haven't thought about you since. You
know what occurred to me?
WILL
No.
SEAN
You're just a boy. You don't have the
faintest idea what you're talking about.
WILL
Why thank you.
SEAN
You've never been out of Boston.
WILL
No.

SEAN
So if I asked you about art you could
give me the skinny on every art book
ever written...Michelangelo? You know a
lot about him I bet. Life's work,
criticisms, political aspirations. But
you couldn't tell me what it smells like
in the Sistine Chapel. You've never
stood there and looked up at that
beautiful ceiling. And if I asked you
about women I'm sure you could give me a
syllabus of your personal favorites, and
maybe you've been laid a few times too.
But you couldn't tell me how it feels to
wake up next to a woman and be truly
happy. If I asked you about war you
could refer me to a bevy of fictional
and non-fictional material, but you've
never been in one. You've never held
your best friend's head in your lap and
watched him draw his last breath,
looking to you for help. And if I asked
you about love I'd get a sonnet, but
you've never looked at a woman and been
truly vulnerable. Known that someone
could kill you with a look. That someone
could rescue you from grief. That God
had put an angel on Earth just for you.
And you wouldn't know how it felt to be
her angel. To have the love be there for
her forever. Through anything, through
cancer. You wouldn't know about sleeping
sitting up in a hospital room for two
months holding her hand and not leaving
because the doctors could see in your
eyes that the term "visiting hours"
didn't apply to you. And you wouldn't
know about real loss, because that only
occurs when you lose something you love
more than yourself, and you've never
dared to love anything that much. I look
at you and I don't see an intelligent
confident man, I don't see a peer, and I
don't see my equal. I see a boy. Nobody
could possibly understand you, right
Will? Yet you presume to know so much
about me because of a painting you saw.
You must know everything about me.
You're an orphan, right?
Will nods quietly.

SEAN (cont'd)
Do you think I would presume to know the
first thing about who you are because I
read "Oliver Twist?" And I don't buy the
argument that you don't want to be here,
because I think you like all the
attention you're getting. Personally, I
don't care. There's nothing you can tell
me that I can't read somewhere else.
Unless we talk about your life. But you
won't do that. Maybe you're afraid of
what you might say.
Sean stands,
SEAN (cont'd)
It's up to you.
And walks away.
CUT TO:

INT. CONSTRUCTION SITE -- DAY
Will and Chuckie doing demo at the site. They throw cinderblocks
out a window into a pile. They are filthy.
CUT TO:

EXT. SOUTH BOSTON STREET -- NIGHT
Rain pounds South Boston. Chuckie sits with the Cadillac
fidling, humming to the radio. Morgan and Billy sit in the back,
sharing a case of beer. Will is at a pay phone.
INT. SKYLAR'S ROOM -- NIGHT
SKYLAR
Hello?
Will hangs up and runs back to the car, soaked.
CHUCKIE
Who'd you call?
WILL
No one. I didn't have the number.
MORGAN
What are you, retarded? You went all the
way out there in the rain and you didn't
have the number?
WILL
No, it was your mother's 900 number. I
just ran out of quarters.

Laughter. Chuckie pulls away from the curb.
MORGAN
Why don't we get off mothers, I just got
off yours.
There is a long moment of silence in response to Morgan's
attempt at levity. Then laughter.
BILLY
You're a pretty funny guy. Here, have a
nickel.
Billy WHIPS his EMPTY BEER CAN off of Morgan's head.
MORGAN
Keep fuckin' with me. Watch what
happens.
BILLY
All right, then.
MORGAN
Watch what happens.
CUT TO:

INT. SEAN'S OFFICE -- DAY
Will sits across from Sean completely silent and takes out a
pack of cigarettes.
SEAN
No smoking.
Will puts the cigarettes away. Sean stares at Will and
occaisionally at the clock. Sean continues to check the clock on
the wall. It is the only clock in the room and it is BEHIND
Will. Their hour is almost up.
CLOSE ON: WILL'S EYES INTERCUT WITH THE CLOCK.
He is counting seconds. As the second hand crosses the twelve,
Will stands up and walks out, leaving Sean alone.

INT. HALLWAY -- LATER
Lambeau and Sean walk down the hallway after the session.
LAMBEAU
What do you mean "he didn't talk?" You
sat there for an hour?

SEAN
No, he just sat there and counted the
seconds until the session was over. It
was pretty impressive, actually.
LAMBEAU
Why would he do that?
SEAN
To show me he doesn't have to talk to me
if he doesn't want to.
LAMBEAU
Oh, what is this? Some kind of staring
contest between two kids from the "old
neighborhood?"
SEAN
I won't talk first.

EXT. WILL'S APARTMENT -- EVENING
Chuckie drops Will off at his apartment, watches him [Will] walk
up the steps.
DISSOLVE TO:

EXT. WILL'S APARTMENT -- MORNING
Chuckie pulls up to the curb and walks up the steps to Will's
front door. After a beat, Will emerges. They get back in [the
car].
CUT TO:

EXT. CONSTRUCTION SITE -- DAY
Will and Chuckie at work. Chuckie shows Will how to be a man.

INT. L STREET BAR & GRILLE, SOUTH BOSTON -- NIGHT
The bar is a bit more crowded than usual. Will and Chuckie walk
back to their table, carrying beers. They pass a table of
GIRLS, local regulars getting just as bombed as the guys. These
girls are a little overdone. Too much make-up, too much
hairspray, and too much body for such tight outfits. One of the
girls, KRYSTYN, smiles at Will who seems subdued.
KRYSTYN
Hi, Will.
WILL
How you doin', Krystyn.

They pass the table of girls. Chuckie looks at one, ruefully.
CHUCKIE
I didn't get on Cathy last night.
WILL
Why not?
CHUCKIE
I don't know.
Chuckie turns back to one of the girls, calling out:
CHUCKIE (cont'd)
Cathy! Why didn't you give me none of
your twat last night?
A girl at the table, CATHY, holds up her PINKY FINGER and
smiles-- revealing a mouthful of MISSING TEETH.
CATHY
Fuck you and your Irish curse, Chuckie!
CHUCKIE
She's missin' teeth, Will.
Will nods, not really into it tonight.
CHUCKIE (cont'd)
Plus, it's like, five to two Morgan ends
up marryin' her. There's only so many
times you can bang your friend's future
wife...
They get to the table. Will's heart just isn't in it.
WILL
I'm takin' off.
ALL
We're goin' late night.
WILL
I'm tired.
CUT TO:

INT. LAMBEAU'S OFFICE -- DAY
Will and Lambeau work together at the board. They communicate
non-verbally as they collaborate on a problem. After a
particularly amusing series of numbers, they share a look and
laugh.
CUT TO:

INT. SEAN'S OFFICE -- DAY
Will and Sean sit in silence. A long moment passes. Sean
casually reclines in his chair, disinterested. Will restlessly
looks around the room and then back to Sean. An odd half smile
crosses Sean's face. After a moment:
WILL
You know, I was on this plane once. And
I'm sittin' there and the captain comes
on and is like "we'll be cruising at
35,000 feet," and does his thing, then
he puts the mike down but forgets to
turn it off. Then he says "man, all I
want right now is a blow-job and a cup
of coffee." So the stewardess goes
runnin' up towards the cock-pit to tell
him the mike's still on, and this guy in
the back of the plane goes "don't forget
the coffee!"
SEAN
(smiles)
You've never been on a plane.
WILL
I know, but the joke's better if I tell
it in the first person.
A beat.
WILL (cont'd)
I have been laid you know.
Sean smiles.
SEAN
Yeah? You got a lady now?
WILL
Yeah, I went on a date last week.
SEAN
How'd it go?
WILL
Fine.
SEAN
Well, are you going out again?
WILL
I don't know.
SEAN
Why not?

WILL
Haven't called her.
SEAN
Jesus Christ, you are an amateur.
WILL
I know what I'm doing. She's different
from the other girls I met. We have a
really good time. She's smart,
beautiful, fun...
SEAN
So Christ, call her up.
WILL
Why? So I can realize she's not so
smart. That she's boring. You don't get
it. Right now she's perfect, I don't
want to ruin that.
SEAN
And right now you're perfect too. Maybe
you don't want to ruin that.
Will says nothing.
SEAN (cont'd)
Well, I think that's a great philosophy
Will, that way you can go through your
entire life without ever having to
really know anybody.
Sean looks directly at Will, who looks away. A beat.
SEAN (cont'd)
My wife used to turn the alarm clock off
in her sleep. I was late for work all
the time because in the middle of the
night she'd roll over and turn the damn
thing off. Eventually I got a second
clock and put it under my side of the
bed, but it got to where she was gettin'
to that one too. She was afraid of the
dark, so the closet light was on all
night. Thing kept me up half the night.
Eventually I'd fall asleep, out of sheer
exhaustion and not wake up when I was
supposed to cause she'd have already
gotten to my alarms.
Will smiles, Sean takes a beat.

SEAN (cont'd)
My wife's been dead two years, Will. And
when I think about her, those are the
things I think about most. Little
idiosyncrasies that only I knew about.
Those made her my wife. And she had the
goods on me too. Little things I do out
of habit. People call these things
imperfections Will. It's just who we
are. And we get to choose who we're
going to let into out weird little
worlds. You're not perfect. And let me
save you the suspense, this girl you met
isn't either. The question is, whether
or not you're perfect for each other.
You can know everything in the world,
but the only way you're findin' that one
out is by giving it a shot. You sure
won't get the answer from an old fucker
like me. And even if I did know, I
wouldn't tell you.
Will smiles. A beat.
WILL
Why not? You told me every other fuckin'
thing. You talk more than any shrink I
ever met.
Sean laughs.
SEAN
I teach this shit, I didn't say I knew
how to do it.
WILL
You ever think about gettin' remarried?
SEAN
My wife's dead.
WILL
Hence, the word remarried.
SEAN
My wife's dead.
WILL
Well I think that's a wonderful
philosophy, Sean. That way you can go
through the rest of your life without
having to really know anyone.
A beat. Sean smiles.
SEAN
Time's up.

CUT TO:

EXT. SKYLAR'S DORM -- AFTERNOON
Will is waiting outside the door for someone to come out -- so
he can go in.

INT. SKYLAR'S DORM -- AFTERNOON
The door to Skylar's dorm is partially open. Will stands outside
while Skylar remains on the threshold.
SKYLAR
Where have you been?
WILL
I'm sorry, I been real busy.
SKYLAR
You were busy? You know, I really was
waiting for you to call me.
WILL
Sorry. I'm sorry. Give me another crack
at it. Let me take you out.
SKYLAR
You should have called. I have an "Ochem" lab due tomorrow and it's
impossible.
(beat)
It's not an excuse dummy. I want to go
out with you. But look:
She holds up her Lab. Will glances at it.
SKYLAR (cont'd)
Tomorrow?
WILL
Promise?
SKYLAR
If you bring the caramels.
Will smiles.
CUT TO:

EXT. HARVARD SQUARE -- LATER
Will sits in an outdoor cafe, thinking. After a beat, he leans
over to two students working at a nearby table, borrows a pen
and paper and starts writing.

CUT TO:

EXT. SKYLAR'S DORM -- DAY
Will is a solitary figure strolling across the lawn. He stops at
Skylar's dorm and knocks on the door.
CUT TO:

INT. SKYLAR'S DORM -- DAY
She emarges. He hands her the paper he was working on. It is her
O-chem lab.
WILL
I couldn't wait till tomorrow.
SKYLAR
How the hell did you do that?
WILL
Didn't your mother ever tell you not to
look a gift horse n the mouth?
SKYLAR
I'm supposed to understand this.
WILL
You're not going into surgery tomorrow
are you?
SKYLAR
No.
WILL
Then let's go have some fun.
With a smile, she relents.

INT. SEAN'S OFFICE -- DAY
Sean and Will in session.
SEAN
Really? How'd the date go?
WILL
Do you still counsel veterans?
(beat)
I read your book last night.
SEAN
No, I don't.

WILL
Why not?
SEAN
I gave that up when my wife got sick.
WILL
Is that why you didn't write anything
else?
SEAN
(smiles)
I didn't write anything else 'cause
nobody, including most of my colleagues
bothered to read the first one.
WILL`;


export const TEST_USER_CREDENTIALS = {
  email: 'test@storymagic.ai',
  password: 'TestPassword123!',
  fullName: 'Test User',
};
