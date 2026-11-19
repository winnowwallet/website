#!/usr/bin/env python3
"""Render the launch pages without replacing the maintained wallet guides."""
from pathlib import Path
import argparse
import re

PUBLIC = ('index', 'guides', 'updates', 'technical', 'architecture', 'vaults',
          'roadmap', 'privacy', 'lean-native', 'source', '404')
RENAMES = {'architecture.html': 'wallet-architecture.html',
           'vaults.html': 'protection.html', 'roadmap.html': 'whats-next.html',
           'privacy.html': 'privacy-guide.html'}
INCLUDES = {'phone': 'components/phone.fragment.html',
            'site-header': 'components/site-header.html',
            'site-footer': 'components/site-footer.html',
            'styles': 'styles.css', 'choreography': 'choreography.css',
            'art-direction': 'art-direction.css', 'hardware-3d': 'hardware-3d.js',
            'script': 'script.js', 'motion-loader': 'motion-loader.js',
            'dot-field': 'dot-field.js', 'studio-light-css': 'studio-light.css',
            'studio-light-js': 'studio-light.js',
            'engineering-universe': 'engineering-universe.js',
            'accent-palettes-css': 'accent-palettes.css',
            'accent-palettes-js': 'accent-palettes.js', 'device': 'device.js',
            'native-screens': 'native-screens.js',
            'native-screens-css': 'native-screens.css', 'pages': 'pages.css',
            'guides-css': 'guides.css', 'editorial': 'editorial.css',
            'site-shell': 'site-shell.css', 'pages-js': 'pages.js'}

def render(root):
    src = root / 'site/src'
    pages = {}
    paths = [src / (name + '.html') for name in PUBLIC] + sorted((src / 'blog').rglob('*.html'))
    for path in paths:
        text = path.read_text()
        for name, source in INCLUDES.items():
            text = text.replace('<!--INCLUDE:' + name + '-->', (src / source).read_text())
            text = text.replace('/*INCLUDE:' + name + '*/', (src / source).read_text())
        text = text.replace('</head>', '<link rel="preload" href="assets/fonts/Degular-Regular-latin.woff2" as="font" type="font/woff2" crossorigin><style>' + (src/'mobile.css').read_text() + '</style></head>')
        text = re.sub(r'<!--REVIEW-ONLY:START-->.*?<!--REVIEW-ONLY:END-->', '', text, flags=re.S)
        text = text.replace('<!--MOTION-CONTROL-->', '<button id="site-motion-toggle" aria-pressed="false">Pause motion</button>' if path.name == 'index.html' and path.parent == src else '')
        text = re.sub(r'<meta name="robots" content="noindex,nofollow">', '', text)
        if path.name == 'roadmap.html':
            text = re.sub(r'<nav class="roadmap-options".*?</nav><p class="option-description">.*?</p>', '', text, flags=re.S)
        # Original guide and policy URLs stay intact. Our introductory pages have
        # distinct names; absolute links to the maintained guides are unchanged.
        for old, new in RENAMES.items():
            text = text.replace('href="' + old, 'href="' + new)
        relative = path.relative_to(src)
        if relative.parts[0] == 'blog':
            prefix = '../' * (len(relative.parts) - 1)
            text = re.sub(r'\b(href|src)="(?!https?:|data:|mailto:|#|/)([^"]+)"', lambda m: m[1]+'="'+prefix+m[2]+'"', text)
            text = text.replace("url('assets/", "url('"+prefix+"assets/").replace('url(assets/', 'url('+prefix+'assets/')
        assert 'INCLUDE:' not in text, path
        pages[RENAMES.get(str(relative), str(relative))] = text
    pages['blog/feed.xml'] = (src/'blog/feed.xml').read_text()
    return pages

def build(root, check=False):
    for name, text in render(root).items():
        output = root / 'docs' / name
        if check:
            if not output.exists() or output.read_text() != text:
                raise SystemExit(f'{name} is stale; run scripts/build-site')
        else:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(text)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    build(args.root, args.check)
