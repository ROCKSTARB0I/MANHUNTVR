// lines.js — every spoken line in the game, by ID. If vo/<ID>.mp3 exists the
// recording plays; otherwise the browser's speech voice reads the text.
// VOICE_LINES.md is generated from this table for Nathan to record.
// Keys: who (DIRECTOR, HUNTER_*, CASH), when (trigger), text.

export const VOICES = {
  NEWS: { name: 'News anchor', pitch: 1, rate: 1, note: 'Channel 6 evening news anchor. Serious, practised TV voice.' },
  DIRECTOR: { name: 'The Director', pitch: 0.92, rate: 0.9, note: 'Like the Director in Manhunt: a calm, cultured British voice, close to the mic, quietly thrilled and a bit breathless when it gets violent. Talks through an earpiece. Never shouts.' },
  HUNTER_A: { name: 'Hood (hockey mask)', pitch: 0.8, rate: 1.05, note: 'Rough street thug, cocky.' },
  HUNTER_B: { name: 'Hood (skull mask)', pitch: 0.65, rate: 0.95, note: 'Low, slow and menacing. Taunts quietly.' },
  HUNTER_C: { name: 'Hood (balaclava)', pitch: 1.0, rate: 1.15, note: 'Twitchy, high-strung, laughs a lot.' },
  CASH: { name: 'James Earl Cash', pitch: 0.85, rate: 0.95, note: 'A grown man in his late 30s, low gravelly voice. Exhausted, angry, few words. Under his breath.' },
};

export const LINES = [
  // ---------------------------------------------------------------- Intro cutscene: the news
  ['news_1', 'NEWS', 'Intro cutscene: TV news', "Good evening. Tonight at Carcer City State Penitentiary, convicted killer James Earl Cash is scheduled to die by lethal injection."],
  ['news_2', 'NEWS', 'Intro cutscene: TV news', "The governor has refused a final appeal. Outside the prison gates, a small crowd has gathered in the rain to wait for midnight."],
  ['news_3', 'NEWS', 'Intro cutscene: TV news', "We'll bring you the moment it happens. Channel Six, live from Carcer City."],
  // ---------------------------------------------------------------- Director
  ['dir_intro_1', 'DIRECTOR', 'Start of scene', "Wake up, James. James Earl Cash. Can you hear me? That's me in your ear. Don't bother looking for me."],
  ['dir_intro_2', 'DIRECTOR', 'Start of scene', "The State was going to put you to sleep at midnight. I paid a great deal of money to make sure it didn't. Welcome to Carcer City."],
  ['dir_intro_3', 'DIRECTOR', 'Start of scene', "Now you're going to pay me back. There are men out there who've been told you're worth a lot of money dead. Kill every last one of them, and that gate on the east wall opens."],
  ['dir_intro_4', 'DIRECTOR', 'Start of scene', "Stay in the dark. Keep quiet. And when you get behind one of them... make it count. The cameras are rolling."],
  ['dir_gate_open', 'DIRECTOR', 'Pen gate opens', "Your cell door is open. Action."],
  ['dir_pickup_bag', 'DIRECTOR', 'First time picking up a plastic bag', "A plastic bag. Simple. Intimate. Get behind one and pull it tight."],
  ['dir_pickup_shard', 'DIRECTOR', 'First time picking up a glass shard', "Glass. It'll cut your hand as much as theirs. Make it quick."],
  ['dir_pickup_crowbar', 'DIRECTOR', 'First time picking up the crowbar', "Ah, the crowbar. A classic. Swing it like you mean it."],
  ['dir_pickup_throw', 'DIRECTOR', 'First time picking up a bottle or brick', "Throw that somewhere they'll hear it. Let them go look."],
  ['dir_exec_grey', 'DIRECTOR', 'Grey (hasty) execution', "Good. Quick. Not much to look at, but it's a start."],
  ['dir_exec_grey_2', 'DIRECTOR', 'Grey (hasty) execution', "Well done, James. Next time, take your time. Let the audience enjoy it."],
  ['dir_exec_grey_3', 'DIRECTOR', 'Grey (hasty) execution', "That's one. Clean. A little too clean."],
  ['dir_exec_green', 'DIRECTOR', 'Green (violent) execution', "Yes. YES. That's what I want to see. Very good."],
  ['dir_exec_green_2', 'DIRECTOR', 'Green (violent) execution', "Oh, nicely done. The viewers felt that one."],
  ['dir_exec_green_3', 'DIRECTOR', 'Green (violent) execution', "Brilliant. You're a natural, James. A natural."],
  ['dir_exec_red', 'DIRECTOR', 'Red (gruesome) execution', "Oh... oh, that was beautiful. Beautiful. Did you get that? Tell me you got that."],
  ['dir_exec_red_2', 'DIRECTOR', 'Red (gruesome) execution', "Now THAT is what they're paying for. Bloody magnificent, Cash."],
  ['dir_exec_red_3', 'DIRECTOR', 'Red (gruesome) execution', "I think I need to sit down. Wonderful work. Truly wonderful."],
  ['dir_kill_quiet', 'DIRECTOR', 'Stealth kill without charging an execution', "Quiet. Efficient. Good job, James."],
  ['dir_kill_quiet_2', 'DIRECTOR', 'Stealth kill without charging an execution', "He never saw you coming. Good. Very good."],
  ['dir_kill_fight', 'DIRECTOR', 'Kill in an open fight', "Messy as hell, but he's down. Well done. Now get back in the bloody shadows."],
  ['dir_kill_fight_2', 'DIRECTOR', 'Kill in an open fight', "You won the brawl. Congratulations. A brawl is not a performance, though, James."],
  ['dir_spotted', 'DIRECTOR', 'A hunter spots James', "Oh, damn. He's seen you. Run, or don't. Either way it's good television."],
  ['dir_spotted_2', 'DIRECTOR', 'A hunter spots James', "You're in the light, James. Amateurs stand in the light."],
  ['dir_lost', 'DIRECTOR', 'Hunters lose James', "And he's gone. Nice. Very nice."],
  ['dir_cctv', 'DIRECTOR', 'A CCTV camera sees James', "Smile, I've got you on camera four. Let me tell the boys where you are."],
  ['dir_cctv_2', 'DIRECTOR', 'A CCTV camera sees James', "There you are. Lovely angle. Gentlemen, he's near you."],
  ['dir_cctv_smash', 'DIRECTOR', 'James smashes a camera', "Hey! Those are bloody expensive. Fine. I'll watch you through the others."],
  ['dir_hidden', 'DIRECTOR', 'James hides in shadow near a hunter', "Hold your breath. He's right there."],
  ['dir_idle', 'DIRECTOR', 'James does nothing for a long time', "This is dead air, James. Nobody in Carcer City pays for dead air."],
  ['dir_idle_2', 'DIRECTOR', 'James does nothing for a long time', "My audience is getting bored. You don't want to know what I do with bored."],
  ['dir_noise', 'DIRECTOR', 'James makes a loud noise', "Loud. Very loud. Everyone heard that."],
  ['dir_distract', 'DIRECTOR', 'A thrown object draws a hunter away', "He took the bait. Go. Now."],
  ['dir_hurt', 'DIRECTOR', 'James is badly hurt', "You're bleeding on my set, James. Don't die yet. We're not finished."],
  ['dir_one_left', 'DIRECTOR', 'One kill away from the gate opening', "One more. Give me one more and the gate is yours."],
  ['dir_gate', 'DIRECTOR', 'Exit gate unlocks', "That's a wrap on this scene. The gate on the east wall is open. Walk out. Don't run. Walking looks better."],
  ['dir_rate_low', 'DIRECTOR', 'Scene rating: 1 star', "Hm. Competent, I suppose. Nobody is going to pay to watch that twice."],
  ['dir_rate_mid', 'DIRECTOR', 'Scene rating: 2-3 stars', "Not bad, James. Not bad at all. But I know you have more in you."],
  ['dir_rate_high', 'DIRECTOR', 'Scene rating: 4-5 stars', "Wonderful. Simply wonderful. That's going straight to the premium customers."],
  ['dir_win', 'DIRECTOR', 'James walks out the gate', "Cut. Beautiful. Rest up, James. Tomorrow we shoot the old mall on the other side of Carcer."],
  ['dir_death', 'DIRECTOR', 'James dies', "Cut. CUT. Well, that's a shame. Reset the scene. We go again."],
  ['dir_death_2', 'DIRECTOR', 'James dies', "No, no, no. Nobody wants to watch you die that fast. Again."],

  // ---------------------------------------------------------------- Hunters (each gang records the same set)
  ...['A', 'B', 'C'].flatMap((g) => [
    [`h${g}_idle_1`, 'HUNTER_' + g, 'Patrolling, bored', ["Come on out, death row. I got bills to pay, you piece of shit.", "Cash! James Earl Cash! There's big fuckin' money on your head, man!", "Tick tock, killer. Tick fuckin' tock."][('ABC').indexOf(g)]],
    [`h${g}_idle_2`, 'HUNTER_' + g, 'Patrolling, bored', ["This place stinks like shit. Let's find this asshole and go home.", "I can smell you, little man. You smell like a goddamn prison.", "Heh. Heh heh. Where are you, motherfucker? Where are youuu?"][('ABC').indexOf(g)]],
    [`h${g}_idle_3`, 'HUNTER_' + g, 'Patrolling, bored', ["They say he killed a whole family. Nobody in Carcer gives a shit, man.", "Come here, pig. Come to daddy, you son of a bitch.", "I'm gonna be famous after this. On fuckin' TV, baby!"][('ABC').indexOf(g)]],
    [`h${g}_hear`, 'HUNTER_' + g, 'Hears a noise', ["The hell was that?", "Hm. Something's moving. Shit.", "Who's there? WHO THE FUCK IS THERE?"][('ABC').indexOf(g)]],
    [`h${g}_suspect`, 'HUNTER_' + g, 'Glimpses something', ["Hey. Hey! Something over there, goddammit.", "I see you, you bastard... maybe.", "Was that him? Shit, that was him!"][('ABC').indexOf(g)]],
    [`h${g}_search`, 'HUNTER_' + g, 'Searching an area', ["Come out, come out, asshole. Don't make me dig.", "You can't hide in the dark forever, you little shit.", "I know you're here. I KNOW you're fuckin' here!"][('ABC').indexOf(g)]],
    [`h${g}_giveup`, 'HUNTER_' + g, 'Gives up searching', ["Must've been rats. Fuckin' rats.", "Nothing. Damn. Next time.", "Ugh. Screw it. SCREW IT!"][('ABC').indexOf(g)]],
    [`h${g}_spot`, 'HUNTER_' + g, 'Spots James', ["THERE HE IS! GET HIM!", "Found you, you son of a bitch.", "HE'S HERE! HE'S RIGHT FUCKIN' HERE!"][('ABC').indexOf(g)]],
    [`h${g}_chase`, 'HUNTER_' + g, 'Chasing James', ["Get back here, asshole!", "Run, rabbit. Run, you piece of shit.", "You can't run, man, you can't fuckin' run!"][('ABC').indexOf(g)]],
    [`h${g}_hit`, 'HUNTER_' + g, 'Hits James', ["How's that feel, huh? HUH?", "Hold still, goddammit.", "Ha! Eat shit! HA!"][('ABC').indexOf(g)]],
    [`h${g}_hurt`, 'HUNTER_' + g, 'Gets hurt', ["Agh! You little shit!", "Nngh. You'll fuckin' pay for that.", "OW! Oh God! OW, FUCK!"][('ABC').indexOf(g)]],
    [`h${g}_lost`, 'HUNTER_' + g, 'Loses sight of James', ["Where the hell'd he go?", "Hiding again. Cute, you bastard.", "No no no, where'd he GO? Shit!"][('ABC').indexOf(g)]],
    [`h${g}_body`, 'HUNTER_' + g, 'Finds a dead hunter', ["Oh shit... oh, he got Ricky. He fuckin' got Ricky.", "Hm. Son of a bitch is good. Good.", "He's DEAD! Holy shit, he's dead, man!"][('ABC').indexOf(g)]],
    [`h${g}_bagged`, 'HUNTER_' + g, 'Bag pulled over head (muffled)', ["Mmph! MMPH!", "Hhhkk... mmmh!", "Nnnnn! NNNNN!"][('ABC').indexOf(g)]],
    [`h${g}_die`, 'HUNTER_' + g, 'Dies', ["Aaagh... shit...", "Hhk...", "No... no... fuck..."][('ABC').indexOf(g)]],
  ]),

  // ---------------------------------------------------------------- Cash
  ['cash_wake', 'CASH', 'Start of scene', "Where the hell am I... Carcer? Shit."],
  ['cash_reply', 'CASH', 'After the Director explains', "I didn't kill anybody, you sick bastard."],
  ['cash_kill', 'CASH', 'After a kill (sometimes)', "...Sorry. Shit."],
  ['cash_kill_2', 'CASH', 'After a kill (sometimes)', "Stay down, asshole."],
  ['cash_spotted', 'CASH', 'Spotted', "Shit. Shit!"],
  ['cash_hurt', 'CASH', 'Takes a hit', "Agh! Fuck!"],
  ['cash_gate', 'CASH', 'Gate opens', "I'm coming for you next, you son of a bitch."],
];

export const LINE = Object.fromEntries(LINES.map(([id, who, when, text]) => [id, { id, who, when, text }]));
export function pick(prefix) { // random line among ids starting with prefix (e.g. 'dir_kill_quiet')
  const c = LINES.filter(([id]) => id === prefix || id.startsWith(prefix + '_') && /_\d$/.test(id) || id === prefix);
  const all = LINES.filter(([id]) => id === prefix || (id.startsWith(prefix + '_') && /^\d+$/.test(id.slice(prefix.length + 1))));
  const list = all.length ? all : c;
  return list.length ? LINE[list[Math.floor(Math.random() * list.length)][0]] : null;
}
