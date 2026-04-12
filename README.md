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

## Cai de phien ban moi (khong can xoa game cu)

- Android se cai de duoc neu giu cung `applicationId` va ky cung keystore.
- Du an da tu dong map version vao `android/app/build.gradle`:
	- `versionName` = `APP_BUILD_VERSION` (neu co), neu khong thi fallback `package.json.version`
	- `versionCode` = `major * 10000 + minor * 100 + patch`
- Vi vay, APK moi co the update len ban cu ma khong can go cai dat.

## Tu thong bao update dua tren ma nguon

Game da co checker doc file `public/version.json`:

- `src/lib/updateChecker.ts` se fetch manifest version va so sanh voi version hien tai trong app.
- Home/Settings se hien trang thai "Co ban cap nhat moi" va nut cap nhat.
- Khi vao game, app se check version. Neu co ban moi, app mo man hinh bat buoc cap nhat voi:
  - Version hien tai / version moi
  - Dung luong can thiet
  - Lua chon `Cap nhat ngay` hoac `Thoat`
- Neu chon cap nhat, loading full-screen se hien tien trinh cap nhat cho den khi xong.

Manifest mau:

```json
{
	"version": "1.1.0",
	"publishedAt": "2026-04-12",
	"forceUpdate": true,
	"requiredSizeMb": 120,
	"packageUrl": "https://your-domain.com/patch-v1.1.0.bin",
	"packageSizeBytes": 125829120,
	"downloadUrl": "https://...",
	"notes": "Mo ta ngan"
}
```

Ghi chu:

- Uu tien `packageUrl` neu ban muon hien tien trinh tai goi cap nhat ngay trong game.
- Neu khong co `packageUrl`, app se fallback sang `downloadUrl`.

Neu can check update tu server rieng (dac biet cho ban native), dat bien moi truong:

```bash
VITE_UPDATE_MANIFEST_URL=https://your-domain.com/version.json
```

Khi release, cap nhat `public/version.json` (version + downloadUrl).

Neu ban release bang GitHub tag `vX.Y.Z`, workflow se tu dong set `APP_BUILD_VERSION=X.Y.Z`.
Luc do version hien trong game va version APK se theo tag release.

## Tu dong build APK len GitHub Releases

Du an da co workflow:

- `.github/workflows/android-release.yml`

Workflow nay se chay khi ban push tag `v*` (vi du: `v2.1.0`):

1. Build web + sync Capacitor Android
2. Build APK release da ky
3. Upload len GitHub Release voi ten file co dinh `star-keeper.apk`

Them nua: workflow tu dong parse tag va set `APP_BUILD_VERSION` (vd `v2.0.4` -> `2.0.4`) de game version + APK versionName/versionCode dong bo theo release.

### A) Chuan bi keystore (1 lan)

Neu ban chua co keystore:

```bash
keytool -genkey -v -keystore star-keeper-release.jks -alias starkeeper -keyalg RSA -keysize 2048 -validity 10000
```

Sau do encode base64:

```bash
# Linux/macOS
base64 -w 0 star-keeper-release.jks > keystore.base64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("star-keeper-release.jks")) | Out-File keystore.base64
```

### B) Them GitHub Secrets

Vao repo GitHub > Settings > Secrets and variables > Actions, tao 4 secrets:

- `ANDROID_KEYSTORE_BASE64`: noi dung file `keystore.base64`
- `ANDROID_KEYSTORE_PASSWORD`: mat khau keystore
- `ANDROID_KEY_ALIAS`: alias key (vi du `starkeeper`)
- `ANDROID_KEY_PASSWORD`: mat khau key

De APK build tren GitHub chay dung dang nhap (khong bi man hinh den do thieu env), them them 2 secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### B.1) Cau hinh Supabase OAuth redirect cho mobile (bat buoc)

Vao Supabase Dashboard > Authentication > URL Configuration, them Redirect URLs:

- `com.vibe.banmaybay://auth`
- `com.vibe.banmaybay://auth/callback`

Neu de redirect URL chi la dia chi web, dang nhap xong se o lai browser thay vi quay lai app.

Neu co dung update endpoint rieng, co the them Actions Variables:

- `VITE_UPDATE_MANIFEST_URL`
- `VITE_NATIVE_OAUTH_SCHEME` (mac dinh: `com.vibe.banmaybay`)

### C) Tao release moi

```bash
git add .
git commit -m "release: v2.1.0"
git push origin main
git tag v2.1.0
git push origin v2.1.0
```

Sau khi workflow xong, APK se o tab Releases.

### D) Lay link tai tren web

Ban co 2 cach:

- Link co dinh (de nhat):
	- `https://github.com/<owner>/<repo>/releases/latest/download/star-keeper.apk`
- Lay metadata bang API:
	- `https://api.github.com/repos/<owner>/<repo>/releases/latest`
	- Parse `tag_name`, `assets[].size`, `assets[].browser_download_url`

Goi y: dat `public/version.json.downloadUrl` = link latest/download o tren de app va web luon tro ve ban moi nhat.

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
