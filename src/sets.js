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
};
