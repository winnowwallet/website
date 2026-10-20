# Winnow's Curve Math, Now in Swift

Draft — Alex Newman · October 20, 2026

*A single-key build of Winnow whose curve math is 894 lines of Swift, the mainnet payment it signed, and what it still lacks.*

Winnow has been a Bitcoin wallet written in Swift for a while, with one exception. Every key, every tweak and every signature went through P256K, a Swift wrapper around Bitcoin Core's C library, libsecp256k1. That library is excellent. It is also the one part of the wallet I could not read end to end, from the screen down to the arithmetic, and the question kept coming back: how hard would it be to own that boundary?

I had a [proof of concept](https://github.com/posix4e/native-secp256k1-swift-test) to start from. It did field arithmetic modulo the curve prime and the `lift_x` operation from BIP340, with expected answers produced outside Swift, and nothing else. It could not derive a key or sign a message. The distance from there to a wallet that pays is the interesting part.

This post describes the code, the evidence that it is correct, what it costs, and the first payment it signed on mainnet. Every number about the wallet comes from its repository at tag [v0.8.7](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d), from the [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172) that built it, or from the block chain, and the appendix gives the commands to check the transaction yourself.

## Shrink the problem first

How hard it is depends on what the wallet needs. Winnow's shared accounts need MuSig2 key aggregation, nonce sessions and script-path threshold spends, and those need far more of the curve than an ordinary payment does. So this experiment is a specialized Winnow: a single-key build with shared accounts removed. No 2-of-3 vaults, no cosigner cards, no shared savings.

The removal is four commits. [The first](https://github.com/winnowwallet/winnow/compare/8718dc554b3d4dc7fa895697c58a6b65d8947e01...0468c97297b34ad414c174a37f0b3c3eaa35d6c2) takes MuSig2, script-path multisig and cosigner keys out of WalletCore. The descriptor grammar becomes single-key `tr()` and `rawtr()`, and `musig()` or a script tree is refused when the descriptor is parsed. [The second](https://github.com/winnowwallet/winnow/commit/ae98c6f14efa0d793fb8fbd5eac96f39a2ed1226) removes the shared-savings screens and flows from the app, [the third](https://github.com/winnowwallet/winnow/compare/ae98c6f14efa0d793fb8fbd5eac96f39a2ed1226...81d90abf91f536d477ab3f5a83a58709597fa505) removes their tests, and [the fourth](https://github.com/winnowwallet/winnow/commit/fa3381981d016a6fdaf1949da8d95129814c5f33) updates the docs, scripts and CI gates to match. A backup file that carries shared-account records is refused outright, so its shared-account coins are never silently left out of a restore.

What is left is the minimum. Scalar arithmetic modulo the group order, field arithmetic modulo the prime, point addition and multiplication, the compressed and x-only encodings, the BIP32 and Taproot tweaks, BIP340 signing and verification, and the tagged hash. That is 894 lines of Swift in nine files under [`Sources/NativeSecp256k1`](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1), and it imports Foundation and CryptoKit and nothing else. ECDSA, ECDH, MuSig2 and script-path signing are out of scope. The [module's guide](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/README.md) states that scope and the module's limits.

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

## How I know it is right

One rule governs every test: the expected answer never comes from the code under test. The evidence builds in layers.

**Fixtures computed elsewhere.** The [field and x-only fixtures](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/Vectors/native-secp256k1/README.md) hold 2,624 pairs of field elements with their sums, products and negations, 168 square-root cases, and 318 x-only key inputs. Field answers come from Python's arbitrary-precision integers. The x-only answers come from two oracles that had to agree: the `lift_x` function of BIP340's `reference.py`, and a small C probe linked against libsecp256k1 v0.7.1. The fixture README records the pinned commits and the SHA-256 of every file. The [generator scripts](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tools/Generate/native-secp256k1/README.md) rebuild them from fresh checkouts and never call the Swift code.

**The official vectors.** The BIP340 test vectors must [sign to the expected bytes and verify as the CSV says](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L69). The BIP341 key-path spending vectors are tweaked, signed and verified natively. The BIP32 and BIP86 vectors WalletCore already ran now run through the new backend unchanged.

**Differential tests against libsecp256k1.** The test targets still link the pinned [swift-secp256k1 0.23.2](https://github.com/21-DOT-DEV/swift-secp256k1/tree/0.23.2) package as an oracle. [The key tests](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1KeyTests.swift) cover private-key validation and compressed-point parsing, junk prefixes included. They also cover all three tweak-adds, with zero, overflowing and infinity-producing tweaks. Each must accept, reject and produce bytes exactly as libsecp256k1 does. [The signing test](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L123-L142) makes 96 signatures, half with an all-zero auxiliary input and half with a random one given to both libraries. Each must be byte-identical to libsecp256k1's, so a valid signature that differs by one bit fails. [The verification test](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1SchnorrTests.swift#L144-L190) gives both verifiers seventeen candidates for each of 48 keys. The candidates include the valid signature, flipped bits, a changed message or key, r equal to p, s equal to n, swapped halves and wrong lengths. The two must return the same verdict on every one.

**Fuzzing.** The [`native-secp256k1` fuzz target](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tools/Fuzz/Sources/WinnowFuzzCore/NativeSecp256k1Exercise.swift) slices one input into a secret, a tweak, a point, a message, auxiliary randomness, a signature and an x coordinate. It feeds them to both backends and fails unless they accept or reject together and agree byte for byte. In the release run, the deterministic smoke campaign passed 16,000 cases across the harness's sixteen targets, a thousand of them in this one. That is a smoke test, not a long campaign.

**A real node.** The [signet journey](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/UITests/README.md) drives the app through creating a wallet, receiving coins from a private signet run by Bitcoin Core, sending a payment and watching it confirm, with screenshots at six checkpoints. The node checks the signature on that payment, so a confirmed send is the module's acceptance test against Bitcoin Core's own validation.

**The release.** The [release run](https://github.com/winnowwallet/winnow/actions/runs/39419425172) built tag v0.8.7 and passed every lane: 608 package tests, 227 app unit tests, the fuzz smoke run and the journey. Its TestFlight job compiled `NativeSecp256k1` and never compiled P256K or libsecp256k1. The C library is in the package graph only because the test targets still pin it.

None of that is a proof. It is agreement on a large set of cases, which is the most a test suite can say.

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

| | |
|---|---|
| Version | 2 |
| Size | 193 bytes, weight 568, virtual size 142 vbytes |
| Input | output 1 of `deeeaa2b…9d6a`: 100,000 sats locked to a Taproot (P2TR) output key, `22e48712…9950d`; sequence `0xfffffffd` |
| Witness | one item of 64 bytes |
| Outputs | 98,290 sats to a P2TR address (the change); 1,000 sats to a P2WPKH address (the payment) |
| Fee | 710 sats, 5.0 sat/vbyte |
| Locktime | 972,341 |
| Mined | [block 972,342](https://blockstream.info/block/000000000000000000003524d2ae7205c8ac854deb3d9afe5c3e8f8a5296e352), timestamp 15:03:42 UTC on 20 October |
| Confirmations | 9 when I checked, at block 972,350 (15:45 UTC) |

A single 64-byte witness item is what a Taproot key-path spend looks like. BIP341 lets a signature omit its sighash byte, and 64 bytes means it did: the hash type is `SIGHASH_DEFAULT`, which commits to every input and output. The signer [appends a byte](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/Signer.swift#L33-L35) only for other hash types. The sequence number signals BIP125 replaceability, which is the wallet's [default](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/TransactionBuilder.swift#L50-L51). The locktime is the wallet's [anti-fee-sniping](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/TransactionBuilder.swift#L53-L81) height, as Bitcoin Core sets it. The wallet uses either its tip or a height up to 99 blocks below it, never a height above. The transaction was mined in block 972,342, so the wallet's tip cannot have been higher than 972,341 when it built the transaction. It was therefore built and signed after the wallet had block 972,341 and before 972,342 was mined: by their timestamps, between 14:16:35 and 15:03:42 UTC. Miners set those timestamps, so the window is approximate.

I checked the signature myself, two ways. First with the wallet's own code: WalletCore's [BIP341 sighash](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/WalletCore/Transactions/SighashBIP341.swift#L221-L228) over the transaction and the coin it spends gives `248a5ec2…5779`. [`Secp256k1.Schnorr.verify`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Schnorr.swift#L40-L54) accepts the witness signature for that message under the output key, and so does libsecp256k1 through the pinned P256K. Then without any of it: a short Python script rebuilds the sighash from the raw bytes and gets the same 32 bytes. BIP340's own [`reference.py`](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340/reference.py) accepts the signature too. Both checks reject it if one bit of the signature is flipped, or if the spent amount is changed by one satoshi. The appendix has both programs.

What the chain cannot tell you is which code made that signature. libsecp256k1 would have produced a signature that verifies the same way. Because the auxiliary randomness was fresh, nobody can reproduce these exact bytes. The evidence that the Swift module signed is the build: build 97's TestFlight job never compiled libsecp256k1, and the phone that sent this payment was running build 97. The verified signature adds one thing the build alone does not show. To sign, build 97 had to derive the private key itself, through BIP32 and the BIP86 tweak, and it arrived at exactly the key the spent output commits to.

The timing deserves care too. The coin this transaction spends arrived in block 972,325, whose timestamp is 12:34:00 UTC, about eighteen minutes after the build reached the internal group. So I make no claim that this payment spent a coin the C-backed build had derived. It shows something narrower: a wallet created under the C library, upgraded in place, derived its keys and signed with the Swift module, and Bitcoin mainnet accepted the result less than three hours after the build reached TestFlight.

A separate app identity, so the two builds can live side by side, is the next thing to build.

## What is next

Three experiments follow from this one.

**A constant-time pass.** This means replacing the conditional subtractions, the per-bit branches and the secret-indexed table lookup with constant-time selects, clearing secrets after use, and measuring the speed again afterwards. Writing constant-time Swift is only half of it. The compiler decides what instructions run, and on Apple silicon some instructions take data-dependent time unless the processor's DIT flag is set. Apple [tells cryptographic code to set it](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms#Enable-DIT-for-constant-time-cryptographic-operations), with calls that exist from iOS 18.2 and a lower-level route for older systems. Winnow still supports iOS 17, and either route is a step that Swift source alone does not take.

A Bitcoin wallet on Apple's platforms has to bring its own secp256k1, because the system speaks P-256. CryptoKit's [`P256`](https://developer.apple.com/documentation/cryptokit/p256) and the Secure Enclave's keys are NIST's curve, and CryptoKit enables DIT for them internally; there is no system secp256k1 to call. P-256 had a notable week. On 16 October Anthropic [published](https://www.anthropic.com/research/ecdsa-curve-origins) Claude's reconstruction of how the seeds of P-256 and other NIST curves were generated. Anthropic says the work is "not a cryptographic break, new attack, or weakness" and that it makes a deliberate backdoor much less plausible. That is a result about where the curve's constants came from. It is not a proof about any implementation, and it says nothing about Bitcoin's curve.

The kind of evidence this module lacks exists elsewhere, and Claude wrote that too. [Verified Garbage](https://github.com/pyca/verified-garbage/tree/2fa57c651a97a18e3e1c03503b583f62db9d9e2a) is an experimental cryptography library under the pyca organization, implemented by language models. Each primitive is assembly, written against a Lean model of the processor and proved in Lean to be correct against a specification, memory safe, and constant time. Its P-256 ECDSA verification [on x86-64](https://github.com/pyca/verified-garbage/pull/721) and [on AArch64](https://github.com/pyca/verified-garbage/pull/797) was merged on 3 and 4 October from commits authored by Claude. The point addition there is a complete formula, so there are no exceptional cases to branch on. The library has since added [secp256k1 on AArch64](https://github.com/pyca/verified-garbage/pull/1342) too: keys, ECDH and ECDSA, but not BIP340, BIP32 or Taproot tweaks. Its proofs rest on stated assumptions. On AArch64 the constant-time guarantee holds only if the caller has set DIT, and the Rust around the verified functions is tested, not proved. Even so, that is a different class of evidence from mine. My tests show agreement on the inputs I chose. A machine-checked proof covers every input, within the model it trusts. This module has nothing like it yet. I am not planning to swap Swift for Rust and assembly here. I am noting where the bar now is.

**Removing the last pin.** The test suite still links libsecp256k1, as its differential oracle and for the signet miner's ECDSA signatures. Recorded vectors and a miner that signs another way would leave the repository with no third-party package at all. That change is in progress on a branch. It is not merged, and nothing described here depends on it.

**Deciding where the module lives:** an independent package, an upstream contribution, or a target that stays inside the wallet. That decision includes whether shared signing and Silent Payments justify adding the curve operations this build left out.

I wrote recently that a payment arriving is evidence about the path it took. This payment took a path I can read all the way down, and that was the point. Whether it is a path the shipping wallet should take is a question the next experiments have to answer.

## Appendix: checking the transaction yourself

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
