<?php
/* Yönetim paneli API'si */
define('EY_APP', 1);
require __DIR__ . '/lib.php';
require_installed();

$a = isset($_GET['a']) ? (string)$_GET['a'] : '';

switch ($a) {

    /* ── oturum ── */
    case 'me':
        admin_session();
        $in = !empty($_SESSION['admin']);
        if ($in && empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
        out(array('ok' => true, 'admin' => $in, 'csrf' => $in ? $_SESSION['csrf'] : null));

    case 'login':
        method_post();
        admin_session();
        rate_limit('login', 8, 900);
        $b = body();
        $pw = isset($b['password']) && is_string($b['password']) ? $b['password'] : '';
        $hash = (string)setting('admin_hash');
        if ($hash === '' || !password_verify($pw, $hash)) {
            usleep(400000);
            fail('Şifre hatalı.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = 1;
        $_SESSION['last'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        out(array('ok' => true, 'csrf' => $_SESSION['csrf']));

    case 'logout':
        method_post();
        require_admin();
        $_SESSION = array();
        session_destroy();
        out(array('ok' => true));

    case 'password':
        method_post();
        require_admin();
        $b = body();
        $cur = isset($b['current']) && is_string($b['current']) ? $b['current'] : '';
        $new = isset($b['new']) && is_string($b['new']) ? $b['new'] : '';
        if (!password_verify($cur, (string)setting('admin_hash'))) fail('Mevcut şifre hatalı.', 403);
        if (strlen($new) < 8) fail('Yeni şifre en az 8 karakter olmalı.');
        set_setting('admin_hash', password_hash($new, PASSWORD_DEFAULT));
        out(array('ok' => true));

    /* ── özet ── */
    case 'stats':
        require_admin(false);
        $r = q("SELECT
                SUM(status='geliyor') AS geliyor, SUM(status='gelmiyor') AS gelmiyor, SUM(status='belki') AS belki,
                COALESCE(SUM(CASE WHEN status='geliyor' THEN adults + children ELSE 0 END),0) AS kisi,
                COUNT(*) AS toplam FROM rsvp")->fetch();
        $m = q('SELECT COUNT(*) AS n, COALESCE(SUM(approved=0),0) AS bekleyen FROM memories')->fetch();
        $md = q("SELECT COUNT(*) AS n, COALESCE(SUM(kind='image'),0) AS foto, COALESCE(SUM(kind='video'),0) AS video,
                 COALESCE(SUM(approved=0),0) AS bekleyen, COALESCE(SUM(size),0) AS boyut FROM media")->fetch();
        $qz = q('SELECT COUNT(*) FROM quiz_scores')->fetchColumn();
        $free = function_exists('disk_free_space') ? @disk_free_space(EY_UPLOADS) : false;
        out(array('ok' => true,
            'rsvp' => array_map('intval', $r),
            'memories' => array_map('intval', $m),
            'media' => array_map('floatval', $md),
            'quiz' => (int)$qz,
            'disk_free' => $free === false ? null : (float)$free,
            'zip' => class_exists('ZipArchive'),
        ));

    /* ── katılım ── */
    case 'rsvp_list':
        require_admin(false);
        $rows = q('SELECT id, first_name, last_name, status, adults, children, created_at, updated_at FROM rsvp ORDER BY id DESC')->fetchAll();
        foreach ($rows as &$x) { $x['id'] = (int)$x['id']; $x['adults'] = (int)$x['adults']; $x['children'] = (int)$x['children']; }
        unset($x);
        out(array('ok' => true, 'items' => $rows));

    case 'rsvp_delete':
        method_post();
        require_admin();
        q('DELETE FROM rsvp WHERE id = ?', array(in_int('id', 0, PHP_INT_MAX)));
        out(array('ok' => true));

    case 'rsvp_csv':
        require_admin(false);
        $rows = q('SELECT first_name, last_name, status, adults, children, created_at, updated_at FROM rsvp ORDER BY last_name, first_name')->fetchAll();
        $label = array('geliyor' => 'Katılacak', 'gelmiyor' => 'Katılamayacak', 'belki' => 'Belirsiz');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="katilim-listesi-' . date('Y-m-d') . '.csv"');
        header('Cache-Control: no-store');
        $o = fopen('php://output', 'w');
        fwrite($o, "\xEF\xBB\xBF"); // Excel'de Türkçe karakterler için
        fputcsv($o, array('Ad', 'Soyad', 'Durum', 'Yetişkin', 'Çocuk', 'Toplam kişi', 'İlk yanıt', 'Son güncelleme'), ';');
        foreach ($rows as $r) {
            $total = $r['status'] === 'geliyor' ? (int)$r['adults'] + (int)$r['children'] : 0;
            $safe = array();
            foreach (array($r['first_name'], $r['last_name'], $label[$r['status']], $r['adults'], $r['children'], $total, $r['created_at'], $r['updated_at']) as $v) {
                $v = (string)$v;
                if ($v !== '' && strpos('=+-@', $v[0]) !== false) $v = "'" . $v; // Excel formül enjeksiyonuna karşı
                $safe[] = $v;
            }
            fputcsv($o, $safe, ';');
        }
        fclose($o);
        exit;

    /* ── anı defteri ── */
    case 'memories_list':
        require_admin(false);
        $items = array();
        foreach (q('SELECT * FROM memories ORDER BY approved ASC, id DESC')->fetchAll() as $r) $items[] = fmt_memory($r, '');
        out(array('ok' => true, 'items' => $items));

    case 'memory_set':
        method_post();
        require_admin();
        q('UPDATE memories SET approved = ? WHERE id = ?', array(in_int('approved', 0, 1), in_int('id', 0, PHP_INT_MAX)));
        out(array('ok' => true));

    case 'memory_delete':
        method_post();
        require_admin();
        $id = in_int('id', 0, PHP_INT_MAX);
        $r = q('SELECT image FROM memories WHERE id = ?', array($id))->fetch();
        if ($r) {
            q('DELETE FROM memories WHERE id = ?', array($id));
            delete_upload($r['image']);
        }
        out(array('ok' => true));

    /* ── albüm ── */
    case 'media_list':
        require_admin(false);
        $off = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
        $where = isset($_GET['filter']) && $_GET['filter'] === 'pending' ? 'WHERE approved = 0' : '';
        $rows = q('SELECT * FROM media ' . $where . ' ORDER BY id DESC LIMIT 61 OFFSET ' . $off)->fetchAll();
        $items = array();
        foreach (array_slice($rows, 0, 60) as $r) $items[] = fmt_media($r, '');
        out(array('ok' => true, 'items' => $items, 'more' => count($rows) > 60));

    case 'media_set':
        method_post();
        require_admin();
        q('UPDATE media SET approved = ? WHERE id = ?', array(in_int('approved', 0, 1), in_int('id', 0, PHP_INT_MAX)));
        out(array('ok' => true));

    case 'media_delete':
        method_post();
        require_admin();
        $id = in_int('id', 0, PHP_INT_MAX);
        $r = q('SELECT path, thumb FROM media WHERE id = ?', array($id))->fetch();
        if ($r) {
            q('DELETE FROM media WHERE id = ?', array($id));
            delete_upload($r['path']);
            if ($r['thumb'] !== $r['path']) delete_upload($r['thumb']);
        }
        out(array('ok' => true));

    case 'media_zip':
        require_admin(false);
        if (!class_exists('ZipArchive')) fail('Sunucuda ZIP desteği yok. Dosyaları cPanel Dosya Yöneticisi ile indirin.', 500);
        @set_time_limit(0);
        ensure_dir(EY_TMP);
        $kind = isset($_GET['kind']) && in_array($_GET['kind'], array('image', 'video'), true) ? $_GET['kind'] : '';
        $rows = $kind
            ? q('SELECT id, kind, path, uploader, created_at FROM media WHERE kind = ? ORDER BY id', array($kind))->fetchAll()
            : q('SELECT id, kind, path, uploader, created_at FROM media ORDER BY id')->fetchAll();
        if (!$rows) fail('Albümde henüz dosya yok.', 404);
        $zipPath = EY_TMP . '/album-' . bin2hex(random_bytes(6)) . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE) !== true) fail('ZIP dosyası oluşturulamadı.', 500);
        foreach ($rows as $r) {
            $src = EY_UPLOADS . '/' . $r['path'];
            if (!is_file($src)) continue;
            $ext = pathinfo($src, PATHINFO_EXTENSION);
            $folder = $r['kind'] === 'video' ? 'videolar' : 'fotograflar';
            $entry = $folder . '/' . str_replace(array(' ', ':'), array('_', '-'), $r['created_at']) . '_' . ascii_slug($r['uploader']) . '_' . $r['id'] . '.' . $ext;
            $zip->addFile($src, $entry);
            if (method_exists($zip, 'setCompressionName')) $zip->setCompressionName($entry, ZipArchive::CM_STORE);
        }
        $zip->close();
        while (ob_get_level()) ob_end_clean();
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="dugun-albumu' . ($kind ? '-' . $kind : '') . '-' . date('Y-m-d') . '.zip"');
        header('Content-Length: ' . filesize($zipPath));
        header('Cache-Control: no-store');
        readfile($zipPath);
        @unlink($zipPath);
        exit;

    /* ── quiz ── */
    case 'quiz_list':
        require_admin(false);
        $rows = q('SELECT id, name, score, total, created_at FROM quiz_scores ORDER BY score DESC, id ASC')->fetchAll();
        out(array('ok' => true, 'items' => $rows));

    case 'quiz_delete':
        method_post();
        require_admin();
        q('DELETE FROM quiz_scores WHERE id = ?', array(in_int('id', 0, PHP_INT_MAX)));
        out(array('ok' => true));

    case 'quiz_reset':
        method_post();
        require_admin();
        db()->exec('DELETE FROM quiz_scores');
        out(array('ok' => true));

    /* ── oyun soruları ── */
    case 'quiz_questions_list':
        require_admin(false);
        $rows = q('SELECT id, soru, siklar, dogru, sira FROM quiz_questions ORDER BY sira ASC, id ASC')->fetchAll();
        $items = array();
        foreach ($rows as $r) {
            $siklar = json_decode($r['siklar'], true);
            $items[] = array(
                'id' => (int)$r['id'], 'soru' => $r['soru'],
                'siklar' => is_array($siklar) ? array_values($siklar) : array(),
                'dogru' => (int)$r['dogru'], 'sira' => (int)$r['sira'],
            );
        }
        out(array('ok' => true, 'items' => $items));

    case 'quiz_question_save':
        method_post();
        require_admin();
        $b = body();
        $id = isset($b['id']) ? (int)$b['id'] : 0;
        $soru = in_str('soru', 300);
        $siklarIn = isset($b['siklar']) && is_array($b['siklar']) ? $b['siklar'] : array();
        $siklar = array();
        foreach ($siklarIn as $s) {
            $s = clean_text(is_scalar($s) ? $s : '', 120);
            if ($s !== '') $siklar[] = $s;
        }
        $dogru = isset($b['dogru']) && is_numeric($b['dogru']) ? (int)$b['dogru'] : -1;
        if ($soru === '') fail('Soru metnini yazın.');
        if (count($siklar) < 2 || count($siklar) > 6) fail('En az 2, en fazla 6 şık girin.');
        if ($dogru < 0 || $dogru >= count($siklar)) fail('Doğru şıkkı seçin.');
        $json = json_encode($siklar, JSON_UNESCAPED_UNICODE);
        if ($id > 0 && q('SELECT id FROM quiz_questions WHERE id = ?', array($id))->fetch()) {
            q('UPDATE quiz_questions SET soru=?, siklar=?, dogru=? WHERE id=?', array($soru, $json, $dogru, $id));
        } else {
            $maxSira = (int)q('SELECT COALESCE(MAX(sira),-1) FROM quiz_questions')->fetchColumn();
            q('INSERT INTO quiz_questions (soru, siklar, dogru, sira, created_at) VALUES (?,?,?,?,NOW())', array($soru, $json, $dogru, $maxSira + 1));
            $id = (int)db()->lastInsertId();
        }
        out(array('ok' => true, 'id' => $id));

    case 'quiz_question_delete':
        method_post();
        require_admin();
        q('DELETE FROM quiz_questions WHERE id = ?', array(in_int('id', 0, PHP_INT_MAX)));
        out(array('ok' => true));

    case 'quiz_question_move':
        method_post();
        require_admin();
        $id = in_int('id', 0, PHP_INT_MAX);
        $dir = in_str('dir', 4);
        $rows = q('SELECT id, sira FROM quiz_questions ORDER BY sira ASC, id ASC')->fetchAll();
        $idx = null;
        foreach ($rows as $i => $r) if ((int)$r['id'] === $id) { $idx = $i; break; }
        if ($idx === null) fail('Soru bulunamadı.', 404);
        $swapWith = $dir === 'up' ? $idx - 1 : $idx + 1;
        if ($swapWith < 0 || $swapWith >= count($rows)) out(array('ok' => true));
        $a = $rows[$idx]; $b2 = $rows[$swapWith];
        q('UPDATE quiz_questions SET sira = ? WHERE id = ?', array($b2['sira'], $a['id']));
        q('UPDATE quiz_questions SET sira = ? WHERE id = ?', array($a['sira'], $b2['id']));
        out(array('ok' => true));

    /* ── ayarlar ── */
    case 'settings':
        require_admin(false);
        $s = settings();
        $o = array();
        foreach (array('rsvp_open', 'memories_open', 'uploads_open', 'oyun_open', 'auto_wedding_day', 'auto_approve') as $k) $o[$k] = (isset($s[$k]) ? $s[$k] : '0') === '1';
        $o['wedding_day_reached'] = wedding_day_reached();
        out(array('ok' => true, 'settings' => $o));

    case 'settings_set':
        method_post();
        require_admin();
        $k = in_str('key', 40);
        if (!in_array($k, array('rsvp_open', 'memories_open', 'uploads_open', 'oyun_open', 'auto_wedding_day', 'auto_approve'), true)) fail('Geçersiz ayar.');
        set_setting($k, in_int('value', 0, 1));
        out(array('ok' => true));

    default:
        fail('Bilinmeyen işlem.', 404);
}
