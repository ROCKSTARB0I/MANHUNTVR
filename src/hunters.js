// hunters.js — the men paid to kill Cash. They see by the light you stand in,
// hear what you do, investigate, search, hunt in packs, and talk while they do it.
import * as THREE from '../vendor/three.module.js';
import { Person, BONE, SKIN_TONES } from './body.js?v=31';
import { T } from './paint.js?v=31';

const V = THREE.Vector3;
// every scene has its own gang; g picks one of three voices, vp the gang's lines
// Outfits follow the real hunter models (three body types x three textures per gang):
// colours are linear vertex colours; maps come from paint.js T.cloth.
const WHITE = [0.7, 0.52, 0.42], PALE = [0.62, 0.44, 0.34], TAN = [0.55, 0.4, 0.3], BROWN = [0.48, 0.32, 0.23], DARK = [0.3, 0.2, 0.14];
const BLK = [0.035, 0.035, 0.038], JEANS = [0.62, 0.66, 0.8], BOOT = [0.05, 0.04, 0.035], LEATH = [0.07, 0.065, 0.06];
export const GANG_SETS = {
  hoods: { vp: 'h', members: [ // Carcer Market street thugs: stockings, executioner hoods and balaclavas
    { g: 'A', mask: 'stocking', weapon: 'blackjack', skin: WHITE, top: LEATH, topMap: 'leather', inner: [0.03, 0.06, 0.14], openW: 0.3, legs: JEANS, gear: [{ t: 'knot' }, { t: 'print', side: 'back', text: 'H', fg: '#b8b0a0', w: 0.2 }] },
    { g: 'B', mask: 'execRed', weapon: 'bat', skin: PALE, top: LEATH, topMap: 'leather', sleeves: 'none', inner: PALE, openW: 0.45, legs: [0.2, 0.13, 0.08], legsMap: 'fleece', gloves: null, gear: [{ t: 'print', side: 'back', text: 'H', fg: '#c8c0b0', w: 0.2 }, { t: 'print', bone: 'chest', side: 'front', text: 'IIII I', fg: '#d8d0c0', w: 0.08, x: 0.09, y: 0.06 }] },
    { g: 'C', mask: 'balaBlue', weapon: 'crowbar', skin: WHITE, top: BLK, legs: [0.18, 0.13, 0.08], legsMap: 'fleece' },
    { g: 'A', mask: 'stocking', weapon: 'bat', skin: WHITE, top: [0.36, 0.04, 0.03], inner: [0.07, 0.05, 0.16], openW: 0.3, legs: [0.36, 0.3, 0.18], legsMap: 'fleece', boots: [0.7, 0.7, 0.68], sole: [0.75, 0.75, 0.72], stubble: true, gear: [{ t: 'knot' }, { t: 'print', side: 'back', text: 'Furys', fg: '#d8b030', font: 'italic bold 100px Georgia, serif', w: 0.26 }] },
    { g: 'B', mask: 'gimp', weapon: 'crowbar', skin: PALE, top: LEATH, topMap: 'leather', sleeves: 'none', inner: [0.12, 0.14, 0.05], openW: 0.35, legs: JEANS, gloves: BLK, gear: [{ t: 'print', side: 'back', text: 'FUCKER', fg: '#d8d0c0', w: 0.26 }] },
    { g: 'C', mask: 'balaBlack', weapon: 'blackjack', skin: WHITE, top: [0.13, 0.08, 0.045], legs: JEANS, gloves: BLK, boots: BLK },
    { g: 'A', mask: 'stocking', weapon: 'crowbar', skin: DARK, top: [0.2, 0.32, 0.24], inner: [0.5, 0.4, 0.25], openW: 0.3, legs: [0.07, 0.11, 0.3], legsMap: 'fleece', boots: [0.08, 0.12, 0.06], gear: [{ t: 'knot' }] },
    { g: 'B', mask: 'execBlack', weapon: 'bat', skin: DARK, top: [0.3, 0.03, 0.02], inner: [0.75, 0.74, 0.7], openW: 0.4, legs: JEANS, gloves: BLK, gear: [{ t: 'print', side: 'back', text: 'FUCK YOU UP', fg: '#e0d8c8', w: 0.3 }, { t: 'print', side: 'front', text: 'PIG', fg: '#e0d8c8', w: 0.1, x: -0.1, y: 0.07 }] },
    { g: 'C', mask: 'balaRed', weapon: 'bat', skin: DARK, top: [0.05, 0.1, 0.3], legs: [0.1, 0.12, 0.06], legsMap: 'fleece', gloves: BLK, boots: [0.18, 0.1, 0.05], gear: [{ t: 'print', side: 'front', text: 'Furys', fg: '#d8d0c0', font: 'italic bold 100px Georgia, serif', w: 0.2, y: 0.02 }] },
  ] },
  skinz: { vp: 's', bulk: 1.05, members: [ // Dentons City skinheads: hockey masks, braces, boots
    { g: 'A', mask: 'gorilla', weapon: 'metalbat', skin: WHITE, bulk: 1.25, top: BLK, sleeves: 'none', legs: JEANS, gloves: BLK, gear: [{ t: 'print', side: 'front', text: 'HATE', fg: '#d8d0c0', w: 0.16, y: 0.05 }] },
    { g: 'B', mask: 'hockeyBloody', weapon: 'metalbat', skin: WHITE, bulk: 1.15, top: [0.25, 0.25, 0.25], sleeves: 'none', legs: [0.3, 0.3, 0.32], legsMap: 'fleece', gloves: BLK, gear: [{ t: 'armband', col: [0.04, 0.04, 0.04] }] },
    { g: 'C', mask: null, weapon: 'knife', skin: WHITE, bulk: 0.92, top: [0.75, 0.74, 0.7], sleeves: 'none', legs: [0.75, 0.8, 0.95], boots: [0.4, 0.04, 0.03], gear: [{ t: 'suspenders', col: [0.45, 0.04, 0.03] }] },
    { g: 'A', mask: 'puppet', weapon: 'nailgun', skin: WHITE, bulk: 1.25, top: BLK, sleeves: 'short', legs: [0.3, 0.3, 0.32], legsMap: 'fleece', boots: [0.4, 0.06, 0.05], gloves: BLK, gear: [{ t: 'suspenders', col: [0.45, 0.04, 0.03] }] },
    { g: 'B', mask: 'hockeyRed', weapon: 'knife', skin: WHITE, bulk: 1.15, top: [0.05, 0.05, 0.06], sleeves: 'short', legs: [0.9, 0.9, 0.9], legsMap: 'camoUrban', boots: [0.4, 0.04, 0.03], gloves: BLK, gear: [{ t: 'armband', col: [0.45, 0.04, 0.03] }] },
    { g: 'C', mask: null, weapon: 'nailgun', skin: WHITE, bulk: 0.92, top: [0.08, 0.14, 0.4], sleeves: 'short', legs: [0.75, 0.8, 0.95], boots: BOOT, gear: [{ t: 'suspenders', col: [0.06, 0.1, 0.35] }] },
    { g: 'A', mask: 'gorilla', weapon: 'metalbat', skin: WHITE, bulk: 1.25, shirtless: true, legs: [0.3, 0.3, 0.32], legsMap: 'fleece', boots: [0.4, 0.06, 0.05], gloves: BLK, gear: [{ t: 'bandolier' }, { t: 'print', side: 'front', text: 'HATE', fg: 'rgba(20,30,50,0.85)', w: 0.08, x: 0.17, y: 0.1 }] },
    { g: 'B', mask: 'hockeyCracked', weapon: 'metalbat', skin: WHITE, bulk: 1.15, top: BLK, sleeves: 'short', legs: JEANS, gloves: BLK, gear: [{ t: 'armband', col: [0.04, 0.04, 0.04] }, { t: 'print', side: 'front', text: 'FIRST TO GO', fg: '#d8d0c0', w: 0.22, y: 0.04 }] },
    { g: 'C', mask: null, weapon: 'knife', skin: WHITE, bulk: 0.95, top: [0.07, 0.1, 0.05], legs: [0.75, 0.8, 0.95], boots: BOOT, stubble: true, gear: [{ t: 'suspenders', col: [0.45, 0.04, 0.03] }] },
  ] },
  wardogs: { vp: 'w', bulk: 1.08, torch: 'all', sharp: true, members: [ // the zoo's ex-military: camo, vests, ghillie suits
    { g: 'A', mask: null, weapon: 'machete', skin: WHITE, top: [0.18, 0.2, 0.1], sleeves: 'none', legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', gear: [{ t: 'bandanaCap', map: 'camoForest' }, { t: 'vest', map: 'camoForest' }, { t: 'bandolier' }, { t: 'thighPouch', map: 'camoForest' }] },
    { g: 'B', mask: 'wrapCamo', weapon: 'machete', skin: WHITE, top: [0.9, 0.9, 0.9], topMap: 'camoForest', legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', gloves: [0.12, 0.13, 0.06], gear: [{ t: 'ghillie' }, { t: 'pouches', col: [0.1, 0.1, 0.05] }] },
    { g: 'C', mask: 'bandanaLow', weapon: 'machete', skin: WHITE, top: [0.9, 0.9, 0.9], topMap: 'camoUrban', inner: [0.45, 0.36, 0.22], openW: 0.2, legs: [0.9, 0.9, 0.9], legsMap: 'camoDesert', boots: [0.35, 0.26, 0.15], gear: [{ t: 'cap', map: 'camoUrban' }, { t: 'vest', map: 'camoForest', pouches: false, h: 0.3 }, { t: 'pouches', map: 'camoForest' }] },
    { g: 'A', mask: null, weapon: 'machete', skin: WHITE, stubble: true, top: [0.22, 0.14, 0.08], sleeves: 'short', legs: [0.9, 0.9, 0.9], legsMap: 'camoUrban', gloves: BLK, gear: [{ t: 'bandanaCap', map: 'camoUrban' }, { t: 'vest', map: 'camoUrban' }, { t: 'bandolier' }, { t: 'thighPouch', map: 'camoUrban' }] },
    { g: 'B', mask: 'wrapCamo', weapon: 'machete', skin: WHITE, top: [0.9, 0.9, 0.9], topMap: 'camoUrban', legs: [0.9, 0.9, 0.9], legsMap: 'camoUrban', boots: [0.2, 0.2, 0.1], gear: [{ t: 'ghillie', cols: [[0.3, 0.3, 0.28], [0.18, 0.18, 0.17], [0.45, 0.44, 0.4], [0.1, 0.1, 0.1]] }, { t: 'pouches', col: [0.15, 0.15, 0.14] }] },
    { g: 'C', mask: 'bandanaCamo', weapon: 'machete', skin: WHITE, top: [0.3, 0.3, 0.3], inner: [0.1, 0.18, 0.06], openW: 0.2, legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', gear: [{ t: 'cap', col: [0.04, 0.08, 0.3], print: 'TROJAN' }, { t: 'vest', map: 'plaidRed', pouches: false, h: 0.3 }, { t: 'pouches', col: [0.1, 0.1, 0.06] }] },
    { g: 'A', mask: null, weapon: 'machete', skin: DARK, top: [0.05, 0.1, 0.3], sleeves: 'short', legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', gloves: BLK, gear: [{ t: 'bandanaCap', col: [0.4, 0.04, 0.03] }, { t: 'vest', map: 'camoForest' }, { t: 'thighPouch', map: 'camoForest' }] },
    { g: 'C', mask: 'bandanaCamo', weapon: 'machete', skin: DARK, top: [0.9, 0.9, 0.9], topMap: 'camoForest', legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', boots: [0.12, 0.13, 0.06], gear: [{ t: 'cap', map: 'camoForest' }, { t: 'vest', col: [0.03, 0.03, 0.03] }, { t: 'print', side: 'front', text: 'KILLER', fg: '#d8d0c0', bg: '#202018', w: 0.08, x: 0.09, y: 0.08 }, { t: 'pouches', col: [0.1, 0.1, 0.06] }] },
  ] },
  innocentz: { vp: 'i', bulk: 1, members: [ // Babyfaces in doll masks, Skullys in shrouds and face paint
    { g: 'A', mask: 'doll', weapon: 'machete', skin: WHITE, bulk: 1.28, top: [0.9, 0.9, 0.9], topMap: 'hawaiianBlue', inner: WHITE, openW: 0.5, legs: JEANS, boots: [0.7, 0.7, 0.68], sole: [0.75, 0.75, 0.72] },
    { g: 'B', mask: 'skullCrimson', weapon: 'sickle', skin: BROWN, top: [0.32, 0.03, 0.03], hood: 'up', legs: JEANS, gloves: [0.35, 0.03, 0.03], gear: [{ t: 'cloak', col: [0.32, 0.03, 0.03] }, { t: 'cone', col: [0.32, 0.03, 0.03] }] },
    { g: 'C', mask: 'skullPaint', weapon: 'knife', skin: BROWN, shirtless: true, legs: [0.04, 0.07, 0.3], legsMap: 'fleece', gloves: BLK, boots: [0.6, 0.2, 0.03], sole: [0.8, 0.8, 0.8], gear: [{ t: 'print', side: 'front', text: 'INNOCENTZ', fg: 'rgba(20,24,30,0.8)', w: 0.24, y: 0.07 }] },
    { g: 'A', mask: 'babyface', weapon: 'machete', skin: WHITE, bulk: 1.28, stubble: true, top: [0.9, 0.9, 0.9], topMap: 'plaidRed', inner: [0.7, 0.68, 0.62], openW: 0.45, legs: [0.22, 0.14, 0.08], legsMap: 'fleece', boots: [0.7, 0.7, 0.68], sole: [0.75, 0.75, 0.72] },
    { g: 'B', mask: 'pazuzu', weapon: 'sickle', skin: BROWN, top: [0.04, 0.035, 0.035], hood: 'up', legs: [0.3, 0.32, 0.45], gloves: [0.6, 0.58, 0.55], gear: [{ t: 'cloak', col: [0.04, 0.035, 0.035] }, { t: 'cone', col: [0.04, 0.035, 0.035] }, { t: 'print', side: 'back', text: 'MALOS', fg: '#a8a090', w: 0.22, y: 0.0 }] },
    { g: 'C', mask: 'skullPaint', weapon: 'knife', skin: BROWN, top: [0.78, 0.76, 0.72], sleeves: 'none', legs: [0.25, 0.03, 0.05], legsMap: 'fleece', boots: BLK, sole: [0.8, 0.8, 0.8] },
    { g: 'A', mask: 'doll', weapon: 'machete', skin: BROWN, bulk: 1.28, top: [0.9, 0.9, 0.9], topMap: 'hawaiianBlack', inner: BROWN, openW: 0.5, legs: [0.55, 0.6, 0.75], legsMap: 'fleece' },
    { g: 'B', mask: 'flayed', weapon: 'sickle', skin: BROWN, top: [0.35, 0.22, 0.06], hood: 'up', legs: [0.12, 0.14, 0.06], legsMap: 'fleece', gloves: [0.3, 0.3, 0.3], gear: [{ t: 'cloak', col: [0.35, 0.22, 0.06] }, { t: 'cone', col: [0.35, 0.22, 0.06] }] },
    { g: 'C', mask: 'skullPaint', weapon: 'machete', skin: BROWN, shirtless: true, legs: [0.06, 0.08, 0.2], boots: [0.75, 0.75, 0.72], gear: [{ t: 'print', side: 'front', text: 'MUERTE', fg: 'rgba(20,24,30,0.8)', w: 0.2, y: 0.07 }, { t: 'print', bone: 'spine', side: 'front', text: '187', fg: 'rgba(20,24,30,0.8)', w: 0.12, y: 0.0 }] },
  ] },
  piggsy: { vp: 'p', boss: true, bulk: 1.5, members: [{ g: 'A', mask: 'pig', weapon: 'chainsaw', top: [0.42, 0.38, 0.32], legs: [0.18, 0.16, 0.14] }] },
  smileys: { vp: 'y', bulk: 1, members: [ // asylum inmates: smiley masks and paint, overalls, mohawks
    { g: 'A', mask: 'smileyPaint', weapon: 'pipe', skin: WHITE, bulk: 1.12, shirtless: true, legs: [0.05, 0.05, 0.06], legsMap: 'fleece', gloves: BLK, gear: [{ t: 'mohawk' }, { t: 'bracer' }, { t: 'print', side: 'front', text: 'KILL KILL', fg: 'rgba(20,24,30,0.8)', w: 0.24, y: 0.04 }] },
    { g: 'B', mask: 'smiley', weapon: 'crowbar', skin: WHITE, bulk: 1.1, top: [0.06, 0.12, 0.32], legs: BLK, legsMap: 'fleece', gloves: [0.25, 0.14, 0.06], gear: [{ t: 'bib', col: BLK }] },
    { g: 'C', mask: 'smileyCracked', weapon: 'machete', skin: WHITE, top: BLK, sleeves: 'none', legs: [0.3, 0.3, 0.3], gloves: BLK, gear: [{ t: 'skirt', col: [0.3, 0.3, 0.3] }] },
    { g: 'A', mask: 'smileyPaint', weapon: 'pipe', skin: WHITE, bulk: 1.12, shirtless: true, legs: JEANS, gloves: BLK, gear: [{ t: 'mohawk', col: [0.2, 0.04, 0.3] }, { t: 'bracer' }, { t: 'print', side: 'front', text: 'FILLED WITH HATE', fg: 'rgba(120,6,4,0.9)', w: 0.26, y: 0.04 }] },
    { g: 'B', mask: 'smileyFrown', weapon: 'crowbar', skin: WHITE, bulk: 1.1, shirtless: true, legs: [0.06, 0.12, 0.35], legsMap: 'fleece', gloves: [0.25, 0.14, 0.06], stains: 1.6, gear: [{ t: 'bib', col: [0.06, 0.12, 0.35] }] },
    { g: 'C', mask: 'smileyCracked', weapon: 'machete', skin: WHITE, top: BLK, sleeves: 'none', legs: [0.2, 0.2, 0.2], gear: [{ t: 'skirt', map: 'plaidBrown' }] },
    { g: 'A', mask: 'smileyPaint', weapon: 'pipe', skin: DARK, bulk: 1.12, shirtless: true, legs: [0.9, 0.9, 0.9], legsMap: 'camoForest', gloves: BLK, gear: [{ t: 'mohawk', col: [0.5, 0.04, 0.3] }, { t: 'bracer' }, { t: 'print', side: 'front', text: 'DRUG SLUT', fg: 'rgba(200,190,170,0.85)', w: 0.22, y: 0.04 }] },
    { g: 'B', mask: 'smileyPlease', weapon: 'crowbar', skin: WHITE, bulk: 1.1, top: [0.9, 0.9, 0.9], topMap: 'plaidOrange', legs: BLK, legsMap: 'fleece', gloves: [0.05, 0.1, 0.35], gear: [{ t: 'bib', col: BLK, print: 'DIE', printCol: '#c8b020' }] },
    { g: 'C', mask: 'smileyFrown', weapon: 'machete', skin: DARK, top: [0.7, 0.66, 0.6], sleeves: 'short', legs: JEANS, stains: 1.6 },
  ] },
  swat: { vp: 'c', bulk: 1.12, torch: 'all', sharp: true, guns: true, members: [ // Carcer City SWAT: helmets, balaclavas, vests
    { g: 'B', mask: 'swat', weapon: 'rifle', top: [0.03, 0.035, 0.05], legs: [0.03, 0.035, 0.05], legsMap: 'fleece', gloves: BLK, gear: [{ t: 'vest', col: [0.03, 0.03, 0.035] }, { t: 'print', side: 'back', text: 'SWAT', fg: '#e8e4d8', w: 0.24, y: 0.04 }, 'kneepad', { t: 'pouches', col: BLK }] },
    { g: 'A', mask: 'swat', weapon: 'shotgun', top: [0.03, 0.035, 0.05], legs: [0.03, 0.035, 0.05], legsMap: 'fleece', gloves: BLK, gear: [{ t: 'vest', col: [0.03, 0.03, 0.035] }, { t: 'print', side: 'back', text: 'POLICE', fg: '#e8e4d8', w: 0.24, y: 0.04 }, 'kneepad', { t: 'thighPouch', col: BLK }] },
    { g: 'C', mask: 'swat', weapon: 'rifle', top: [0.03, 0.035, 0.05], legs: [0.03, 0.035, 0.05], legsMap: 'fleece', gloves: BLK, gear: [{ t: 'vest', col: [0.03, 0.03, 0.035] }, { t: 'print', side: 'back', text: 'SWAT', fg: '#e8e4d8', w: 0.24, y: 0.04 }, 'kneepad', { t: 'pouches', col: BLK }] },
  ] },
  cerberus: { vp: 'c', bulk: 1.15, torch: 'all', sharp: true, guns: true, members: [ // the Director's private army: gas masks with red lenses, riot vests
    { g: 'B', mask: 'gasHood', weapon: 'shotgun', top: [0.035, 0.035, 0.04], inner: [0.04, 0.06, 0.16], openW: 0.12, legs: [0.035, 0.035, 0.04], legsMap: 'fleece', gloves: BLK, gear: ['gasmask', 'riot', { t: 'backpack', col: [0.03, 0.03, 0.03] }, { t: 'armband', col: [0.4, 0.03, 0.03] }, 'kneepad', { t: 'pouches', col: BLK }] },
    { g: 'A', mask: 'gasHood', weapon: 'shotgun', top: [0.035, 0.035, 0.04], legs: [0.9, 0.9, 0.9], legsMap: 'camoBlack', gloves: BLK, gear: ['gasmask', 'riot', { t: 'backpack', col: [0.03, 0.03, 0.03] }, { t: 'armband', col: [0.25, 0.2, 0.02] }, 'kneepad', { t: 'pouches', col: BLK }] },
    { g: 'C', mask: 'gasHood', weapon: 'rifle', top: [0.035, 0.035, 0.04], legs: [0.035, 0.035, 0.04], legsMap: 'fleece', gloves: BLK, gear: ['gasmask', 'riot', { t: 'backpack', col: [0.03, 0.03, 0.03] }, { t: 'armband', col: [0.25, 0.2, 0.02] }, 'kneepad', { t: 'bandolier', col: [0.04, 0.04, 0.04] }] },
  ] },
};
const NAMES = ['Ricky', 'Dwayne', 'Lonnie', 'Cutter', 'Moss', 'Tully', 'Boone', 'Vic'];
const _a = new V(), _b = new V(), _c = new V();

export class Hunter {
  constructor(game, idx, route) {
    this.game = game; this.idx = idx; this.name = NAMES[idx % NAMES.length];
    const set = this.set = GANG_SETS[game.world.def.gang] || GANG_SETS.hoods;
    const G = this.gang = set.members[idx % set.members.length];
    this.body = new Person(Object.assign({ hood: false, dirt: 1, stains: idx % 2 ? 0.8 : 0.3 }, G, { seed: idx + 1, skin: G.skin || SKIN_TONES[(idx * 3 + 1) % SKIN_TONES.length], bulk: (set.bulk || 1) * (G.bulk || 1) * (0.97 + (idx % 3) * 0.04) }));
    game.scene.add(this.body.root);
    this.route = route; this.wp = 0;
    this.boss = !!set.boss; if (this.boss) { this.hp = 300; this.saw = game.sound.sawLoop?.(); }
    this.pos = new V(route[0][0], 0, route[0][1]); this.yaw = 0; this.speed = 0;
    this.state = 'patrol'; this.susp = 0; this.hp = this.boss ? 300 : 100; this.alive = true;
    this.path = []; this.pathT = 0; this.goal = new V(); this.last = new V();
    this.timer = 0; this.lostT = 0; this.lookT = 0; this.talkT = 8 + Math.random() * 20; this.atkT = 0;
    this.seen = 0; this.heardAt = -9; this.foundBodies = new Set();
    this.stepPh = 0;
    // flashlight on every other hunter
    if (!set.boss && (set.torch === 'all' || idx % 2 === 0)) {
      const torch = new THREE.SpotLight(0xfff2d8, 14, 16, 0.38, 0.5, 1.6);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true), new THREE.MeshBasicMaterial({ map: T.beam, color: 0xfff2d0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.geometry.translate(0, -3.5, 0); beam.geometry.rotateX(-Math.PI / 2); // cone along +Z from apex
      // apex at origin pointing +Z in hand space; attach to left hand
      const holder = new THREE.Group(); holder.position.set(0, -0.08, 0.02);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6 }));
      tube.rotation.x = Math.PI / 2; holder.add(tube); holder.add(beam);
      this.body.bones[BONE.handL].add(holder);
      torch.position.set(0, 0, 0); holder.add(torch); torch.target.position.set(0, 0, 4); holder.add(torch.target);
      holder.rotation.x = 1.25; // undo the raised forearm so the beam points ahead and a little down
      this.torch = torch; this.beam = beam; this.body.anim.hold = 0;
    }
    this.place();
  }

  place() { this.body.root.position.copy(this.pos); this.body.root.position.y = this.game.world.heightAt(this.pos.x, this.pos.z); this.body.root.rotation.y = this.yaw; }
  forward(out = new V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  eye(out = new V()) { return out.copy(this.pos).setY((this.body.anim.crouch ? 1.2 : 1.62) + this.game.world.heightAt(this.pos.x, this.pos.z)); }
  aware() { return this.state === 'hunt' || this.state === 'attack'; }
  say(kind) {
    if (!this.alive) return;
    if (this.boss) { const id = kind === 'spot' || kind === 'chase' ? 'piggsy_2' : kind === 'hurt' || kind === 'die' ? 'piggsy_3' : kind.startsWith('idle') ? 'piggsy_1' : null; if (id) this.game.sound.say(id, { at: this.eye(_c).clone(), force: true }); return; }
    this.game.sound.say(`${this.set.vp}${this.gang.g}_${kind}`, { at: this.eye(_c).clone() });
  }

  // ------------------------------------------------------------ senses
  // how strongly does this hunter see Cash right now (0..~1.5)?
  look(dt) {
    const P = this.game.player; if (!P.alive) return 0;
    if (P.hidden && !(this.set.sharp && this.torch && this.pos.distanceTo(P.pos) < 4.5)) return 0;
    const eye = this.eye(_a), tgt = _b.copy(P.chest);
    const d = eye.distanceTo(tgt); if (d > 26) return 0;
    const f = this.forward(_c), dir = tgt.clone().sub(eye).setY(0).normalize();
    const cos = f.dot(dir), fov = this.aware() ? Math.cos(1.25) : this.state === 'patrol' ? Math.cos(0.95) : Math.cos(1.1);
    if (cos < fov && d > 1.0) return 0;
    if (!this.game.world.clear(eye, tgt) && !this.game.world.clear(eye, P.head)) return 0;
    let vis = P.light * (P.crouch ? 0.55 : 1) + P.moveVis;
    if (d < 3.5) vis += 0.6 * (1 - d / 3.5);
    if (cos < Math.cos(0.5)) vis *= 0.6; // peripheral
    return Math.max(0, vis) * Math.max(0, 1.25 - d / 22);
  }

  hear(n) {
    if (this.dormant) return;
    if (!this.alive || this.state === 'bagged' || this.state === 'executed') return;
    const d = this.pos.distanceTo(n.p); let r = n.r;
    if (!this.game.world.clear(this.eye(_a), _b.copy(n.p).setY(1.0))) r *= 0.55;
    if (d > r) return;
    const k = 1 - d / r;
    if (this.state === 'hunt') { if (n.kind === 'player') this.last.copy(n.p); return; }
    this.susp = Math.min(0.95, this.susp + (n.kind === 'player' ? 0.35 + k * 0.5 : 0.6));
    if (this.susp > 0.25) {
      this.investigate(n.p);
      if (this.game.time - this.heardAt > 6) { this.say('hear'); this.heardAt = this.game.time; }
      if (n.kind === 'distract') this.game.director.event('distract', this);
    }
  }

  investigate(p) { this.state = 'investigate'; this.goal.copy(p); this.goPath(p); this.timer = 6 + Math.random() * 3; }
  goPath(p) { this.path = this.game.world.path(this.pos, p); this.pathT = 0; }

  // ------------------------------------------------------------ think
  update(dt, t) {
    const A = this.body.anim;
    if (this.dormant) { this.body.root.visible = false; return; } // waiting out of sight (a scene objective wakes him)
    if (!this.alive) { this.body.animate(dt, t); return; }
    if (this.state === 'bagged') { A.speed = 0; A.struggle = Math.min(1, A.struggle + dt * 4); this.body.animate(dt, t); return; }
    if (this.state === 'fallen') { this.fallen -= dt; if (this.saw) this.saw(this.eye(_a), 0); if (this.fallen <= 0) { const p = [[14, -8], [-12, 8], [12, 8]][Math.floor(Math.random() * 3)]; this.pos.set(p[0], 0, p[1]); this.body.root.position.y = 0; this.state = 'hunt'; this.susp = 1; this.last.copy(this.game.player.pos); this.lostT = 0; this.say('spot'); } this.place(); this.body.root.position.y = this.fallen > 0 ? -2.4 : 0; return; }
    if (this.state === 'executed') { A.speed = 0; this.speed = 0; this.place(); this.body.animate(dt, t); return; }
    A.struggle = Math.max(0, A.struggle - dt * 3);
    if (this.stun > 0) { this.stun -= dt; A.speed = 0; this.body.animate(dt, t); this.place(); return; }
    const P = this.game.player;
    const v = this.look(dt);
    this.seen = v;
    if (v > 0.06) {
      const gain = v * dt * (this.state === 'patrol' ? 1.6 : 2.4);
      this.susp = Math.min(1.5, this.susp + gain);
      if (this.susp > 0.35 && this.state === 'patrol') { this.investigate(P.pos); this.say('suspect'); }
      if (this.state === 'investigate' || this.state === 'search') this.goal.copy(P.pos);
      if (this.susp >= 1 && !this.aware()) this.spot();
      if (this.aware()) { this.last.copy(P.pos); this.lostT = 0; }
    } else if (!this.aware()) this.susp = Math.max(0, this.susp - dt * 0.08);

    // dead friends
    for (const h of this.game.hunters) {
      if (h.alive || this.foundBodies.has(h) || this.aware()) continue;
      const d = this.pos.distanceTo(h.pos); if (d > 13) continue;
      const fc = this.forward(_c).dot(_b.copy(h.pos).sub(this.pos).normalize());
      if (fc < 0.4 || !this.game.world.clear(this.eye(_a), _b.copy(h.pos).setY(0.4))) continue;
      this.foundBodies.add(h); this.say('body'); this.susp = Math.max(this.susp, 0.9); this.investigate(h.pos);
      this.searchUntil = t + 25;
    }

    let speed = 0, lookAround = 0;
    switch (this.state) {
      case 'patrol': {
        const w = this.route[this.wp]; this.goal.set(w[0], 0, w[1]);
        if (this.pos.distanceTo(this.goal) < 0.6) { this.wp = (this.wp + 1) % this.route.length; this.lookT = Math.random() < 0.35 ? 2.5 : 0; }
        if (this.lookT > 0) { this.lookT -= dt; lookAround = 1; }
        else { speed = 1.15; this.steerTo(this.goal, dt); }
        this.talkT -= dt; if (this.talkT < 0) { this.talkT = 18 + Math.random() * 25; if (this.pos.distanceTo(P.pos) < 22) this.say('idle_' + (1 + Math.floor(Math.random() * 3))); }
        break;
      }
      case 'investigate': {
        if (this.pos.distanceTo(this.goal) > 1.0) { speed = this.susp > 0.6 ? 1.9 : 1.4; this.followPath(dt); }
        else { lookAround = 1; this.timer -= dt; if (this.timer < 0) { this.state = 'search'; this.timer = 10 + Math.random() * 6; this.say('search'); this.pickSearch(); } }
        break;
      }
      case 'search': {
        this.timer -= dt;
        if (this.pos.distanceTo(this.goal) > 0.8) { speed = 1.5; this.followPath(dt); }
        else { lookAround = 1; this.lookT -= dt; if (this.lookT < 0) this.pickSearch(); }
        if (this.timer < 0 && !(this.searchUntil > t)) { this.state = 'patrol'; this.susp = 0.1; this.say('giveup'); this.goPath(this.nearestRoute()); }
        break;
      }
      case 'hunt': {
        this.lostT += v > 0.04 ? -this.lostT : dt;
        const d = this.pos.distanceTo(P.pos);
        if (this.lostT > 6) { this.state = 'search'; this.timer = 16; this.goal.copy(this.last); this.goPath(this.last); this.say('lost'); this.game.director.event('lost', this); break; }
        this.pathT -= dt;
        const tgt = this.lostT > 0.5 ? this.last : P.pos;
        if (this.pathT < 0) { this.goPath(tgt); this.pathT = 0.5; }
        if (d < 1.55 && this.lostT < 0.5) { this.state = 'attack'; this.atkT = 0; A.swing = 0; this.hitDone = false; break; }
        // Cerberus: stop and shoot when they can see you
        if ((this.set.guns || this.gun) && this.alive && v > 0.04 && d > 2.4 && d < (this.gun ? 34 : 22)) {
          speed = 0; this.face(P.pos, dt * 3); A.hold = 0; this.shootT = (this.shootT ?? 0.8) - dt;
          if (this.shootT <= 0) { this.shootT = 0.9 + Math.random() * 0.6; this.shoot(P, d); }
          break;
        }
        speed = d > 4 ? 3.3 : 2.4; this.followPath(dt);
        this.talkT -= dt; if (this.talkT < 0) { this.talkT = 6 + Math.random() * 6; this.say('chase'); }
        break;
      }
      case 'attack': {
        this.atkT += dt; A.swing = Math.min(1, this.atkT / 0.95);
        this.face(P.pos, dt * 2);
        if (!this.hitDone && A.swing > 0.55) {
          this.hitDone = true; this.game.sound.whoosh(this.eye(_a));
          const d = this.pos.distanceTo(P.pos), f = this.forward(_c).dot(_b.copy(P.pos).sub(this.pos).setY(0).normalize());
          if (d < 1.9 && f > 0.4 && P.alive) { P.hurt(this.boss ? 40 : 20 + Math.random() * 10, this); this.say('hit'); }
        }
        if (this.atkT > 1.25) { A.swing = -1; this.state = 'hunt'; this.pathT = 0; }
        break;
      }
    }
    // slow head-turn scan while standing
    if (lookAround) { A.look = Math.sin(t * 0.9 + this.idx) * 1.0; this.yaw += Math.sin(t * 0.5 + this.idx * 2) * dt * 0.5; }
    else A.look *= 0.9;
    A.lookV = this.aware() ? -0.05 : 0.12; A.alert = this.aware() ? 1 : this.state === 'patrol' ? 0 : 0.5;
    A.hold = this.torch ? 1 : 0;
    if (this.torch) this.torch.intensity = 14;
    // move
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    if (this.speed > 0.05) {
      const f = this.forward(_c);
      this.pos.addScaledVector(f, this.speed * dt);
      // keep apart from other hunters and from Cash's body
      for (const h of this.game.hunters) if (h !== this && h.alive) { const d = this.pos.distanceTo(h.pos); if (d < 0.7 && d > 1e-4) this.pos.addScaledVector(_b.copy(this.pos).sub(h.pos).normalize(), (0.7 - d) * 0.5); }
      const dp = this.pos.distanceTo(P.pos); if (dp < 0.55) this.pos.addScaledVector(_b.copy(this.pos).sub(P.pos).setY(0).normalize(), 0.55 - dp);
      this.game.world.collide(this.pos, 0.3);
      // footsteps
      this.stepPh += this.speed * dt / (this.speed > 2.5 ? 0.85 : 0.7);
      if (this.stepPh > 1) { this.stepPh = 0; this.game.sound.step(this.pos, this.speed > 2.5 ? 'run' : 'walk'); }
    }
    A.speed = this.speed;
    if (this.boss) this.bossTick(dt);
    this.place();
    this.body.animate(dt, t);
  }

  bossTick(dt) {
    const W = this.game.world;
    if (this.saw) this.saw(this.eye(_a), this.aware() ? 1 : 0.35);
    for (const w of W.weak || []) {
      if (w.broken || this.speed < 2.2 || Math.hypot(this.pos.x - w.x, this.pos.z - w.z) > w.r) continue;
      // CRACK: he goes straight through the floor
      w.broken = true; w.mesh.material = new THREE.MeshBasicMaterial({ color: 0x050302 });
      W.boxes.push({ x0: w.x - 1.1, x1: w.x + 1.1, z0: w.z - 1.1, z1: w.z + 1.1, y0: 0, y1: 0.5, see: true }); W.bakeWalk();
      this.game.sound.crunch(this.eye(_a)); this.game.sound.thud(this.eye(_a), 2); this.say('hurt'); this.game.director.line('dir_piggsy_hurt', 0);
      this.game.blood.spray(this.eye(_a).clone(), new V(0, 1, 0), 40, 1.2);
      this.hp -= 100; this.fallen = 7; this.body.root.position.y = -2.4; this.state = 'fallen'; this.speed = 0;
      if (this.hp <= 0) { this.body.root.position.y = 0; this.pos.set(w.x + 1.6, 0, w.z); this.place(); this.kill(new V(0, 0, 0), this.eye(_a).clone(), 'fall'); }
      return;
    }
  }

  shoot(P, d) {
    const G = this.game, mz = this.muzzle();
    G.sound.bang(mz); G.flash(mz); G.noise(this.pos, 25, 'shout', this);
    // harder to hit you far away, moving, or in the dark
    const chance = Math.max(0.12, 0.85 - d * 0.03 - (P.speed > 1.2 ? 0.2 : 0) - (P.light < 0.15 ? 0.2 : 0) - (P.crouch ? 0.1 : 0));
    if (Math.random() < chance) { P.hurt(10 + Math.random() * 8, this); G.blood.spray(P.chest.clone(), P.chest.clone().sub(mz).normalize(), 10, 0.6); }
  }
  muzzle(out = new V()) { const w = this.body.weapon; return w && w.userData.muzzle ? w.localToWorld(out.copy(w.userData.muzzle)) : this.eye(out); }

  spot() {
    this.state = 'hunt'; this.susp = 1; this.lostT = 0; this.last.copy(this.game.player.pos); this.pathT = 0;
    this.say('spot'); this.game.director.event('spotted', this);
    // shout brings friends within earshot
    this.game.noise(this.pos, 16, 'shout', this);
  }

  pickSearch() {
    const W = this.game.world;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
      const p = new V(this.last.x + Math.cos(a) * r, 0, this.last.z + Math.sin(a) * r);
      const [i, j] = W.cellOf(p.x, p.z); if (!W.walkable(i, j)) continue;
      this.goal.copy(p); this.goPath(p); this.lookT = 2 + Math.random() * 2; return;
    }
    this.lookT = 2;
  }
  nearestRoute() { let best = 0, bd = 1e9; this.route.forEach((w, i) => { const d = Math.hypot(w[0] - this.pos.x, w[1] - this.pos.z); if (d < bd) { bd = d; best = i; } }); this.wp = best; return new V(this.route[best][0], 0, this.route[best][1]); }

  steerTo(p, dt, rate = 4) {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    return Math.abs(d);
  }
  face(p, k) { this.steerTo(p, k, 1); }
  followPath(dt) {
    while (this.path.length && Math.hypot(this.path[0][0] - this.pos.x, this.path[0][1] - this.pos.z) < 0.5) this.path.shift();
    const w = this.path[0] || [this.goal.x, this.goal.z];
    this.steerTo(_b.set(w[0], 0, w[1]), dt, 5);
  }

  // ------------------------------------------------------------ violence
  // body hit spheres in world space
  parts() {
    const b = this.body; b.root.updateMatrixWorld(true);
    return [
      { name: 'head', bone: 'head', p: b.headPos(new V()), r: 0.13 },
      { name: 'neck', bone: 'neck', p: b.bonePos('neck', new V()).add(new V(0, 0.05, 0)), r: 0.08 },
      { name: 'chest', bone: 'chest', p: b.bonePos('chest', new V()).add(new V(0, 0.05, 0)), r: 0.19 },
      { name: 'gut', bone: 'spine', p: b.bonePos('spine', new V()), r: 0.17 },
    ];
  }
  // is Cash behind this man (for executions)?
  behind(p) { const f = this.forward(_c), d = _b.copy(p).sub(this.pos).setY(0).normalize(); return f.dot(d) < -0.15; }

  damage(n, part, dir, at, cause) {
    if (!this.alive) return false;
    if (this.boss) n *= 0.12; // only the floor can stop him
    this.hp -= n;
    this.body.wound(part === 'head' ? 'head' : part === 'neck' ? 'neck' : part === 'chest' ? 'chest' : 'spine', at, n > 50 ? 1.6 : 1);
    this.game.blood.spray(at, dir, n > 50 ? 70 : 30, part === 'neck' ? 1.4 : 1);
    if (this.hp <= 0) { this.kill(dir.clone().multiplyScalar(n > 60 ? 3.2 : 1.8), at, cause); return true; }
    this.say('hurt'); this.game.sound.grunt(this.eye(new V()), 1); this.body.anim.stagger = 1; this.stun = 0.45;
    if (!this.aware()) { this.susp = 1; this.state = 'hunt'; this.last.copy(this.game.player.pos); this.lostT = 0; this.game.noise(this.pos, 12, 'shout', this); }
    return false;
  }
  kill(impulse, at, cause) {
    if (!this.alive) return;
    this.alive = false; this.state = 'dead'; this.hp = 0;
    if (this.torch) { this.torch.intensity = 0; this.beam.visible = false; }
    if (this.saw) this.saw(this.eye(_a), 0, true);
    if (this.body.weapon) { const w = this.body.weapon; w.parent.remove(w); }
    if (this.set.guns) this.game.kit.spawn('rifle', new V(this.pos.x + 0.4, 0.04, this.pos.z + 0.2));
    if (this.dropOnDeath) this.game.kit.spawn(this.dropOnDeath, new V(this.pos.x + 0.3, 0.04, this.pos.z - 0.3));
    this.body.anim.struggle = 0; this.body.anim.swing = -1;
    this.body.die(impulse, at, this.game.world);
    this.game.sound.gurgle(this.eye(_a)); this.say('die');
    this.game.blood.pool(this.pos.clone(), 1.1 + Math.random() * 0.5);
    this.game.onKill(this, cause);
  }
}

export function spawnHunters(game) {
  return game.world.routes.map((r, i) => new Hunter(game, i, r));
}
