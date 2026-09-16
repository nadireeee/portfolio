# Nadire Yöndem — Portföy Sitesi

Gerçek, linkle paylaşılabilir kişisel portföy. Kaynak kod private; ekran görüntüleri + teknik özet public.

## Yerelde aç

1. Klasöre gir: `C:\Users\nadire\Desktop\nadire-portfolio`
2. `index.html` dosyasına çift tıkla **veya**
3. PowerShell:

```powershell
cd C:\Users\nadire\Desktop\nadire-portfolio
Start-Process index.html
```

> Not: Bazı tarayıcılarda `file://` ile `manifest.json` engellenebilir. O zaman:

```powershell
cd C:\Users\nadire\Desktop\nadire-portfolio
npx --yes serve .
```

Tarayıcıda çıkan `http://localhost:3000` adresini aç.

## GitHub Pages ile public link (CV’ye bunu koy)

1. GitHub’da yeni **public** repo oluştur: örn. `nadireeee/portfolio`
2. Terminal:

```powershell
cd C:\Users\nadire\Desktop\nadire-portfolio
git init
git add .
git commit -m "Personal portfolio site with project screenshots"
git branch -M main
git remote add origin https://github.com/nadireeee/portfolio.git
git push -u origin main
```

3. GitHub → repo → **Settings → Pages**
4. Source: **Deploy from a branch** → `main` → `/ (root)` → Save
5. 1–2 dk sonra link:

```
https://nadireeee.github.io/portfolio/
```

## CV’ye yazılacak satır

```
Portföy: https://nadireeee.github.io/portfolio/
GitHub: https://github.com/nadireeee  (müşteri kodları NDA nedeniyle private)
```

## İçerik

| Klasör | Proje | Screenshot |
|--------|--------|------------|
| assets/depo-a | Offline depo mobil A | 27 |
| assets/depo-b | Offline depo mobil B | ~57 |
| assets/depo-c | Offline depo mobil C | 27 |
| assets/ecod | EDI → DIA sipariş | 10 |
| assets/fatura | Havuz fatura paneli | 36 |

dib-mobil ve web için henüz screenshot yok; metin kartları sitede duruyor.

## Güvenlik

- API key / şifre / DIA URL yok
- Screenshot’larda gerçek cari/kişisel veri varsa yayın öncesi maskele
- Müşteri kaynak kodunu bu repoya koyma
