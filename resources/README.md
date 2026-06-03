# Capacitor Assets — PM Hybrid

Esta pasta é lida pelo `@capacitor/assets` pra gerar **todos** os tamanhos de
ícone (iPhone, iPad, App Store, Apple Watch) e splash screens automaticamente.

## Arquivos

- `icon.png` — 1024×1024, app icon master. Fundo preto, monograma PM titânio.
- `splash.png` — 1920×1920 (ou maior), splash master, centro da arte no meio.

## Como regenerar tudo (no Mac, depois do `npx cap add ios`)

```bash
npx capacitor-assets generate --ios
```

Isso popula:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`

Pra Apple Watch, depois de criar o target Watch no Xcode, copiar o `icon.png`
master pro Watch target `Assets.xcassets/AppIcon.appiconset/` e o Xcode gera
os tamanhos necessários automaticamente (ou usa `capacitor-assets` apontando
o `--iconBackgroundColor #000000` se quiser).
