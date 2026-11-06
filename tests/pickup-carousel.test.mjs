import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('controls follow actual overflow, support navigation, and disappear on wide or empty layouts', () => {
  const element = () => ({ children: [], handlers: {}, setAttribute(k,v){this[k]=v;},
    addEventListener(k,fn){this.handlers[k]=fn;}, replaceChildren(...children){this.children=children;} });
  const rail = Object.assign(element(), { clientWidth:350, scrollWidth:978, scrollLeft:0,
    querySelectorAll(){return this.cards;}, cards:[20,334,648].map(offsetLeft=>({offsetLeft})),
    scrollTo({left}){this.scrollLeft=left;this.handlers.scroll();} });
  const nodes = {pickup:rail, 'pickup-controls':element(), 'pickup-prev':element(),
    'pickup-next':element(), 'pickup-dots':element()};
  const context = vm.createContext({window:{}, document:{getElementById:id=>nodes[id],createElement:element},
    ResizeObserver:class {observe(){}}});
  vm.runInContext(readFileSync(new URL('../pickup-carousel.js',import.meta.url),'utf8'),context);
  const refresh = context.window.GamePickupCarousel.refresh;
  assert.equal(nodes['pickup-controls'].hidden,false);
  assert.equal(nodes['pickup-prev'].disabled,true);
  nodes['pickup-next'].handlers.click();
  assert.equal(rail.scrollLeft,314);
  assert.equal(nodes['pickup-dots'].children[1]['aria-pressed'],'true');
  nodes['pickup-dots'].children[2].handlers.click();
  assert.equal(rail.scrollLeft,628);
  assert.equal(nodes['pickup-next'].disabled,true);
  rail.clientWidth=978; rail.scrollLeft=0; refresh();
  assert.equal(nodes['pickup-controls'].hidden,true);
  assert.equal(nodes['pickup-dots'].children.length,0);
  rail.clientWidth=350; rail.cards=[{offsetLeft:20}];refresh();
  assert.equal(nodes['pickup-controls'].hidden,true);
  rail.cards=[];refresh();
  assert.equal(nodes['pickup-controls'].hidden,true);
});

test('public and editor preview place discovery before latest news and share carousel behavior', () => {
  for (const path of ['index.html','editor-preview.html']) {
    const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    assert.ok(html.indexOf('id="pickup-heading"') < html.indexOf('id="latest"'));
    assert.match(html,/src="\/pickup-carousel.js"/);
    assert.equal((html.match(/id="pickup-controls"/g)||[]).length,1);
  }
});
