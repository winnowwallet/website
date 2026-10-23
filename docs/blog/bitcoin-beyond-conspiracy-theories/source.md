# Bitcoin Beyond Conspiracy Theories

*The NIST curve seeds had no secret and no lost phrase. Bitcoin's curve has no seed at all. And 894 lines of my own Swift signed a payment to Kraken.*

## There was no phrase

For 29 years, the seeds behind NIST's elliptic curves were cryptography's favourite conspiracy theory. Every curve from P-192 to P-521 in [FIPS 186](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf) is "verifiably random": its coefficient comes from the SHA-1 hash of a published 160-bit seed. Anyone could check the hash. Nobody could say where the seeds came from. And once NIST [dropped Dual_EC_DRBG](https://www.nist.gov/news-events/news/2014/04/nist-removes-cryptography-algorithm-random-number-generator-recommendations) in 2014, an unexplained number in a NIST curve looked like a place to hide something.

The seeds were apparently made by Jerry Solinas at the NSA in 1997, and the story that came down from him was charming. He reportedly said they were hashes of English phrases, something like `SHA1("Jerry deserves a raise.")`, and that the phrases were lost with an old computer. He tried every phrase he could remember. None matched, [as Stephen Weis tells it](https://saweis.net/posts/nist-curve-seed-origins.html). Solinas died in 2023. That October, Filippo Valsorda offered [$12,288](https://words.filippo.io/dispatches/seeds-bounty/) to anyone who found them.

On 16 October, Anthropic's Frontier Red Team [published the answer](https://www.anthropic.com/research/ecdsa-curve-origins). There was no phrase.

An Anthropic employee asked Claude how the seeds were made, without pointing it at the clue. In under half an hour it guessed that a 1990s program had used a weak random number generator, wrote a scanner for that generator's fingerprints, spotted a pattern of zero top bits, and recovered the generator's state with lattice reduction. The seeds are outputs of the C library's `lrand48`, seeded with Unix timestamps from 1997 and 1998. In Anthropic's code, P-256's seed is candidate 1,842 from a generator started at 01:52:34 UTC on 16 August 1997. The bounty goes to the Internet Security Research Group.

## Bitcoin's curve has no seed

Bitcoin doesn't use P-256. It uses secp256k1, from Certicom's [SEC 2](https://www.secg.org/sec2-v2.pdf): y² = x³ + 7 over the prime p = 2²⁵⁶ − 2³² − 977. Nothing in it is random. The prime is shaped to make arithmetic cheap, and 0 and 7 are about as small as constants get. There's no seed to explain.

![Two cards, one for each curve. secp256r1, NIST P-256, whose coefficient comes from the SHA-1 hash of a published seed, and secp256k1, Bitcoin's curve, whose constants are a = 0 and b = 7 with no seed](/images/blog/bitcoin-beyond-conspiracy-theories/r1-vs-k1.png)

*The r in secp256r1 is for "verifiably random", the k in secp256k1 for Koblitz.*

There is one loose end. Halve Bitcoin's generator G and the x-coordinate of the result is `0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63`. That's 166 bits, where a random point's would have about 256. So G is twice a point somebody picked for its small x-coordinate, and nobody has said why. The twenty lines of Python that show it will be in the appendix of a follow-up post.

It doesn't matter for security. Every point except infinity generates the same group, and a discrete log with respect to one generator converts to any other for free. A chosen generator can't hide a weakness the way a chosen curve could.

![Two recipes. For secp256r1: a seed, run through SHA-1, gives the coefficient b. For secp256k1: pick a = 0 and b = 7, then pick a prime that is cheap to reduce](/images/blog/bitcoin-beyond-conspiracy-theories/two-recipes.png)

*P-256's seed was the mystery, solved in October 2026. Bitcoin's curve has no seed. Its one loose end is the generator.*

## Every wallet brings its own curve

Bitcoin pays for its own curve in compatibility. [Apple's Secure Enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave) only does P-256. [Android's StrongBox documentation](https://developer.android.com/privacy-and-security/keystore) lists P-256, and secp256k1 isn't on the page. Browsers' [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/EcKeyGenParams) offers P-256, P-384 and P-521. So a Bitcoin wallet can't hand its keys to the phone's secure hardware or use the platform's signatures. It brings its own curve, and it has to keep it right everywhere it runs.

Software that needs secp256k1 ends up in one of three places. It wraps libsecp256k1, the C library inside [Bitcoin Core](https://github.com/bitcoin/bitcoin/tree/master/src/secp256k1). It ports it. Or it writes its own.

| Implementation | Where you meet it | Relation to libsecp256k1 |
|---|---|---|
| [libsecp256k1](https://github.com/bitcoin-core/secp256k1) (C) | Bitcoin Core | the reference |
| [rust-secp256k1](https://github.com/rust-bitcoin/rust-secp256k1) (Rust) | rust-bitcoin, Winnow Rescue | bindings to it |
| [electrum-ecc](https://github.com/spesmilo/electrum-ecc) (Python) | Electrum | a ctypes wrapper around it |
| [P256K](https://github.com/21-DOT-DEV/swift-secp256k1) (Swift) | Winnow, until build 97 | a wrapper around it |
| [NBitcoin.Secp256k1](https://github.com/MetacoSA/NBitcoin/blob/master/NBitcoin.Secp256k1/README.md) (C#) | NBitcoin, Wasabi | a managed port: the same algorithms, rewritten |
| [decred secp256k1](https://github.com/decred/dcrd/tree/master/dcrec/secp256k1) (Go) | btcd, lnd | its own, pure Go |
| [Bouncy Castle](https://github.com/bcgit/bc-java) (Java) | bitcoinj | its own |
| [noble-curves](https://github.com/paulmillr/noble-curves) (JavaScript) | bitcoinerlab's secp256k1 package | its own |
| [trezor-crypto](https://github.com/trezor/trezor-firmware/tree/main/crypto) (C) | Trezor | its own, for embedded devices |
| NativeSecp256k1 (Swift) | Winnow, from build 97 | its own |

I filled that in from each project's own pages. Wrappers share libsecp256k1's code and the port shares its design, so none of them can disagree with it. Only the ones that wrote their own can. One library means one thing to review very well. It also means one mistake lands everywhere at once, and you'd only notice with an independent implementation. A follow-up post will go through how the independent ones differ.

## Why I trust SHA-256

Bitcoin also leans on SHA-256, another NSA design. I trust it, but not because it's a standard. I trust it because the evidence can be checked.

Its constants have a recipe. The eight initial values are the fractional parts of the square roots of the first eight primes, and the 64 round constants come from the cube roots of the first 64 primes ([FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf), sections 4.2.2 and 5.3.3). Anyone can reproduce them, so nobody tuned those numbers. That doesn't prove the design is secure. That part comes from people attacking it in public.

And public attacks work. In 2017, researchers produced [two different PDFs with the same SHA-1 digest](https://eprint.iacr.org/2017/190). That broke SHA-1's collision resistance, and it's why "industry standard" never means "secure forever". It says nothing about SHA-256. SHA-3 came out of an [open competition](https://csrc.nist.gov/Projects/hash-functions/sha-3-project), with public submissions, public comments and a [final report](https://nvlpubs.nist.gov/nistpubs/ir/2012/NIST.IR.7896.pdf) on why Keccak won. It's a different design alongside SHA-2, not a sign that SHA-2 failed.

So when someone claims a break, I ask four things. The full algorithm, or fewer rounds? A collision, or a preimage? What did it cost? Has anyone reproduced it? Those answers make even bad news useful.

## So I wrote the curve

That's the kind of trust I want Winnow to earn: publish the design, show the assumptions, and change course when the evidence does. A Swift rewrite doesn't inherit anyone's correctness. Passing known-answer tests proves agreement on those answers and nothing more. It says nothing about timing leaks, bad randomness or malformed input, which is why the [native Swift research](/research/#native-swift) tracks those separately.

Winnow has been a Bitcoin wallet written in Swift for a while, with one exception. Every key, tweak and signature went through P256K, a Swift wrapper around libsecp256k1. That library is excellent. It was also the one part of the wallet I couldn't read end to end, from the screen down to the arithmetic. Owning it meant writing the curve, because Apple won't: CryptoKit's [`P256`](https://developer.apple.com/documentation/cryptokit/p256) is NIST's curve, and there's no system secp256k1.

I started from a [proof of concept](https://github.com/posix4e/native-secp256k1-swift-test) that did field arithmetic and BIP340's `lift_x`, and nothing else. It couldn't derive a key or sign anything. Getting from there to a wallet that pays was the interesting part.

The result is [`NativeSecp256k1`](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1): nine files, 894 lines of Swift, 781 of them not blank, importing Foundation and CryptoKit and nothing else. It does what a single-key wallet needs and no more: field and scalar arithmetic, point addition and multiplication, compressed and x-only keys, the [BIP32](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0032.mediawiki) and [Taproot](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0341.mediawiki) tweaks, [BIP340](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340.mediawiki) signing and verification, and the tagged hash. I shipped it in a single-key build of Winnow with shared accounts taken out.

| File | What it does | Lines |
|---|---|---|
| `Integer256` | 256-bit numbers in four 64-bit limbs | 235 |
| `FieldElement` | arithmetic modulo p | 131 |
| `Scalar` | arithmetic modulo the group order | 67 |
| `Point` | Jacobian points | 138 |
| `GeneratorTable` | precomputed multiples of G | 76 |
| `Secp256k1Keys` | private, public and x-only keys, and tweaks | 140 |
| `Secp256k1Schnorr` | BIP340 signing and verification | 68 |
| `Secp256k1Error`, `TaggedSHA256` | errors, and the tagged hash | 39 |
| **Total** | | **894** (781 not blank) |

It's variable-time, and it doesn't wipe secrets from memory; libsecp256k1 guards against both. On a phone, neither is the worry yet. Exploiting them takes code running on the device or a way to time thousands of my signatures. The worry is whether the math is right.

## Four layers

Each layer only uses the one below it.

`Integer256` is a 256-bit number in four 64-bit limbs, because Swift's [`UInt128`](https://developer.apple.com/documentation/swift/uint128) needs iOS 18 and the app supports iOS 17. Squaring computes each cross product once and adds it twice, so it takes ten 64-bit multiplications instead of sixteen.

`FieldElement` works modulo p, and p's shape is the trick. Because p is 2²⁵⁶ minus a small constant, 2²⁵⁶ is congruent to that constant, 2³² + 977. Anything that spills past 256 bits gets multiplied by the constant and added back in:

```swift
// fold = 0x1_0000_03D1 = 2^32 + 977 = 2^256 − p
private static func reduce(high: Integer256, low: Integer256) -> FieldElement {
    let (highFold, lowFold) = high.multipliedFullWidth(by: fold)
    let (total, overflow) = low.addingReportingOverflow(lowFold)
    let extra = highFold &+ (overflow ? 1 : 0)

    let (extraHigh, extraLow) = extra.multipliedFullWidth(by: fold)
    var carry: UInt64 = 0
    let r0 = Integer256.addLimb(total.l0, extraLow, &carry)
    let r1 = Integer256.addLimb(total.l1, extraHigh, &carry)
    let r2 = Integer256.addLimb(total.l2, 0, &carry)
    let r3 = Integer256.addLimb(total.l3, 0, &carry)
    var result = Integer256(l0: r0, l1: r1, l2: r2, l3: r3)
    if carry != 0 {
        result = result.addingReportingOverflow(foldValue).partialValue
    }
    return FieldElement(reducing: result)
}
```

The full function explains, in a comment, why a few folds and one conditional subtraction always land below p. Inversion is Fermat's little theorem. Square roots work because p ≡ 3 (mod 4), and the code squares the answer to check it.

`Scalar` is the same idea modulo the group order, and it's what private keys, nonces and tweaks are. It multiplies the slow, simple way, because the wallet does that once per signature.

`Point.swift` uses Jacobian coordinates and the a = 0 formulas from the [Explicit-Formulas Database](https://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html). The addition formula breaks when the two points are equal or opposite, so the code checks for those cases first, and they have tests of their own. `GeneratorTable` precomputes 960 multiples of G, 61 KB built in about a millisecond, so any multiple of G costs at most 64 additions and no doublings.

On top, `Secp256k1Keys.swift` copies the validation rules and parity behaviour of the four libsecp256k1 tweak calls it replaces. That's why nothing above it had to change. Nothing in it traps on bad input, which matters because the Taproot tweak also runs on control blocks from other people's transactions. And the signer ends the way BIP340's reference does, by verifying its own signature before handing it back:

```swift
let k = r.hasOddY ? nonce.negated() : nonce
let rX = r.x.bigEndian

let e = challenge(rX: rX, publicX: publicX, message: message)
let s = k + e.multiplied(by: d)
let signature = rX + s.bigEndian
guard verify(signature: signature, message: message, publicKey: publicX) else {
    throw Secp256k1Error.signingFailed
}
return signature
```

[BIP340 recommends that](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340.mediawiki), because a signature broken by a computation error can leak the key. It can't catch a bug the signer and verifier share, though. That takes a second implementation.

## Is the math right?

A broken signer usually fails loudly: its signatures don't verify. The dangerous bugs are quiet. Some live on rare paths, like a carry out of the top limb that ordinary inputs never reach. Others are consistent: a wrong constant or a wrong hash that signing and verifying share, so every signature still checks out against the same wrong code.

Three things check the module. Recorded answers from libsecp256k1 and BIP340's reference code cover hand-picked edge cases. The official BIP32, BIP86, BIP340 and BIP341 vectors cover the specs. And a fuzzer throws mutated inputs at it on every pull request.

I wanted to know whether the fuzzer was doing its job, so I planted 21 realistic bugs in the curve code, one at a time, and ran the pull-request fuzz job against each. It caught 13. It missed three of the five consistent bugs, because it only checked the module against itself, and five of the seven rare-path ones, because random bytes never got there. Running it 25 times longer caught nothing more. The unit tests did better, at 20, and the one they missed, a lost carry in the multiplier, got past everything.

So the fuzzer now has something to argue with: [a second implementation](https://github.com/winnowwallet/winnow/pull/242), about 300 lines of deliberately plain Swift that shares none of the module's algorithms. It uses 32-bit limbs instead of 64, Montgomery multiplication instead of p's special form, affine points instead of Jacobian, and BIP340 written straight from the spec. It has to reproduce BIP340's own vectors before it's trusted. The fuzzer demands byte-for-byte agreement between the two and pushes half its inputs to the edges: around the group order and p, or long runs of ones. A new test feeds both implementations operands built from awkward limbs, all ones or the top bit alone, which is what it takes to reach that carry.

Against the same 21 bugs, the fuzzer now catches 19, and with the new test the unit tests catch all 21. The two the fuzzer still misses sit deep in field arithmetic that keys and points can't steer, which is what that test is for. None of it turned up a bug in the real module: it passes every check, old and new.

## The curve is the small part

At commit [`3794057`](https://github.com/winnowwallet/winnow/commit/3794057eae11a18e33af2ffba76d91dce71b5da8), the single-key build has 24,476 non-blank lines of production Swift:

| Area | Lines |
|---|---|
| Networking and sync | 8,749 |
| The app | 7,794 |
| Wallet and spending | 5,659 |
| Keys and crypto, including the 781-line curve | 2,274 |

The biggest part is the one that learns about the chain without trusting a server. The compact-filter client and its peers outweigh the whole wallet core, and the curve is 3% of the total.

## Paying Kraken

Build 97 went to internal TestFlight testers on 20 October, from tag [v0.8.7](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d) and its [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172). It replaces the App Store Winnow on a tester's phone, it can't see shared-account funds, and its iCloud backup overwrites one that has them. [Its notes](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/docs/testflight-what-to-test.txt) say not to install it over any.

Then I installed it on my own phone, over the App Store Winnow and a live wallet. It upgraded in place and kept receiving and sending. One of those sends is [ad627d56…5d6e](https://blockstream.info/tx/ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e):

![Winnow's Advanced Wallet tab on build 97: the filter scan at block 972,361 of 972,361 with two peers, and the transactions Sent 13,060 sats in block 972,351 with a 715-sat fee, Sent to Kraken 1,710 sats in block 972,342 with a 710-sat fee, Received from Kraken 100,000 sats in block 972,325, and the two older transactions from before the upgrade](/images/blog/native-swift-secp256k1/advanced-transactions.png)

*The wallet after the upgrade. The two bottom rows predate build 97; the top three are the funding coin and the two sends below.*

| | |
|---|---|
| Size | 193 bytes, 142 vbytes |
| Input | output 1 of `deeeaa2b…9d6a`: 100,000 sats locked to a Taproot output key |
| Witness | one item of 64 bytes |
| Outputs | 98,290 sats of change; 1,000 sats to a Kraken deposit address |
| Fee | 710 sats, 5.0 sat/vbyte |
| Locktime | 972,341 |
| Mined | [block 972,342](https://blockstream.info/block/000000000000000000003524d2ae7205c8ac854deb3d9afe5c3e8f8a5296e352), 15:03:42 UTC on 20 October |

One 64-byte witness item is a Taproot key-path spend with the [default sighash](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0341.mediawiki), which commits to every input and output. The locktime tells you when it was signed. Winnow sets it the way Bitcoin Core does, never above its own tip, so the phone signed after it saw block 972,341 and before 972,342 was mined: between 14:16 and 15:03 UTC, by the miners' timestamps.

I checked the signature two ways. Winnow's own sighash code and Swift verifier accept it, and so does libsecp256k1. Then, with nothing from the wallet, a short Python script rebuilt the sighash from the raw bytes, and BIP340's [`reference.py`](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340/reference.py) accepted the signature too. Flip one bit, or change the amount by one satoshi, and both reject it. Both programs will be in that appendix.

The chain can't say which code signed. libsecp256k1 would have made a signature that verifies the same way. The evidence is the build: build 97's job never compiled libsecp256k1, and that's what the phone was running. The signature adds one thing. To make it, the Swift code had to derive the private key through [BIP32](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0032.mediawiki) and [BIP86](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0086.mediawiki), and it arrived at exactly the key the coin was locked to.

![The payment detail for the funding coin: Received from Kraken, 100,000 sats, confirmed, with the receive address labelled Kraken](/images/blog/native-swift-secp256k1/funding-coin.png)

*The coin the first send spent. The label is my own note on the address; the screen says it doesn't verify who sent the payment.*

That first payment didn't reach my account. Kraken's [minimum Bitcoin deposit](https://support.kraken.com/articles/360000292886-cryptocurrency-deposit-fees-and-minimums) is 10,000 sats, ten times what I sent, and smaller deposits are marked failed and lost. A 1,000-sat lesson.

So I sent [another](https://blockstream.info/tx/3e28224cb67f95a1909a34b7bfceca5c10305d94a031fdc34b374007bc0ae7a6): 12,345 sats, the same shape, one 64-byte signature at 5.0 sat/vbyte, mined in block 972,351. That one went through. Its input was the first payment's change, so build 97 signed the transaction that made the coin and then spent it. Both coins arrived after the upgrade. A 4,230-sat coin from before it was still unspent when I wrote this, and spending it would show the Swift code signing for a coin the C build received.

## Multisig needed no new curve code

The latest internal build, [0.8.11](https://github.com/winnowwallet/winnow/releases/tag/v0.8.11), adds Taproot multisig in Advanced mode: two phones and a Ledger in a 2-of-3, say, with an optional recovery path that lets fewer signers move a coin that has sat still for a while. Each signer makes an ordinary BIP340 signature over a different message (the script-path one, from [BIP342](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0342.mediawiki)), so between `3794057` and [`7b7ff30`](https://github.com/winnowwallet/winnow/tree/7b7ff30db3156224e2cf1da3d93b591a59c88844), the curve module's Swift files didn't change at all. The price is paid on-chain: a 2-of-2 spend is about 42 vbytes bigger per input than a single signature, and anyone can see it's multisig.

None of it has signed on a physical Ledger yet. That's the next test. The [research page](/research/#thresholds) has the details, and the whole line is [draft pull request #241](https://github.com/winnowwallet/winnow/pull/241).

## The bar

The NIST seeds waited 29 years for an explanation, and the story everyone told turned out to be wrong. What settled it was evidence anyone can rerun, and that's the bar for a wallet too.
