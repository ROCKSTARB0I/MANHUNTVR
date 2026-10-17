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
};
