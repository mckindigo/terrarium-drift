/* Terrarium Drift - static game data. No dependencies. */
(function () {
  const TD = (globalThis.TD = globalThis.TD || {});

  TD.VERSION = 1;
  TD.OFFLINE_CAP = 8 * 3600; // seconds of offline progress that count
  TD.OFFLINE_EFF = [0.4, 0.55, 0.75, 1.0]; // by Night Lantern level
  TD.MAX_COLS = 12;

  TD.BIOMES = {
    temperate: { id: 'temperate', name: 'Temperate Glass', cost: 0, tint: [150, 60, 45], desc: 'Mossy, gentle, forgiving. Where every jar begins.' },
    desert: { id: 'desert', name: 'Desert Glass', cost: 1800, tint: [38, 70, 55], desc: 'Sand, gravel and thirsty spiny things. Unlocks dry-loving plants and soils.' },
    bog: { id: 'bog', name: 'Bog', cost: 8000, tint: [100, 35, 35], desc: 'Peat, reeds and carnivorous dew-traps. Wet, rich, and hungry.' },
    alpine: { id: 'alpine', name: 'Alpine', cost: 40000, tint: [210, 45, 60], desc: 'Scree, frost-flowers and star-bright rarities. High yields.' },
  };

  // retention (ret) = how well it holds water; fert = nutrient capacity
  TD.SOILS = {
    loam: { id: 'loam', name: 'Loam', biome: 'temperate', fert: 1.0, ret: 0.5, base: [26, 30, 28], note: 'Balanced all-rounder.' },
    clay: { id: 'clay', name: 'Clay', biome: 'temperate', fert: 0.75, ret: 0.75, base: [18, 42, 40], note: 'Holds water well.' },
    sand: { id: 'sand', name: 'Sand', biome: 'desert', fert: 0.3, ret: 0.12, base: [40, 55, 68], note: 'Drains fast. Poor nutrients.' },
    gravel: { id: 'gravel', name: 'Gravel', biome: 'desert', fert: 0.15, ret: 0.08, base: [210, 6, 52], note: 'Driest soil there is.' },
    peat: { id: 'peat', name: 'Peat', biome: 'bog', fert: 0.9, ret: 1.0, base: [20, 25, 16], note: 'Sodden and nutrient-rich.' },
    charcoal: { id: 'charcoal', name: 'Charcoal', biome: 'bog', fert: 0.35, ret: 0.45, base: [225, 8, 16], note: 'Absorbs rot; calms strain a little.' },
    scree: { id: 'scree', name: 'Scree', biome: 'alpine', fert: 0.45, ret: 0.25, base: [210, 12, 48], note: 'Sharp mountain rubble.' },
    humus: { id: 'humus', name: 'Humus', biome: 'alpine', fert: 1.45, ret: 0.6, base: [22, 28, 20], note: 'Very rich dark soil.' },
  };
  TD.SOIL_ORDER = ['loam', 'clay', 'sand', 'gravel', 'peat', 'charcoal', 'scree', 'humus'];
  TD.SOIL_COST = 10;

  // light: preferred light 0..1 (unshaded ~0.9); lw: tolerance width; wlo/whi: happy soil moisture band
  TD.PLANTS = [
    { id: 'moss', name: 'Glimmer Moss', biome: 'temperate', cost: 12, yield: 0.25, mature: 70, light: 0.5, lw: 0.8, wlo: 0.45, whi: 1.0, nutr: 0.1, thirst: 0.0006, height: 0.14, canopy: 0.04, palat: 0.3, flower: 0, shed: 0.0004,
      col: { stem: [135, 35, 28], leaf: [125, 52, 40], acc: [88, 70, 62] }, desc: 'A soft carpet that loves damp shade.' },
    { id: 'fern', name: 'Lacefern', biome: 'temperate', cost: 30, yield: 0.45, mature: 100, light: 0.5, lw: 0.7, wlo: 0.45, whi: 0.95, nutr: 0.25, thirst: 0.0009, height: 0.45, canopy: 0.35, palat: 0.8, flower: 0, shed: 0.0007,
      col: { stem: [140, 35, 26], leaf: [138, 55, 36], acc: [100, 60, 55] }, desc: 'Arching fronds. Casts gentle shade over its neighbours.' },
    { id: 'vine', name: 'Dewvine', biome: 'temperate', cost: 85, yield: 0.8, mature: 150, light: 0.6, lw: 0.7, wlo: 0.4, whi: 0.9, nutr: 0.3, thirst: 0.001, height: 0.7, canopy: 0.3, palat: 1.0, flower: 0.3, shed: 0.0008,
      col: { stem: [105, 40, 30], leaf: [118, 50, 45], acc: [190, 70, 80] }, desc: 'A climbing vine with heart-shaped leaves that bead with dew.' },
    { id: 'bell', name: 'Bellcap', biome: 'temperate', cost: 130, yield: 0.7, mature: 130, light: 0.3, lw: 0.6, wlo: 0.5, whi: 1.0, nutr: 0.05, thirst: 0.0007, height: 0.25, canopy: 0.25, palat: 0, flower: 0, shed: 0.0003,
      col: { stem: [40, 25, 80], leaf: [18, 55, 55], acc: [320, 40, 78] }, desc: 'A glowing mushroom. Eats leaf litter and releases spores.' },
    { id: 'sun', name: 'Sunpetal', biome: 'temperate', cost: 300, yield: 1.6, mature: 220, light: 0.9, lw: 0.55, wlo: 0.35, whi: 0.8, nutr: 0.45, thirst: 0.0014, height: 1.0, canopy: 0.5, palat: 1.0, flower: 1.0, shed: 0.001,
      col: { stem: [100, 45, 32], leaf: [110, 50, 38], acc: [44, 95, 60] }, desc: 'Tall and golden. Sunlight hungry; its blooms draw moths.' },
    { id: 'succ', name: 'Pebble Succulent', biome: 'desert', cost: 1400, yield: 2.6, mature: 260, light: 0.9, lw: 0.6, wlo: 0.05, whi: 0.45, nutr: 0.1, thirst: 0.0003, height: 0.25, canopy: 0.2, palat: 0.2, flower: 0, shed: 0.0003,
      col: { stem: [160, 25, 38], leaf: [165, 40, 50], acc: [340, 60, 70] }, desc: 'A stone-like rosette that sips almost nothing.' },
    { id: 'cactus', name: 'Spindle Cactus', biome: 'desert', cost: 3200, yield: 4, mature: 320, light: 0.95, lw: 0.55, wlo: 0.0, whi: 0.35, nutr: 0.1, thirst: 0.0002, height: 0.7, canopy: 0.25, palat: 0, flower: 0.3, shed: 0.0002,
      col: { stem: [150, 40, 30], leaf: [145, 42, 38], acc: [335, 75, 70] }, desc: 'A ribbed green column that thrives on neglect.' },
    { id: 'reed', name: 'Marsh Reed', biome: 'bog', cost: 8000, yield: 5.5, mature: 340, light: 0.7, lw: 0.6, wlo: 0.7, whi: 1.0, nutr: 0.5, thirst: 0.0016, height: 0.9, canopy: 0.3, palat: 0.6, flower: 0, shed: 0.0012,
      col: { stem: [85, 40, 34], leaf: [90, 45, 40], acc: [25, 55, 28] }, desc: 'Tall blades and velvet cattails. Loves soggy ground.' },
    { id: 'sundrop', name: 'Sundrop', biome: 'bog', cost: 14000, yield: 7.5, mature: 380, light: 0.75, lw: 0.6, wlo: 0.65, whi: 1.0, nutr: 0.12, thirst: 0.0012, height: 0.35, canopy: 0.2, palat: 0.1, flower: 0, shed: 0.0005,
      col: { stem: [100, 40, 36], leaf: [92, 50, 42], acc: [350, 80, 55] }, desc: 'Sticky red dew-traps. Eats small insects and enriches the soil.' },
    { id: 'gentian', name: 'Frost Gentian', biome: 'alpine', cost: 45000, yield: 12, mature: 480, light: 0.8, lw: 0.55, wlo: 0.25, whi: 0.65, nutr: 0.3, thirst: 0.0009, height: 0.45, canopy: 0.2, palat: 1.0, flower: 0.8, shed: 0.0006,
      col: { stem: [130, 30, 34], leaf: [140, 35, 38], acc: [225, 80, 62] }, desc: 'Deep blue bells above cold green leaves.' },
    { id: 'cushion', name: 'Snowcushion', biome: 'alpine', cost: 70000, yield: 15, mature: 520, light: 0.8, lw: 0.55, wlo: 0.2, whi: 0.6, nutr: 0.15, thirst: 0.0006, height: 0.2, canopy: 0.1, palat: 0.5, flower: 0.5, shed: 0.0004,
      col: { stem: [150, 25, 35], leaf: [150, 35, 44], acc: [285, 55, 82] }, desc: 'A dense dome studded with tiny lilac stars.' },
    { id: 'edel', name: 'Star Edelweiss', biome: 'alpine', cost: 120000, yield: 26, mature: 600, light: 0.9, lw: 0.5, wlo: 0.15, whi: 0.55, nutr: 0.2, thirst: 0.0007, height: 0.5, canopy: 0.15, palat: 1.0, flower: 1.0, shed: 0.0005,
      col: { stem: [120, 18, 52], leaf: [128, 20, 58], acc: [55, 40, 90] }, desc: 'A woolly star-flower. The jar\'s crown jewel.' },
  ];
  TD.PLANT = {};
  TD.PLANTS.forEach((p) => (TD.PLANT[p.id] = p));

  // unlock: stability earned in this jar before it appears in the list (kind: ground/air/crawl)
  TD.INSECTS = [
    { id: 'spring', name: 'Springtail', cost: 25, unlock: 0, add: 4, K: 3.5, iy: 0.02, col: '#dfe6ea', kind: 'ground', size: 1.5, wings: 0, desc: 'Tiny hoppers that turn leaf litter into nutrients.' },
    { id: 'pill', name: 'Pillbug', cost: 90, unlock: 120, add: 3, K: 1.6, iy: 0.05, col: '#8d98a6', kind: 'ground', size: 2.8, wings: 0, desc: 'Armoured recyclers. Slow, steady, nutrient-rich.' },
    { id: 'moth', name: 'Glowmoth', cost: 170, unlock: 350, add: 3, K: 1.3, iy: 0.1, col: '#fff0a8', kind: 'air', size: 2.4, wings: 1, desc: 'A soft glowing pollinator. Boosts yield and rare seeds near flowers.' },
    { id: 'beetle', name: 'Dot Beetle', cost: 120, unlock: 500, add: 3, K: 1.0, iy: 0, col: '#e5533d', kind: 'crawl', size: 2.6, wings: 0.5, desc: 'A red-shelled hunter of aphids.' },
    { id: 'lace', name: 'Lacewing', cost: 460, unlock: 2500, add: 3, K: 0.9, iy: 0.06, col: '#bdf3cf', kind: 'air', size: 2.6, wings: 2, desc: 'Gauzy generalist predator of aphids and springtails.' },
    { id: 'aphid', name: 'Dew Aphid', cost: 0, unlock: 1e12, add: 0, K: 3.0, iy: 0, col: '#8ed15a', kind: 'crawl', size: 1.8, wings: 0, pest: true, desc: 'A sap-sucking pest that hitchhikes in on new seedlings.' },
  ];
  TD.INSECT = {};
  TD.INSECTS.forEach((p) => (TD.INSECT[p.id] = p));

  // Long-idle morphs. calm = seconds of un-interrupted stillness.
  TD.MORPHS = [
    null,
    { id: 1, name: 'Dusk', mult: 1.5, calm: 600, rate: 1 / 1500, hue: { leaf: 268, acc: 312, stem: 255 }, glow: 'rgba(170,130,255,', desc: 'Violet leaves after ten quiet minutes.' },
    { id: 2, name: 'Ember', mult: 2.5, calm: 2700, rate: 1 / 3600, hue: { leaf: 20, acc: 48, stem: 10 }, glow: 'rgba(255,150,70,', desc: 'A warm glowing blush after 45 still minutes.' },
    { id: 3, name: 'Aurora', mult: 4.0, calm: 7200, rate: 1 / 10800, hue: { leaf: 172, acc: 190, stem: 158 }, glow: 'rgba(110,255,230,', desc: 'Shimmering aurora light after two calm hours.' },
  ];

  // Symbiotic pairs. a = plant; b = plant (adj within 2 columns) or ib = insect (pop >= ibMin).
  TD.PAIRS = [
    { id: 'dewring', name: 'Dew Ring', a: 'moss', b: 'fern', req: 1200, bonus: 0.35, desc: 'Moss and fern share one dew cycle.' },
    { id: 'lantern', name: 'Lantern Tryst', a: 'sun', ib: 'moth', ibMin: 2, req: 1500, bonus: 0.5, desc: 'Moths drift around Sunpetal blooms like lanterns.' },
    { id: 'sporecourt', name: 'Spore Court', a: 'bell', ib: 'spring', ibMin: 2, req: 1500, bonus: 0.4, desc: 'Springtails tend the Bellcap\'s spore garden.' },
    { id: 'trellis', name: 'Drowned Trellis', a: 'vine', b: 'reed', req: 1800, bonus: 0.45, desc: 'Dewvine climbs the Marsh Reed.' },
    { id: 'sandchoir', name: 'Sand Choir', a: 'succ', b: 'cactus', req: 1800, bonus: 0.45, desc: 'Dry-loving neighbours that hum in the heat.' },
    { id: 'truce', name: 'Hunter\'s Truce', a: 'sundrop', ib: 'beetle', ibMin: 2, req: 2100, bonus: 0.5, desc: 'Sundrop and Dot Beetle divide the hunt.' },
    { id: 'frost', name: 'Frost Mosaic', a: 'gentian', b: 'cushion', req: 2400, bonus: 0.5, desc: 'Blue bells over a lilac cushion.' },
    { id: 'starlit', name: 'Starlit Wing', a: 'edel', ib: 'moth', ibMin: 2, req: 2700, bonus: 0.6, desc: 'Moths gather on Star Edelweiss at night.' },
  ];

  // Upgrades. cost = base * mult^level
  TD.UPGRADES = [
    { id: 'glow', group: 'Growth', name: 'Glow Dust', max: 6, base: 220, mult: 2.4, desc: '+25% stability from all plants per level.' },
    { id: 'roots', group: 'Growth', name: 'Deep Roots', max: 6, base: 90, mult: 2.1, desc: '+20% plant growth speed per level.' },
    { id: 'seedlib', group: 'Growth', name: 'Seed Library', max: 5, base: 160, mult: 2.1, desc: '+30% rare seed rate per level.' },
    { id: 'hush', group: 'Growth', name: 'Hush Pad', max: 3, base: 500, mult: 3, desc: 'Interventions disturb the calm less (keeps 50% → 65% → 78% → 88%).' },
    { id: 'width', group: 'Jar', name: 'Widen the Jar', max: 3, costs: [200, 1500, 9000], desc: '+2 columns of plantable space per level (max 12).' },
    { id: 'mister', group: 'Tenders', name: 'Dew Wick', max: 3, costs: [130, 700, 3600], desc: 'Tender: automatically mists the jar when soil gets dry.' },
    { id: 'snips', group: 'Tenders', name: 'Silver Snips', max: 3, costs: [380, 2000, 9000], desc: 'Tender: prunes overgrown plants for you.' },
    { id: 'compost', group: 'Tenders', name: 'Compost Tender', max: 3, costs: [650, 3200, 13000], desc: 'Tender: faster nutrient cycling and soil balancing.' },
    { id: 'warden', group: 'Tenders', name: 'Pest Warden', max: 3, costs: [950, 4200, 16000], desc: 'Tender: gently culls aphid outbreaks.' },
    { id: 'valve', group: 'Tenders', name: 'Fog Valve', max: 3, costs: [1500, 6500, 22000], desc: 'Tender: strain builds 25% slower per level.' },
    { id: 'lantern', group: 'Away', name: 'Night Lantern', max: 3, costs: [450, 2600, 11000], desc: 'Offline efficiency 40% → 55% → 75% → 100%.' },
  ];
  TD.UPGRADE = {};
  TD.UPGRADES.forEach((u) => (TD.UPGRADE[u.id] = u));
  TD.upgradeCost = function (u, lvl) {
    return u.costs ? u.costs[lvl] : Math.round(u.base * Math.pow(u.mult, lvl));
  };

  // Sealing
  TD.SEAL_BASE = 30000; // lifetime stability needed in a jar to seal the first time
  TD.SEAL_GROWTH = 1.7; // each further exhibit needs more
  TD.SEAL_MIN_AGE = 30 * 60; // seconds of active (online) play in this jar
  TD.SEAL_MIN_SPECIES = 4;

  // colour helpers
  TD.hsl = function (c, dl, ds, a) {
    return 'hsl(' + Math.round(c[0]) + ',' + Math.round(Math.max(0, Math.min(100, c[1] + (ds || 0)))) + '%,' + Math.round(Math.max(4, Math.min(96, c[2] + (dl || 0)))) + '%' + (a != null ? ',' + a : '') + ')';
  };
  TD.hsla = function (c, dl, a) {
    return 'hsla(' + Math.round(c[0]) + ',' + Math.round(c[1]) + '%,' + Math.round(Math.max(4, Math.min(96, c[2] + (dl || 0)))) + '%,' + a + ')';
  };
  TD.plantColor = function (sp, morph, part) {
    const base = sp.col[part];
    if (!morph) return base;
    const m = TD.MORPHS[morph];
    return [m.hue[part], Math.min(90, base[1] + 25), base[2] + (morph === 1 ? 6 : morph === 2 ? 4 : 8)];
  };

  TD.fmt = function (n) {
    if (n == null || isNaN(n)) return '0';
    const a = Math.abs(n);
    if (a < 1000) return a < 10 ? n.toFixed(a < 1 ? 2 : 1).replace(/\.?0+$/, '') || '0' : String(Math.floor(n));
    const u = ['K', 'M', 'B', 'T', 'Qa'];
    let i = -1, v = a;
    while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
    return (n < 0 ? '-' : '') + v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + u[i];
  };
  TD.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + (x < 10 ? '0' : '') + x + 's';
    return x + 's';
  };
})();
