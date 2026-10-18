// sets.js — each traced scene dressed like the real one, from a frame-by-frame
// watch of the game. Coordinates are plan cells (see plans.js; 0.64 m each for
// Born Again). zones/ramps give floor heights; tall turns low blocks into
// full-height buildings; dress(K) places everything (setkit.js).
const PI = Math.PI;
export const SETS = {
  // ------------------------------------------------------------ 1. BORN AGAIN
  // Cash comes out of the dark room into a long alley of tenements (overturned
  // orange pickup, TRAVEL shop, neon, bins), round the corner, down a narrow
  // stair passage of chain-link pens into the sunken basketball court (burning
  // drums, hoops), along a low corridor and up wooden stairs into the car park
  // (box trucks, ambulance), then the mall's back corridor of shuttered shop
  // units to the REAR MALL DISPOSAL CHUTE.
  'born-again': {
    look: { bldTex: 'cinder', bldCol: 0xa8a49a },
    start: [197, 52, PI / 2], exit: [5, 133],
    zones: [{ x0: 105, y0: 68, x1: 160, y1: 103, h: -1.8 }, { x0: 105, y0: 103, x1: 137, y1: 117, h: -1.8 }],
    ramps: [{ x0: 130, x1: 137.5, y0: 103, y1: 131, axis: 'y', h0: -1.8, h1: 0 }, { x0: 91, x1: 105, y0: 109, y1: 117, axis: 'x', h0: 0, h1: -1.8 }],
    tall: [{ x0: 15, y0: 115, x1: 55, y1: 165, h: 3.4 }],
    // the Hoods: one spraying the alley wall (the plastic-bag lesson), one round the corner in the
    // dark, the fist-fight in the court, two in the car park, two guarding the mall and the chute
    patrols: [[[167, 64], [167, 67]], [[150, 138], [139, 141], [150, 138]], [[120, 88], [146, 88]],
      [[70, 115], [88, 125], [75, 140]], [[80, 104], [66, 110]], [[30, 113], [50, 113], [52, 132]], [[20, 148], [48, 150], [30, 166]]],
    dress(K) {
      // the dark room's door at the end of the side passage
      K.doorway(199.4, 52.5, -PI / 2);
      // the top of the T: where the van dropped him
      K.boxTruck(172, 10, PI / 2); K.car(156, 14, 0.4); K.bins(151.5, 4, 0, 3); K.fire(190, 16); K.prop('trash', 186, 4, 1);
      // the long alley
      K.flippedPickup(171, 40, 0.15);
      K.sign('TRAVEL', 160.4, 37, PI / 2, { w: 3.2, h: 0.8, y: 3.1, bg: '#1c2230', fg: '#e8d07a', lit: true });
      K.neon('LIQUOR', 179.6, 70, -PI / 2, '#ff3a6a'); K.neon('OPEN', 160.4, 82, PI / 2, '#3aa8ff', 2.8, 1.6);
      K.awning(160.6, 60, PI / 2, 4, 0x6a1a14); K.awning(160.6, 74, PI / 2, 3.4, 0x2a4a2a); K.awning(179.4, 46, -PI / 2, 3.6, 0x6a5a1a);
      K.shutter(179.6, 56, -PI / 2, 3.2); K.shutter(160.4, 89, PI / 2, 3.2); K.shutter(179.6, 92, -PI / 2, 2.6);
      K.prop('dumpster', 178, 28, PI / 2); K.prop('dumpster', 162, 96, -PI / 2); K.bins(178.6, 82, PI / 2, 2);
      for (const [i, j] of [[163, 30], [176, 58], [165, 66], [177, 99], [163, 48], [174, 22]]) K.prop('trash', i, j, i * 0.7);
      K.fire(176, 50);
      K.graffiti(160.3, 50, PI / 2); K.graffiti(179.7, 88, -PI / 2); K.graffiti(160.3, 98, PI / 2, 1.8);
      // round the corner
      K.fire(150, 135); K.prop('trash', 141, 141, 2); K.prop('barrel', 158, 143, 0);
      // the stair passage down: chain-link pens
      K.prop('trash', 131.5, 124, 0.5); K.prop('barrel', 136, 116, 0);
      // the sunken basketball court
      K.court(108, 73, 157, 99);
      K.fence(106, 70, 158, 70, 4); K.fence(158, 70, 158, 101, 4); K.fence(106, 101, 129.5, 101, 4); K.fence(138, 101, 158, 101, 4);
      for (const [i, j] of [[110, 73], [154, 73], [110, 98], [154, 98]]) K.fire(i, j);
      K.graffiti(105.3, 80, PI / 2, 2.4); K.graffiti(105.3, 92, PI / 2, 2.4); K.graffiti(130, 68.4, 0, 2.6); K.graffiti(146, 68.4, 0, 2.6);
      K.prop('trash', 112, 108, 0.4); K.prop('mattress', 120, 112, 1.2);
      // the car park
      K.boxTruck(68, 104, 0); K.boxTruck(85, 113, 0.08); K.ambulance(66, 130, PI); K.car(83, 141, 1.55); K.van(71, 151, 1.6); K.car(86, 99, 0.2);
      K.lamp(76, 122, { h: 5.4, r: 12, col: 0xffb46a }); K.lamp(76, 146, { h: 5.4, r: 12, col: 0xffb46a });
      // the mall's back corridor: shuttered shop units, mall logos, bins
      K.shutter(44.6, 125.5, PI / 2, 4); K.shutter(50.6, 141.5, PI / 2, 4); K.shutter(44.6, 156.5, PI / 2, 4);
      K.shutter(32, 120.6, PI, 4); K.shutter(32, 146.4, 0, 4);
      K.sign('C', 40, 108.5, 0, { w: 1.1, h: 1.1, y: 3.4, bg: '#b8201a', fg: '#f4efe2', font: 'bold 180px Arial' }); K.sign('CARCER MALL', 56, 109, 0, { w: 4, h: 0.8, y: 3.6, bg: '#b8201a', fg: '#f4efe2', lit: true });
      K.prop('dumpster', 56, 160, 0); K.bins(12.5, 148, PI / 2, 2); K.prop('trash', 18, 168, 0.3); K.prop('trash', 52, 118, 1.9);
      // the way out
      K.sign('REAR MALL\nDISPOSAL CHUTE', 11.4, 133, PI / 2, { w: 3, h: 1.1, y: 3.0, bg: '#d6d2c4', fg: '#202020', font: 'bold 60px Arial', border: '#202020' });
      K.fire(13, 129.5); K.fire(13, 136.5);
    },
  },
  // ---------------------------------------------------------- 2. DOORWAY INTO HELL
  // Out of the mall's chute into the back alleys; a Hood steps out of a derelict
  // house to piss; through the house; out into the barricaded street of rubble,
  // rusted cars and the FOR LEASE billboard, an abandoned house in the middle;
  // the crowbar in the next house; the yellow yard ("Hide yo shit"); the cellar.
  'doorway': {
    look: { bldTex: 'stucco', bldCol: 0x9a8a76, lineCol: { wallpaper: 0xa89478 } }, inner: 'wallpaper', linings: [{ x0: 196, y0: 67, x1: 215, y1: 82, mat: 'concreteWall' }, { x0: 155, y0: 51, x1: 179, y1: 70, mat: 'plaster' }],
    start: [26, 118, -PI / 2], exit: [243, 61],
    patrols: [[[40, 88], [40, 90]], [[34, 102], [52, 101]], [[90, 30], [90, 82]], [[86, 118], [96, 146]], [[70, 68], [70, 63]], [[168, 58], [198, 46]], [[206, 74], [212, 70]]],
    dress(K) {
      // the mall wall and the chute they came out of
      K.sign('CARCER MALL', 21.2, 105, PI / 2, { w: 4, h: 0.8, y: 4.2, bg: '#b8201a', fg: '#f4efe2' }); K.doorway(21.3, 118, PI / 2, 1.4, 1.6);
      K.prop('dumpster', 29, 128, PI / 2); K.prop('trash', 28, 110, 0.5); K.bins(28.8, 96, PI / 2, 2);
      // back alleys: air-con units, weeds, a pissing Hood's corner
      for (const [i, j, r] of [[56.6, 90, -PI / 2], [56.6, 112, -PI / 2], [29.4, 132, PI / 2], [74.4, 52, -PI / 2]]) K.ac(i, j, r);
      K.graffiti(57, 100, -PI / 2, 2); K.graffiti(29.3, 86, PI / 2, 2);
      // the barricaded street: rubble, rusted cars, sawhorse barricades, the billboard
      for (const [i, j] of [[80, 14], [100, 38], [78, 92], [102, 110], [84, 138], [97, 72]]) K.rubble(i, j, 2.2, 1.2);
      K.car(98, 22, 0.3); K.car(79, 60, 2.9); K.car(100, 98, 1.4); K.car(81, 126, 0.1); K.van(98, 132, 3.0);
      K.fence(75, 6, 105, 6, 2.2); K.fence(75, 149, 105, 149, 2.2);
      K.sign('FOR LEASE\ncall today\n555-7625  555-5440', 106.5, 24, -PI / 2, { w: 7, h: 3.2, y: 8, bg: '#ece8dc', fg: '#c01c14', font: 'bold 72px Arial' });
      K.lamp(77, 22, { h: 5.4, r: 13, col: 0xc8d4e0 }); K.lamp(103, 62, { h: 5.4, r: 13, col: 0xc8d4e0 }); K.lamp(77, 104, { h: 5.4, r: 13, col: 0xc8d4e0 }); K.lamp(103, 142, { h: 5.4, r: 13, col: 0xc8d4e0 });
      K.tree(70, 145, 3.5); K.tree(108, 8, 3); K.tree(205, 90, 3.5); K.tree(240, 22, 3);
      // houses: bare bulbs, a mattress and the crowbar message upstairs
      K.bulb(42, 100); K.bulb(68, 66); K.bulb(112, 56); K.bulb(170, 64);
      K.prop('mattress', 66, 70, 0.3); K.sign('GET THE\nCROWBAR', 61.4, 66, PI / 2, { w: 1.8, h: 1, y: 1.8, bg: null, fg: '#7a120c', font: 'bold 70px Arial' });
      // the yellow yard
      K.sign('Hide yo\nshit', 157.4, 36, PI / 2, { w: 2.6, h: 1.6, y: 1.9, bg: null, fg: '#b0140e', font: 'italic bold 92px Georgia' });
      K.ac(157.4, 46, PI / 2, 2.9); K.ac(157.4, 50, PI / 2, 2.9); K.prop('dumpster', 165, 30, 0); K.prop('dumpster', 172, 30, 0.1);
      // the cellar: blood everywhere
      for (let k = 0; k < 9; k++) K.blood(202 + Math.random() * 12, 68 + Math.random() * 14, 1.2 + Math.random() * 1.6);
      K.bulb(207, 75, { col: 0xff9a7a, flicker: 1 });
    },
  },
  // Road to Ruin ("der2") is the same Carcer Market blocks as Doorway Into Hell, walked the other way:
  // out of the cellar, through a warehouse and its tiled restroom, an alley, a long corridor,
  // across the street to the derelict library, through its cellar of hanging bodies, out a back gate.
  'road-to-ruin': {
    look: { bldTex: 'concreteWall', bldCol: 0x9a968c },
    start: [192, 74, PI / 2], exit: [90, 5], inner: 'plaster',
    linings: [{ x0: 155, y0: 57, x1: 179, y1: 70, mat: 'tiles' }],
    patrols: [[[157, 53], [167, 53]], [[167, 63], [157, 63]], [[150, 44], [150, 36]], [[72, 14], [72, 34]], [[90, 96], [90, 62]], [[104, 50], [114, 58], [104, 64]], [[124, 45], [124, 62]]],
    dress(K) {
      // the cellar Cash climbs out of, and the street outside it
      K.bulb(207, 75, { col: 0xff9a7a, flicker: 1 }); for (let k = 0; k < 5; k++) K.blood(202 + Math.random() * 12, 68 + Math.random() * 14, 1.4);
      K.prop('dumpster', 186, 79, 0); K.prop('trash', 184, 70, 1); K.lamp(188, 68, { h: 5.2, r: 12, col: 0xc8d4e0 });
      // warehouse: bare bulbs over crates; restroom: stalls, sinks, blood on the tiles
      K.bulb(160, 53); K.bulb(174, 53); K.prop('crate', 157, 52, 0.2); K.prop('crate', 172, 54, 0.6); K.prop('barrel', 177, 52, 0);
      K.bulb(162, 63, { col: 0xd8e8b0, flicker: 1 }); K.bulb(174, 63, { col: 0xd8e8b0 }); K.stalls(160, 57.3, 0, 4); K.sinks(160, 69.6, PI, 3);
      for (let k = 0; k < 4; k++) K.blood(157 + Math.random() * 20, 61 + Math.random() * 7, 1.2);
      // the alley and the yard: dumpsters full of junk, chalk on the brick
      K.prop('dumpster', 160, 32, 0.1); K.prop('trash', 152, 44, 2); K.graffiti(157.4, 40, PI / 2, 2);
      // the long corridor west of the street: plaster, one bulb at each end
      K.bulb(72, 16); K.bulb(72, 32);
      // the street: blue-white lamps, the box truck, a parked van with its lights on, the moon over the roofs
      K.lamp(80, 40, { h: 5.4, r: 13, col: 0xc8d4e0 }); K.lamp(100, 80, { h: 5.4, r: 13, col: 0xc8d4e0 }); K.lamp(80, 120, { h: 5.4, r: 13, col: 0xc8d4e0 });
      K.boxTruck(84, 70, PI / 2); K.van(98, 112, 0.1); K.car(82, 132, 3.0);
      for (const [i, j] of [[80, 14], [97, 92], [102, 140]]) K.rubble(i, j, 2, 1);
      // the derelict library in the middle of the street
      K.sign('CARCER CITY\nPUBLIC LIBRARY', 99.6, 32, -PI / 2, { w: 4.6, h: 1.4, y: 4.4, bg: '#3a3428', fg: '#c8b88a', font: 'bold 60px Georgia' });
      K.doorway(99.7, 42, -PI / 2, 1.6, 2.4); K.sign('KEEP OUT', 99.5, 45, -PI / 2, { w: 1.4, h: 0.5, y: 1.4, bg: '#c8b030', fg: '#141414' });
      // its cellar: corpses strung up in the dark, a couple of weak bulbs, blood and shelving
      for (const [i, j] of [[103, 49], [108, 52], [112, 48], [106, 57], [114, 56], [110, 65], [103, 65]]) K.hanged(i + 0.5, j + 0.5);
      K.bulb(105, 52, { col: 0xffd890, i: 0.6, flicker: 1 }); K.bulb(113, 60, { col: 0xffd890, i: 0.6 });
      K.prop('crate', 115, 50, 0.3); K.prop('barrel', 101, 60, 0); K.prop('mattress', 116, 64, 1.2);
      // out the back: the alley to the gate where the van waits
      K.lamp(84, 8, { h: 5.4, r: 12, col: 0xc8d4e0 }); K.tree(108, 8, 3);
      K.sign('FOR LEASE\ncall today\n555-7625  555-5440', 106.5, 24, -PI / 2, { w: 7, h: 3.2, y: 8, bg: '#ece8dc', fg: '#c01c14', font: 'bold 72px Arial' });
    },
  },
  // White Trash: the Cerberus van dumps Cash at the top of a long alley into the Dentons City junkyard.
  // A Skin guards the yard gate; mazes of crushed cars under camo tarps; a rope-tied gate, a trailer
  // with a Skin on the toilet, the crane, a Quonset hangar, fuel tanks; a guard house switch opens the last gate.
  'white-trash': {
    look: { wall: 'concreteWall', wallCol: 0xa8a49a, facadeTex: 'metal', bldTex: 'metal', bldCol: 0x9a8a80 },
    start: [12, 6], exit: [238, 62], blockH: [2.6, 4.4], blockMat: 'scrap',
    patrols: [[[76, 66], [76, 84]], [[100, 50], [140, 50]], [[116, 86], [119, 69], [150, 70]], [[96, 124], [96, 150]], [[112, 136], [130, 150]], [[180, 140], [210, 128]], [[218, 96], [220, 74]]],
    dress(K) {
      // the alley the van backs into: bins, a lamp, graffiti on the brick
      K.lamp(20, 8, { h: 5, r: 11, col: 0xffc070 }); K.lamp(60, 40, { h: 5, r: 11, col: 0xffc070 }); K.graffiti(46, 12, -PI / 4, 2.2); K.prop('dumpster', 30, 8, 0); K.prop('trash', 40, 22, 1);
      // the yard gate the first Skin walks
      K.lamp(78, 62, { h: 6, r: 14, col: 0xffb860 }); K.fire(84, 70); K.tyres(86, 64, 6); K.tyres(88, 66, 4);
      // first area: oil drums, tyres, wrecks, the crane over the scrap
      K.drums(100, 58, 4); K.drums(150, 60, 6); K.tyres(132, 66, 5); K.tyres(134, 68, 3); K.crane(152, 96, 0.6);
      K.prop('car', 110, 100, 0.4); K.prop('car', 176, 104, 2.2); K.fire(124, 84); K.fire(170, 64);
      K.lamp(110, 76, { h: 7, r: 16, col: 0xffc070 }); K.lamp(190, 96, { h: 7, r: 16, col: 0xffc070 });
      // through the rope gate: the trailer (Skin on the toilet), the Quonset hangar, fuel tanks
      K.trailer(92, 134, 0); K.quonset(122, 148, 0, 12, 3.6); K.tank(108, 124, 0); K.tank(140, 128, PI / 2); K.tank(138, 154, 0.2);
      K.drums(100, 154, 4); K.tyres(132, 124, 5); K.fire(116, 128); K.lamp(104, 140, { h: 6, r: 14, col: 0xffc070 });
      // the far yard: wrecks and tyres, the guard house with the gate switch, the electric gate out
      K.guardhouse(214, 128, 0); K.lamp(220, 124, { h: 6, r: 14, col: 0xffd090 }); K.tyres(200, 168, 6); K.tyres(203, 168, 4); K.drums(170, 168, 4);
      K.prop('car', 214, 110, 1.2); K.prop('van', 160, 140, 0.4); K.fire(190, 150); K.lamp(232, 70, { h: 6, r: 14, col: 0xffd090 });
      for (let k = 0; k < 6; k++) K.blood(80 + Math.random() * 140, 60 + Math.random() * 100, 1.2);
    },
  },
  // Fuelled By Hate: the far end of the junkyard. Containers first (three Skinz), then the yard with the
  // raised guard hut (a lazy Skin watching TV: knock out the fuse box), the crane with no fuel blocking the
  // way to the crusher, the gasoline in the hangar, the crusher yard, a second crane, the exit doors.
  'fuelled': {
    look: { wall: 'metal', facadeTex: 'concreteWall', facadeCol: 0x9a968c, bldTex: 'planks' },
    start: [130, 6], exit: [8, 182], blockH: [2.6, 4.2], blockMat: 'scrap',
    patrols: [[[114, 22], [114, 70]], [[130, 16], [130, 60], [146, 40]], [[148, 72], [148, 22]], [[100, 131], [100, 131]],
      [[90, 126], [62, 140]], [[125, 142], [125, 160]], [[102, 175], [126, 175]],
      [[150, 160], [172, 170]], [[118, 140], [104, 128]], [[56, 127], [62, 131]], [[42, 108], [42, 108]],
      [[66, 80], [66, 92]], [[40, 74], [70, 74]], [[51, 109], [86, 110]], [[20, 170], [20, 170]]],
    dress(K) {
      // the containers: open boxes in rows down the lanes, shadows inside
      const cols = [0x7a4a2a, 0x3a4a5a, 0x5a5a3a, 0x7a2a20, 0x4a4a48];
      [[114, 30, 0], [114, 50, PI], [130, 30, PI], [130, 70, 0], [147, 52, 0], [147, 14, PI], [114, 82, 0]].forEach(([i, j, r], k) => K.container(i, j, r + PI / 2, cols[k % cols.length]));
      K.lamp(122, 8, { h: 6, r: 14, col: 0xffc070 }); K.lamp(140, 60, { h: 6, r: 14, col: 0xffc070 }); K.fire(118, 88); K.drums(150, 86, 4);
      // the yard: raised guard hut with the TV on, fuse box, the first crane parked across the crusher road
      K.hutRaised(100, 128, 0); K.fusebox(88, 121, 0); K.lamp(106, 136, { h: 6, r: 14, col: 0xffd090 }); K.fire(70, 136); K.tyres(116, 122, 5); K.timber(80, 146, 0);
      K.crane(50, 124, PI / 2); K.mound(30, 125, 3, 2.6); K.drums(58, 142, 4);
      // the south corridor and the hangar with the gasoline
      K.quonset(168, 168, 0, 12, 3.6); K.lamp(150, 158, { h: 6, r: 14, col: 0xffc070 }); K.tyres(140, 176, 6); K.tyres(144, 176, 4); K.timber(96, 176, 0); K.fire(112, 170); K.prop('van', 84, 170, 0.1);
      // the crusher yard: scrap mounds, crate stacks, the crusher on its belt
      K.crusher(58, 86, 0); for (const [i, j, r] of [[28, 72, 4], [80, 66, 4.5], [32, 98, 4], [84, 104, 3.5], [48, 66, 3]]) K.mound(i, j, r, 3.2);
      for (const [i, j] of [[70, 100], [74, 104], [24, 84], [86, 82]]) { K.prop('crate', i, j, 0.2); K.prop('crate', i + 1.2, j, 0.6); }
      K.lamp(40, 80, { h: 7, r: 16, col: 0xffc070 }); K.lamp(76, 92, { h: 7, r: 16, col: 0xffc070 }); K.fire(46, 100);
      // the second crane by the way down to the exit; the exit lane
      K.crane(52, 136, -PI / 2); K.fire(14, 176); K.fire(30, 176); K.lamp(22, 160, { h: 6, r: 14, col: 0xffd090 }); K.graffiti(4, 160, PI / 2, 2.2);
      for (let k = 0; k < 6; k++) K.blood(40 + Math.random() * 100, 70 + Math.random() * 100, 1.2);
    },
  },
  // Grounds for Assault: Carcer City Zoo. Dropped at the entrance unarmed; a Wardog's machete cuts the
  // rope-tied door; the rocky pens; the padlocked gate (crowbar from the cave); the sniper on his platform;
  // the restaurant at the top, out the back to the exit.
  'grounds': {
    look: { wall: 'stone', facadeTex: 'concreteWall', facadeCol: 0x8a8a84, bldTex: 'stucco', bldCol: 0x7a9aa8 },
    start: [22, 198], exit: [89, 3], noJunk: true,
    patrols: [[[30, 170], [60, 170]], [[70, 150], [55, 185]], [[40, 100], [69, 89]], [[60, 60], [65, 33]], [[40, 62], [48, 64]], [[50, 13], [50, 13]], [[40, 12], [70, 12]], [[80, 18], [85, 8]]],
    dress(K) {
      // entrance: the zoo sign, statues, ticket kiosk, a tree in the forecourt
      K.sign('CARCER CITY ZOO', 22, 196.6, PI, { w: 5, h: 0.9, y: 3.8, bg: '#2a3a2a', fg: '#d8c890', font: 'bold 64px Georgia' });
      K.statue(40, 176, 0.4); K.statue(70, 168, -0.6); K.kiosk(64, 186, 0); K.tree(48, 160, 4); K.tree(16, 176, 3.5); K.vending(30, 190, PI / 2);
      K.lamp(30, 180, { h: 5, r: 12, col: 0xd8d8b0 }); K.lamp(64, 150, { h: 5, r: 12, col: 0xd8d8b0 });
      // the pens: rock outcrops, big old trees, a statue, the cave with the crowbar
      for (const [i, j, r] of [[60, 80, 2.6], [44, 70, 3], [70, 50, 3.4], [26, 62, 3], [62, 102, 2.6]]) K.rocks(i, j, r, 2.6);
      K.tree(36, 76, 5); K.tree(66, 66, 4.5); K.statue(50, 112, 1.2); K.cave(44, 56, PI);
      K.lamp(58, 50, { h: 5, r: 12, col: 0xd8d8b0 });
      // the restaurant at the top: kiosks, vending machines, the sniper's platform
      K.restaurant(60, 6.5, 0, 18, 4.4); K.kiosk(36, 16, 0); K.kiosk(70, 16, 0); K.vending(48, 20, PI); K.vending(50, 20, PI, 0x1c4ab0);
      K.platform(50, 9.6, 0); K.lamp(40, 20, { h: 5, r: 12, col: 0xffd8a0 }); K.lamp(80, 12, { h: 5, r: 12, col: 0xffd8a0 });
    },
  },
  // Strapped for Cash: the other half of the zoo, foggy, from the restaurant down to the aquarium. Cash's
  // family are held as bait round the zoo; the shark's mouth opens once they're all saved or dead.
  'strapped': {
    look: { wall: 'stone', facadeTex: 'concreteWall', facadeCol: 0x7a7e7a, bldTex: 'stucco', bldCol: 0x8aa08a },
    start: [85, 10], exit: [7, 197], noJunk: true,
    patrols: [[[46, 12], [50, 16]], [[40, 64], [38, 66]], [[52, 58], [50, 64]], [[17, 106], [17, 118]], [[75, 143], [72, 138]], [[26, 156], [24, 162]], [[60, 90], [29, 95]], [[30, 186], [30, 186]], [[50, 190], [50, 190]], [[40, 145], [80, 145]]],
    dress(K) {
      // the restaurant end where the last scene finished; the store room
      K.restaurant(60, 6.5, 0, 18, 4.4); K.kiosk(70, 16, 0); K.vending(50, 20, PI); K.lamp(80, 12, { h: 5, r: 12, col: 0xffd8a0 }); K.lamp(40, 18, { h: 5, r: 12, col: 0xffd8a0 });
      // the gorilla enclosure in the pens: rocks, old trees, a statue
      K.rocks(60, 72, 2.6, 2.4); K.rocks(56, 78, 2.2, 2); K.tree(62, 64, 5); K.tree(50, 82, 4.5); K.statue(70, 100, -0.8);
      K.lamp(50, 70, { h: 5, r: 12, col: 0xd8d8c0 }); K.lamp(30, 96, { h: 5, r: 12, col: 0xd8d8c0 });
      // the court: the cafeteria, the monkey dome
      K.cafe(85.6, 142, -PI / 2); K.dome(30, 166, 4); K.lamp(60, 140, { h: 5, r: 12, col: 0xd8d8c0 }); K.lamp(20, 152, { h: 5, r: 12, col: 0xd8d8c0 });
      // behind the shark's mouth: the emptied pool, the souvenir shop and its fire exit
      K.pool(30, 190, 8, 5); K.shop(58, 194, PI); K.lamp(44, 184, { h: 4, r: 10, col: 0xc8e0ff });
    },
  },
  // View of Innocence: the abandoned, unfinished mall, built split level. Ground floor (laundromat with a
  // gun, the bar and its TV, toilets, the basement with the power switch), escalators up to the second floor
  // (the toy store with the camera) and the third (the record store with the tape, the pharmacy).
  'innocence': {
    look: { wall: 'cinder', wallCol: 0xa89a88, facadeTex: 'concreteWall', bldTex: 'wallpaper', lineCol: { cinder: 0x9a9488, wallpaper: 0xc8a888 } }, inner: 'cinder', innerFloor: 'tfloor',
    linings: [{ x0: 1, y0: 1, x1: 21, y1: 21, mat: 'polka' }, { x0: 1, y0: 60, x1: 22, y1: 79, mat: 'tiles' }, { x0: 89, y0: 41, x1: 99, y1: 49, mat: 'tiles' }, { x0: 72, y0: 41, x1: 99, y1: 61, mat: 'wallpaper' }, { x0: 80, y0: 1, x1: 99, y1: 18, mat: 'wallpaper' }, { x0: 51, y0: 1, x1: 64, y1: 14, mat: 'tiles' }, { x0: 85, y0: 62, x1: 99, y1: 79, mat: 'concreteWall' }],
    start: [36, 76, PI], exit: [64, 79], noJunk: true,
    zones: [{ x0: 1, x1: 49, y0: 1, y1: 39, h: 4.2 }, { x0: 50, x1: 99, y0: 1, y1: 39, h: 8.4 }, { x0: 85, x1: 99, y0: 66, y1: 79, h: -3.2 }],
    ramps: [{ x0: 22, x1: 28, y0: 32, y1: 46, axis: 'y', h0: 4.2, h1: 0 }, { x0: 40, x1: 58, y0: 8, y1: 13, axis: 'x', h0: 4.2, h1: 8.4 }, { x0: 89, x1: 93, y0: 62, y1: 72, axis: 'y', h0: 0, h1: -3.2 }],
    patrols: [[[40, 66], [56, 66]], [[50, 45], [50, 56]], [[64, 64], [64, 68]], [[78, 56], [86, 54]], [[10, 30], [40, 34]], [[30, 6], [44, 18]], [[8, 8], [14, 14]],
      [[56, 25], [94, 25]], [[70, 32], [90, 34]], [[86, 6], [92, 12]], [[56, 5], [60, 10]], [[94, 44], [94, 44]]],
    dress(K) {
      // ground floor: the atrium with medallion tiles and planters, the laundromat, the bar
      for (const [i, j] of [[40, 50], [60, 50], [50, 44], [50, 56]]) K.medallion(i, j, 1.8);
      K.planter(36, 47, 4); K.planter(64, 47, 4); K.planter(36, 54, 4); K.planter(64, 54, 4);
      K.washers(8, 63, 0, 5); K.washers(8, 75, PI, 5); K.shopfront(13, 59.4, 0, 'LAUNDROMAT', '#a8d8f0');
      K.counter(80, 47, 0, 9); K.shopfront(70.6, 51, -PI / 2, 'BAR', '#f0c020', '#3a0c0c');
      K.lamp(50, 50, { h: 4, r: 12, col: 0xe8f0d8 }); K.bulb(30, 70, { col: 0xd8e0c8 }); K.bulb(80, 55, { col: 0xffc890 }); K.bulb(10, 69, { col: 0xd8e8f0, flicker: 1 }); K.bulb(91, 13, { col: 0xe0a0e0 }); K.bulb(9, 9, { col: 0xf0e0a0 }); K.bulb(94, 74, { col: 0xff9a7a, flicker: 1 });
      K.graffiti(29.5, 66, PI / 2, 2); K.graffiti(70.5, 70, -PI / 2, 2);
      // second floor: the toy store, shutters, a kiosk
      K.shopfront(21.4, 13, PI / 2, 'TOYS', '#f0e020', '#b01818'); K.kiosk(37, 26, 0); K.planter(12, 30, 4); K.bulb(30, 20, { col: 0xe8f0d8 });
      // third floor: the record store and the pharmacy
      K.shopfront(78.6, 10.5, -PI / 2, 'RECORDS', '#e050e0', '#1a0a2a'); K.shopfront(64.6, 7.5, PI / 2, 'PHARMACY', '#f0f0f0', '#a01818');
      K.counter(90, 14, 0, 6); K.bulb(70, 26, { col: 0xe8f0d8 }); K.planter(84, 30, 4);
    },
  },
};
