Build the Winnow launch site and preserve the current Lean guides

The homepage and supporting pages now present Winnow as a customer-facing product, with the reviewed visual design, actual native Lean screen captures, and shorter explanations. Guides and release notes are available from Explore and the footer. All five blog articles are included with Newman's current text, including the three November 18 corrections and the updated census source link.

> **HANDOFF NOTE — WEBSITE AND APP ARE SEPARATE SUBMISSIONS.** This is the launch website source and its generated public pages. It does not publish a site, release an app, or prove that the photographed flows work with a real wallet. Please coordinate the website launch with the corresponding app release. Native images show the actual proposed Lean view functions with inert sample state; the Ledger-nearby popup is a sample discovery state, not a physically detected Ledger. CI transaction recordings remain separately identified in the existing engineering evidence.

The source is based on website main `66868cdd1621d3e14043ab38913bfeb8bf838175`. It keeps the November 18 guides, research, privacy policy, security records, release-note pointers, and recording pipeline. The new introduction pages use distinct URLs so they do not replace the maintained detailed guides: `protection.html`, `wallet-architecture.html`, `privacy-guide.html`, and `whats-next.html`. The previous generated homepage becomes `journeys.html`.

`scripts/build-site` now renders `site/src` as well as the journey gallery and recording page. Running the existing build no longer overwrites the new homepage. `site/README.md` describes the source and commands; no local design workspace is required.

Private website galleries, the screen inspector, the Winnow Review app/catalog, local build paths and caches are excluded. Customer pages have no simulator captions, design-option instructions or submission FAQ. Public technical documentation and the founder's dated article corrections are retained.

Validation: all 44 existing website tests pass; the generated-site check and 34-page link, fragment, media and size check pass. All five article bodies match the current upstream text. The RSS feed has five entries. The updated local website was checked at desktop and 390px mobile widths, with no horizontal overflow or console errors observed.

Remaining release work: Newman should review the final product claims and availability against the app version he releases. The independent renderer and app changes require their own review. Website imagery is presentation evidence, not a substitute for real-device, iCloud, network or hardware testing.

Branch: `codex/launch-website-20261119`. One commit; no AI coauthor trailer. No merge or deployment is requested by this PR.
