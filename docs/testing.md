# Testing the Lean app

Winnow 0.9.x is written in Lean 4 in
[winnowwallet/winnow-lean](https://github.com/winnowwallet/winnow-lean). The
app's own
[testing guide](https://github.com/winnowwallet/winnow-lean/blob/main/docs/testing.md)
is the reference: what each CI job runs, every journey step by step, how to run
them locally, and the fuzzer. This page summarises it and describes what the
site's journey media show. The Swift app's suites (WalletCoreTests, AppTests,
the single signet journey) ended with the Swift app, whose main stopped at
0.8.13; their history stays in
[winnowwallet/winnow](https://github.com/winnowwallet/winnow), and the retired
[tdx CI notes](engineering/tdx-ci.md) describe how they ran.

## CI

Every push to winnow-lean's main, and every pull request that is ready for
review and changes more than the docs, runs LeanNative's reusable `ios-app`
workflow
([`.github/workflows/ci.yml`](https://github.com/winnowwallet/winnow-lean/blob/main/.github/workflows/ci.yml))
on GitHub's hosted macOS runners, or on a self-hosted Mac while the
repository's `MACOS_RUNNER` variable names one. Three jobs start at once and a
fourth joins their evidence.

| Job | What it runs |
| --- | --- |
| `lean` | Builds `Lean/` and `LeanApp/`, which checks every proof; then the Lean test executables, the fuzzer, `scripts/ci-regtest`'s suites against a disposable regtest Bitcoin Core, and the journeys headless against the app itself. |
| `app` | The Debug simulator build, checked for Swift, and the UI journeys in a simulator, split across two runners. |
| `media` | Once both parts pass: their evidence joined into the `journey-media` artifact. |
| `release` | The Debug and Release simulator builds and the Release device build, each checked for Swift; the test-mode check. |

The test-mode check launches both simulator builds with test mode's
environment: Debug must start the test run, Release must ignore it.

## The journeys

The UI journeys are Lean
([`LeanApp/Journeys.lean`](https://github.com/winnowwallet/winnow-lean/blob/main/LeanApp/Journeys.lean)),
run on the Mac. Each step is one command to LeanNative's journey driver, the
one XCUITest in the app's UI test target; each check is Lean, against the
node. Each journey launches the app in test mode in a simulator (CI's is an
iPhone 17 Pro) against a regtest node and finds controls by the identifiers
the views give them.

Main, whose runs supply this site's media, has nine:

- `createReceiveSendConfirm`: create a wallet, receive, send, see it confirm.
- `multisigTwoOfThreeWithRecovery`: a 2-of-3 with two Bitcoin Core wallets,
  then its recovery path.
- `ledgerPairVerifySpend`: pair test mode's simulated Ledger, verify an
  address, spend with both signatures.
- `ledgerCardTwoOfTwo`: the Ledger nearby card sets up a 2-of-2 of the phone
  and the Ledger.
- `shippedCensus`: the census peer list the build ships shows in Settings.
- `silentPaymentSend`: pay a BIP352 code.
- `feeBumpReplaceConfirm`: bump a fee; Core checks the replacement.
- `spentElsewhere`: coins spent by the same phrase in another wallet.
- `retryAfterNoPeers`: Retry after the node goes off the network.

The 0.9.16 release line adds a tenth, `cardForOnePerson`: a card for one
person, paid by the node from the card's text alone.

What the journeys do not cover: a physical Ledger (CI's is simulated),
receiving silent payments (Winnow does not), live Tor and I2P gateways,
iCloud, background tasks scheduled by iOS, and iPad layouts.

## Run them locally

From a winnow-lean checkout, with the Lean toolchain
`leanprover/lean4:v4.35.0` (elan):

```sh
scripts/build-ios Debug                      # the app for the simulator, from a clean checkout
scripts/journeys                             # the UI journeys against a regtest fixture
scripts/journeys --wire                      # the same journeys headless, with no simulator
```

Name journeys to run only those, for example
`scripts/journeys createReceiveSendConfirm`. The app's testing guide has the
test executables, where the results are kept and how Bitcoin Core is found.

## The journey media on this site

After the journeys, LeanNative's `journey-media` step in winnow-lean's `media`
job turns the run into the `journey-media` artifact: the screenshots, a
browser copy of the recording and `journey-provenance.json` (the run, source
commit, device, each test's result and seconds, and each file's SHA-256).

This site's `scripts/fetch-journey-media` downloads that artifact from the
newest successful `ci.yml` run on winnow-lean's main, checks every file against
the provenance file, and writes the media over the committed files in the CI
workspace only. `scripts/build-site` then builds the homepage gallery and the
[recording page](https://winnowwallet.com/recording) from it. When the fetch
fails, the site publishes the committed reference media from the Swift app
([screenshots](screenshots/README.md), [video](videos/README.md)) instead.

The result bundle and logs are what establish a pass. The recording and
screenshots show the run; they do not replace its assertions, and they are
evidence only for the commit and device their provenance names.
