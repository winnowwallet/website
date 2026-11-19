// Actual native Lean views, captured from the local review build. See provenance.json.
(() => {
  const sources = {
  "home": {
    "title": "Home \u00b7 synced",
    "nativeCapture": {
      "dark": "assets/native/home-dark.webp?v=58",
      "light": "assets/native/home-light.webp?v=58"
    }
  },
  "review": {
    "title": "Review payment",
    "nativeCapture": {
      "dark": "assets/native/review-dark.webp?v=58",
      "light": "assets/native/review-light.webp?v=58"
    }
  },
  "network": {
    "title": "Sync status",
    "nativeCapture": {
      "dark": "assets/native/network-dark.webp?v=58",
      "light": "assets/native/network-light.webp?v=58"
    }
  },
  "backup": {
    "title": "iCloud backup \u00b7 saved",
    "nativeCapture": {
      "dark": "assets/native/backup-dark.webp?v=58",
      "light": "assets/native/backup-light.webp?v=58"
    }
  },
  "hardware": {
    "title": "Ledger Nano X nearby",
    "nativeCapture": {
      "dark": "assets/native/hardware-dark.webp?v=60",
      "light": "assets/native/hardware-light.webp?v=60"
    }
  },
  "people": {
    "title": "Shared approval \u00b7 signatures",
    "nativeCapture": {
      "dark": "assets/native/people-dark.webp?v=62",
      "light": "assets/native/people-light.webp?v=62"
    }
  },
  "recovery": {
    "title": "Family recovery",
    "nativeCapture": {
      "dark": "assets/native/recovery-dark.webp?v=58",
      "light": "assets/native/recovery-light.webp?v=58"
    }
  },
  "trustee": {
    "title": "Shared account \u00b7 receive",
    "nativeCapture": {
      "dark": "assets/native/trustee-dark.webp?v=58",
      "light": "assets/native/trustee-light.webp?v=58"
    }
  }
};
  const templates = Object.fromEntries(Object.entries(sources).map(([key,source]) => [key, `<figure class="native-screen"><img class="native-dark" src="${source.nativeCapture.dark}" width="1206" height="2622" alt="${source.title}" decoding="async"><img class="native-light" src="${source.nativeCapture.light}" width="1206" height="2622" alt="${source.title}" decoding="async"></figure>`]));
  window.WINNOW_SCREENS = {templates,sources,nativeCaptures:true,revision:'f0ada0b-shared-approval-corrected-62'};
})();
