import test from 'node:test';
import assert from 'node:assert/strict';
import {filterFeed,getNewsFeed} from '../lib/news-feed.js';
const rows=[
 {id:1,title:'星の大冒険',platforms:['Nintendo Switch 2','PS5','PC（Steam）'],category:'NEWS'},
 {id:2,title:'映画の発表',platforms:[],category:'MOVIE'},
 {id:3,title:'次の冒険',platforms:['Xbox','iOS','Android'],category:'NEWS'},
 {id:4,title:'未登録の作品',platforms:[],category:'NEWS'}
];
test('multi-platform filtering normalizes aliases without inventing missing platforms',()=>{
 for(const filter of ['switch','playstation','pc'])assert.deepEqual(filterFeed(rows,{filter}).map(a=>a.id),[1]);
 for(const filter of ['xbox','mobile'])assert.deepEqual(filterFeed(rows,{filter}).map(a=>a.id),[3]);
 assert.deepEqual(filterFeed(rows,{filter:'movie'}).map(a=>a.id),[2]);
 assert.equal(filterFeed(rows).length,4);
 assert.equal(filterFeed([{id:5,platforms:['Wii U']}],{filter:'switch'}).length,0);
});
test('default excludes both slots, inclusion restores them, and literal normalized search spans all slots and filters',()=>{
 const featured={breaking:rows[0],pickup:[rows[2]]};
 assert.deepEqual(filterFeed(rows,{featured}).map(a=>a.id),[2,4]);
 assert.equal(filterFeed(rows,{featured,includeFeatured:true}).length,4);
 assert.deepEqual(filterFeed(rows,{featured,filter:'movie',q:'大冒険'}).map(a=>a.id),[1]);
 assert.deepEqual(filterFeed(rows,{featured,q:'GALAXY',linkedTitles:new Map([[3,['Ｇａｌａｘｙ']]])}).map(a=>a.id),[3]);
 assert.equal(filterFeed(rows,{q:'%'}).length,0);
});
test('feed reads beyond the first metadata batch and counts matches before pagination',async()=>{
 const previous=globalThis.fetch;const all=Array.from({length:503},(_,i)=>({id:i+1,title:'ニュース',platforms:i>=500?['PS5']:[]}));
 globalThis.fetch=async url=>{
  const u=new URL(url);
  if(u.searchParams.has('offset'))return Response.json(all.slice(Number(u.searchParams.get('offset')),Number(u.searchParams.get('offset'))+500));
  const ids=u.searchParams.get('id').slice(4,-1).split(',').map(Number);return Response.json(all.filter(a=>ids.includes(a.id)));
 };
 try {const r=await getNewsFeed('https://db.invalid','key','secret',{public_page_size:2},{filter:'playstation',page:'99'},null);assert.equal(r.total,3);assert.equal(r.page,2);assert.deepEqual(r.articles.map(a=>a.id),[503]);}
 finally{globalThis.fetch=previous;}
});
