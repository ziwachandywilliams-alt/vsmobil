## VSMobil (Next.js)

Bu proje Next.js tabanli bir web uygulamasidir.

### Calistirma

```bash
npm install --no-audit --no-fund
npm run dev
```

Tarayicida: `http://localhost:3000`

### NPM kurulumunda sertifika/proxy hatasi (SELF_SIGNED_CERT_IN_CHAIN)

Kurumsal aglarda `npm install` su hata ile takilabilir:

- `SELF_SIGNED_CERT_IN_CHAIN`

En dogru cozum: kurum sertifikasini NPM'e tanitmak.

1) Kurum sertifika dosyanizi (ornegin `corp-ca.pem`) bir klasore koyun  
2) Sonra:

```bash
npm config set cafile "C:\\path\\to\\corp-ca.pem"
```

Gecici cozum (onerilmez, guvenlik dusurur):

```bash
npm config set strict-ssl false
```

