# Winnow's Curve Math, Now in Swift

Draft — Alex Newman · October 20, 2026

*A single-key build of Winnow with no third-party code in the app, and what it cost to get there.*

Winnow has been a Bitcoin wallet written in Swift for a while, with one exception. Every key, every tweak and every signature went through P256K, a Swift wrapper around Bitcoin Core's C library, libsecp256k1. That library is excellent. It is also the one part of the wallet I could not read end to end, from the screen down to the arithmetic, and the question kept coming back: how hard would it be to own that boundary?

I had a [proof of concept](https://github.com/posix4e/native-secp256k1-swift-test) to start from. It did field arithmetic modulo the curve prime and the `lift_x` operation from BIP340, with expected answers produced outside Swift, and nothing else. It could not derive a key or sign a message. The distance from there to a wallet that pays is the interesting part.

## Shrink the problem first

The honest answer to "how hard" depends on what the wallet needs. Winnow's shared accounts need MuSig2 key aggregation, nonce sessions and script-path threshold spends, and those need far more of the curve than an ordinary payment does. So this experiment is a specialized Winnow: a single-key build with shared accounts removed. No vaults, no cosigner cards, no shared savings. A backup file that carries shared-account records is refused outright rather than restored with those coins silently missing.

What is left is the minimum. Scalar arithmetic modulo the group order, field arithmetic modulo the prime, point addition and multiplication, the compressed and x-only encodings, the BIP32 and Taproot tweaks, BIP340 signing and verification, and the tagged hash. That is about nine hundred lines of Swift in nine files, and it depends on Foundation and CryptoKit and nothing else. The [module's guide](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/README.md) describes it in detail.

## The shape of the code

The module is four layers, and each layer uses only the one below it.

At the bottom is a 256-bit unsigned integer in four 64-bit limbs, because Swift's 128-bit integer is not available on iOS 17. It adds, subtracts and multiplies, and its 512-bit product is built by product scanning: each output limb is the column sum of the partial products that land on it.

Above that are two modular types. A field element is an integer below the curve prime, kept fully reduced; the prime is 2^256 minus a small constant, so anything that overflows past 256 bits is folded back by multiplying with that constant. Inversion is Fermat's little theorem and square roots use the fact that the prime is 3 mod 4. A scalar is the same idea modulo the group order, and that is what private keys, nonces and tweaks are.

Then the curve. Points are kept in Jacobian coordinates with the standard doubling and mixed-addition formulas for a curve with a = 0, and the three cases those formulas cannot express (infinity, doubling, inverses) are handled as explicit branches. A fixed-base table of 960 precomputed points makes multiplying the generator cost at most 64 additions instead of 256 doublings, which is what keeps address derivation fast enough for a wallet that derives hundreds of addresses on every sync.

At the top is the public face: private keys, compressed public keys and x-only keys with exactly the validation rules and parity behaviour of the libsecp256k1 calls they replace, so that nothing in the wallet above them had to change, and a BIP340 signer that follows the specification's reference algorithm step for step and verifies its own signature before handing it back.

## How I know it is right

One rule governs every test: the expected answer never comes from the code under test.

The field, scalar and point tests use fixtures computed in Python integer arithmetic and by a small C program linked against libsecp256k1, both kept in the repository with the scripts that produced them. The wallet's existing BIP32, BIP86, BIP340 and BIP341 vectors run unchanged through the new backend. Differential tests compare every public operation with libsecp256k1, and signatures must match it byte for byte under fixed auxiliary randomness; a valid but different signature fails. The fuzz harness feeds the same input to both backends and fails on any disagreement. Finally, the recorded signet journey creates a wallet, receives test coins, sends a payment and watches it confirm on a real node, with the native signature under it, and the shipped binary links no libsecp256k1 at all.

None of that is a proof. It is agreement on a large set of cases, which is the most a test suite can say.

## What it costs

Measured in a release build on an Apple silicon Mac, microseconds per operation:

| Operation | Native Swift | libsecp256k1 |
|---|---|---|
| Multiply the generator | 37 | 11 |
| BIP32 public child | 52 | 19 |
| Taproot tweak | 50 | 22 |
| BIP340 sign, including its self-check | 271 | 26 |
| BIP340 verify | 207 | 18 |

Address derivation, the thing a wallet does constantly, stays within three times the C library on the child-key and tweak rows; multiplying the generator on its own is about 3.4 times. Signing and verifying happen once per spent input and are roughly ten times slower, which on a phone is still a quarter of a millisecond.

The larger cost is not speed. Every operation in this first version is variable-time: how long it takes depends on the secret it is processing. And the scalar copies made while signing and tweaking are not cleared from memory afterwards. libsecp256k1 has had years of deliberate work on exactly those two properties, and the honest statement is that this module has had none yet. The wallet's documentation used to say that all secret math ran in constant-time C. Those sentences were rewritten, because they would otherwise have been false.

That trade-off is acceptable for an internal test build on a phone I control. It is not a claim about what the shipping wallet should do.

## Shipping it

The build went to TestFlight as Winnow 0.8.7, build 97, for internal testers only, under Winnow's own app identity. That choice has consequences I would rather state than discover. It replaces the App Store Winnow on a tester's phone. It cannot see shared-account funds, and creating or deleting a wallet inside it removes their records. And because its automatic iCloud backup has no shared accounts in it, it rewrites the backup the production app made. The notes in TestFlight say: do not install it over a phone that holds shared-account funds.

Then I installed it on my own phone, over the App Store Winnow and a live wallet. It upgraded the wallet in place, and the wallet went on receiving and sending as before. The signature on [the mainnet send](https://blockstream.info/tx/ad627d565202df6e644af195fd2ba9a1908631999ec55ae12a36ce5e784b5d6e) came from the Swift module, and Bitcoin mainnet accepted and mined it a few hours after the build reached TestFlight.

A separate app identity, so the two can live side by side, is the next thing to build.

## What is next

Three experiments follow from this one. A constant-time pass, replacing the conditional subtractions, the per-bit branch in scalar multiplication and the secret-indexed table lookup with constant-time selects, and clearing secrets after use, with the speed measured again afterwards. Removing the last pin: the test suite still links libsecp256k1 as its oracle and for the signet miner's ECDSA signatures, and recorded vectors plus a miner signer of its own would leave the repository with no third-party package at all. And a decision about where the module lives: an independent package, an upstream contribution, or a target that stays inside the wallet.

I wrote recently that a payment arriving is evidence about the path it took. This payment took a path I can read all the way down, and that was the point. Whether it is a path the shipping wallet should take is a question the next experiments have to answer.
