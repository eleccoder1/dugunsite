<?php
/*
 * Parçalı dosya yükleme.
 * Büyük videolar küçük parçalar halinde gönderilir; böylece hosting'in
 * "upload_max_filesize" sınırına takılmaz ve bağlantı koparsa kaldığı yerden devam eder.
 */
define('EY_APP', 1);
require __DIR__ . '/lib.php';
require_installed();
@set_time_limit(300);

$a = isset($_GET['a']) ? (string)$_GET['a'] : '';
$MAX = (int)cfg('max_upload_mb', 500) * 1048576;

function up_paths($id)
{
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) fail('Geçersiz yükleme kimliği.');
    return array(EY_TMP . '/' . $id . '.part', EY_TMP . '/' . $id . '.json');
}

function up_meta($metaPath, $gh)
{
    if (!is_file($metaPath)) return null;
    $m = json_decode((string)file_get_contents($metaPath), true);
    if (!is_array($m) || !isset($m['token']) || !hash_equals($m['token'], $gh)) fail('Bu yükleme size ait değil.', 403);
    return $m;
}

function cleanup_tmp()
{
    $files = glob(EY_TMP . '/*');
    if (!$files) return;
    foreach ($files as $f) {
        if (preg_match('/\.(part|json|zip)$/', $f) && is_file($f) && filemtime($f) < time() - 86400) @unlink($f);
    }
}

/* Dosya türünü içeriğine bakarak belirle */
function detect_type($path, $origName)
{
    $allowed = array(
        'image/jpeg' => 'jpg', 'image/pjpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
        'image/heic' => 'heic', 'image/heif' => 'heif', 'image/heic-sequence' => 'heic',
        'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/x-m4v' => 'm4v', 'video/webm' => 'webm',
        'video/3gpp' => '3gp', 'video/3gpp2' => '3gp', 'video/x-matroska' => 'webm',
    );
    $mime = '';
    if (class_exists('finfo')) {
        $fi = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string)$fi->file($path);
    } elseif (function_exists('mime_content_type')) {
        $mime = (string)mime_content_type($path);
    }
    if (isset($allowed[$mime])) return array($mime, $allowed[$mime]);

    // Yedek yöntem: dosya imzası
    $fh = fopen($path, 'rb');
    $head = $fh ? fread($fh, 16) : '';
    if ($fh) fclose($fh);
    if (strlen($head) < 12) return null;
    if (substr($head, 0, 3) === "\xFF\xD8\xFF") return array('image/jpeg', 'jpg');
    if (substr($head, 0, 8) === "\x89PNG\r\n\x1a\n") return array('image/png', 'png');
    if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') return array('image/webp', 'webp');
    if (substr($head, 0, 4) === "\x1A\x45\xDF\xA3") return array('video/webm', 'webm');
    if (substr($head, 4, 4) === 'ftyp') {
        $brand = strtolower(substr($head, 8, 4));
        if (in_array($brand, array('heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'), true)) return array('image/heic', 'heic');
        if ($brand === 'qt  ') return array('video/quicktime', 'mov');
        if (strpos($brand, '3gp') === 0 || strpos($brand, '3g2') === 0) return array('video/3gpp', '3gp');
        if ($brand === 'm4v ') return array('video/x-m4v', 'm4v');
        return array('video/mp4', 'mp4');
    }
    // Eski iPhone .mov dosyaları "ftyp" ile başlamayabilir
    if (preg_match('/\.mov$/i', $origName) && in_array(substr($head, 4, 4), array('wide', 'mdat', 'moov', 'free', 'skip'), true)) {
        return array('video/quicktime', 'mov');
    }
    return null;
}

switch ($a) {

    case 'chunk':
        method_post();
        if (!flag('uploads_open')) fail('Albüme yükleme şu an kapalı.', 403);
        $gh = guest_hash();
        list($part, $metaPath) = up_paths(isset($_GET['id']) ? (string)$_GET['id'] : '');
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : -1;
        $total = isset($_GET['total']) ? (int)$_GET['total'] : 0;
        if ($total <= 0) fail('Dosya boş görünüyor.');
        if ($total > $MAX) fail('Dosya çok büyük. En fazla ' . (int)cfg('max_upload_mb') . ' MB yükleyebilirsiniz.', 413);

        ensure_dir(EY_UPLOADS . '/album');
        ensure_dir(EY_TMP);

        $meta = up_meta($metaPath, $gh);
        if ($meta === null) {
            if ($offset !== 0) fail('Yükleme bulunamadı, baştan başlayın.', 409, array('expected' => 0));
            rate_limit('upload', 3000, 3600); // düğün salonunda herkes aynı internet adresini paylaşabilir
            cleanup_tmp();
            $meta = array('token' => $gh, 'total' => $total, 'created' => time());
            file_put_contents($metaPath, json_encode($meta));
            file_put_contents($part, '');
        }
        if ((int)$meta['total'] !== $total) fail('Dosya boyutu değişmiş, baştan başlayın.', 409);

        clearstatcache(true, $part);
        $current = is_file($part) ? filesize($part) : 0;
        if ($offset !== $current) out(array('ok' => false, 'error' => 'Parça sırası kaydı.', 'expected' => $current), 409);

        $in = fopen('php://input', 'rb');
        $fo = fopen($part, 'ab');
        if (!$in || !$fo) fail('Geçici dosya açılamadı.', 500);
        flock($fo, LOCK_EX);
        $written = stream_copy_to_stream($in, $fo, $total - $current + 1);
        fflush($fo);
        flock($fo, LOCK_UN);
        fclose($fo);
        fclose($in);

        clearstatcache(true, $part);
        $now = filesize($part);
        if ($now > $total || $written === false) {
            @unlink($part);
            @unlink($metaPath);
            fail('Yükleme bozuldu, baştan deneyin.', 400);
        }
        out(array('ok' => true, 'received' => $now));

    case 'status':
        $gh = guest_hash();
        list($part, $metaPath) = up_paths(isset($_GET['id']) ? (string)$_GET['id'] : '');
        $meta = up_meta($metaPath, $gh);
        clearstatcache(true, $part);
        out(array('ok' => true, 'received' => ($meta && is_file($part)) ? filesize($part) : 0));

    case 'finish':
        method_post();
        if (!flag('uploads_open')) fail('Albüme yükleme şu an kapalı.', 403);
        $gh = guest_hash();
        $b = body();
        list($part, $metaPath) = up_paths(isset($b['id']) ? (string)$b['id'] : '');
        $meta = up_meta($metaPath, $gh);
        if ($meta === null) fail('Yükleme bulunamadı, tekrar deneyin.', 404);
        clearstatcache(true, $part);
        $size = is_file($part) ? filesize($part) : -1;
        if ($size !== (int)$meta['total']) fail('Dosyanın tamamı ulaşmadı, tekrar deneyin.', 409);

        $orig = in_str('name', 200);
        $uploader = in_str('uploader', 80);
        if ($uploader === '') $uploader = 'Misafir';

        $type = detect_type($part, $orig);
        if ($type === null) {
            @unlink($part);
            @unlink($metaPath);
            fail('Bu dosya türü desteklenmiyor. Fotoğraf (JPG, PNG, HEIC) veya video (MP4, MOV) yükleyin.', 415);
        }
        list($mime, $ext) = $type;
        $kind = strpos($mime, 'video/') === 0 ? 'video' : 'image';

        $rel = 'album/' . date('Y-m');
        ensure_dir(EY_UPLOADS . '/' . $rel);
        $fname = rand_name($ext);
        if (!@rename($part, EY_UPLOADS . '/' . $rel . '/' . $fname)) fail('Dosya kaydedilemedi. Sunucu disk alanını kontrol edin.', 500);
        @chmod(EY_UPLOADS . '/' . $rel . '/' . $fname, 0644);
        @unlink($metaPath);
        $path = $rel . '/' . $fname;

        $thumb = isset($b['thumb']) ? save_jpeg_dataurl($b['thumb'], 'album', 700 * 1024, '_k') : null;
        if ($thumb === null && $kind === 'image' && in_array($ext, array('jpg', 'png', 'webp', 'gif'), true)) {
            $thumb = $path; // küçük resim üretilemediyse orijinali kullan
        }

        $approved = flag('auto_approve') ? 1 : 0;
        q('INSERT INTO media (kind, path, thumb, original_name, mime, size, uploader, approved, token_hash, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
            array($kind, $path, $thumb, $orig, $mime, $size, $uploader, $approved, $gh, ip_hash()));
        $r = q('SELECT * FROM media WHERE id = ?', array(db()->lastInsertId()))->fetch();
        out(array('ok' => true, 'item' => fmt_media($r, $gh)));

    default:
        fail('Bilinmeyen işlem.', 404);
}
