## Kurulum / Calistirma (Windows)

### 1) Node.js

- Node.js kurulu olmali.
- Kontrol:

```bash
node -v
npm -v
```

### 2) Paketleri kur

```bash
npm install --no-audit --no-fund
```

Eger `SELF_SIGNED_CERT_IN_CHAIN` gorursen:

- **Onerilen**: kurum CA sertifikasini tanit

```bash
npm config set cafile "C:\\path\\to\\corp-ca.pem"
```

- **Gecici**: SSL kontrolunu kapat (onerilmez)

```bash
npm config set strict-ssl false
```

### 3) Gelistirme modunda calistir

```bash
npm run dev
```

Tarayici: `http://localhost:3000`

### 4) Production build (opsiyonel)

```bash
npm run build
npm run start
```

