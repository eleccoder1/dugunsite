<?php
/*
 * TEK SEFERLİK KURULUM
 * Tarayıcıda https://elifyusufcagri.com/api/kurulum.php adresini açın.
 * Kurulum bitince bu dosyayı silin.
 */
define('EY_APP', 1);
require __DIR__ . '/lib.php';
restore_exception_handler();

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$checks = array();
$checks[] = array('PHP sürümü 7.2 veya üstü (şu an ' . PHP_VERSION . ')', version_compare(PHP_VERSION, '7.2.0', '>='));
$checks[] = array('PDO MySQL eklentisi', extension_loaded('pdo_mysql'));
$checks[] = array('Fileinfo eklentisi (dosya türü tespiti, önerilir)', class_exists('finfo'), true);
$checks[] = array('Zip eklentisi (albümü toplu indirme, önerilir)', class_exists('ZipArchive'), true);
$checks[] = array('uploads klasörü yazılabilir', is_dir(EY_UPLOADS) && is_writable(EY_UPLOADS));
$checks[] = array('config.php içinde veritabanı şifresi girildi', cfg('db_pass') !== 'VERITABANI_SIFRESI' && cfg('db_pass') !== '');
$checks[] = array('config.php içinde kurulum anahtarı değiştirildi', strlen((string)cfg('secret')) >= 20 && strpos((string)cfg('secret'), 'BURAYA') !== 0);

$dbOk = false; $dbErr = '';
try { db(); $dbOk = true; } catch (Exception $e) { $dbErr = $e->getMessage(); }
$checks[] = array('Veritabanı bağlantısı', $dbOk);

$blocking = false;
foreach ($checks as $c) if (!$c[1] && empty($c[2])) $blocking = true;

$msg = ''; $ok = false;
if (installed()) {
    $msg = 'Kurulum daha önce tamamlanmış. Güvenlik için bu dosyayı (api/kurulum.php) sunucudan silin.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && !$blocking) {
    $key = isset($_POST['key']) ? (string)$_POST['key'] : '';
    $p1 = isset($_POST['p1']) ? (string)$_POST['p1'] : '';
    $p2 = isset($_POST['p2']) ? (string)$_POST['p2'] : '';
    if (!hash_equals((string)cfg('secret'), $key)) {
        $msg = 'Kurulum anahtarı config.php dosyasındakiyle aynı değil.';
    } elseif (strlen($p1) < 8) {
        $msg = 'Yönetici şifresi en az 8 karakter olmalı.';
    } elseif ($p1 !== $p2) {
        $msg = 'Şifreler birbiriyle aynı değil.';
    } else {
        $sql = array(
            "CREATE TABLE IF NOT EXISTS settings (
                k VARCHAR(64) NOT NULL PRIMARY KEY,
                v TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS rsvp (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(80) NOT NULL,
                last_name VARCHAR(80) NOT NULL,
                status VARCHAR(10) NOT NULL,
                guests TINYINT UNSIGNED NOT NULL DEFAULT 0,
                phone VARCHAR(30) NOT NULL DEFAULT '',
                note VARCHAR(500) NOT NULL DEFAULT '',
                token_hash CHAR(64) NOT NULL,
                ip_hash CHAR(64) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                KEY idx_token (token_hash)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS memories (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(80) NOT NULL,
                message TEXT NOT NULL,
                image VARCHAR(255) NULL,
                approved TINYINT(1) NOT NULL DEFAULT 1,
                token_hash CHAR(64) NOT NULL,
                ip_hash CHAR(64) NOT NULL,
                created_at DATETIME NOT NULL,
                KEY idx_approved (approved, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS media (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                kind VARCHAR(5) NOT NULL,
                path VARCHAR(255) NOT NULL,
                thumb VARCHAR(255) NULL,
                original_name VARCHAR(200) NOT NULL DEFAULT '',
                mime VARCHAR(60) NOT NULL,
                size BIGINT UNSIGNED NOT NULL,
                uploader VARCHAR(80) NOT NULL,
                approved TINYINT(1) NOT NULL DEFAULT 1,
                token_hash CHAR(64) NOT NULL,
                ip_hash CHAR(64) NOT NULL,
                created_at DATETIME NOT NULL,
                KEY idx_approved (approved, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS quiz_scores (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(60) NOT NULL,
                score TINYINT UNSIGNED NOT NULL,
                total TINYINT UNSIGNED NOT NULL,
                ip_hash CHAR(64) NOT NULL,
                created_at DATETIME NOT NULL,
                KEY idx_score (score, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS rate_limits (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                k VARCHAR(100) NOT NULL,
                ts INT UNSIGNED NOT NULL,
                KEY idx_k (k, ts)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        );
        try {
            foreach ($sql as $s) db()->exec($s);
            foreach (array('rsvp_open' => '1', 'memories_open' => '1', 'uploads_open' => '1', 'auto_approve' => '1') as $k => $v) {
                q('INSERT IGNORE INTO settings (k, v) VALUES (?, ?)', array($k, $v));
            }
            set_setting('admin_hash', password_hash($p1, PASSWORD_DEFAULT));
            foreach (array('album', 'anilar', '.tmp') as $d) {
                if (!is_dir(EY_UPLOADS . '/' . $d)) @mkdir(EY_UPLOADS . '/' . $d, 0755, true);
            }
            if (file_put_contents(EY_LOCK, date('c')) === false) throw new Exception('api klasörüne yazılamadı (izinleri 755 yapın).');
            $ok = true;
            $msg = 'Kurulum tamamlandı.';
        } catch (Exception $e) {
            $msg = 'Kurulum sırasında hata: ' . $e->getMessage();
        }
    }
}
?><!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Kurulum</title>
<style>
body{font-family:Georgia,serif;background:#FAF8F4;color:#221E1B;max-width:620px;margin:0 auto;padding:40px 20px;font-size:18px;line-height:1.55}
h1{font-weight:400;font-style:italic}
ul{list-style:none;padding:0}li{padding:8px 0;border-bottom:1px solid #E2DCD2;display:flex;justify-content:space-between;gap:12px}
.y{color:#4E7A4A}.n{color:#9E3F36}.w{color:#9A7A2E}
label{display:block;margin:14px 0 4px}input{width:100%;padding:12px;font:inherit;border:1px solid #E2DCD2;box-sizing:border-box}
button{margin-top:20px;padding:14px 28px;background:#221E1B;color:#fff;border:0;font:inherit;cursor:pointer}
.msg{padding:14px;background:#fff;border:1px solid #E2DCD2;margin:20px 0}
code{background:#fff;padding:2px 6px;border:1px solid #E2DCD2;word-break:break-all}
</style></head><body>
<h1>Düğün sitesi kurulumu</h1>
<ul>
<?php foreach ($checks as $c): ?>
<li><span><?= h($c[0]) ?></span><?= $c[1] ? '<b class="y">Tamam</b>' : (!empty($c[2]) ? '<b class="w">Yok (isteğe bağlı)</b>' : '<b class="n">Eksik</b>') ?></li>
<?php endforeach; ?>
</ul>
<?php if (!$dbOk): ?><p class="n">Veritabanı hatası: <?= h($dbErr) ?><br>api/config.php içindeki bilgileri ve cPanel'de kullanıcının veritabanına "Tüm Yetkiler" ile eklendiğini kontrol edin.</p><?php endif; ?>
<?php if ($msg): ?><div class="msg <?= $ok ? 'y' : '' ?>"><?= h($msg) ?></div><?php endif; ?>

<?php if ($ok): ?>
  <p>Şimdi yapmanız gerekenler:</p>
  <p>1. cPanel Dosya Yöneticisi'nden <code>public_html/api/kurulum.php</code> dosyasını <b>silin</b>.</p>
  <p>2. Yönetim paneline girin: <a href="../yonetim/">../yonetim/</a></p>
<?php elseif (!installed()): ?>
  <?php if ($blocking): ?>
    <p class="n">Yukarıdaki eksikler giderilmeden kurulum yapılamaz. Düzelttikten sonra sayfayı yenileyin.</p>
  <?php else: ?>
  <form method="post" autocomplete="off">
    <label for="key">Kurulum anahtarı (config.php içindeki "secret")</label>
    <input id="key" name="key" type="password" required>
    <label for="p1">Yönetim paneli şifresi (en az 8 karakter)</label>
    <input id="p1" name="p1" type="password" minlength="8" required>
    <label for="p2">Şifre tekrar</label>
    <input id="p2" name="p2" type="password" minlength="8" required>
    <button type="submit">Kurulumu tamamla</button>
  </form>
  <?php endif; ?>
<?php endif; ?>
</body></html>
