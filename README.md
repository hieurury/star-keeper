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

## Checklist truoc khi build APK

### 1) Cap nhat bo icon app

Icon Android duoc sinh tu file nguon `public/pwa/icon-512.svg`.

```bash
npm run icons:android
```

Lenh nay se cap nhat cac file launcher trong `android/app/src/main/res/mipmap-*`.

### 2) Dong bo va kiem tra full-screen

```bash
npm run cap:sync:android
```

App da duoc cau hinh immersive full-screen trong `MainActivity` va theme Android da set `postSplashScreenTheme` de vao game khong bi action bar.

### 3) Kiem tra app hoat dong dung chuc nang

Build native debug de bat loi tai nguyen/cau hinh truoc khi tao release APK:

```bash
cd android
.\gradlew.bat assembleDebug
```

Sau khi build pass, test nhanh tren may that/emulator:
- Dang nhap/dang xuat
- Vao tran game, HUD, enemy spawning, am thanh
- Pause/resume app (dua app vao nen va mo lai)
- Kiem tra ket noi mang va dong bo (neu dang dung Supabase)
