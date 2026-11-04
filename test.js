const fs = require('fs');
const appCode = fs.readFileSync('app.js', 'utf8');

const fakeDom = {
  getElementById: (id) => ({
    style: {},
    classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{}, contains: ()=>false },
    innerHTML: '',
    textContent: ''
  }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.document = fakeDom;
global.window = { location: { search: '' }, matchMedia: () => ({matches: false}) };
global.localStorage = { getItem:()=>null, setItem:()=>{} };
global.sessionStorage = { getItem:()=>null, setItem:()=>{} };
global.$ = id => fakeDom.getElementById(id);

// Expose renderShelf & pricing functions to global scope by evaluating appCode
eval(appCode + '\nglobal.renderShelf = () => { logs = global.logs; bagMeta = global.bagMeta; journal = global.journal; return renderShelf(); };\nglobal.marketPriceForBrewer = marketPriceForBrewer;\nglobal.marketPriceForUsedFor = marketPriceForUsedFor;\nglobal.calcMoneySaved = () => { logs = global.logs; bagMeta = global.bagMeta; journal = global.journal; return calcMoneySaved(); };\nglobal.normalizeBrewerName = normalizeBrewerName;\nglobal.isSameBrewer = isSameBrewer;');

try {
  // Test pricing consistency
  const assert = require('assert');

  // Test Kompresso and Cafflano Kompresso equivalence
  assert.strictEqual(global.normalizeBrewerName('Kompresso'), 'Cafflano Kompresso');
  assert.strictEqual(global.normalizeBrewerName('Cafflano Kompresso'), 'Cafflano Kompresso');
  assert.strictEqual(global.isSameBrewer('Kompresso', 'Cafflano Kompresso'), true);
  assert.strictEqual(global.isSameBrewer('Cafflano Kompresso', 'Kompresso'), true);
  assert.strictEqual(global.marketPriceForBrewer('Kompresso', false), 175);
  assert.strictEqual(global.marketPriceForBrewer('Cafflano Kompresso', false), 175);
  console.log('SUCCESS: Kompresso / Cafflano Kompresso equivalence tests passed.');

  assert.strictEqual(global.marketPriceForBrewer('Dedica Duo', false), 200, 'Dedica Duo should be ₹200');
  assert.strictEqual(global.marketPriceForBrewer('Dedica Duo', true), 250, 'Milk-based Dedica Duo should be ₹250');
  assert.strictEqual(global.marketPriceForBrewer('V60', false), 200, 'V60 should be ₹200');
  assert.strictEqual(global.marketPriceForBrewer('Chemex', false), 200, 'Chemex should be ₹200');
  assert.strictEqual(global.marketPriceForBrewer('Cafflano Kompresso', false), 175, 'Kompresso should be ₹175');
  assert.strictEqual(global.marketPriceForBrewer('KaldiPress', false), 150, 'KaldiPress should be ₹150');
  assert.strictEqual(global.marketPriceForBrewer('French Press', false), 150, 'French Press should be ₹150');
  assert.strictEqual(global.marketPriceForBrewer('AeroPress', false), 150, 'AeroPress should be ₹150');
  assert.strictEqual(global.marketPriceForBrewer('Moka Pot', false), 100, 'Moka Pot should be ₹100');
  assert.strictEqual(global.marketPriceForBrewer('Americano', false), 200, 'Americano should be ₹200');

  assert.strictEqual(global.marketPriceForUsedFor('Espresso'), 200, 'usedFor Espresso should be ₹200');
  assert.strictEqual(global.marketPriceForUsedFor('Americano'), 200, 'usedFor Americano should be ₹200');
  assert.strictEqual(global.marketPriceForUsedFor('Kompresso'), 175, 'usedFor Kompresso should be ₹175');
  assert.strictEqual(global.marketPriceForUsedFor('Moka Pot'), 100, 'usedFor Moka Pot should be ₹100');
  assert.strictEqual(global.marketPriceForUsedFor('Pour Over'), 200, 'usedFor Pour Over should be ₹200');

  console.log('SUCCESS: Pricing consistency tests passed.');

  global.logs = [
    { id: 1, category: 'beans', name: 'Roast Date Bean', date: '2026-08-01', size: '250g', price: 500 },
    { id: 2, category: 'beans', name: 'Opened Only Bean', date: '2026-08-01', size: '250g', price: 500 }
  ];
  global.finishedBags = [];
  global.bagMeta = {
    1: { roastDate: '2026-08-01', openedDate: '2026-08-05' },
    2: { openedDate: '2026-08-05' }
  };
  global.journal = [
    { id: '1', date: '2026-08-05', brewer: 'Dedica Duo', beanId: '1', dose: 15, is_milk_based: 0 }
  ];

  const html = global.renderShelf();
  console.log('SUCCESS: renderShelf executed cleanly.');

  const savings = global.calcMoneySaved();
  assert.strictEqual(savings.rows.length, 1);
  assert.strictEqual(savings.rows[0].cafeCost, 200, 'Dedica Duo café cost should be ₹200');
  assert.strictEqual(savings.rows[0].homeCost, 30, '15g dose @ ₹2/g should be ₹30');
  assert.strictEqual(savings.rows[0].saved, 170, 'Saved should be ₹170');
  console.log('SUCCESS: calcMoneySaved executed cleanly with accurate used bean price.');
} catch(e) {
  console.log('ERROR:', e.stack);
  process.exit(1);
}
