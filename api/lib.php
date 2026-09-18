<?php
/* Ortak fonksiyonlar — doğrudan erişilemez */
if (!defined('EY_APP')) { http_response_code(403); exit; }

error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('Europe/Istanbul');

define('EY_ROOT', dirname(__DIR__));
define('EY_UPLOADS', EY_ROOT . '/uploads');
define('EY_TMP', EY_UPLOADS . '/.tmp');
define('EY_LOCK', __DIR__ . '/.kurulum-tamam');

$GLOBALS['EY_CFG'] = require __DIR__ . '/config.php';

function cfg($k, $d = null)
{
    return array_key_exists($k, $GLOBALS['EY_CFG']) ? $GLOBALS['EY_CFG'][$k] : $d;
}

/* ─── JSON yanıtları ─── */
function out($data, $code = 200)
{
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($msg, $code = 400, $extra = array())
{
    out(array_merge(array('ok' => false, 'error' => $msg), $extra), $code);
}

set_exception_handler(function ($e) {
    error_log('[dugun] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if ($e instanceof PDOException) {
        fail('Veritabanına bağlanılamadı. Yönetici ayarları kontrol etmeli.', 500);
    }
    fail('Sunucuda beklenmeyen bir hata oluştu.', 500);
});

function installed()
{
    return is_file(EY_LOCK);
}

function require_installed()
{
    if (!installed()) fail('Site henüz kurulmadı. Yönetici api/kurulum.php sayfasını açmalı.', 503);
}

/* ─── veritabanı ─── */
function db()
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . cfg('db_host') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
        $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ));
        $pdo->exec("SET time_zone = '+03:00'");
    }
    return $pdo;
}

function q($sql, $params = array())
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

/* ─── giriş verisi ─── */
function body()
{
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = json_decode($raw, true);
        if (!is_array($b)) $b = array();
    }
    return $b;
}

function clean_text($v, $max, $multiline = false)
{
    $v = is_scalar($v) ? (string)$v : '';
    if (function_exists('mb_check_encoding') && !mb_check_encoding($v, 'UTF-8')) return '';
    $pattern = $multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u';
    $c = preg_replace($pattern, '', $v);
    if ($c === null) return '';
    $c = trim($c);
    if ($multiline) $c = preg_replace("/\n{4,}/", "\n\n\n", str_replace("\r", '', $c));
    if (function_exists('mb_substr')) return mb_substr($c, 0, $max, 'UTF-8');
    return substr($c, 0, $max);
}

function in_str($k, $max, $multiline = false)
{
    $b = body();
    return clean_text(isset($b[$k]) ? $b[$k] : '', $max, $multiline);
}

function in_int($k, $min, $max, $def = 0)
{
    $b = body();
    $v = isset($b[$k]) && is_numeric($b[$k]) ? (int)$b[$k] : $def;
    return max($min, min($max, $v));
}

function method_post()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Geçersiz istek.', 405);
}

/* ─── kimlikler ─── */
function ip_hash()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
    return hash('sha256', $ip . '|' . cfg('secret'));
}

function guest_hash($required = true)
{
    $t = isset($_SERVER['HTTP_X_GUEST_TOKEN']) ? $_SERVER['HTTP_X_GUEST_TOKEN'] : '';
    if (!preg_match('/^[a-f0-9]{32,64}$/', $t)) {
        if ($required) fail('Tarayıcı kimliği eksik. Sayfayı yenileyip tekrar deneyin.', 400);
        return '';
    }
    return hash('sha256', $t);
}

function rand_name($ext)
{
    return bin2hex(random_bytes(12)) . '.' . $ext;
}

/* ─── hız sınırı ─── */
function rate_limit($bucket, $max, $window)
{
    $k = $bucket . ':' . ip_hash();
    $now = time();
    if (mt_rand(1, 40) === 1) q('DELETE FROM rate_limits WHERE ts < ?', array($now - 86400));
    $n = (int)q('SELECT COUNT(*) FROM rate_limits WHERE k = ? AND ts > ?', array($k, $now - $window))->fetchColumn();
    if ($n >= $max) fail('Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.', 429);
    q('INSERT INTO rate_limits (k, ts) VALUES (?, ?)', array($k, $now));
}

/* ─── ayarlar ─── */
function settings()
{
    static $s = null;
    if ($s === null) {
        $s = array('rsvp_open' => '1', 'memories_open' => '1', 'uploads_open' => '1', 'auto_approve' => '1');
        foreach (q('SELECT k, v FROM settings')->fetchAll() as $r) $s[$r['k']] = $r['v'];
    }
    return $s;
}

function setting($k)
{
    $s = settings();
    return isset($s[$k]) ? $s[$k] : null;
}

function flag($k)
{
    return setting($k) === '1';
}

/* düğün gününden itibaren mi? (yerel saat, config.php > wedding_date) */
function wedding_day_reached()
{
    return date('Y-m-d') >= (string)cfg('wedding_date');
}

/* bölüm açık mı? manuel anahtar açıksa, veya "düğün günü otomatik aç" açık ve gün gelmişse */
function section_open($k)
{
    return flag($k) || (flag('auto_wedding_day') && wedding_day_reached());
}

function set_setting($k, $v)
{
    q('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', array($k, (string)$v));
}

/* ─── dosyalar ─── */
function base_url()
{
    $dir = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'])));
    return rtrim($dir, '/');
}

function file_url($rel)
{
    return $rel ? base_url() . '/uploads/' . $rel : null;
}

function ensure_dir($dir)
{
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        fail('Yükleme klasörü oluşturulamadı. uploads klasörünün izinlerini kontrol edin (755).', 500);
    }
    if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
}

function delete_upload($rel)
{
    if (!$rel || strpos($rel, '..') !== false) return;
    $p = EY_UPLOADS . '/' . $rel;
    if (is_file($p)) @unlink($p);
}

/* data:image/jpeg;base64,... → kaydet; göreli yolu döndür */
function save_jpeg_dataurl($data, $subdir, $maxBytes, $suffix = '')
{
    if (!is_string($data) || strpos($data, 'data:image/jpeg;base64,') !== 0) return null;
    $bin = base64_decode(substr($data, 23), true);
    if ($bin === false || strlen($bin) < 100 || strlen($bin) > $maxBytes) return null;
    $info = @getimagesizefromstring($bin);
    if (!$info || $info[2] !== IMAGETYPE_JPEG) return null;
    $rel = $subdir . '/' . date('Y-m');
    ensure_dir(EY_UPLOADS . '/' . $rel);
    $name = bin2hex(random_bytes(12)) . $suffix . '.jpg';
    if (file_put_contents(EY_UPLOADS . '/' . $rel . '/' . $name, $bin) === false) return null;
    @chmod(EY_UPLOADS . '/' . $rel . '/' . $name, 0644);
    return $rel . '/' . $name;
}

/* ─── satır biçimlendirme ─── */
function fmt_memory($r, $gh)
{
    return array(
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'message' => $r['message'],
        'image' => file_url($r['image']),
        'approved' => (bool)$r['approved'],
        'private' => (bool)$r['private'],
        'created_at' => $r['created_at'],
        'mine' => $gh !== '' && hash_equals($r['token_hash'], $gh),
    );
}

function fmt_media($r, $gh)
{
    return array(
        'id' => (int)$r['id'],
        'kind' => $r['kind'],
        'url' => file_url($r['path']),
        'thumb' => file_url($r['thumb']),
        'original_name' => $r['original_name'],
        'size' => (int)$r['size'],
        'uploader' => $r['uploader'],
        'approved' => (bool)$r['approved'],
        'private' => (bool)$r['private'],
        'created_at' => $r['created_at'],
        'mine' => $gh !== '' && hash_equals($r['token_hash'], $gh),
    );
}

/* ─── yönetici oturumu ─── */
function admin_session()
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('EYADMIN');
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params(array('lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax'));
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', '', $secure, true);
    }
    session_start();
}

function require_admin($csrf = true)
{
    admin_session();
    if (empty($_SESSION['admin'])) fail('Oturumunuz kapandı. Tekrar giriş yapın.', 401);
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > 6 * 3600) {
        $_SESSION = array();
        session_destroy();
        fail('Oturumunuz kapandı. Tekrar giriş yapın.', 401);
    }
    $_SESSION['last'] = time();
    if ($csrf) {
        $h = isset($_SERVER['HTTP_X_CSRF']) ? $_SERVER['HTTP_X_CSRF'] : '';
        if (empty($_SESSION['csrf']) || !is_string($h) || !hash_equals($_SESSION['csrf'], $h)) {
            fail('Güvenlik doğrulaması başarısız. Sayfayı yenileyin.', 403);
        }
    }
}

function ascii_slug($s)
{
    $map = array('ç' => 'c', 'Ç' => 'C', 'ğ' => 'g', 'Ğ' => 'G', 'ı' => 'i', 'İ' => 'I', 'ö' => 'o', 'Ö' => 'O', 'ş' => 's', 'Ş' => 'S', 'ü' => 'u', 'Ü' => 'U');
    $s = strtr($s, $map);
    $s = preg_replace('/[^A-Za-z0-9]+/', '-', $s);
    $s = trim((string)$s, '-');
    return $s !== '' ? substr($s, 0, 40) : 'misafir';
}
