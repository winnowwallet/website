# Census signing

The [peer census](https://github.com/winnowwallet/census) publishes a signed
list of Bitcoin peers each day. Each Winnow build ships a copy of that list;
the app downloads no census. It has no manual refresh and no I2P mirror fetch.
Peers remain untrusted: the wallet still validates their headers and filters
independently.

## What a build ships

[`scripts/import-census`](https://github.com/winnowwallet/winnow-lean/blob/main/scripts/import-census)
in winnow-lean fetches `census/peers.json` and `census/peers.json.sig` at one
census commit (by default the newest on its main) and:

1. verifies the Ed25519 signature under the pinned key below, refusing a
   signature that names another key;
2. drops clearnet peers that the census's health record scores under 70 for
   consistency over at least 3 attempted days. Peers the record does not cover
   are kept, the list is kept unfiltered if fewer than 200 clearnet peers would
   remain, and Tor and I2P peers are kept as published;
3. ships the signed bytes when nothing is dropped; otherwise the same document
   without the dropped entries, written the way the census writes it, after
   checking that this reproduces the signed bytes exactly;
4. checks the result with the app's own decoder (Lean's `census-check`);
5. writes `build/census/peers.json`, which the app's manifest bundles, and
   `peers-source.txt`, recording the census commit, the signature, the health
   filter and both files' SHA-256.

CI runs it in every job that builds the app (`lean`, `app` and `release`), as
that job's `prepare` step. `scripts/build-ios` runs it for Release builds and
when the list is missing. If the signature does not verify,
the build stops; there is no unsigned fallback.

## Publisher and wallet trust

The publisher key established on September 18, 2026 is:

```text
b999d0881c236f3f38dce334bd373c75b936677bbed952685745486131d32b74
```

The private key is held in the `winnowwallet/census` repository's
`CENSUS_SIGNING_KEY` Actions secret. The public key is recorded in that
repository's `census/signing-public-key.txt`. Winnow pins it in winnow-lean's
[`scripts/census-public-key.txt`](https://github.com/winnowwallet/winnow-lean/blob/main/scripts/census-public-key.txt);
until 0.8.13 the Swift app compiled it in as `CensusPublisher.trustedKeysHex`.
The pin was recorded on 28 October 2026 from sources in one GitHub
organization, so it is still to be confirmed out of band.

The publisher signs the tag `winnow-census-peers-v1\0` followed by the exact
bytes of `peers.json`. Its adjacent `peers.json.sig` contains:

```json
{"algorithm":"ed25519","publicKey":"<32 bytes hex>","signature":"<64 bytes hex>"}
```

Both publisher deployment paths require a signature matching the pinned key.
Missing or mismatched secrets stop daily publication; missing, modified, or
foreign signatures stop deployment. The previous published list stays in use.

## Key rotation

1. Generate a replacement key with `WinnowCensus keygen` (from the
   [census repository](https://github.com/winnowwallet/census)) in a trusted local
   session. Its output includes the private key; keep it out of logs and git.
2. Add the new public key to `scripts/census-public-key.txt` in winnow-lean,
   one key per line, beside the old one, before the publisher switches.
3. Replace the publisher's Actions secret and commit the matching public key
   and newly signed list together. Verify the deployed bytes and signature.
4. Remove the old key from the pin when no list signed by it needs to ship.

Publish signed data before shipping a build that pins only the new key. If the
secret is lost, use this rotation process; never restore unsigned acceptance.

## Checks

The census repository's contract tests verify its committed catalog, missing
and modified signatures, foreign keys, and a known-answer signature. In
winnow-lean, `scripts/tests` (`test_census_import.py`, `test_ed25519_verify.py`)
cover signature refusal, the health filter and the derived file; CI's `lean`
job runs them and `census-check` on the shipped list, and the `shippedCensus`
journey checks that the list shows in Settings on mainnet.

## History: the Swift app

Until 0.8.13 the Swift app shipped no peer list. A mainnet install downloaded
the signed census automatically, Settings had a manual refresh, an I2P mirror
served the same signed files to I2P-only wallets, and the app verified the
signature on every refresh and again on load.
