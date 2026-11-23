import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../header.js', import.meta.url), 'utf8');

function renderAt(iso, page = 'public', source = script) {
  let now = new Date(iso);
  const handlers = {};
  const image = { src: '', getAttribute() { return this.src; }, addEventListener(type, fn) { handlers[type] = fn; } };
  const header = {
    set innerHTML(html) { image.src = html.match(/<img class="header-mascot[^>]*src="([^"]+)"/)[1]; },
    querySelector() { return image; }
  };
  const document = {
    readyState: 'complete', hidden: false,
    body: { dataset: { page }, classList: { contains: name => page === 'login' && name === 'editor-login-page' } },
    documentElement: { classList: { add() {} } },
    querySelector(selector) { return selector === 'header' ? header : {}; },
    addEventListener(type, fn) { handlers[type] = fn; }
  };
  const window = { addEventListener(type, fn) { handlers[type] = fn; }, setInterval(fn) { handlers.tick = fn; } };
  vm.runInNewContext(source, { document, window, location: { pathname: '/' }, Date: class extends Date { constructor() { super(now); } } });
  return { image, handlers, move: iso => { now = new Date(iso); } };
}

test('season windows use JST dates and return to the default image after each period', () => {
  const cases = [
    ['2026-12-31T14:59:59Z', 'welcome_mitten.png'], ['2026-12-31T15:00:00Z', 'new_year.webp'],
    ['2027-01-07T14:59:59Z', 'new_year.webp'], ['2027-01-07T15:00:00Z', 'welcome_mitten.png'],
    ['2027-03-14T15:00:00Z', 'spring.webp'], ['2027-04-15T15:00:00Z', 'welcome_mitten.png'],
    ['2027-06-30T15:00:00Z', 'summer.webp'], ['2027-08-31T15:00:00Z', 'welcome_mitten.png'],
    ['2027-09-30T15:00:00Z', 'halloween.webp'], ['2027-10-31T15:00:00Z', 'welcome_mitten.png'],
    ['2027-11-30T15:00:00Z', 'christmas.webp'], ['2027-12-25T15:00:00Z', 'welcome_mitten.png']
  ];
  for (const [date, expected] of cases) assert.equal(renderAt(date).image.src, `/assets/cosmochi_${expected}`);
});

test('editor identity is fixed; game events override season only on configured dates', () => {
  const date = '2027-12-01T00:00:00Z';
  assert.equal(renderAt(date, 'editor').image.src, '/assets/cosmochi_editor_laptop.webp');
  assert.equal(renderAt(date, 'login').image.src, '/assets/cosmochi_welcome_mitten.png');
  const configured = script.replace('const gameEventDates = [];','const gameEventDates = [{start:"2027-12-01",end:"2027-12-02"}];');
  assert.equal(renderAt(date, 'public', configured).image.src, '/assets/cosmochi_game_event.webp');
  assert.equal(renderAt('2027-12-03T00:00:00Z', 'public', configured).image.src, '/assets/cosmochi_christmas.webp');
});

test('open pages refresh on date changes and fall back if an image fails', () => {
  const view = renderAt('2027-11-30T14:59:59Z');
  view.move('2027-11-30T15:00:00Z');
  view.handlers.tick();
  assert.equal(view.image.src, '/assets/cosmochi_christmas.webp');
  view.handlers.error();
  assert.equal(view.image.src, '/assets/cosmochi_welcome_mitten.png');
});
