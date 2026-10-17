// lines.js — every spoken line in the game, by ID. If vo/<ID>.mp3 exists the
// recording plays; otherwise the browser's speech voice reads the text.
// VOICE_LINES.md is generated from this table for Nathan to record.
// Keys: who (DIRECTOR, HUNTER_*, JOSH), when (trigger), text.

export const VOICES = {
  DIRECTOR: { name: 'The Director', pitch: 0.55, rate: 0.88, note: 'Calm, amused, close to the mic. Through an earpiece. Never shouts.' },
  HUNTER_A: { name: 'Hunter (Hockey Masks gang)', pitch: 0.8, rate: 1.05, note: 'Rough street thug, cocky.' },
  HUNTER_B: { name: 'Hunter (Skulls gang)', pitch: 0.65, rate: 0.95, note: 'Low, menacing, sing-song taunting.' },
  HUNTER_C: { name: 'Hunter (Knit Masks gang)', pitch: 1.0, rate: 1.15, note: 'Twitchy, high-strung, laughs a lot.' },
  JOSH: { name: 'Josh Earnings', pitch: 0.7, rate: 0.95, note: 'Exhausted, angry, few words. Under his breath.' },
};

export const LINES = [
  // ---------------------------------------------------------------- Director
  ['dir_intro_1', 'DIRECTOR', 'Start of scene', "Good evening, Josh. Josh Earnings. Can you hear me? Touch your ear. That's me."],
  ['dir_intro_2', 'DIRECTOR', 'Start of scene', "The State was going to put you to sleep at midnight. I paid a great deal of money to make sure it didn't. Welcome to Carcer City."],
  ['dir_intro_3', 'DIRECTOR', 'Start of scene', "Now you're going to pay me back. There are men out there who've been told you're worth a lot of money dead. Give my audience a show, and that gate on the east wall opens."],
  ['dir_intro_4', 'DIRECTOR', 'Start of scene', "Stay in the dark. Keep quiet. And when you get behind one of them... make it count. The cameras are rolling."],
  ['dir_gate_open', 'DIRECTOR', 'Pen gate opens', "Your cell door is open. Action."],
  ['dir_pickup_bag', 'DIRECTOR', 'First time picking up a plastic bag', "A plastic bag. Simple. Intimate. Get behind one and pull it tight."],
  ['dir_pickup_shard', 'DIRECTOR', 'First time picking up a glass shard', "Glass. It'll cut your hand as much as theirs. Make it quick."],
  ['dir_pickup_crowbar', 'DIRECTOR', 'First time picking up the crowbar', "Ah, the crowbar. A classic. Swing it like you mean it."],
  ['dir_pickup_throw', 'DIRECTOR', 'First time picking up a bottle or brick', "Throw that somewhere they'll hear it. Let them go look."],
  ['dir_kill_quiet', 'DIRECTOR', 'Quick, clean takedown', "Quiet. Efficient. The audience likes a professional."],
  ['dir_kill_quiet_2', 'DIRECTOR', 'Quick, clean takedown', "Hm. Clean. Carcer City likes it messier. Take your time with the next one."],
  ['dir_kill_brutal', 'DIRECTOR', 'Long or violent takedown', "Oh, that was beautiful. Did you see his feet kick? We got every frame."],
  ['dir_kill_brutal_2', 'DIRECTOR', 'Long or violent takedown', "Now THAT is what they're paying for."],
  ['dir_kill_bag', 'DIRECTOR', 'Bag takedown finished', "Look how still he is now. Like he's sleeping. Ha."],
  ['dir_kill_fight', 'DIRECTOR', 'Kill in an open fight', "Sloppy. A brawl is not a performance, Josh."],
  ['dir_spotted', 'DIRECTOR', 'A hunter spots Josh', "Oh dear. He's seen you. Run, or don't. Either way it's good television."],
  ['dir_spotted_2', 'DIRECTOR', 'A hunter spots Josh', "You're in the light, Josh. Amateurs stand in the light."],
  ['dir_lost', 'DIRECTOR', 'Hunters lose Josh', "And he's gone. Nice. Very nice."],
  ['dir_cctv', 'DIRECTOR', 'A CCTV camera sees Josh', "Smile, I've got you on camera four. Let me tell the boys where you are."],
  ['dir_cctv_2', 'DIRECTOR', 'A CCTV camera sees Josh', "There you are. Lovely angle. Gentlemen, he's near you."],
  ['dir_cctv_smash', 'DIRECTOR', 'Josh smashes a camera', "Hey. Those are expensive. Fine. I'll watch you through the others."],
  ['dir_hidden', 'DIRECTOR', 'Josh hides in shadow near a hunter', "Hold your breath. He's right there."],
  ['dir_idle', 'DIRECTOR', 'Josh does nothing for a long time', "This is dead air, Josh. Nobody in Carcer City pays for dead air."],
  ['dir_idle_2', 'DIRECTOR', 'Josh does nothing for a long time', "My audience is getting bored. You don't want to know what I do with bored."],
  ['dir_noise', 'DIRECTOR', 'Josh makes a loud noise', "Loud. Very loud. Everyone heard that."],
  ['dir_distract', 'DIRECTOR', 'A thrown object draws a hunter away', "He took the bait. Go. Now."],
  ['dir_hurt', 'DIRECTOR', 'Josh is badly hurt', "You're bleeding on my set, Josh. Don't die yet. We're not finished."],
  ['dir_one_left', 'DIRECTOR', 'One kill away from the gate opening', "One more. Give me one more and the gate is yours."],
  ['dir_gate', 'DIRECTOR', 'Exit gate unlocks', "That's a wrap on this scene. The gate on the east wall is open. Walk out. Don't run. Walking looks better."],
  ['dir_win', 'DIRECTOR', 'Josh walks out the gate', "Cut. Beautiful. Rest up, Josh. Tomorrow we shoot the old mall on the other side of Carcer."],
  ['dir_death', 'DIRECTOR', 'Josh dies', "Cut. CUT. Well, that's a shame. Reset the scene. We go again."],
  ['dir_death_2', 'DIRECTOR', 'Josh dies', "No, no, no. Nobody wants to watch you die that fast. Again."],

  // ---------------------------------------------------------------- Hunters (each gang records the same set)
  ...['A', 'B', 'C'].flatMap((g) => [
    [`h${g}_idle_1`, 'HUNTER_' + g, 'Patrolling, bored', ['Come on out, death row. I got bills to pay.', "Earnings! Josh Earnings! Big money on your head, man!", "Tick tock, killer. Tick tock."][('ABC').indexOf(g)]],
    [`h${g}_idle_2`, 'HUNTER_' + g, 'Patrolling, bored', ["This place stinks. Let's find him and go home.", "I can smell you, little man. You smell like prison.", "Heh. Heh heh. Where are you? Where are youuu?"][('ABC').indexOf(g)]],
    [`h${g}_idle_3`, 'HUNTER_' + g, 'Patrolling, bored', ["They say he killed a family. Nobody in Carcer cares, man.", "Come here, pig. Come to daddy.", "I'm gonna be famous after this. On TV, baby!"][('ABC').indexOf(g)]],
    [`h${g}_hear`, 'HUNTER_' + g, 'Hears a noise', ["What was that?", "Hm. Something's moving.", "Who's there? WHO'S THERE?"][('ABC').indexOf(g)]],
    [`h${g}_suspect`, 'HUNTER_' + g, 'Glimpses something', ["Hey. Hey! Something over there.", "I see you... maybe.", "Was that him? That was him!"][('ABC').indexOf(g)]],
    [`h${g}_search`, 'HUNTER_' + g, 'Searching an area', ["Come out, come out. Don't make me dig.", "You can't hide in the dark forever.", "I know you're here. I KNOW you're here!"][('ABC').indexOf(g)]],
    [`h${g}_giveup`, 'HUNTER_' + g, 'Gives up searching', ["Must've been rats.", "Nothing. Next time.", "Ugh. Forget it. Forget it!"][('ABC').indexOf(g)]],
    [`h${g}_spot`, 'HUNTER_' + g, 'Spots Josh', ["THERE HE IS!", "Found you.", "HE'S HERE! HE'S RIGHT HERE!"][('ABC').indexOf(g)]],
    [`h${g}_chase`, 'HUNTER_' + g, 'Chasing Josh', ["Get back here!", "Run, rabbit. Run.", "You can't run, man, you can't run!"][('ABC').indexOf(g)]],
    [`h${g}_hit`, 'HUNTER_' + g, 'Hits Josh', ["How's that feel?", "Hold still.", "Ha! HA!"][('ABC').indexOf(g)]],
    [`h${g}_hurt`, 'HUNTER_' + g, 'Gets hurt', ["Agh! You little...", "Nngh. You'll pay for that.", "OW! Oh God, OW!"][('ABC').indexOf(g)]],
    [`h${g}_lost`, 'HUNTER_' + g, 'Loses sight of Josh', ["Where'd he go?", "Hiding again. Cute.", "No no no, where'd he GO?"][('ABC').indexOf(g)]],
    [`h${g}_body`, 'HUNTER_' + g, 'Finds a dead hunter', ["Oh man... oh, he got Ricky.", "Hm. He's good. Good.", "He's DEAD! He's dead, man!"][('ABC').indexOf(g)]],
    [`h${g}_bagged`, 'HUNTER_' + g, 'Bag pulled over head (muffled)', ["Mmph! MMPH!", "Hhhkk... mmmh!", "Nnnnn! NNNNN!"][('ABC').indexOf(g)]],
    [`h${g}_die`, 'HUNTER_' + g, 'Dies', ["Aaagh...", "Hhk...", "No... no..."][('ABC').indexOf(g)]],
  ]),

  // ---------------------------------------------------------------- Josh
  ['josh_wake', 'JOSH', 'Start of scene', "Where the hell am I... Carcer?"],
  ['josh_reply', 'JOSH', 'After the Director explains', "I didn't kill anybody."],
  ['josh_kill', 'JOSH', 'After a kill (sometimes)', "...Sorry."],
  ['josh_kill_2', 'JOSH', 'After a kill (sometimes)', "Stay down."],
  ['josh_spotted', 'JOSH', 'Spotted', "Damn it."],
  ['josh_hurt', 'JOSH', 'Takes a hit', "Agh!"],
  ['josh_gate', 'JOSH', 'Gate opens', "I'm coming for you next."],
];

export const LINE = Object.fromEntries(LINES.map(([id, who, when, text]) => [id, { id, who, when, text }]));
export function pick(prefix) { // random line among ids starting with prefix (e.g. 'dir_kill_quiet')
  const c = LINES.filter(([id]) => id === prefix || id.startsWith(prefix + '_') && /_\d$/.test(id) || id === prefix);
  const all = LINES.filter(([id]) => id === prefix || (id.startsWith(prefix + '_') && /^\d+$/.test(id.slice(prefix.length + 1))));
  const list = all.length ? all : c;
  return list.length ? LINE[list[Math.floor(Math.random() * list.length)][0]] : null;
}
