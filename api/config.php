<?php
/*
 * ─────────────────────────────────────────────────────────────
 *  SUNUCU AYARLARI
 *  cPanel > MySQL Veritabanları bölümünde oluşturduğunuz
 *  veritabanı bilgilerini aşağıya yazın.
 * ─────────────────────────────────────────────────────────────
 */
if (!defined('EY_APP')) { http_response_code(403); exit; }

return array(
    // cPanel veritabanı adları genelde "cpanelkullanici_dugun" biçimindedir
    'db_host' => '127.0.0.1',
    'db_name' => 'dugun',
    'db_user' => 'dugun_user',
    'db_pass' => 'DugunSifre2026!',

    // Kurulum anahtarı: en az 20 karakterlik, size özel rastgele bir metin yazın.
    // kurulum.php sayfasında bu anahtar sorulur; başkası kurulumu yapamaz.
    'secret'  => 'YEREL-TEST-KURULUM-ANAHTARI-2026',

    // Albüme yüklenebilecek tek dosyanın en büyük boyutu (MB)
    'max_upload_mb' => 500,

    // Yükleme parça boyutu (MB). Yükleme hatası alırsanız 2 yapın.
    'chunk_mb' => 4,

    // Anı defterine eklenen fotoğrafın en büyük boyutu (MB)
    'memory_photo_mb' => 6,

    // Düğün tarihi (YYYY-AA-GG). Anı defteri, albüm ve oyun "düğün günü otomatik aç"
    // ayarı açıkken bu tarihten itibaren kendiliğinden açılır. assets/js/site-config.js
    // içindeki tarihISO ile aynı günü göstermeye dikkat edin.
    'wedding_date' => '2026-11-01',
);
