const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const enc = new TextEncoder();

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function fail(message, status = 400, extra = {}) { return json({ ok: false, error: message, ...extra }, status); }
function clean(value, max) { return String(value ?? "").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max); }
function integer(value, min, max, fallback = 0) {
  const n = Number.isFinite(+value) ? Math.trunc(+value) : fallback;
  return Math.max(min, Math.min(max, n));
}
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function now() { return new Date().toISOString().replace("T", " ").slice(0, 19); }
function detectUploadType(bytes) {
  const b = new Uint8Array(bytes), ascii = (at, n) => String.fromCharCode(...b.slice(at, at + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { mime: "image/png", ext: "png", kind: "image" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return { mime: "image/gif", ext: "gif", kind: "image" };
  if (ascii(0, 4) === "\x1a\x45\xdf\xa3") return { mime: "video/webm", ext: "webm", kind: "video" };
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic", kind: "image" };
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov", kind: "video" };
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  return null;
}
function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(hex) { return Uint8Array.from(hex.match(/.{2}/g) || [], (x) => parseInt(x, 16)); }
function safeEqual(a, b) {
  const aa = enc.encode(String(a)), bb = enc.encode(String(b));
  if (aa.length !== bb.length) return false;
  let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 100000) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${bytesToHex(salt)}$${bytesToHex(bits)}`;
}
async function verifyPassword(password, stored, env) {
  if (stored?.startsWith("pbkdf2$")) {
    const [, count, salt, expected] = stored.split("$");
    return safeEqual((await passwordHash(password, hexToBytes(salt), +count)).split("$")[3], expected);
  }
  return !!env.ADMIN_PASSWORD && safeEqual(await digest(password), await digest(env.ADMIN_PASSWORD));
}
function cookies(req) {
  return Object.fromEntries((req.headers.get("cookie") || "").split(";").map((x) => x.trim().split(/=(.*)/s)).filter((x) => x[0]).map(([k, v]) => [k, decodeURIComponent(v || "")]));
}
async function adminSession(req, env, csrf = false) {
  const token = cookies(req).ey_admin;
  if (!token) return null;
  const row = await env.DB.prepare("SELECT token_hash,csrf,expires_at FROM admin_sessions WHERE token_hash=? AND expires_at>?").bind(await digest(`${token}|${env.TOKEN_SALT}`), Math.floor(Date.now() / 1000)).first();
  if (!row) return null;
  if (csrf && !safeEqual(req.headers.get("x-csrf") || "", row.csrf)) throw fail("Oturum doğrulaması başarısız.", 403);
  return row;
}
async function requireAdmin(req, env, csrf = req.method !== "GET") {
  const session = await adminSession(req, env, csrf);
  if (!session) throw fail("Oturum açmanız gerekiyor.", 401);
  return session;
}
function adminCookie(token, maxAge = 43200) { return `ey_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`; }
function guestToken(req) { return req.headers.get("x-guest-token") || ""; }
async function guestHash(req, env, required = true) {
  const token = guestToken(req);
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    if (required) throw new Response(JSON.stringify({ ok: false, error: "Tarayıcı kimliği eksik. Sayfayı yenileyip tekrar deneyin." }), { status: 400, headers: JSON_HEADERS });
    return "";
  }
  return digest(`${token}|${env.TOKEN_SALT}`);
}
async function ipHash(req, env) { return digest(`${req.headers.get("cf-connecting-ip") || "0"}|${env.TOKEN_SALT}`); }
async function body(req) { try { return await req.json(); } catch { return {}; } }
async function settings(env) {
  const rows = await env.DB.prepare("SELECT k,v FROM settings").all();
  return Object.fromEntries(rows.results.map((r) => [r.k, r.v]));
}
function weddingReached(env) { return new Date().toISOString().slice(0, 10) >= env.WEDDING_DATE; }
function sectionOpen(s, key, env) { return s[key] === "1" || (s.auto_wedding_day === "1" && weddingReached(env)); }
async function rateLimit(env, bucket, key, max, seconds) {
  const cutoff = Math.floor(Date.now() / 1000) - seconds;
  const id = `${bucket}:${key}`;
  const row = await env.DB.prepare("SELECT COUNT(*) n FROM rate_limits WHERE k=? AND ts>?").bind(id, cutoff).first();
  if ((row?.n || 0) >= max) throw fail("Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.", 429);
  await env.DB.prepare("INSERT INTO rate_limits(k,ts) VALUES(?,?)").bind(id, Math.floor(Date.now() / 1000)).run();
}
function mediaItem(r, gh) {
  return { id: +r.id, kind: r.kind, url: `/media/${r.object_key}`, thumb: r.thumb_key ? `/media/${r.thumb_key}` : `/media/${r.object_key}`, original_name: r.original_name, uploader: r.uploader, size: +r.size, approved: !!r.approved, private: !!r.private, mine: !!gh && r.token_hash === gh, created_at: r.created_at };
}
function memoryItem(r, gh) {
  return { id: +r.id, name: r.name, message: r.message, image: r.image ? `/media/${r.image}` : null, approved: !!r.approved, private: !!r.private, mine: !!gh && r.token_hash === gh, created_at: r.created_at };
}

async function publicApi(req, env, url) {
  const action = url.searchParams.get("a") || "";
  const s = await settings(env);
  if (action === "config") return json({ ok: true, config: { rsvp_open: s.rsvp_open === "1", memories_open: sectionOpen(s, "memories_open", env), uploads_open: sectionOpen(s, "uploads_open", env), oyun_open: sectionOpen(s, "oyun_open", env), max_upload_mb: +env.MAX_UPLOAD_MB, chunk_mb: +env.CHUNK_MB } });
  if (action === "rsvp" && req.method === "POST") {
    if (s.rsvp_open !== "1") return fail("Katılım bildirimi kapandı.", 403);
    const b = await body(req), gh = await guestHash(req, env), ip = await ipHash(req, env);
    await rateLimit(env, "rsvp", ip, 120, 3600);
    const first = clean(b.first_name, 80), last = clean(b.last_name, 80), status = clean(b.status, 10);
    if (!first || !last) return fail("Adınızı ve soyadınızı yazın.");
    if (!["geliyor", "gelmiyor", "belki"].includes(status)) return fail("Katılım durumunuzu seçin.");
    const adults = status === "geliyor" ? integer(b.adults, 1, 10, 1) : 0, children = status === "geliyor" ? integer(b.children, 0, 10) : 0, t = now();
    await env.DB.prepare("INSERT INTO rsvp(first_name,last_name,status,adults,children,token_hash,ip_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,status=excluded.status,adults=excluded.adults,children=excluded.children,updated_at=excluded.updated_at").bind(first, last, status, adults, children, gh, ip, t, t).run();
    return json({ ok: true });
  }
  if (action === "memories") {
    const gh = await guestHash(req, env, false), offset = integer(url.searchParams.get("offset"), 0, 100000), rows = await env.DB.prepare("SELECT * FROM memories WHERE approved=1 AND private=0 ORDER BY id DESC LIMIT 25 OFFSET ?").bind(offset).all();
    return json({ ok: true, items: rows.results.slice(0, 24).map((r) => memoryItem(r, gh)), more: rows.results.length > 24 });
  }
  if (action === "memory" && req.method === "POST") {
    if (!sectionOpen(s, "memories_open", env)) return fail("Anı defteri şu an kapalı.", 403);
    const b = await body(req), gh = await guestHash(req, env), ip = await ipHash(req, env), name = clean(b.name, 80), message = clean(b.message, 1500), priv = b.private ? 1 : 0;
    if (!name || message.length < 2) return fail("Adınızı ve mesajınızı yazın.");
    let image = null;
    if (typeof b.photo === "string" && b.photo.startsWith("data:image/jpeg;base64,")) {
      const raw = Uint8Array.from(atob(b.photo.slice(23)), (c) => c.charCodeAt(0));
      if (raw.length > 6 * 1048576) return fail("Fotoğraf çok büyük.", 413);
      image = `anilar/${crypto.randomUUID()}.jpg`; await env.MEDIA.put(image, raw, { httpMetadata: { contentType: "image/jpeg" } });
    }
    const approved = s.auto_approve === "1" ? 1 : 0, t = now();
    const out = await env.DB.prepare("INSERT INTO memories(name,message,image,approved,private,token_hash,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(name, message, image, approved, priv, gh, ip, t).run();
    const row = await env.DB.prepare("SELECT * FROM memories WHERE id=?").bind(out.meta.last_row_id).first();
    return json({ ok: true, item: memoryItem(row, gh) });
  }
  if (action === "memory_delete" && req.method === "POST") {
    const b = await body(req), gh = await guestHash(req, env), row = await env.DB.prepare("SELECT * FROM memories WHERE id=?").bind(integer(b.id, 0, 2147483647)).first();
    if (!row || row.token_hash !== gh) return fail("Bu mesajı yalnızca yazan kişi silebilir.", 403);
    if (row.image) await env.MEDIA.delete(row.image); await env.DB.prepare("DELETE FROM memories WHERE id=?").bind(row.id).run(); return json({ ok: true });
  }
  if (action === "media") {
    const gh = await guestHash(req, env, false), offset = integer(url.searchParams.get("offset"), 0, 100000), rows = await env.DB.prepare("SELECT * FROM media WHERE approved=1 AND private=0 ORDER BY id DESC LIMIT 37 OFFSET ?").bind(offset).all();
    return json({ ok: true, items: rows.results.slice(0, 36).map((r) => mediaItem(r, gh)), more: rows.results.length > 36 });
  }
  if (action === "media_delete" && req.method === "POST") {
    const b = await body(req), gh = await guestHash(req, env), row = await env.DB.prepare("SELECT * FROM media WHERE id=?").bind(integer(b.id, 0, 2147483647)).first();
    if (!row || row.token_hash !== gh) return fail("Bu dosyayı yalnızca yükleyen kişi silebilir.", 403);
    await env.MEDIA.delete([row.object_key, row.thumb_key].filter(Boolean)); await env.DB.prepare("DELETE FROM media WHERE id=?").bind(row.id).run(); return json({ ok: true });
  }
  if (action === "quiz_questions") {
    const rows = await env.DB.prepare("SELECT id,soru,siklar,dogru FROM quiz_questions ORDER BY sira,id").all();
    return json({ ok: true, items: rows.results.map((r) => ({ ...r, id: +r.id, dogru: +r.dogru, siklar: JSON.parse(r.siklar) })) });
  }
  if (action === "quiz" && req.method === "POST") {
    const b = await body(req), name = clean(b.name, 60), total = integer(b.total, 1, 50, 1), score = integer(b.score, 0, total), ip = await ipHash(req, env);
    if (!name) return fail("Adınızı yazın."); await env.DB.prepare("INSERT INTO quiz_scores(name,score,total,ip_hash,created_at) VALUES(?,?,?,?,?)").bind(name, score, total, ip, now()).run(); return json({ ok: true });
  }
  if (action === "leaderboard") {
    const rows = await env.DB.prepare("SELECT name,MAX(score) score,MAX(total) total,MIN(id) first_id FROM quiz_scores GROUP BY name ORDER BY score DESC,first_id LIMIT 20").all(); return json({ ok: true, items: rows.results });
  }
  return fail("Bilinmeyen işlem.", 404);
}

async function uploadApi(req, env, url) {
  const action = url.searchParams.get("a"), gh = await guestHash(req, env), id = clean(url.searchParams.get("id"), 32);
  if (action === "chunk" && req.method === "POST") {
    const cfg = await settings(env);
    if (!sectionOpen(cfg, "uploads_open", env)) return fail("Albüm yüklemeleri şu an kapalı.", 403);
    if (!/^[a-f0-9]{32}$/.test(id)) return fail("Geçersiz yükleme kimliği.");
    const offset = integer(url.searchParams.get("offset"), 0, 10737418240), total = integer(url.searchParams.get("total"), 1, +env.MAX_UPLOAD_MB * 1048576);
    let session = await env.DB.prepare("SELECT * FROM upload_sessions WHERE id=?").bind(id).first();
    if (!session) {
      if (offset !== 0) return fail("Yükleme bulunamadı, baştan başlayın.", 409, { expected: 0 });
      const used = await env.DB.prepare("SELECT COALESCE((SELECT SUM(size) FROM media),0)+COALESCE((SELECT SUM(total) FROM upload_sessions),0) n").first("n");
      if (+used + total > +env.MAX_TOTAL_STORAGE_BYTES) return fail("Albüm depolama sınırına ulaştı. Lütfen site yöneticisine haber verin.", 507);
      const key = `album/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.bin`, upload = await env.MEDIA.createMultipartUpload(key);
      await env.DB.prepare("INSERT INTO upload_sessions(id,token_hash,object_key,upload_id,total,received,created_at) VALUES(?,?,?,?,?,0,?)").bind(id, gh, key, upload.uploadId, total, now()).run();
      session = await env.DB.prepare("SELECT * FROM upload_sessions WHERE id=?").bind(id).first();
    }
    if (session.token_hash !== gh) return fail("Bu yükleme size ait değil.", 403);
    if (+session.total !== total) return fail("Dosya boyutu değişti, yüklemeyi yeniden başlatın.", 409);
    if (+session.received !== offset) return fail("Parça sırası kaydı.", 409, { expected: +session.received });
    const bytes = await req.arrayBuffer(), partNumber = Math.floor(offset / (+env.CHUNK_MB * 1048576)) + 1;
    if (!bytes.byteLength || bytes.byteLength > +env.CHUNK_MB * 1048576 || offset + bytes.byteLength > total) return fail("Geçersiz dosya parçası.", 400);
    const upload = env.MEDIA.resumeMultipartUpload(session.object_key, session.upload_id), part = await upload.uploadPart(partNumber, bytes);
    await env.DB.batch([env.DB.prepare("INSERT OR REPLACE INTO upload_parts(session_id,part_number,etag,size) VALUES(?,?,?,?)").bind(id, partNumber, part.etag, bytes.byteLength), env.DB.prepare("UPDATE upload_sessions SET received=received+? WHERE id=?").bind(bytes.byteLength, id)]);
    return json({ ok: true, received: offset + bytes.byteLength });
  }
  if (action === "status") { const s = await env.DB.prepare("SELECT received,token_hash FROM upload_sessions WHERE id=?").bind(id).first(); return json({ ok: true, received: s && s.token_hash === gh ? +s.received : 0 }); }
  if (action === "finish" && req.method === "POST") {
    const b = await body(req), sid = clean(b.id, 32), s = await env.DB.prepare("SELECT * FROM upload_sessions WHERE id=?").bind(sid).first();
    if (!s || s.token_hash !== gh || +s.received !== +s.total) return fail("Dosyanın tamamı ulaşmadı, tekrar deneyin.", 409);
    const parts = await env.DB.prepare("SELECT part_number partNumber,etag FROM upload_parts WHERE session_id=? ORDER BY part_number").bind(sid).all();
    await env.MEDIA.resumeMultipartUpload(s.object_key, s.upload_id).complete(parts.results);
    const head = await env.MEDIA.get(s.object_key, { range: { offset: 0, length: 32 } }), type = head && detectUploadType(await head.arrayBuffer());
    if (!type) { await env.MEDIA.delete(s.object_key); await env.DB.batch([env.DB.prepare("DELETE FROM upload_parts WHERE session_id=?").bind(sid), env.DB.prepare("DELETE FROM upload_sessions WHERE id=?").bind(sid)]); return fail("Bu dosya türü desteklenmiyor. Fotoğraf veya video yükleyin.", 415); }
    const { mime, kind, ext } = type, rawName = clean(b.name, 200).replace(/[\\/]/g, "_"), baseName = rawName.replace(/\.[^.]*$/, "").slice(0, 180) || "dosya", originalName = `${baseName}.${ext}`;
    const finalKey = s.object_key.replace(/\.bin$/, `.${ext}`); await env.MEDIA.put(finalKey, (await env.MEDIA.get(s.object_key)).body, { httpMetadata: { contentType: mime } }); await env.MEDIA.delete(s.object_key);
    let thumbKey = null;
    if (typeof b.thumb === "string" && b.thumb.startsWith("data:image/jpeg;base64,")) { const raw = Uint8Array.from(atob(b.thumb.slice(23)), (c) => c.charCodeAt(0)); if (raw.length <= 700 * 1024 && detectUploadType(raw)?.mime === "image/jpeg") { thumbKey = `thumb/${crypto.randomUUID()}.jpg`; await env.MEDIA.put(thumbKey, raw, { httpMetadata: { contentType: "image/jpeg" } }); } }
    const set = await settings(env), approved = set.auto_approve === "1" ? 1 : 0, ip = await ipHash(req, env), out = await env.DB.prepare("INSERT INTO media(kind,object_key,thumb_key,original_name,mime,size,uploader,approved,private,token_hash,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(kind, finalKey, thumbKey, originalName, mime, +s.total, clean(b.uploader, 80) || "Misafir", approved, b.private ? 1 : 0, gh, ip, now()).run();
    await env.DB.batch([env.DB.prepare("DELETE FROM upload_parts WHERE session_id=?").bind(sid), env.DB.prepare("DELETE FROM upload_sessions WHERE id=?").bind(sid)]); const row = await env.DB.prepare("SELECT * FROM media WHERE id=?").bind(out.meta.last_row_id).first(); return json({ ok: true, item: mediaItem(row, gh) });
  }
  return fail("Bilinmeyen işlem.", 404);
}

async function adminApi(req, env, url) {
  const action = url.searchParams.get("a") || "";
  if (action === "me") {
    const session = await adminSession(req, env);
    return json({ ok: true, admin: !!session, csrf: session?.csrf || null });
  }
  if (action === "login" && req.method === "POST") {
    const ip = await ipHash(req, env); await rateLimit(env, "admin-login", ip, 8, 900);
    const b = await body(req), stored = await env.DB.prepare("SELECT v FROM settings WHERE k='admin_password_hash'").first("v");
    if (!(await verifyPassword(String(b.password || ""), stored, env))) return fail("Şifre hatalı.", 401);
    const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32))), csrf = bytesToHex(crypto.getRandomValues(new Uint8Array(16))), expires = Math.floor(Date.now() / 1000) + 43200;
    await env.DB.prepare("INSERT INTO admin_sessions(token_hash,csrf,expires_at) VALUES(?,?,?)").bind(await digest(`${token}|${env.TOKEN_SALT}`), csrf, expires).run();
    return json({ ok: true, csrf }, 200, { "set-cookie": adminCookie(token) });
  }
  await requireAdmin(req, env);
  if (action === "logout" && req.method === "POST") {
    const token = cookies(req).ey_admin; if (token) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await digest(`${token}|${env.TOKEN_SALT}`)).run();
    return json({ ok: true }, 200, { "set-cookie": adminCookie("", 0) });
  }
  if (action === "password" && req.method === "POST") {
    const b = await body(req), stored = await env.DB.prepare("SELECT v FROM settings WHERE k='admin_password_hash'").first("v");
    if (!(await verifyPassword(String(b.current || ""), stored, env))) return fail("Mevcut şifre hatalı.", 403);
    if (String(b.new || "").length < 10) return fail("Yeni şifre en az 10 karakter olmalı.");
    await env.DB.prepare("INSERT INTO settings(k,v) VALUES('admin_password_hash',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(await passwordHash(String(b.new))).run();
    return json({ ok: true });
  }
  if (action === "stats") {
    const [r, m, md, qz] = await Promise.all([
      env.DB.prepare("SELECT COALESCE(SUM(status='geliyor'),0) geliyor,COALESCE(SUM(status='gelmiyor'),0) gelmiyor,COALESCE(SUM(status='belki'),0) belki,COALESCE(SUM(CASE WHEN status='geliyor' THEN adults+children ELSE 0 END),0) kisi,COUNT(*) toplam FROM rsvp").first(),
      env.DB.prepare("SELECT COUNT(*) n,COALESCE(SUM(approved=0),0) bekleyen FROM memories").first(),
      env.DB.prepare("SELECT COUNT(*) n,COALESCE(SUM(kind='image'),0) foto,COALESCE(SUM(kind='video'),0) video,COALESCE(SUM(approved=0),0) bekleyen,COALESCE(SUM(size),0) boyut FROM media").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM quiz_scores").first()
    ]);
    return json({ ok: true, rsvp: r, memories: m, media: md, quiz: +qz.n, disk_free: Math.max(0, +env.MAX_TOTAL_STORAGE_BYTES - +md.boyut), zip: false });
  }
  if (action === "rsvp_list") { const x = await env.DB.prepare("SELECT id,first_name,last_name,status,adults,children,created_at,updated_at FROM rsvp ORDER BY id DESC").all(); return json({ ok: true, items: x.results }); }
  if (action === "rsvp_delete" && req.method === "POST") { const b = await body(req); await env.DB.prepare("DELETE FROM rsvp WHERE id=?").bind(integer(b.id, 0, 2147483647)).run(); return json({ ok: true }); }
  if (action === "rsvp_csv") {
    const x = await env.DB.prepare("SELECT first_name,last_name,status,adults,children,created_at,updated_at FROM rsvp ORDER BY last_name,first_name").all(), labels = { geliyor: "Katılacak", gelmiyor: "Katılamayacak", belki: "Belirsiz" };
    const quote = (v) => `"${String(v ?? "").replace(/^([=+\-@])/, "'$1").replaceAll('"', '""')}"`;
    const rows = [["Ad","Soyad","Durum","Yetişkin","Çocuk","Toplam kişi","İlk yanıt","Son güncelleme"], ...x.results.map((r) => [r.first_name,r.last_name,labels[r.status],r.adults,r.children,r.status === "geliyor" ? +r.adults + +r.children : 0,r.created_at,r.updated_at])];
    return new Response("\uFEFF" + rows.map((r) => r.map(quote).join(";")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="katilim-listesi-${new Date().toISOString().slice(0,10)}.csv"`, "cache-control": "no-store" } });
  }
  if (action === "memories_list") { const x = await env.DB.prepare("SELECT * FROM memories ORDER BY approved,id DESC").all(); return json({ ok: true, items: x.results.map((r) => memoryItem(r, "")) }); }
  if (action === "memory_set" && req.method === "POST") { const b = await body(req); await env.DB.prepare("UPDATE memories SET approved=? WHERE id=?").bind(integer(b.approved,0,1), integer(b.id,0,2147483647)).run(); return json({ ok: true }); }
  if (action === "memory_delete" && req.method === "POST") { const b = await body(req), id = integer(b.id,0,2147483647), r = await env.DB.prepare("SELECT image FROM memories WHERE id=?").bind(id).first(); if (r?.image) await env.MEDIA.delete(r.image); await env.DB.prepare("DELETE FROM memories WHERE id=?").bind(id).run(); return json({ ok: true }); }
  if (action === "media_list") { const off=integer(url.searchParams.get("offset"),0,100000), pending=url.searchParams.get("filter")==="pending", x=await env.DB.prepare(`SELECT * FROM media ${pending ? "WHERE approved=0" : ""} ORDER BY id DESC LIMIT 61 OFFSET ?`).bind(off).all(); return json({ok:true,items:x.results.slice(0,60).map((r)=>mediaItem(r,"")),more:x.results.length>60}); }
  if (action === "media_set" && req.method === "POST") { const b=await body(req); await env.DB.prepare("UPDATE media SET approved=? WHERE id=?").bind(integer(b.approved,0,1),integer(b.id,0,2147483647)).run(); return json({ok:true}); }
  if (action === "media_delete" && req.method === "POST") { const b=await body(req),id=integer(b.id,0,2147483647),r=await env.DB.prepare("SELECT object_key,thumb_key FROM media WHERE id=?").bind(id).first(); if(r) await env.MEDIA.delete([r.object_key,r.thumb_key].filter(Boolean)); await env.DB.prepare("DELETE FROM media WHERE id=?").bind(id).run(); return json({ok:true}); }
  if (action === "media_zip") return fail("Cloudflare depolamasında toplu ZIP yerine dosyaları albüm listesinden ayrı ayrı indirebilirsiniz.", 501);
  if (action === "quiz_list") { const x=await env.DB.prepare("SELECT id,name,score,total,created_at FROM quiz_scores ORDER BY score DESC,id").all(); return json({ok:true,items:x.results}); }
  if (action === "quiz_delete" && req.method === "POST") { const b=await body(req); await env.DB.prepare("DELETE FROM quiz_scores WHERE id=?").bind(integer(b.id,0,2147483647)).run(); return json({ok:true}); }
  if (action === "quiz_reset" && req.method === "POST") { await env.DB.prepare("DELETE FROM quiz_scores").run(); return json({ok:true}); }
  if (action === "quiz_questions_list") { const x=await env.DB.prepare("SELECT id,soru,siklar,dogru,sira FROM quiz_questions ORDER BY sira,id").all(); return json({ok:true,items:x.results.map((r)=>({...r,id:+r.id,dogru:+r.dogru,sira:+r.sira,siklar:JSON.parse(r.siklar)}))}); }
  if (action === "quiz_question_save" && req.method === "POST") {
    const b=await body(req),id=integer(b.id,0,2147483647),soru=clean(b.soru,300),opts=Array.isArray(b.siklar)?b.siklar.map((x)=>clean(x,120)).filter(Boolean).slice(0,6):[],dogru=integer(b.dogru,0,5);
    if(!soru||opts.length<2) return fail("Soru ve en az iki şık gerekli."); if(dogru>=opts.length) return fail("Doğru şıkkı seçin.");
    if(id && await env.DB.prepare("SELECT id FROM quiz_questions WHERE id=?").bind(id).first()) await env.DB.prepare("UPDATE quiz_questions SET soru=?,siklar=?,dogru=? WHERE id=?").bind(soru,JSON.stringify(opts),dogru,id).run();
    else { const pos=await env.DB.prepare("SELECT COALESCE(MAX(sira),-1)+1 n FROM quiz_questions").first("n"); await env.DB.prepare("INSERT INTO quiz_questions(soru,siklar,dogru,sira,created_at) VALUES(?,?,?,?,?)").bind(soru,JSON.stringify(opts),dogru,pos,now()).run(); }
    return json({ok:true});
  }
  if (action === "quiz_question_delete" && req.method === "POST") { const b=await body(req); await env.DB.prepare("DELETE FROM quiz_questions WHERE id=?").bind(integer(b.id,0,2147483647)).run(); return json({ok:true}); }
  if (action === "quiz_question_move" && req.method === "POST") { const b=await body(req),id=integer(b.id,0,2147483647),rows=(await env.DB.prepare("SELECT id,sira FROM quiz_questions ORDER BY sira,id").all()).results,idx=rows.findIndex((r)=>+r.id===id),j=b.dir==="up"?idx-1:idx+1; if(idx>=0&&j>=0&&j<rows.length) await env.DB.batch([env.DB.prepare("UPDATE quiz_questions SET sira=? WHERE id=?").bind(rows[j].sira,rows[idx].id),env.DB.prepare("UPDATE quiz_questions SET sira=? WHERE id=?").bind(rows[idx].sira,rows[j].id)]); return json({ok:true}); }
  if (action === "settings") { const s=await settings(env), keys=["rsvp_open","memories_open","uploads_open","oyun_open","auto_wedding_day","auto_approve"], out=Object.fromEntries(keys.map((k)=>[k,s[k]==="1"])); out.wedding_day_reached=weddingReached(env); return json({ok:true,settings:out}); }
  if (action === "settings_set" && req.method === "POST") { const b=await body(req),allowed=["rsvp_open","memories_open","uploads_open","oyun_open","auto_wedding_day","auto_approve"],key=clean(b.key,40); if(!allowed.includes(key)) return fail("Geçersiz ayar."); await env.DB.prepare("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(key,String(integer(b.value,0,1))).run(); return json({ok:true}); }
  return fail("Bilinmeyen işlem.", 404);
}

export default { async fetch(req, env) {
  try {
    const url = new URL(req.url);
    if (url.hostname === "elifyusufcagri.com") {
      url.protocol = "https:";
      url.hostname = "www.elifyusufcagri.com";
      return Response.redirect(url.toString(), req.method === "GET" || req.method === "HEAD" ? 301 : 308);
    }
    if (url.pathname === "/api/public.php" || url.pathname === "/api/public") return await publicApi(req, env, url);
    if (url.pathname === "/api/upload.php" || url.pathname === "/api/upload") return await uploadApi(req, env, url);
    if (url.pathname === "/api/admin.php" || url.pathname === "/api/admin") return await adminApi(req, env, url);
    if (url.pathname.startsWith("/media/")) { const obj = await env.MEDIA.get(url.pathname.slice(7)); if (!obj) return new Response("Not found", { status: 404 }); const h = new Headers(); obj.writeHttpMetadata(h); h.set("etag", obj.httpEtag); h.set("x-content-type-options", "nosniff"); h.set("cache-control", "public,max-age=31536000,immutable"); return new Response(obj.body, { headers: h }); }
    return env.ASSETS.fetch(req);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error); return fail("Sunucuda beklenmeyen bir hata oluştu.", 500);
  }
} };
