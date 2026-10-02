# Comparing Bitcoin wallets by what we can check

Draft — Alex Newman · October 2, 2026

I built [compare.winnowwallet.com](https://compare.winnowwallet.com/) because a wallet's feature list tells you very little about what you are trusting. “Open source” is a useful starting point. It is not the end of the inspection.

Winnow is my wallet, so I have an obvious stake in this comparison. The useful response to that is to make the rules and evidence public. Every measured project is pinned to an exact commit. Each feature cell links to the code behind it. The build that produces the tables is public too.

The site compares Winnow with BlueWallet, Blockstream Green, Muun, Phoenix, Bitkit, Blixt, and Zeus. Its scope is their Bitcoin wallet on iPhone. Several of these applications also provide Lightning, and that matters to their architecture and dependencies, but this is not a comparison of their Lightning capabilities.

## Start with the wallet you actually need

Before counting code, ask what the app lets you do. How does it learn about the chain? Who has to sign a payment? Can you import the wallet you already have, or recover it somewhere else? What does the phone support directly, and what would require another device or service?

Those are questions about the application a person uses. A feature buried in an underlying library does not make it a feature of the iPhone app. The comparison's feature rows define what yes, partial, and no mean, and each cell cites the source reviewed for that answer.

I want that distinction to be visible. Two wallets may both advertise shared custody while asking you to trust very different arrangements. A table is helpful only when a reader can follow it back to the implementation.

## What counts as code

The size tables count non-blank, non-comment lines in programming languages for code that builds into the iPhone application. Tests, Android and desktop code, web pages, build tooling, generated files, and vendored third-party code are excluded from the wallet's own-code totals. Characters are counted too, with comments and whitespace removed, so compressing a function onto one line does not make the implementation disappear.

A separate engine is shown separately at the version the app pins. It does not vanish from the comparison, and it does not get silently added to the application's own code. Likewise, dependency counts come from the relevant lockfiles and resolved production dependency trees. Committed third-party code, prebuilt binaries, and dependency patches have their own accounting.

These distinctions are worth keeping because a small wrapper around a large engine and a wallet that implements more of its own chain logic are different things. A single number hides that choice.

## Complexity is a question, not a verdict

The site also measures cyclomatic complexity per function: the branches, loops, and other decisions that create different paths through it. A function with many paths deserves attention when you read or test it. That does not establish that the function is wrong, and a short function can still be wrong in a consequential way.

CRAP combines complexity with test coverage. This project does not measure instrumented coverage for all eight wallets, so it reports the floor the score cannot go below: cyclomatic complexity. That is a lower bound, not a measured CRAP score. I do not want a table that makes missing coverage look like evidence of missing tests.

Code size and dependency counts need the same restraint. Fewer lines do not prove safety. More dependencies do not prove danger. The numbers describe the amount and shape of code involved; deciding whether it is correct requires further work.

## Keep the measurements and the review separate

The daily job updates source pins, rebuilds the measurements, and adds a history snapshot when anything moves. Most projects follow their default branch; Phoenix follows its latest iOS release tag because the branch inspected during setup was configured for testnet. The pinning rules are documented in the repository.

Hand-reviewed feature claims have a separate reviewed revision. Updating a code-size measurement does not automatically re-review a feature. The site records which cited passages changed since that review so a reader can see where the evidence may need another look.

That makes a comparison less tidy, but more useful. A changing project should not inherit an old claim without telling you.

## Check the comparison itself

The [comparison repository](https://github.com/winnowwallet/compare) includes the source pins, counting rules, feature definitions, citations, and build. Its regression cases check the rules against small examples counted by hand. The reproduction workflow rebuilds the output and checks that it matches the committed measurements.

The point is to give someone a place to begin inspecting a wallet—and a way to disagree with the comparison using evidence. If a path is counted incorrectly or a feature cell misses something the app can do, that is a specific claim we can check and fix.

Winnow should be subject to those same rules. I wrote it, and I would rather explain what it asks you to trust than ask you to trust a flattering number.

---

Editorial notes before publication:

- Pick a dated snapshot and add two or three concrete, linked examples from that snapshot. Avoid live numeric claims that become stale between drafting and publication.
- Recheck the live page and cited feature cells at that revision.
- Decide whether to include one screenshot of the feature table and one of the size breakdown.

Source for this draft: [comparison README and measurement methodology](https://github.com/winnowwallet/compare/blob/main/README.md). No wallet coverage or security outcome is claimed here.
