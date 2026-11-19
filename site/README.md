# Launch website source

The launch pages live in `site/src`; `scripts/build-site` bakes them into `docs`.
Run `python3 -m unittest discover -s scripts/tests`, `scripts/build-site`, and
`scripts/check-site`. Git LFS must be hydrated for the existing journey media.

The maintained guides, privacy policy, release-note pointers, research, security
records and blog source files remain at their existing URLs. The shorter launch
explainers use `protection.html`, `wallet-architecture.html`, `privacy-guide.html`
and `whats-next.html`. The prior generated homepage is available at `journeys.html`;
the original CI media refresh and recording page still run through `build-site`.

Blog article content matches website main 66868cdd1621d3e14043ab38913bfeb8bf838175,
including the three November 18 corrections. Edit articles in `site/src/blog`.

Native website images are captures of the Lean views with inert sample state.
They are not CI transaction evidence. See HANDOFF.md for exact scope and limits.
Private design galleries, the app review harness, local paths and build caches
are excluded. Source assets are committed under `docs/assets`; no external design
workspace or package installation is required for the Python build.
