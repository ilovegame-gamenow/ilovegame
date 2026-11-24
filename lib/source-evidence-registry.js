// Source-specific routing is centralized here. IDs are never arbitrary URLs.
const datedArticle=/^\d{4}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/[a-z0-9-]{1,180}$/i;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const appId=/^[1-9]\d{0,9}$/;

export const SOURCE_REGISTRY=Object.freeze({
 nintendo:{name:'Nintendo',kind:'nintendo',maxPage:5,article:id=>uuid.test(id)?'https://www.nintendo.com/jp/topics/article/'+id.toLowerCase():null,identify:u=>u.hostname==='www.nintendo.com'?u.pathname.match(/^\/jp\/topics\/article\/([^/]+)\/?$/)?.[1]:null,coverage:'requested_page_only'},
 playstation:{name:'PlayStation',kind:'rss',maxPage:1,listUrl:'https://blog.ja.playstation.com/feed/',host:'blog.ja.playstation.com',article:id=>datedArticle.test(id)?'https://blog.ja.playstation.com/'+id+'/':null,identify:u=>u.hostname==='blog.ja.playstation.com'?u.pathname.slice(1).replace(/\/$/,''):null,coverage:'current_rss_only'},
 xbox:{name:'Xbox Wire Japan',kind:'rss',maxPage:1,listUrl:'https://news.xbox.com/ja-jp/feed/',host:'news.xbox.com',article:id=>datedArticle.test(id)?'https://news.xbox.com/ja-jp/'+id+'/':null,identify:u=>u.hostname==='news.xbox.com'?u.pathname.match(/^\/ja-jp\/(\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+)\/?$/i)?.[1]:null,coverage:'current_rss_only'},
 prtimes:{name:'PR TIMES',kind:'prtimes',maxPage:1,listUrl:'https://prtimes.jp/main/html/searchbiscate/busi_cate_id/008/lv2/22/',article:id=>/^\d{9}\.\d{9}$/.test(id)?'https://prtimes.jp/main/html/rd/p/'+id+'.html':null,identify:u=>u.hostname==='prtimes.jp'?u.pathname.match(/^\/main\/html\/rd\/p\/(\d{9}\.\d{9})\.html$/)?.[1]:null,coverage:'category_first_page_only'},
 steam:{name:'Steam',kind:'store',maxPage:1,listUrl:'https://store.steampowered.com/api/featuredcategories?l=japanese&cc=jp',article:id=>appId.test(id)&&Number(id)<=4294967295?'https://store.steampowered.com/app/'+id+'/':null,identify:u=>u.hostname==='store.steampowered.com'?u.pathname.match(/^\/app\/([1-9]\d{0,9})(?:\/[^/]+)?\/?$/)?.[1]:null,coverage:'featured_new_releases_and_coming_soon'},
});
export const validSource=source=>typeof source==='string'&&Object.hasOwn(SOURCE_REGISTRY,source);
export const validSourcePage=(source,page)=>validSource(source)&&Number.isInteger(page)&&page>=1&&page<=SOURCE_REGISTRY[source].maxPage;
export const sourceArticleUrl=(source,id)=>validSource(source)&&typeof id==='string'?SOURCE_REGISTRY[source].article(id):null;
