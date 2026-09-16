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
    'db_host' => 'localhost',
    'db_name' => 'CPANELKULLANICI_dugun',
    'db_user' => 'CPANELKULLANICI_dugun',
    'db_pass' => 'VERITABANI_SIFRESI',

    // Kurulum anahtarı: en az 20 karakterlik, size özel rastgele bir metin yazın.
    // kurulum.php sayfasında bu anahtar sorulur; başkası kurulumu yapamaz.
    'secret'  => 'BURAYA-EN-AZ-20-KARAKTERLIK-RASTGELE-BIR-METIN',

    // Albüme yüklenebilecek tek dosyanın en büyük boyutu (MB)
    'max_upload_mb' => 500,

    // Yükleme parça boyutu (MB). Yükleme hatası alırsanız 2 yapın.
    'chunk_mb' => 4,

    // Anı defterine eklenen fotoğrafın en büyük boyutu (MB)
    'memory_photo_mb' => 6,
);
