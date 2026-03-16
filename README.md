# Star Keeper (ban-may-bay)

Game Vue 3 + TypeScript + Vite, da duoc bo sung Capacitor de chay nhu app mobile native (Android/iOS) ma khong thay doi gameplay logic hien tai.

## Chay web

```bash
npm install
npm run dev
```

## Build web

```bash
npm run build
npm run preview
```

## Mobile voi Capacitor

Capacitor su dung output build tu thu muc `dist` (cau hinh trong `capacitor.config.ts`).

### 1) Khoi tao platform (chi can lam 1 lan)

```bash
npx cap add android
npx cap add ios
```

### 2) Dong bo web build vao native project

```bash
npm run cap:sync
```

Hoac theo tung nen tang:

```bash
npm run cap:sync:android
npm run cap:sync:ios
```

### 3) Mo Android Studio / Xcode

```bash
npm run mobile:android
npm run mobile:ios
```

Luu y:
- Service Worker chi dang ky o web browser, khong dang ky trong shell native de tranh xung dot cache.
- Moi thay doi code Vue/game logic van giu nguyen workflow hien tai; chi can build va sync lai truoc khi chay tren mobile.
