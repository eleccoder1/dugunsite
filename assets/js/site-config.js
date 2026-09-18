/*
 * ─────────────────────────────────────────────────────────────
 *  SİTE İÇERİĞİ — Metinleri buradan değiştirebilirsiniz.
 *  Tırnak işaretlerini (" ") ve virgülleri silmemeye dikkat edin.
 * ─────────────────────────────────────────────────────────────
 */
window.SITE = {
  gelin: "Elif",
  damat: "Yusuf Çağrı",
  monogram: ["E", "Y"],

  // Düğün saati (Türkiye saati, +03:00 kalsın)
  tarihISO: "2026-11-01T19:00:00+03:00",
  tarihYazi: "1 KASIM 2026",
  gunYazi: "PAZAR",
  saatYazi: "19:00",

  davetBaslik: ["DÜĞÜN TÖRENİMİZE", "DAVETLİSİNİZ"],
  aileler: ["AKAY VE KÜÇÜK", "AİLELERİ"],
  aileDetay: [
    { isimler: "Nurten & Recep", soyad: "Akay" },
    { isimler: "Ayşegül & Muhammet", soyad: "Küçük" }
  ],

  mekan: {
    ad: "Lebiderya Düğün Salonu",
    sehir: "İZMİT / KOCAELİ",
    adres: "Fatih Mahallesi, Barış Cd. No:82, 41100 İzmit/Kocaeli",
    harita: "https://maps.app.goo.gl/1L7VUSnk4zu8WszP6?g_st=ic",
    web: "https://lebideryaizmit.com"
  },

  program: [
    { saat: "17:00", baslik: "Gelin alma", aciklama: "Araçlar erkek evinden hareket eder" },
    { saat: "19:00", baslik: "Karşılama", aciklama: "" },
    { saat: "20:00", baslik: "Nikâh töreni", aciklama: "" }
  ],

  davetMesaji: "Bu özel günümüzde sizleri de aramızda görmekten mutluluk duyarız.",

  // Quiz: "dogru" = doğru şıkkın sırası (0'dan başlar)
  quiz: [
    { soru: "İlk tanıştıkları yer neresi?", siklar: ["Okul", "Kafe", "Yıldız ailesi aracılığıyla :)", "İş yeri"], dogru: 2 },
    { soru: "“Nereye gidelim?” sorusuna 47 seçenek sunan kim?", siklar: ["Elif", "Yusuf Çağrı", "İkisi de"], dogru: 1 },
    { soru: "Acıkınca karakteri değişen kim?", siklar: ["Elif", "Yusuf Çağrı", "İkisi de"], dogru: 0 },
    { soru: "“Sadece bakacağız” deyip en çok alışveriş yapan kim?", siklar: ["Elif", "Yusuf Çağrı", "İkisi de"], dogru: 2 },
    { soru: "Yusuf'un Elif'e en sık söylediği cümle hangisi?", siklar: ["Ne kadar sürer?", "Nereye gidiyoruz?", "Sen bilirsin", "Ben hallederim"], dogru: 3 }
  ]
};
