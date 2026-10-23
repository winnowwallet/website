# Two Signers, One Signature

Draft — Alex Newman · October 20, 2026

**Shelved 23 October 2026.** MuSig2 (winnow #235) is parked. The multisig that shipped is Taproot script-path accounts with a Ledger signer and recovery paths (0.8.11, winnow #241), so a Part 3 should describe that, after a physical Ledger has signed.

*Part 3 of the series that starts with [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): MuSig2 back on Winnow's native Swift build, as raw as I could make it, with Bitcoin Core as the second signer.*

The single-key build got small by deleting things. Shared accounts went: threshold vaults, recovery paths, people as co-owners, approval wording and the MuSig2 signing underneath them, 12,601 deleted lines by the [introduction's](/blog/bitcoin-beyond-conspiracy-theories/) count. On a [branch](https://github.com/winnowwallet/winnow/commit/dae4b74576d0c5aa179c90c9c71a677c95b06bde), with an [open pull request](https://github.com/winnowwallet/winnow/pull/235), MuSig2 is back. The product around it is not. This part is about what came back, what stayed out, and why the most interesting test of it is run by somebody else's code.

## What MuSig2 is

MuSig2, from a [2020 paper](https://eprint.iacr.org/2020/1261) by Jonas Nick, Tim Ruffing and Yannick Seurin, lets several people who each hold a key produce one BIP340 Schnorr signature for one aggregate key. It takes two rounds: everyone shares a nonce, then everyone shares a partial signature, and anyone can add the partial signatures up. To the network the result is a single-key Taproot spend: one key in the output, one 64-byte signature in the witness. [BIP327](https://github.com/bitcoin/bips/blob/master/bip-0327.mediawiki) says the outputs are "indistinguishable for a blockchain observer" from single-signer ones.

Four documents make it usable by wallets:

- **[BIP327](https://github.com/bitcoin/bips/blob/master/bip-0327.mediawiki)**, the protocol: key aggregation and sorting, nonce generation and aggregation, partial signing and verification, tweaks.
- **[BIP328](https://github.com/bitcoin/bips/blob/master/bip-0328.mediawiki)**, which turns an aggregate key into a synthetic extended public key, so an account can derive fresh addresses from it.
- **[BIP390](https://github.com/bitcoin/bips/blob/master/bip-0390.mediawiki)**, the `musig()` descriptor that writes such an account down.
- **[BIP373](https://github.com/bitcoin/bips/blob/master/bip-0373.mediawiki)**, the PSBT fields that carry participants, nonces and partial signatures between signers.

BIP327 is plain about its limits too: MuSig2 is "a n-of-n multi-signature scheme", not a threshold scheme. Every signer has to sign, every time.

## As raw as possible

I asked for MuSig2 back "as raw as possible and Advanced mode only". That came out as one kind of account: a key-path `tr(musig(...)/<0;1>/*)` descriptor and nothing around it.

- **Descriptor in.** The Wallet tab gains a MuSig2 section in Advanced mode. Adding an account shows this phone's key to share, takes a pasted descriptor, checks it, and shows the first address.
- **Addresses and coins out.** The account watches its addresses with the same compact-filter scan as the rest of the wallet.
- **PSBT text between signers.** One screen creates a spend or takes a pasted one, shows the review, and runs round 1, round 2 and the broadcast, each behind device authentication.

Left out: threshold policies, script-path recovery, cosigner cards, people as co-owners, approval wording, integration with the Send tab, and anything in Simple mode. Script trees still fail at the parse.

Two storage choices matter more than they look. The accounts live in their own sealed file, `musig2.json`, not the `vaults.json` the shared-account Winnow wrote, so a phone that goes back to a main build finds its threshold vaults untouched. Backups carry the records under the old bundle key, `vaults`, with the same fields, so a MuSig2 account backed up by the shared-account Winnow restores here. A bundle that holds any threshold or script-path account is refused whole, rather than restored in part.

The commit adds 5,686 lines and deletes 126. About 2,900 of the added lines are production Swift: 1,452 in WalletCore, 1,376 in the app and 76 in the curve module. Most of the rest is tests and the BIPs' own test vectors.

## What the curve module had to grow

The single-key module only needed what one key needs: derive, tweak, sign, verify. MuSig2 needs plain arithmetic. Key aggregation adds weighted public keys together. Nonce aggregation adds points that may cancel out, and BIP327 encodes the point at infinity on purpose. The signing equation needs scalars where zero is a legitimate value, which a private-key type rightly refuses.

So the module gained `Secp256k1.ScalarModN`, with zero allowed, and addition, negation and multiplication on `PublicKey`, each returning `nil` at infinity. That is 76 lines of Swift, nearly all in [one file](https://github.com/winnowwallet/winnow/blob/dae4b74576d0c5aa179c90c9c71a677c95b06bde/Sources/NativeSecp256k1/Secp256k1Arithmetic.swift). The algebra is checked by identities in the tests and in the fuzz harness: a point plus its negation is infinity, k(P + Q) equals kP + kQ, and (a + b)G equals aG + bG. The BIP327 vectors check it again from outside.

The [BIP327 code](https://github.com/winnowwallet/winnow/blob/dae4b74576d0c5aa179c90c9c71a677c95b06bde/Sources/WalletCore/Descriptors/MuSig2.swift) itself came back from the shared-account Winnow almost unchanged. Only its helpers moved from the old C wrapper onto the native arithmetic.

## The nonce is the dangerous part

In a single-key BIP340 signature the nonce is derived from the key, the message and some fresh randomness, so a wallet never has to remember it. MuSig2 cannot do that. BIP327 says nonces "must not be derived deterministically", because a dishonest co-signer could then make you sign twice with the same nonce, and two partial signatures made with one nonce give away the key. The nonce has to be random, kept between round 1 and round 2, and used once.

Winnow handles that in two places. WalletCore zeroes each secret nonce as it signs and refuses to sign with a zeroed one. The app keeps secret nonces only in the PSBT screen's memory, and scrubs them when the screen closes, when the app goes to the background, and when the exchange restarts. Nothing about a nonce is written to disk, backed up or synced. The cost is that a signer who switches apps between rounds starts again from round 1. I would rather pay that than reason about a nonce surviving a backup restore.

There is a second, quieter cost, and it is Part 1's subject. The secret nonces pass through the same variable-time arithmetic as the key, and leaking a nonce gives away the key just as surely. The module's README says so. Zeroing a Swift array also does not reach the copies the language made along the way. This branch makes the constant-time pass more urgent, not less.

## Read the PSBT before you sign it

A co-signer sends you a PSBT, and every field in it is a claim. Before Winnow shows, signs, finalizes or broadcasts one, it [checks the spend](https://github.com/winnowwallet/winnow/blob/dae4b74576d0c5aa179c90c9c71a677c95b06bde/Sources/WalletCore/Wallet/MuSig2Account.swift#L214-L238) against what the phone saw for itself:

- Every input is a coin of this account that the phone recorded, with the exact amount and script the signature will commit to, and mature if it came from a coinbase.
- The MuSig2 fields name the expected participants and internal key.
- Every signature commits to all outputs.
- An output counts as the account's own only if its script matches the descriptor.
- The fee is at most a tenth of the inputs, the same ceiling the phone applies when it creates a spend.

Adding an account is checked as strictly. The descriptor must end in `/<0;1>/*` and have at least two participants. Each participant must be an extended public key on this network, with an origin that matches its depth and child index, and no signer may appear twice under different labels. This phone has to be one of them. Its key is the wallet's checked account key, so wallets restored from words, a master key or an account key can all sign.

## Bitcoin Core as the other signer

Part 2 argued that a second implementation is most useful as an oracle. MuSig2 has an unusually strict one. Bitcoin Core implements the same BIPs on libsecp256k1's own [MuSig2 module](https://github.com/bitcoin-core/secp256k1/blob/master/include/secp256k1_musig.h), in C, written independently of Winnow. If the two sides disagree about anything, the signature is invalid and the network rejects it. The list of things to agree on is long: how keys are sorted and weighted, how BIP328 turns the aggregate into an extended key, the derivation to the address, the Taproot tweak, how nonces combine, and the challenge.

The UI journey runs that test end to end after its ordinary payment, as it did on the shared-account Winnow, and now the phone's side is all Swift. The phone files `tr(musig(PHONE,CORE)/<0;1>/*)`, and its first address has to equal the one Core's `deriveaddresses` gives. The test node's wallet funds it. The phone builds the spend. Core's `walletprocesspsbt` adds Core's nonce, then its partial signature. The phone aggregates them into one 64-byte signature and broadcasts. Bitcoin Core 31.1, the version the test fixture runs, accepts the transaction, mines it, and finds the change. A [`CoreSigner`](https://github.com/winnowwallet/winnow/blob/dae4b74576d0c5aa179c90c9c71a677c95b06bde/Tests/Support/Node/CoreSigner.swift) helper holds Core's key, and five new checkpoints record the screens on the way.

Neither side can fake that result. A signature Core's node accepts was checked by code nobody in this project wrote, against an aggregate key that both implementations had to compute identically.

## What it does not do yet

- **It is not released.** The branch's package and app tests pass in CI, and the signet journey with Core co-signing passes when run locally. It has not been to TestFlight, and no MuSig2 spend from it has touched mainnet.
- **It is n-of-n with no way out.** There is no script path. If one participant loses their key, the coins in that account cannot be spent by anyone. That is the protocol's shape, not a bug, but it is the first thing anyone using it should know.
- **Recovery words are not enough.** The introduction lists account meaning as one of recovery's four parts, and an n-of-n account is mostly meaning: the other signers' keys, their origins and the order of derivation. Lose the descriptor and every key still exists, but nobody can find the coins. Winnow's backup carries the descriptor; a written-down copy should too.
- **The arithmetic leaks.** Until the constant-time pass from Part 1 lands, secret nonces share the module's variable-time, not-zeroized limits.

## What would come next

The natural next steps are the ones this branch refused. A threshold policy, where some subset of keys can spend, needs either a script path or a threshold protocol like [FROST](https://eprint.iacr.org/2020/852), and both bring back much of what the single-key build deleted. A hardware signer as one of the participants would let a phone and a device share an account without either holding everything. Each should come with its own recovery record and its own interop test against code that Winnow did not write.

For now the branch shows something narrower and still worth having: shared signing does not need a product around it to be tested, and a phone running its own Swift curve code can produce a signature that Bitcoin Core's C code helped make and accepts as its own.
