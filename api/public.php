<?php
/* Misafir API'si: katılım, anı defteri, albüm listesi, quiz */
define('EY_APP', 1);
require __DIR__ . '/lib.php';
require_installed();

$a = isset($_GET['a']) ? (string)$_GET['a'] : '';
$PAGE_NOTES = 24;
$PAGE_MEDIA = 36;

switch ($a) {

    case 'config':
        out(array('ok' => true, 'config' => array(
            'rsvp_open' => flag('rsvp_open'),
            'memories_open' => section_open('memories_open'),
            'uploads_open' => section_open('uploads_open'),
            'oyun_open' => section_open('oyun_open'),
            'max_upload_mb' => (int)cfg('max_upload_mb', 500),
            'chunk_mb' => max(1, (int)cfg('chunk_mb', 4)),
        )));

    /* ── katılım (aynı tarayıcıdan tekrar gönderilirse güncellenir) ── */
    case 'rsvp':
        method_post();
        if (!flag('rsvp_open')) fail('Katılım bildirimi kapandı.', 403);
        $gh = guest_hash();
        rate_limit('rsvp', 120, 3600);
        $first = in_str('first_name', 80);
        $last = in_str('last_name', 80);
        $status = in_str('status', 10);
        if ($first === '' || $last === '') fail('Adınızı ve soyadınızı yazın.');
        if (!in_array($status, array('geliyor', 'gelmiyor', 'belki'), true)) fail('Katılım durumunuzu seçin.');
        $guests = $status === 'geliyor' ? in_int('guests', 0, 10) : 0;
        $row = q('SELECT id FROM rsvp WHERE token_hash = ? LIMIT 1', array($gh))->fetch();
        if ($row) {
            q('UPDATE rsvp SET first_name=?, last_name=?, status=?, guests=?, updated_at=NOW() WHERE id=?',
                array($first, $last, $status, $guests, $row['id']));
        } else {
            q('INSERT INTO rsvp (first_name, last_name, status, guests, token_hash, ip_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW())',
                array($first, $last, $status, $guests, $gh, ip_hash()));
        }
        out(array('ok' => true));

    /* ── anı defteri ── */
    case 'memories':
        $gh = guest_hash(false);
        $off = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
        $rows = q('SELECT * FROM memories WHERE approved = 1 AND private = 0 ORDER BY id DESC LIMIT ' . ($PAGE_NOTES + 1) . ' OFFSET ' . $off)->fetchAll();
        $more = count($rows) > $PAGE_NOTES;
        $items = array();
        foreach (array_slice($rows, 0, $PAGE_NOTES) as $r) $items[] = fmt_memory($r, $gh);
        out(array('ok' => true, 'items' => $items, 'more' => $more));

    case 'memory':
        method_post();
        if (!section_open('memories_open')) fail('Anı defteri şu an kapalı.', 403);
        $gh = guest_hash();
        rate_limit('memory', 150, 3600);
        $name = in_str('name', 80);
        $msg = in_str('message', 1500, true);
        $private = in_int('private', 0, 1);
        if ($name === '') fail('Adınızı yazın.');
        if (strlen($msg) < 2) fail('Bir mesaj yazın.');
        $b = body();
        $img = null;
        if (!empty($b['photo'])) {
            $img = save_jpeg_dataurl($b['photo'], 'anilar', (int)cfg('memory_photo_mb', 6) * 1048576);
            if ($img === null) fail('Fotoğraf kaydedilemedi. Farklı bir fotoğraf deneyin.');
        }
        $approved = flag('auto_approve') ? 1 : 0;
        q('INSERT INTO memories (name, message, image, approved, private, token_hash, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,NOW())',
            array($name, $msg, $img, $approved, $private, $gh, ip_hash()));
        $r = q('SELECT * FROM memories WHERE id = ?', array(db()->lastInsertId()))->fetch();
        out(array('ok' => true, 'item' => fmt_memory($r, $gh)));

    case 'memory_delete':
        method_post();
        $gh = guest_hash();
        $id = in_int('id', 0, PHP_INT_MAX);
        $r = q('SELECT * FROM memories WHERE id = ?', array($id))->fetch();
        if (!$r || !hash_equals($r['token_hash'], $gh)) fail('Bu mesajı yalnızca yazan kişi silebilir.', 403);
        q('DELETE FROM memories WHERE id = ?', array($id));
        delete_upload($r['image']);
        out(array('ok' => true));

    /* ── albüm ── */
    case 'media':
        $gh = guest_hash(false);
        $off = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
        $rows = q('SELECT * FROM media WHERE approved = 1 AND private = 0 ORDER BY id DESC LIMIT ' . ($PAGE_MEDIA + 1) . ' OFFSET ' . $off)->fetchAll();
        $more = count($rows) > $PAGE_MEDIA;
        $items = array();
        foreach (array_slice($rows, 0, $PAGE_MEDIA) as $r) $items[] = fmt_media($r, $gh);
        out(array('ok' => true, 'items' => $items, 'more' => $more));

    case 'media_delete':
        method_post();
        $gh = guest_hash();
        $id = in_int('id', 0, PHP_INT_MAX);
        $r = q('SELECT * FROM media WHERE id = ?', array($id))->fetch();
        if (!$r || !hash_equals($r['token_hash'], $gh)) fail('Bu dosyayı yalnızca yükleyen kişi silebilir.', 403);
        q('DELETE FROM media WHERE id = ?', array($id));
        delete_upload($r['path']);
        if ($r['thumb'] !== $r['path']) delete_upload($r['thumb']);
        out(array('ok' => true));

    /* ── quiz ── */
    case 'quiz':
        method_post();
        if (!section_open('oyun_open')) fail('Oyun şu an kapalı.', 403);
        rate_limit('quiz', 300, 3600);
        $name = in_str('name', 60);
        if ($name === '') fail('Adınızı yazın.');
        $total = in_int('total', 1, 50, 1);
        $score = in_int('score', 0, $total);
        q('INSERT INTO quiz_scores (name, score, total, ip_hash, created_at) VALUES (?,?,?,?,NOW())', array($name, $score, $total, ip_hash()));
        out(array('ok' => true));

    case 'leaderboard':
        $rows = q('SELECT name, MAX(score) AS score, MAX(total) AS total, MIN(id) AS first_id FROM quiz_scores GROUP BY name ORDER BY score DESC, first_id ASC LIMIT 20')->fetchAll();
        $items = array();
        foreach ($rows as $r) $items[] = array('name' => $r['name'], 'score' => (int)$r['score'], 'total' => (int)$r['total']);
        out(array('ok' => true, 'items' => $items));

    default:
        fail('Bilinmeyen işlem.', 404);
}
