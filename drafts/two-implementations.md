# Two Implementations Are Better Than One

Draft — Alex Newman · October 23, 2026

*A follow-up to [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): I planted 21 bugs in Winnow's Swift curve code to see whether my tests would notice. Most of the time the fuzzer didn't. So I gave it a second implementation to argue with.*

Winnow signs with its own Swift secp256k1. On a phone, timing leaks and stray secrets in memory aren't the worry yet. The worry is simpler: is the math right? I thought I was checking that. This is how I found out how well.

## One implementation is the rules. Two is an oracle.

Bitcoin learned to be wary of second implementations the hard way. In March 2013 a large block split the chain because versions before 0.8 ran out of database locks processing it and 0.8 didn't ([BIP50](https://github.com/bitcoin/bips/blob/master/bip-0050.mediawiki)). Two years later, [BIP66](https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki) made strict DER signatures a rule, because OpenSSL's signature parser had quietly become part of consensus and then changed. For consensus code, a second implementation is a liability unless it reproduces every quirk of the first.

A wallet's signing code isn't consensus code. It doesn't decide which blocks are valid. It makes signatures the network accepts or rejects. For that job, a second implementation isn't a fork risk. It's an oracle.

## What the first oracle caught

While Winnow still linked libsecp256k1, every operation in the Swift module was compared with it. BIP340 signing is deterministic given its extra randomness, so two correct implementations must produce identical bytes. "It verifies" is a weak test. "It's the same 64 bytes" is a sharp one, and you only get it with a second implementation.

The comparison also found a bug nobody was looking for, in the C library's Swift wrapper rather than in my code. It passed a tweak of any length to C functions that read exactly 32 bytes. A longer tweak was silently cut short. A shorter one sent the C code reading past the end of the array.

## Then the oracle left

To ship with no third-party packages, I took libsecp256k1 out of the build, tests included. The live comparisons became recorded answers, each computed by BIP340's Python reference and by a small C program over libsecp256k1, and kept only where the two agreed.

The fuzzer kept running and kept passing. Its comment still said it compared "both secp256k1 backends". There was only one left. It was checking the module against itself.

## Planting bugs

To see what that cost, I made 21 copies of the code, each with one realistic bug, and ran the pull-request fuzz job (1,000 cases) and the unit tests against each.

Nine break ordinary arithmetic: a dropped term in a multiplication, a sign that never flips. Seven live on rare paths: a carry, a reduction that only matters near the top of the field or the group order, or adding a point to itself. Five are shared by signing and verifying: a wrong generator, a tag hashed once instead of twice, a signer that ignores its randomness, a verifier that ignores R's parity, a square root that never checks itself. Those are the scary ones. Every signature still verifies, against the same wrong code.

| | Bugs | Fuzzer before | Fuzzer after | Unit tests before | Unit tests after |
|---|---|---|---|---|---|
| Ordinary arithmetic | 9 | 9 | 9 | 9 | 9 |
| Rare paths | 7 | 2 | 5 | 6 | 7 |
| Shared by signing and verifying | 5 | 2 | 5 | 5 | 5 |
| **Total** | **21** | **13** | **19** | **20** | **21** |

The old fuzzer caught every ordinary bug, usually on the first case, and missed most of the rest. Running it 25 times longer found nothing more. More random inputs don't help when a bug lives where random inputs never go, or when the code agrees with itself.

The unit tests did much better, at 20, because their recorded answers came from somewhere else. One bug got past everything.

## The carry nobody tested

The multiplier adds up partial products column by column, and each column keeps a small running carry. One of those carries only fires when a 64-bit column is exactly all ones at the wrong moment. Drop it, and some products come out wrong.

The code handles that carry correctly. Until now, no test proved it. A test for (p − 1) × (p − 1) already existed, and it doesn't trigger the carry. A short search found operands that do, in 86 tries, once each limb was all ones, the top bit alone, or one of p's own limbs. Key and point coordinates look random, and random limbs essentially never look like that.

## A second implementation, on purpose

So the fuzzer now has [something to argue with](https://github.com/winnowwallet/winnow/blob/d47ba8335e58a3125c830f6065520f5b89bfd20e/Tools/Fuzz/Sources/WinnowFuzzCore/ReferenceSecp256k1.swift): about 300 lines of deliberately plain Swift that shares none of the module's algorithms. The module uses 64-bit limbs, reduces with p's special shape, inverts by exponentiation and keeps points in Jacobian coordinates. The reference uses 32-bit limbs, Montgomery multiplication, the binary extended Euclidean inverse, affine points, and BIP340 written straight from the spec's pseudocode. It's slow, and it's meant to be easy to check by eye.

Before it judges anything, it has to reproduce BIP340's own test vectors. My first run of that test passed while checking nothing. The vectors file has Windows line endings, and Swift treats "\r\n" as a single character, so splitting on "\n" found zero vectors, and a loop over zero vectors can't fail. A separate test that the file had actually loaded is what caught it. A test that checks nothing passes.

The fuzzer now demands byte-for-byte agreement on keys, tweaks, parsing, signatures and verdicts. It builds a signature that's valid in every way except R's parity and requires it to fail. And it pushes half its inputs to the edges: just below and around the group order and p, or long runs of ones and zeros.

My first version of those edges had a bug of its own. It took its offsets from bytes the seed almost never changes, so "exactly the group order" almost never came up. A hash of the whole input fixed it.

For the carry, a new unit test feeds both implementations operands built from awkward limbs and compares every product, square, sum and inverse. Its first version had the same blind spot in another place: independent limbs almost never land in the sliver between p and 2^256, where one of the reductions lives. Now a quarter of the operands carry p's top limbs and a quarter carry the group order's.

## What it caught

Against the same 21 bugs, the fuzzer now catches 19. The two it misses sit deep in field arithmetic that keys and points can't steer, and the new test catches both, so the unit tests catch all 21.

The real module passes all of it. No real bug turned up this time. The [code is in draft pull request #242](https://github.com/winnowwallet/winnow/pull/242).

## Who wrote both?

Claude wrote most of the curve module, with me directing, reviewing and testing it on a phone. Claude wrote the reference too. That's exactly where AI makes this worse: one model can carry the same misunderstanding into two implementations, and into the tests that compare them, and everything agrees.

So the rules matter more, not less. The expected answer never comes from the code under test. The reference had to match vectors neither implementation wrote. The two share no arithmetic, so a shared mistake would have to be a shared misreading of the spec, which is what the published vectors and the libsecp256k1 recordings guard against. And the network is the last word: a signature Bitcoin Core accepts and a miner includes was checked by code nobody in this project wrote.

Proofs beat all of it. [Verified Garbage](https://github.com/pyca/verified-garbage/tree/2fa57c651a97a18e3e1c03503b583f62db9d9e2a), an experimental library under the pyca organization, has language models write assembly and prove it correct and constant-time in Lean. My tests show agreement on the inputs I chose. A machine-checked proof covers every input, within the model it trusts.

Two implementations don't make either one trustworthy. They make disagreements visible. The planted bugs are how I check that the disagreements actually get looked for.
