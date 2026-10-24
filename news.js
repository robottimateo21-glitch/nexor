// NEXOR · noticias que se actualizan solas (función de Vercel).
// Nadie elige las noticias a mano: esta función lee fuentes RSS públicas de
// ciencia y tecnología, se queda con los temas de robótica, espacio y tecnología
// aptos para la escuela y devuelve las más nuevas en JSON. Vercel guarda la
// respuesta en caché 3 horas, así que la lista se renueva sola todo el día.
const FEEDS = {
  es: [
    {u:"https://www.nasa.gov/es/feed/", s:"NASA en español", all:true},
    {u:"https://www.xataka.com/feedburner.xml", s:"Xataka"}
  ],
  en: [
    {u:"https://www.nasa.gov/news-release/feed/", s:"NASA", all:true},
    {u:"https://www.esa.int/rssfeed/Our_Activities/Space_Science", s:"ESA", all:true},
    {u:"https://www.sciencedaily.com/rss/computers_math/robotics.xml", s:"ScienceDaily", all:true},
    {u:"https://www.sciencedaily.com/rss/space_time.xml", s:"ScienceDaily"}
  ],
  pt: [
    {u:"https://www.inovacaotecnologica.com.br/boletim/rss.xml", s:"Inovação Tecnológica"},
    {u:"https://olhardigital.com.br/feed/", s:"Olhar Digital"}
  ]
};
// Temas que sí queremos (robótica, espacio, tecnología, ciencia)
const OK = /robot|rob[oô]|\bdron|drone|intelig[eê]ncia artificial|artificial intelligence|\bchip|comput|program|sensor|energ|solar|bater|sat[eé]l|satell|\bNASA|\bESA\b|espac|\bspace|espa[cç]o|\bLuna\b|\bMoon|\bLua\b|Marte|\bMars|planet|rover|astron|telesc|cohete|rocket|foguete|Artemis|estaci[oó]n espacial|space station|esta[cç][aã]o espacial|tecnolog|technolog|ingenier|engineer|engenh|f[ií]sica|physics|clima|climate|cient[ií]fic|scien|ci[eê]ncia|galax|estrell|\bstar|estrela|cometa|comet|asteroid|meteor|eclip|nebul|\bsol\b|\bsun\b|Jupiter|J[uú]piter|Saturn|Venus|V[eê]nus|Merc[uú]r|\bimpres|3D|\bmaker|Arduino|microcontrol|el[eé]ctr|electr/i;
const AI = /\b(IA|AI)\b/; // en mayúsculas, para no confundir con palabras que terminan en "ia"
// Temas que no corresponden a una app escolar
const BAD = /muert|\bdeath|\bdead\b|\bmorte|\bmort[oa]s?\b|guerra|\bwar\b|\barmas?\b|weapon|drog|\bdrugs?\b|ozempic|c[aá]ncer|cancer|\bsex|crim|polic[ií]a|\bpolice|\bkill|\bmatan?\b|militar|military|\bbomb|apuesta|\bbet\b|casino|cripto|crypto|bitcoin|elecci|election|elei[cç]|partido|futbol|f[uú]tbol|futebol|onde assistir|oferta|descuento|desconto|\bdeal|cup[oó]n|black friday|\bporn|violen|ataque|attack|demanda|lawsuit|despid|layoff|tiroteo|shooting|suic/i;
const CAT = t => /robot|rob[oô]|\bdron|drone|Arduino|maker/i.test(t) ? "rob"
  : /NASA|\bESA\b|espac|\bspace|espa[cç]o|\bLuna\b|\bMoon|\bLua\b|Marte|\bMars|planet|rover|astron|telesc|cohete|rocket|foguete|sat[eé]l|satell|Artemis|galax|estrell|\bstar|estrela|cometa|comet|asteroid|meteor|eclip|nebul|J[uú]piter|Saturn|V[eêe]nus/i.test(t) ? "esp" : "tec";
const ENT = {amp:"&", quot:'"', apos:"'", lt:"<", gt:">", nbsp:" ", aacute:"á", eacute:"é", iacute:"í", oacute:"ó", uacute:"ú", ntilde:"ñ", ccedil:"ç", atilde:"ã", otilde:"õ", ecirc:"ê", ocirc:"ô", acirc:"â", Aacute:"Á", Eacute:"É", Iacute:"Í", Oacute:"Ó", Uacute:"Ú", Ntilde:"Ñ", uuml:"ü", hellip:"…", ndash:"–", mdash:"—", lsquo:"‘", rsquo:"’", ldquo:"“", rdquo:"”", laquo:"«", raquo:"»"};
const decode = s => s.replace(/&#x([0-9a-f]+);/gi,(m,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(m,n)=>String.fromCodePoint(+n)).replace(/&([a-z]+);/gi,(m,n)=>ENT[n]!=null?ENT[n]:m);
const strip = s => String(s||"").replace(/<!\[CDATA\[|\]\]>/g,"");
const clean = s => decode(decode(strip(s)).replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
const raw = (x, n) => { const m = x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i")); return m ? strip(m[1]) : ""; };
const tag = (x, n) => clean(raw(x, n));
const cut = (s, n) => s.length > n ? s.slice(0, s.lastIndexOf(" ", n) > n*0.6 ? s.lastIndexOf(" ", n) : n).replace(/[,.;:\s]+$/,"") + "…" : s;
function image(it){
  const m = it.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)
    || it.match(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)
    || decode(strip(raw(it, "content:encoded") || raw(it, "description"))).match(/<img[^>]+src="(https:[^"]+\.(?:jpe?g|png|webp)[^"]*)"/i);
  return m && /^https:\/\//.test(m[1]) ? decode(m[1]) : "";
}
async function readFeed(f){
  const ctl = new AbortController(), to = setTimeout(()=>ctl.abort(), 7000);
  try {
    const r = await fetch(f.u, {headers:{"User-Agent":"NEXOR-educativo (ITEC 0915; +https://nexor-eight.vercel.app)"}, signal:ctl.signal});
    if(!r.ok) return [];
    const buf = Buffer.from(await r.arrayBuffer());
    const head = buf.slice(0, 200).toString("latin1");
    const cs = (r.headers.get("content-type")||"").match(/charset=([\w-]+)/i)?.[1] || head.match(/encoding="([\w-]+)"/i)?.[1] || "utf-8";
    let xml; try { xml = new TextDecoder(cs.toLowerCase()).decode(buf); } catch(e){ xml = buf.toString("utf8"); }
    const old = Date.now() - 60*864e5;
    return xml.split(/<item[\s>]/i).slice(1, 40).map(it=>{
      const t = tag(it, "title"), u = tag(it, "link") || (it.match(/<link[^>]+href="([^"]+)"/i)||[])[1] || "";
      const d = new Date(tag(it, "pubDate") || tag(it, "dc:date") || tag(it, "updated") || Date.now());
      const x = cut(tag(it, "description"), 170);
      return {t, u, s:f.s, d:isNaN(d) ? new Date().toISOString() : d.toISOString(), c:CAT(t+" "+x), x, img:image(it), ok:f.all || OK.test(t) || AI.test(t)};
    }).filter(x=>x.t && /^https?:\/\//.test(x.u) && x.ok && !BAD.test(x.t+" "+x.x) && new Date(x.d) > old)
      .map(({ok, ...x})=>x);
  } finally { clearTimeout(to); }
}
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const lang = ["es","en","pt"].includes(req.query.lang) ? req.query.lang : "es";
  try {
    const lists = await Promise.all(FEEDS[lang].map(f=>readFeed(f).catch(()=>[])));
    // Mezcla las fuentes para que ninguna tape a las otras, y ordena por fecha
    const seen = new Set(), key = x => x.t.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,60);
    const out = lists.flat().sort((a,b)=>b.d.localeCompare(a.d))
      .filter(x=>{ const k1=x.u, k2=key(x); if(seen.has(k1)||seen.has(k2)) return false; seen.add(k1); seen.add(k2); return true; })
      .slice(0, 24);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", out.length ? "public, s-maxage=10800, stale-while-revalidate=86400" : "public, s-maxage=600");
    res.status(200).send(JSON.stringify({lang, at:new Date().toISOString(), sources:FEEDS[lang].map(f=>f.s), items:out}));
  } catch(e){ res.status(502).send(JSON.stringify({error:String(e && e.message || e)})); }
};
