# Bitcoin Beyond Conspiracy Theories

Draft — Alex Newman · October 20, 2026

*The NIST seeds' real origin, the odd thing about Bitcoin's generator, the Swift curve code that signed my first mainnet payments, and what recovery still owes you.*

## A joke phrase that was never there

For almost thirty years the seeds behind NIST's elliptic curves were cryptography's favourite conspiracy theory. The curves P-192 through P-521 in [FIPS 186](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf) are "verifiably random": each curve's coefficient is the SHA-1 hash of a published 160-bit seed. Anyone can check the hash. Nobody could say where the seeds came from. After NIST [removed Dual_EC_DRBG](https://www.nist.gov/news-events/news/2014/04/nist-removes-cryptography-algorithm-random-number-generator-recommendations) from its random-number recommendations in 2014, following reports that it had been backdoored, an unexplained number in a NIST curve looked like something worse than an unexplained number.

The seeds were apparently generated in 1997 by Jerry Solinas at the NSA, and the story that came down from him was charming. A colleague recalled him saying they were hashes of English phrases, something like `SHA1("Jerry deserves a raise.")`, and that the exact phrases were lost when his computer was replaced. When the controversy came up he tried every phrase he could think of, and none matched. Solinas died in early 2023. That October, Filippo Valsorda put up [a bounty](https://words.filippo.io/dispatches/seeds-bounty/) for the phrases: $12,288, tripled to $36,864 if the winner gave it to charity.

On 16 October 2026, Anthropic's Frontier Red Team [published the answer](https://www.anthropic.com/research/ecdsa-curve-origins), and it is better than a phrase: there was no phrase. An Anthropic employee asked an internal research model, Claude, to work out how the seeds were made, without pointing it at the clue. In under half an hour it guessed that a 1990s program had used a weak random number generator, wrote a scanner for that generator's fingerprints, noticed an unusual pattern of zero top bits, and recovered the generator's state, using lattice reduction where the program had kept only the top bits of each output. The seeds for P-192 through P-521 are outputs of the C library's `lrand48`, seeded with Unix timestamps from May 1997 to April 1998. In the code on Anthropic's page, P-256's seed is candidate 1,842 from a generator started at 01:52:34 UTC on 16 August 1997. The bounty goes to the Internet Security Research Group.

Anthropic is careful about what this is: "not a cryptographic break, new attack, or weakness in the ECDSA curves." It makes a deliberate backdoor much less plausible. It does not explain everything. The base points of P-224, P-256, P-384 and P-521 are still unexplained, and some candidate seeds were skipped by criteria nobody knows. I like the story because it has the right shape: a suspicion, a claim specific enough to check, and evidence that changed what we know. That is the shape I want for everything underneath a wallet.

## Bitcoin's curve has no seed, but it has a mystery

Bitcoin does not use P-256. It uses secp256k1, from Certicom's [SEC 2](https://www.secg.org/sec2-v2.pdf): y² = x³ + 7 over the prime p = 2²⁵⁶ − 2³² − 977. Nothing in that definition is random. The prime's shape makes reduction cheap, and a = 0 and b = 7 are about as small as constants get. There is no seed to explain.

It does have one loose end, and it is the same kind Anthropic left open for P-256: the generator point. Halve Bitcoin's generator G and the x-coordinate of the result is `0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63`. That is 166 bits, where a random point's x-coordinate has about 256. So G is twice a point that somebody picked with a small x-coordinate, and nobody has said why. The appendix has the twenty lines of Python that show it.

It does not matter for security, and the reason is worth a sentence. Every point on the curve other than infinity generates the same group, and a discrete logarithm with respect to one generator turns into a discrete logarithm with respect to any other at no cost. A chosen generator cannot hide a weakness the way a chosen curve could.

## Why I trust the hashes

I want Winnow's research to make the wallet's assumptions easier to inspect. That includes an uncomfortable question: why should we trust the cryptography underneath Bitcoin?

It is reasonable to ask who designed an algorithm, how its parameters were chosen, and who has tried to break it. The useful next step is to look for evidence that can change our minds. An institution's name cannot settle the question in either direction. Neither can the fact that Bitcoin has money riding on the answer.

I would not say that we proved the standard hashes were safe. We have reasons for confidence in particular algorithms, used for particular jobs, under particular assumptions. That is a more useful foundation for a wallet than either unconditional trust or an unfalsifiable suspicion.

A hash turns a message into a fixed-size digest. Because there are more possible messages than digests, different messages must sometimes have the same digest. The security question is how hard it is to find a useful example. Finding two different messages with the same digest is a collision attack. Finding a message for a given digest is a preimage attack. Finding a different message with the same digest as a particular message is a second-preimage attack. Those are different jobs for an attacker; evidence about one does not automatically settle the others.

SHA-256, part of the SHA-2 family used by Bitcoin, has a public specification. Even the apparently arbitrary constants have a recipe. Its initial values come from the fractional parts of square roots of the first eight primes; its round constants come from cube roots of the first sixty-four primes. The exact rules are in [FIPS 180-4, sections 4.2.2 and 5.3.3](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf). Anyone can reproduce them.

That answers a narrow and worthwhile question about where those numbers came from. It does not prove that every design choice was inevitable, that the whole construction is secure, or that no attack will be discovered. A reproducible origin for constants removes some mystery. It does not replace cryptanalysis.

I want to be able to follow an attack claim back to its method. Does it attack the full algorithm or a version with fewer rounds? Does it find a collision or recover a preimage? What resources does it require? Can other researchers reproduce the result? These questions make a claim useful even when the result is bad news.

We have a concrete example of bad news changing what people should use. In 2017, researchers demonstrated a collision for full SHA-1, producing two different PDF files with the same SHA-1 digest. The [original research paper](https://eprint.iacr.org/2017/190) explains the attack. That is evidence against SHA-1's collision resistance. It is not a demonstration that SHA-256 is broken, or that any arbitrary digest can be reversed. It is also a reason never to use “industry standard” as a synonym for permanently secure.

SHA-3 offers another kind of evidence: an open selection process and a different design. NIST's [SHA-3 competition archive](https://csrc.nist.gov/Projects/hash-functions/sha-3-project) includes submissions, public comments, and conferences. Its [final-round report](https://nvlpubs.nist.gov/nistpubs/ir/2012/NIST.IR.7896.pdf) explains the choice of Keccak after years of analysis. [FIPS 202](https://csrc.nist.gov/pubs/fips/202/final) specifies the resulting SHA-3 family and SHAKE functions. That history is inspectable. SHA-3 supplies design diversity alongside SHA-2; its existence is not a finding that SHA-2 failed.

## Trusting the math is not trusting the code

Inspectable evidence is the kind of trust I want Winnow to earn too. Publish the design, make the assumptions visible, invite attempts to find mistakes, and respond when the evidence changes. A Swift rewrite does not inherit correctness from the language. Passing known-answer tests establishes agreement on those cases. It does not establish resistance to timing leaks, bad randomness, or every malformed input. Our [native Swift cryptography research](/research/#native-swift) has to earn confidence separately from the algorithms it implements.

Winnow has been a Bitcoin wallet written in Swift for a while, with one exception. Every key, every tweak and every signature went through P256K, a Swift wrapper around Bitcoin Core's C library, libsecp256k1. That library is excellent. It is also the one part of the wallet I could not read end to end, from the screen down to the arithmetic, and the question kept coming back: how hard would it be to own that boundary?

A Bitcoin wallet on Apple's platforms has to bring its own secp256k1, because the system speaks P-256. CryptoKit's [`P256`](https://developer.apple.com/documentation/cryptokit/p256) and the Secure Enclave's keys are NIST's curve, and there is no system secp256k1 to call.

I had a [proof of concept](https://github.com/posix4e/native-secp256k1-swift-test) to start from. It did field arithmetic modulo the curve prime and the `lift_x` operation from BIP340, with expected answers produced outside Swift, and nothing else. It could not derive a key or sign a message. The distance from there to a wallet that pays is the interesting part.

The rest of this post describes the code, the evidence that it is correct, what it costs, and the first payments it signed on mainnet. Numbers about what shipped come from the wallet repository at tag [v0.8.7](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d) and the [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172) that built it. Numbers about the code since then come from commit [`3794057`](https://github.com/winnowwallet/winnow/commit/3794057eae11a18e33af2ffba76d91dce71b5da8). The rest come from the block chain, and the appendix gives the commands to check them yourself.

## Shrink the problem first

How hard it is depends on what the wallet needs. Winnow's shared accounts need MuSig2 key aggregation, nonce sessions and script-path threshold spends, and those need far more of the curve than an ordinary payment does. So this experiment is a specialized Winnow: a single-key build with shared accounts removed. No 2-of-3 vaults, no cosigner cards, no shared savings.

In the history behind v0.8.7, the removal is four commits. [The first](https://github.com/winnowwallet/winnow/compare/8718dc554b3d4dc7fa895697c58a6b65d8947e01...0468c97297b34ad414c174a37f0b3c3eaa35d6c2) takes MuSig2, script-path multisig and cosigner keys out of WalletCore. The descriptor grammar becomes single-key `tr()` and `rawtr()`, and `musig()` or a script tree is refused when the descriptor is parsed. [The second](https://github.com/winnowwallet/winnow/commit/ae98c6f14efa0d793fb8fbd5eac96f39a2ed1226) removes the shared-savings screens and flows from the app, [the third](https://github.com/winnowwallet/winnow/compare/ae98c6f14efa0d793fb8fbd5eac96f39a2ed1226...81d90abf91f536d477ab3f5a83a58709597fa505) removes their tests, and [the fourth](https://github.com/winnowwallet/winnow/commit/fa3381981d016a6fdaf1949da8d95129814c5f33) updates the docs, scripts and CI gates to match. A backup file that carries shared-account records is refused outright, so its shared-account coins are never silently left out of a restore.

Shared accounts turned out to be about a sixth of the wallet. Measured on commit [`3794057`](https://github.com/winnowwallet/winnow/commit/3794057eae11a18e33af2ffba76d91dce71b5da8) against current main ([the whole difference](https://github.com/winnowwallet/winnow/compare/6566871db0a40be481dd63b7960790ef4de9192e...3794057eae11a18e33af2ffba76d91dce71b5da8)), removing them deletes 12,601 lines:

| Deleted | Lines |
|---|---|
| Production Swift | 6,053 |
| Tests and the UI journey | 4,178 |
| BIP specification texts and test vectors (MuSig2, multisig descriptors, script-path sighash) | 1,848 |
| Docs | 410 |
| Tools, scripts and CI | 112 |

Counting non-blank lines of production Swift only:

| Module | main | single-key branch |
|---|---|---|
| WalletCore | 16,921 | 15,901 |
| WinnowApp | 10,478 | 7,794 |
| VaultKit | 1,654 | none |
| NativeSecp256k1 | none | 781 |
| **Total** | **29,053** | **24,476** |

The app lost the most, about a quarter of its code: the shared-savings screens, the MuSig2 signing exchange, the vault store and AppModel's vault flows. WalletCore lost MuSig2, multisig scripts, script-path signing, the descriptor tree and `musig()` grammar, and the vault fields in PSBTs. The tests shrank with them, because shared accounts carried the heaviest coverage: threshold pairs, cosigner identity, nonce safety and Bitcoin Core interop. The table counts non-blank lines; the 894 lines below count every line of the module's nine files, which have not changed since v0.8.7.

What the remaining wallet needs from the curve is the minimum: scalar arithmetic modulo the group order, field arithmetic modulo the prime, point addition and multiplication, the compressed and x-only encodings, the BIP32 and Taproot tweaks, BIP340 signing and verification, and the tagged hash. That is 894 lines of Swift in nine files under [`Sources/NativeSecp256k1`](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1), and it imports Foundation and CryptoKit and nothing else. ECDSA, ECDH, MuSig2 and script-path signing are out of scope. The [module's guide](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/README.md) states that scope and the module's limits.

[One commit](https://github.com/winnowwallet/winnow/compare/0348a9cc8c5a3c7e72cb7b3d3c94a993e3b2de66...8718dc554b3d4dc7fa895697c58a6b65d8947e01) switches the callers to it: BIP32 child keys, the BIP86 tweak, Taproot output keys, key-path signing, PSBT finalization, descriptor private keys and the tagged hash. The app target depends only on WalletCore ([`project.yml`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/project.yml#L65-L67)), and WalletCore depends only on the new module ([`Package.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Package.swift#L25-L27)).

## The shape of the code

The module has four layers, and each layer uses only the one below it.

At the bottom, [`Integer256`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Integer256.swift) is a 256-bit unsigned integer in four 64-bit limbs. It uses limbs because Swift's [`UInt128`](https://developer.apple.com/documentation/swift/uint128) requires iOS 18 and the app supports [iOS 17](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/project.yml#L21). It adds, subtracts and multiplies. Its 512-bit product is built by product scanning: each output limb is the column sum of the partial products that land on it. Squaring computes each cross product once and adds it twice, so it needs ten 64-bit multiplications instead of sixteen.

Above that are two modular types. A [`FieldElement`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/FieldElement.swift) is an integer below the curve prime p = 2²⁵⁶ − 2³² − 977, kept fully reduced. The shape of that prime is what makes reduction cheap. Because p is 2²⁵⁶ minus a small constant, 2²⁵⁶ is congruent to that constant, 2³² + 977, modulo p. Anything that spills past 256 bits can be multiplied by the constant and added back in:

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

The [full function](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/FieldElement.swift#L106-L130) carries the bound argument as a comment. The first fold turns the top 256 bits into a value of at most 289 bits, which leaves one extra limb below 2³⁴. Folding that limb contributes less than 2⁶⁷, so at most one carry comes out of the top. When it does, the remainder is tiny, and one more fold brings it below p. A final conditional subtraction makes the result canonical. Inversion is Fermat's little theorem, a^(p−2). Square roots use the fact that p ≡ 3 (mod 4), so a^((p+1)/4) is a root whenever one exists, and the code squares the result to check.

A [`Scalar`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Scalar.swift) is the same idea modulo the group order n, and that is what private keys, nonces and tweaks are. Its multiplication is the binary method, 256 doublings and up to 256 additions. That is slow, but simple, and the wallet multiplies scalars once per signature.

Then the curve. [`Point.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Point.swift) keeps points in Jacobian coordinates and uses the a = 0 formulas from the Explicit-Formulas Database: [`dbl-2009-l`](https://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#doubling-dbl-2009-l) for doubling and [`madd-2007-bl`](https://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#addition-madd-2007-bl) for adding an affine point. The addition formula assumes two distinct points that are not each other's negation. Those cases have to be caught before the formula runs, and [the code](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Point.swift#L56-L77) does it in the open:

```swift
func adding(_ other: AffinePoint) -> JacobianPoint {
    guard !isInfinity else { return JacobianPoint(other) }
    let z1z1 = z.squared()
    let u2 = other.x * z1z1
    let s2 = other.y * z * z1z1
    let h = u2 - x
    let r = (s2 - y).doubled()
    if h.isZero {
        return r.isZero ? doubled() : .infinity
    }
    // … the madd-2007-bl formula
```

If the accumulator is the point at infinity, the sum is the other point. If the x coordinates match (h = 0), the two points are equal or opposite: equal y means doubling, opposite y means infinity. These are the cases a careless implementation gets wrong only on rare inputs, so they have [tests of their own](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1CurveTests.swift#L219).

Multiplying the generator is the operation a wallet repeats most: deriving each address adds a multiple of G at least once, in the BIP32 child step or the Taproot tweak. [`GeneratorTable`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/GeneratorTable.swift) splits the scalar into 64 four-bit windows and precomputes, for each window w, the points j·2^(4w)·G for j from 1 to 15. That is 960 affine points, 61 KB, built once on first use in about a millisecond. Turning that many Jacobian points into affine ones would cost one field inversion each, so the table uses Montgomery's trick: one inversion per batch, two in all. After that, k·G costs at most 64 mixed additions and no doublings. A test checks the table against plain double-and-add on [a thousand scalars](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1CurveTests.swift#L191-L217).

At the top is the public face. [`Secp256k1Keys.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Keys.swift) defines private keys, compressed public keys and x-only keys. They follow the validation rules, tweak semantics and parity behaviour of the libsecp256k1 calls they replace: `ec_seckey_tweak_add`, `ec_pubkey_tweak_add`, `keypair_xonly_tweak_add` and `xonly_pubkey_tweak_add`. That is why nothing in the wallet above them had to change. Every operation rejects malformed input by throwing or returning nil, and none of them traps. That matters more than it sounds, because the Taproot tweak also runs on control blocks taken from other people's transactions.

The signer in [`Secp256k1Schnorr.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Schnorr.swift#L13-L36) follows BIP340's reference algorithm step for step. It ends the same way the reference does, by verifying its own signature before returning it:

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

[BIP340](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340.mediawiki) recommends that check, because an invalid signature produced by a computation error can leak information about the secret key. It is not free. Most of the 271 µs a signature costs below is this verification. It also cannot catch a mistake that the signer and verifier share, which is one reason the tests compare against a different implementation.

The last file, [`TaggedSHA256.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/TaggedSHA256.swift), is eighteen lines: BIP340's SHA256(SHA256(tag) ‖ SHA256(tag) ‖ message) on CryptoKit's SHA-256.

## Where the lines are now

Here are the 24,476 lines that remain, by what they do, at the same commit:

| Area | Lines |
|---|---|
| **Networking and sync** | **8,749** |
| Compact-filter sync and range scanning | 2,328 |
| Peers and the census list | 1,657 |
| Bitcoin wire protocol | 1,317 |
| Peer connections and SOCKS routing | 1,150 |
| Broadcasting | 1,092 |
| Header chain | 904 |
| Mempool windows | 301 |
| **The app** | **7,794** |
| **Wallet and spending** | **5,659** |
| Wallet state, imports, coin selection, fees, people | 3,249 |
| PSBTs | 906 |
| Transaction building, signing and sighash | 769 |
| Descriptors | 482 |
| Taproot scripts | 253 |
| **Keys and crypto** | **2,274** |
| BIP32, BIP39, BIP86 and the Keychain | 875 |
| The Swift curve module | 781 |
| Encodings and hashes | 618 |

5,517 of those lines are comments. The largest part is not keys or signing. It is the part that learns about the chain without trusting a server: the compact-filter client and its peer handling outweigh the whole wallet core. The curve module that replaced libsecp256k1 is about 3% of the total.

## How I know it is right

One rule governs every test: the expected answer never comes from the code under test. The evidence builds in layers.

**Fixtures computed elsewhere.** The [field and x-only fixtures](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/Vectors/native-secp256k1/README.md) hold 2,624 pairs of field elements with their sums, products and negations, 168 square-root cases, and 318 x-only key inputs. Field answers come from Python's arbitrary-precision integers. The x-only answers come from two oracles that had to agree: the `lift_x` function of BIP340's `reference.py`, and a small C probe linked against libsecp256k1 v0.7.1. The fixture README records the pinned commits and the SHA-256 of every file. The [generator scripts](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tools/Generate/native-secp256k1/README.md) rebuild them from fresh checkouts and never call the Swift code.

**The official vectors.** The BIP340 test vectors must [sign to the expected bytes and verify as the CSV says](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L69). The BIP341 key-path spending vectors are tweaked, signed and verified natively. The BIP32 and BIP86 vectors WalletCore already ran now run through the new backend unchanged.

**Differential tests against libsecp256k1.** The test targets still link the pinned [swift-secp256k1 0.23.2](https://github.com/21-DOT-DEV/swift-secp256k1/tree/0.23.2) package as an oracle. [The key tests](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1KeyTests.swift) cover private-key validation and compressed-point parsing, junk prefixes included. They also cover all three tweak-adds, with zero, overflowing and infinity-producing tweaks. Each must accept, reject and produce bytes exactly as libsecp256k1 does. [The signing test](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L123-L142) makes 96 signatures, half with an all-zero auxiliary input and half with a random one given to both libraries. Each must be byte-identical to libsecp256k1's, so a valid signature that differs by one bit fails. [The verification test](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L144-L190) gives both verifiers seventeen candidates for each of 48 keys. The candidates include the valid signature, flipped bits, a changed message or key, r equal to p, s equal to n, swapped halves and wrong lengths. The two must return the same verdict on every one.

**Fuzzing.** The [`native-secp256k1` fuzz target](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tools/Fuzz/Sources/WinnowFuzzCore/NativeSecp256k1Exercise.swift) slices one input into a secret, a tweak, a point, a message, auxiliary randomness, a signature and an x coordinate. It feeds them to both backends and fails unless they accept or reject together and agree byte for byte. In the release run, the deterministic smoke campaign passed 16,000 cases across the harness's sixteen targets, a thousand of them in this one. That is a smoke test, not a long campaign.

**A real node.** The [signet journey](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/UITests/README.md) drives the app through creating a wallet, receiving coins from a private signet run by Bitcoin Core, sending a payment and watching it confirm, with screenshots at six checkpoints. The node checks the signature on that payment, so a confirmed send is the module's acceptance test against Bitcoin Core's own validation.

**The release.** The [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172) built tag v0.8.7 and passed every lane: 608 package tests, 227 app unit tests, the fuzz smoke run and the journey. Its TestFlight job compiled `NativeSecp256k1` and never compiled P256K or libsecp256k1. The C library is in the package graph only because the test targets still pin it.

None of that is a proof. It is agreement on a large set of cases, which is the most a test suite can say.

Those are the checks build 97 passed. The oracle has changed since, and so has where the random inputs live; [Since build 97](#since-build-97) has the details.

## What it costs

Measured in a release build on an Apple silicon Mac, in microseconds per operation, with the [opt-in timing suite](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/README.md#speed) (`WINNOW_TIMING=1 swift test -c release --filter NativeSecp256k1TimingTests`, which prints numbers and asserts nothing):

| Operation | Native Swift | libsecp256k1 |
|---|---|---|
| Multiply the generator | 37 | 11 |
| BIP32 public child | 52 | 19 |
| Taproot tweak | 50 | 22 |
| BIP340 sign, including its self-check | 271 | 26 |
| BIP340 verify | 207 | 18 |

Address derivation is the work a wallet does constantly. On the child-key and tweak rows it stays within three times the C library. Multiplying the generator on its own is about 3.4 times slower. Signing and verifying happen once per spent input and are roughly ten times slower, about a quarter of a millisecond each on the Mac that measured them. I have not timed them on a phone. Verification is dominated by the general point multiplication, which is still plain double-and-add.

The larger cost is not speed. Every operation in this version is variable-time: how long it takes depends on the values it processes, including secret ones. The field and scalar types take a conditional subtraction whenever a result reaches the modulus. Scalar multiplication of a point branches on every bit. The generator table skips zero windows and reads the table at an index taken from the scalar, and in signing that scalar is the nonce. The binary scalar product in `e.multiplied(by: d)` branches on each bit of the private key. Partial knowledge of nonces across many signatures is the classic route to recovering a Schnorr or ECDSA key. I have not tried to measure what an attacker on or near the phone could observe, and the property is missing either way. The scalar copies made while signing and tweaking are also not cleared from memory afterwards.

libsecp256k1 has had years of deliberate work on exactly those two properties, and this module has had none yet. The wallet's documentation used to say that all secret-key math ran in constant-time C. [The commit that switched the backend](https://github.com/winnowwallet/winnow/compare/0348a9cc8c5a3c7e72cb7b3d3c94a993e3b2de66...8718dc554b3d4dc7fa895697c58a6b65d8947e01) rewrote those sentences, because they would otherwise have been false.

That trade-off is acceptable for an internal test build on a phone I control. It is not a claim about what the shipping wallet should do.

## Shipping it

The [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172) started at 12:03 UTC on 20 October from tag v0.8.7. Its TestFlight job stamped the build as 0.8.7 (97) and uploaded it to App Store Connect. It finished adding the build to the internal testing group at 12:16 UTC. A [GitHub pre-release](https://github.com/winnowwallet/winnow/releases/tag/v0.8.7) followed a few seconds later with its SBOM and build provenance. The build went to internal testers only, under Winnow's own app identity. That choice has consequences I would rather state than discover:

- It replaces the App Store Winnow on a tester's phone.
- It cannot see shared-account funds, and creating or deleting a wallet inside it removes their records.
- Its automatic iCloud backup has no shared accounts in it, so it overwrites the backup the production app made.

The [notes in TestFlight](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/docs/testflight-what-to-test.txt) say not to install it over a phone that holds shared-account funds.

Then I installed it on my own phone, over the App Store Winnow and a live wallet. It upgraded the wallet in place, and the wallet went on receiving and sending as before. One of those sends is [ad627d56…5d6e](https://blockstream.info/tx/ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e) on Bitcoin mainnet. Here is what its 193 bytes say, read with the wallet's own inspector (`winnow-debug inspect tx`) and checked against Blockstream's API:

![Winnow's Advanced Wallet tab on build 97: the filter scan at block 972,361 of 972,361 with two peers, and the transactions Sent 13,060 sats in block 972,351 with a 715-sat fee, Sent to Kraken 1,710 sats in block 972,342 with a 710-sat fee, Received from Kraken 100,000 sats in block 972,325, and the two older transactions from before the upgrade](/images/blog/native-swift-secp256k1/advanced-transactions.png)

*The wallet after the upgrade. The two bottom rows predate build 97; the top three are the funding coin and the two sends described below.*

| | |
|---|---|
| Version | 2 |
| Size | 193 bytes, weight 568, virtual size 142 vbytes |
| Input | output 1 of `deeeaa2b…9d6a`: 100,000 sats locked to a Taproot (P2TR) output key, `22e48712…9950d`; sequence `0xfffffffd` |
| Witness | one item of 64 bytes |
| Outputs | 98,290 sats to a P2TR address (the change); 1,000 sats to a P2WPKH deposit address at Kraken (the payment) |
| Fee | 710 sats, 5.0 sat/vbyte |
| Locktime | 972,341 |
| Mined | [block 972,342](https://blockstream.info/block/000000000000000000003524d2ae7205c8ac854deb3d9afe5c3e8f8a5296e352), timestamp 15:03:42 UTC on 20 October |
| Confirmations | 9 when I checked, at block 972,350 (15:45 UTC) |

A single 64-byte witness item is what a Taproot key-path spend looks like. BIP341 lets a signature omit its sighash byte, and 64 bytes means it did: the hash type is `SIGHASH_DEFAULT`, which commits to every input and output. The signer [appends a byte](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/Signer.swift#L33-L35) only for other hash types. The sequence number signals BIP125 replaceability, which is the wallet's [default](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/TransactionBuilder.swift#L50-L51). The locktime is the wallet's [anti-fee-sniping](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/TransactionBuilder.swift#L53-L81) height, as Bitcoin Core sets it. The wallet uses either its tip or a height up to 99 blocks below it, never a height above. The transaction was mined in block 972,342, so the wallet's tip cannot have been higher than 972,341 when it built the transaction. It was therefore built and signed after the wallet had block 972,341 and before 972,342 was mined: by their timestamps, between 14:16:35 and 15:03:42 UTC. Miners set those timestamps, so the window is approximate.

I checked the signature myself, two ways. First with the wallet's own code: WalletCore's [BIP341 sighash](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/SighashBIP341.swift#L221-L228) over the transaction and the coin it spends gives `248a5ec2…5779`. [`Secp256k1.Schnorr.verify`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Schnorr.swift#L40-L54) accepts the witness signature for that message under the output key, and so does libsecp256k1 through the pinned P256K. Then without any of it: a short Python script rebuilds the sighash from the raw bytes and gets the same 32 bytes. BIP340's own [`reference.py`](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340/reference.py) accepts the signature too. Both checks reject it if one bit of the signature is flipped, or if the spent amount is changed by one satoshi. The appendix has both programs.

What the chain cannot tell you is which code made that signature. libsecp256k1 would have produced a signature that verifies the same way. Because the auxiliary randomness was fresh, nobody can reproduce these exact bytes. The evidence that the Swift module signed is the build: build 97's TestFlight job never compiled libsecp256k1, and the phone that sent this payment was running build 97. The verified signature adds one thing the build alone does not show. To sign, build 97 had to derive the private key itself, through BIP32 and the BIP86 tweak, and it arrived at exactly the key the spent output commits to.

The timing deserves care too. The coin this transaction spends arrived in block 972,325, whose timestamp is 12:34:00 UTC, about eighteen minutes after the build reached the internal group. So I make no claim that this payment spent a coin the C-backed build had derived. One coin from before the upgrade is still unspent: the 4,230 sats left over from the send in block 970,649, the second row from the bottom above. Spending it is the test that would show the Swift module signing for a key the C library derived. It shows something narrower: a wallet created under the C library, upgraded in place, derived its keys and signed with the Swift module, and Bitcoin mainnet accepted the result less than three hours after the build reached TestFlight.

![The payment detail for the funding coin: Received from Kraken, 100,000 sats, confirmed, with the receive address labelled Kraken](/images/blog/native-swift-secp256k1/funding-coin.png)

*The coin the first send spent; the second spent that send's change. The label is my own note on the address; the screen says it does not verify who sent the payment.*

The payment itself was too small for where it went. It went to a deposit address at Kraken, and Kraken's [minimum Bitcoin deposit](https://support.kraken.com/articles/360000292886-cryptocurrency-deposit-fees-and-minimums) on the Bitcoin network is 0.0001 BTC: 10,000 sats, ten times what I sent. Kraken's page says a deposit below the minimum is marked failed and the funds are lost. Those 1,000 sats paid for the lesson rather than reaching the account.

So I sent it again. The second transaction, [3e28224c…a7a6](https://blockstream.info/tx/3e28224cb67f95a1909a34b7bfceca5c10305d94a031fdc34b374007bc0ae7a6), pays 12,345 sats to a Kraken deposit address, and that one went through. It has the same shape: one input, one 64-byte signature, and 715 sats in fees on 143 vbytes, again 5.0 sat/vbyte. It was mined in block 972,351, whose timestamp is 16:07:23 UTC. Its locktime, 972,271, is below the height the wallet had already reached when it signed the first payment, so this is the one-in-ten case where the wallet picks a height up to 99 blocks back. Its signature passes the same checks against its own sighash, `a715126d…5380`. Its input is the 98,290-sat change output of the first transaction, and that closes the question the timing left open. This coin was created by a transaction that build 97 built and signed, and build 97 spent it.

## Since build 97

Build 97 is still what testers run. The branch kept moving, and [`native-secp256k1-kernel`](https://github.com/winnowwallet/winnow/commit/3794057eae11a18e33af2ffba76d91dce71b5da8) is now one commit, `3794057`, on top of current main. Three things changed.

**No third-party package at all.** The test suite was the last thing that linked libsecp256k1, as the native module's differential oracle and as the signet miner's ECDSA signer. The live comparisons became recorded answers, and the [signet miner](https://github.com/winnowwallet/winnow/blob/3794057eae11a18e33af2ffba76d91dce71b5da8/Tests/Support/Node/SignetMiner.swift) now has the node's own wallet sign block challenges with `signrawtransactionwithwallet`, as Bitcoin Core's reference miner does. `Package.swift` declares no dependencies, so there is no `Package.resolved`, and [`check-dependencies`](https://github.com/winnowwallet/winnow/blob/3794057eae11a18e33af2ffba76d91dce71b5da8/scripts/check-dependencies) fails if Xcode resolves any package beyond the local one.

**Smaller fixtures, more fuzzing.** The recorded answers started at 2.2 MB and 49,000 lines of JSON, most of it seeded random inputs checked against libsecp256k1. Those answers cannot come from the code under test, and generating them while the tests run would mean running libsecp256k1 or Python inside the test suite. So I kept what earns its place: hand-picked edge cases plus eight seeded samples per file, 261 KB and 769 lines, one case per line. They are still computed by the BIP340 reference and a C probe over libsecp256k1 v0.7.1 that have to agree, and they regenerate byte for byte ([fixture guide](https://github.com/winnowwallet/winnow/blob/3794057eae11a18e33af2ffba76d91dce71b5da8/Tests/BitcoinCoreTests/Vectors/native-secp256k1/README.md)). Random inputs went where random inputs belong: the fuzz harness's [`native-secp256k1` target](https://github.com/winnowwallet/winnow/blob/3794057eae11a18e33af2ffba76d91dce71b5da8/Tools/Fuzz/Sources/WinnowFuzzCore/NativeSecp256k1Exercise.swift) checks the module's own algebra on every CI run. The private and public forms of each operation must agree, fresh signatures must verify, and altered ones must not.

**Rebased onto current main.** Main had moved fourteen commits, including moving vaults into a VaultKit package, new library APIs for account-key signing and range recovery, and shipping the peer census with each build. The rebase removes VaultKit again, moves the people and contact-card code back into WalletCore, and leaves main's newer code byte for byte as it was. The [whole difference from main](https://github.com/winnowwallet/winnow/compare/6566871db0a40be481dd63b7960790ef4de9192e...3794057eae11a18e33af2ffba76d91dce71b5da8) is 4,803 lines added and 12,601 deleted.

On that commit, 598 + 23 + 77 package tests pass, as do 216 + 19 app tests, 15,000 fuzz cases across the harness's fifteen targets, lint, the dependency and test-gate checks, the warnings gates, and the signet journey with its payment mined. None of it is released yet. The next internal build needs a version above 0.8.7.

## Where the bar is now

The first thing missing is constant time. A constant-time pass means replacing the conditional subtractions, the per-bit branches and the secret-indexed table lookup with constant-time selects, clearing secrets after use, and measuring the speed again afterwards. Writing constant-time Swift is only half of it. The compiler decides what instructions run, and on Apple silicon some instructions take data-dependent time unless the processor's DIT flag is set. Apple [tells cryptographic code to set it](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms#Enable-DIT-for-constant-time-cryptographic-operations), with calls that exist from iOS 18.2 and a lower-level route for older systems. Winnow still supports iOS 17, and either route is a step that Swift source alone does not take. CryptoKit sets DIT internally for its own P-256 operations; Winnow's secp256k1 has no such help yet.

The kind of evidence this module lacks exists elsewhere, and Claude wrote that too. [Verified Garbage](https://github.com/pyca/verified-garbage/tree/2fa57c651a97a18e3e1c03503b583f62db9d9e2a) is an experimental cryptography library under the pyca organization, implemented by language models. Each primitive is assembly, written against a Lean model of the processor and proved in Lean to be correct against a specification, memory safe, and constant time. Its P-256 ECDSA verification [on x86-64](https://github.com/pyca/verified-garbage/pull/721) and [on AArch64](https://github.com/pyca/verified-garbage/pull/797) was merged on 3 and 4 October from commits authored by Claude. The point addition there is a complete formula, so there are no exceptional cases to branch on. The library has since added [secp256k1 on AArch64](https://github.com/pyca/verified-garbage/pull/1342) too: keys, ECDH and ECDSA, but not BIP340, BIP32 or Taproot tweaks. Its proofs rest on stated assumptions. On AArch64 the constant-time guarantee holds only if the caller has set DIT, and the Rust around the verified functions is tested, not proved. Even so, that is a different class of evidence from mine. My tests show agreement on the inputs I chose. A machine-checked proof covers every input, within the model it trusts. This module has nothing like it yet. I am not planning to swap Swift for Rust and assembly here. I am noting where the bar now is.

## Getting the money back

Trust in a primitive and getting your money back after losing a phone are different problems, and post-quantum signatures make the difference sharper.

[SLH-DSA, standardized in FIPS 205](https://csrc.nist.gov/pubs/fips/205/final), is a stateless hash-based signature scheme built on SPHINCS+. Stateless means the signer keeps no advancing record of which one-time keys it has used. It still has secret keys to protect and an implementation to get right, and FIPS 205 says nothing about a Bitcoin wallet's recovery words, derivation or backup format.

Recovery has four parts, and recovery words cover only the first:

- **Signing authority:** the secrets that authorize a spend, including any other signers the policy needs.
- **Coin discovery:** enough information and chain access to find the wallet's payments.
- **Account meaning:** the derivation rules, scripts, signer configuration and metadata needed to interpret what was restored.
- **Safe signing state:** whatever must survive so the next signature does not repeat a dangerous earlier one.

Winnow already shows the gap. Its [import bundle](https://github.com/winnowwallet/winnow/blob/6566871db0a40be481dd63b7960790ef4de9192e/Sources/WalletCore/Wallet/ImportBundle.swift) restores recorded history and scans forward from the saved height. That is one restore path with particular inputs, not proof that words alone rebuild every account, record and coin.

Discovery has a privacy cost. Winnow matches compact filters on the phone. [Winnow Rescue](/research/#rescue), which reads older backups and moves funds into a Taproot account, has a different job, and its [repository](https://github.com/winnowwallet/winnowrescue/blob/79ffa4da975b4134af20ce35986a39002cd76bc9/README.md) is an early scaffold that does not make privacy the priority. A server asked about wallet-specific scripts can link those questions, encrypted connection or not, and sweeping recovered coins together can link them on chain. The flow should say so before it does either.

[Silent Payments](/research/#silent-payments) raises the stakes. Receiving needs scanning keys and labels as well as spending keys, and [BIP352](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki) does not make a fresh phone's restore cheap. Winnow does not implement it yet.

Stateful schemes are sharper still. XMSS and LMS must never reuse a one-time key, and [NIST SP 800-208](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-208.pdf) requires the signer to advance and durably store its index before a signature leaves it. Restore an old backup and you restore an old index. A signature made after the backup and never mined is invisible to a rescan, and the next signature can reuse its key. A cloned signer causes the same problem. A stateless scheme avoids that bookkeeping, but not the other three parts. I would want evidence from crashes and stale-backup restores before asking anyone to rely on either, and this is research, not something Winnow or Rescue does today.

[P2MR](/research/#p2mr) belongs here too. BIP360 is a draft that commits directly to a script tree; it does not choose a post-quantum signature scheme or settle how a wallet recovers.

## What is next

- **A constant-time pass**, as above, measured before and after.
- **A separate app identity**, so the single-key build can live beside the App Store Winnow instead of replacing it.
- **Deciding where the module lives:** an independent package, an upstream contribution, or a target that stays inside the wallet. That decision includes whether shared signing and Silent Payments justify adding the curve operations this build left out.
- **A recovery record for each design**: what is saved, what can be rediscovered, who learns what during discovery, and what evidence permits signing again. Then lose the phone, restore an old copy, replace the signer, interrupt the scan, and see where the answers fail.

I wrote recently that a payment arriving is evidence about the path it took. This payment took a path I can read all the way down, and that was the point. Whether it is a path the shipping wallet should take is a question the next experiments have to answer.

The NIST seeds waited almost thirty years for an explanation, and the story everyone had been told about them turned out to be wrong. What settled it was evidence anyone can rerun. Confidence in a curve, a hash or a wallet is built the same way: specific claims, checks other people can repeat, and a willingness to be told no.

## Appendix: checking it yourself

### Halving the generator

Python's integers are enough. Halving a point means multiplying it by (n + 1) / 2, where n is the group order:

```python
p = 2**256 - 2**32 - 977
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)

def add(P, Q):
    if P is None: return Q
    if Q is None: return P
    if P[0] == Q[0] and (P[1] + Q[1]) % p == 0: return None
    if P == Q: slope = 3 * P[0] * P[0] * pow(2 * P[1], -1, p) % p
    else: slope = (Q[1] - P[1]) * pow(Q[0] - P[0], -1, p) % p
    x = (slope * slope - P[0] - Q[0]) % p
    return (x, (slope * (P[0] - x) - P[1]) % p)

def mul(k, P):
    R = None
    while k:
        if k & 1: R = add(R, P)
        P, k = add(P, P), k >> 1
    return R

half = mul((n + 1) // 2, G)
assert add(half, half) == G
print(hex(half[0]), half[0].bit_length())
```

```text
0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63 166
```

### Counting the lines

From a clone of the wallet repository, the size of the removal and the non-blank lines per module at both commits:

```bash
git clone https://github.com/winnowwallet/winnow && cd winnow
git diff --shortstat 6566871 3794057
for rev in 6566871 3794057; do
  for m in WalletCore WinnowApp VaultKit NativeSecp256k1; do
    printf '%s %s ' "$rev" "$m"
    git ls-tree -r --name-only "$rev" -- "Sources/$m" | grep '\.swift$' |
      while read -r f; do git show "$rev:$f"; done | grep -c -v '^[[:space:]]*$'
  done
done
```

### The first payment's signature

Fetch the transaction and its context from a public explorer:

```bash
curl -s https://blockstream.info/api/tx/ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e/hex > tx.hex
curl -s https://blockstream.info/api/tx/ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e
curl -s https://blockstream.info/api/blocks/tip/height
```

The JSON gives the spent output (`prevout`), the fee, the weight and the block. Confirmations are the tip height minus 972,342, plus one.

Read the bytes with the wallet's inspector from a checkout of the tag. It parses with the same WalletCore code the app uses and is offline:

```bash
git clone https://github.com/winnowwallet/winnow && cd winnow && git checkout v0.8.7
scripts/winnow-debug inspect tx "$(cat ../tx.hex)"
```

```json
{
  "inputs" : [
    {
      "sequence" : 4294967293,
      "txid" : "deeeaa2bd9f5636cdc76bd7e352fd96d01e22952e72694a36058af8d19c79d6a",
      "vout" : 1,
      "witnessItems" : 1
    }
  ],
  "locktime" : 972341,
  "outputs" : [
    {
      "scriptPubKey" : "512039e8fb58bce093e6eb458807f25b5b8c1732e66a41b694519a8e4521f69b4bea",
      "value" : 98290
    },
    {
      "scriptPubKey" : "00143238aa2652dcdc128c4a378d9d7f7c2d98334a00",
      "value" : 1000
    }
  ],
  "txid" : "ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e",
  "version" : 2,
  "vsize" : 142
}
```

`5120` followed by 32 bytes is a version 1 witness program (P2TR), and `0014` followed by 20 bytes is version 0 (P2WPKH).

To check the signature with the wallet's code, add an executable target to the checkout's `Package.swift`:

```swift
.executableTarget(
    name: "VerifySpend",
    dependencies: ["WalletCore", "NativeSecp256k1",
                   .product(name: "P256K", package: "swift-secp256k1")],
    path: "Tools/VerifySpend"
),
```

and put this in `Tools/VerifySpend/main.swift`:

```swift
import Foundation
import NativeSecp256k1
import P256K
import WalletCore

// usage: VerifySpend <raw transaction hex>
let tx = try Transaction.decode(Data(hex: CommandLine.arguments[1])!)
let spent = SighashBIP341.SpentOutput(   // deeeaa2b…9d6a output 1
    amount: 100_000,
    scriptPubKey: Data(hex: "512022e487129a0d2d5bdf02617c0fb7a8b59767d1d886498c7d3ca648337679950d")!)
let outputKey = spent.scriptPubKey.suffix(32)
let signature = tx.inputs[0].witness[0]
precondition(tx.inputs.count == 1 && tx.inputs[0].witness.count == 1 && signature.count == 64)

let sighash = try SighashBIP341.sighash(tx: tx, inputIndex: 0, spentOutputs: [spent], hashType: .default)
print("sighash", sighash.hex)
print("NativeSecp256k1", Secp256k1.Schnorr.verify(signature: signature, message: sighash,
                                                    publicKey: Data(outputKey)))
var flipped = Data(signature)
flipped[63] ^= 1
print("one bit flipped", Secp256k1.Schnorr.verify(signature: flipped, message: sighash,
                                                    publicKey: Data(outputKey)))
var message = [UInt8](sighash)
print("libsecp256k1", P256K.Schnorr.XonlyKey(dataRepresentation: Data(outputKey))
    .isValid(try P256K.Schnorr.SchnorrSignature(dataRepresentation: signature), for: &message))
```

```bash
swift run VerifySpend "$(cat ../tx.hex)"
```

```text
sighash 248a5ec225bb0b1fad54d82fcbbd673c247200c93fe39e31eb5bf01b06515779
NativeSecp256k1 true
one bit flipped false
libsecp256k1 true
```

To check it with nothing from the wallet, use Python 3 and BIP340's reference implementation. I used the same pinned copy the fixtures use, whose SHA-256 is `4b1d4ad9e60820df4a6d239733d52b014bc03e4c47afd757a2fe4d3b586d892c`:

```bash
curl -sO https://raw.githubusercontent.com/bitcoin/bips/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340/reference.py
python3 check_spend.py reference.py tx.hex
```

with this saved as `check_spend.py` next to `tx.hex`:

```python
# usage: python3 check_spend.py reference.py tx.hex
# reference.py is bip-0340/reference.py from bitcoin/bips.
import hashlib, importlib.util, struct, sys

spec = importlib.util.spec_from_file_location("bip340", sys.argv[1])
bip340 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bip340)
raw = bytes.fromhex(open(sys.argv[2]).read().strip())

# The coin being spent: deeeaa2b…9d6a output 1.
spent_spk = bytes.fromhex("5120" "22e487129a0d2d5bdf02617c0fb7a8b5"
                          "9767d1d886498c7d3ca648337679950d")
spent_amount = 100_000
sha = lambda b: hashlib.sha256(b).digest()

# This parser assumes what the transaction has: one input, an empty
# scriptSig, two outputs, one witness item, all lengths below 0xfd.
version, rest = raw[:4], raw[4:]
assert rest[:3] == b"\x00\x01\x01"            # segwit marker, flag, 1 input
outpoint, rest = rest[3:39], rest[39:]
assert rest[0] == 0                           # empty scriptSig
sequence, rest = rest[1:5], rest[5:]
count, rest, outputs = rest[0], rest[1:], []
for _ in range(count):
    n = rest[8]
    outputs.append(rest[:9 + n])              # value || len || script
    rest = rest[9 + n:]
assert rest[:2] == b"\x01\x40"                # one witness item, 64 bytes
signature, locktime = rest[2:66], rest[66:70]
assert len(rest) == 70

def sighash(amount):                          # BIP341, SIGHASH_DEFAULT, key path
    msg = (b"\x00" + b"\x00" + version + locktime
           + sha(outpoint) + sha(struct.pack("<q", amount))
           + sha(bytes([len(spent_spk)]) + spent_spk) + sha(sequence)
           + sha(b"".join(outputs)) + b"\x00" + struct.pack("<I", 0))
    return bip340.tagged_hash("TapSighash", msg)

key = spent_spk[2:]
print("sighash", sighash(spent_amount).hex())
print("valid", bip340.schnorr_verify(sighash(spent_amount), key, signature))
print("valid if the spent amount were 1 sat more",
      bip340.schnorr_verify(sighash(spent_amount + 1), key, signature))
```

```text
sighash 248a5ec225bb0b1fad54d82fcbbd673c247200c93fe39e31eb5bf01b06515779
valid True
valid if the spent amount were 1 sat more False
```

The message is BIP341's: the epoch byte, the hash type, version and locktime, then hashes of the prevouts, the spent amounts, the spent scripts, the sequences and the outputs, then the spend type and the input index. That message is hashed with the `TapSighash` tag. The Python and the Swift agree on all 32 bytes of it.

The same two programs check the second transaction, `3e28224c…a7a6`. Fetch its hex the same way, and change the spent output to output 0 of the first transaction: 98,290 sats locked by `512039e8fb58bce093e6eb458807f25b5b8c1732e66a41b694519a8e4521f69b4bea`. Both then print the sighash `a715126d3d57c8f7f97ca5a021348af22a00ec9f43925250876e10233d6b5380` and accept the signature.
