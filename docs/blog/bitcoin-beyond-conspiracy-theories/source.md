# Bitcoin Beyond Conspiracy Theories

*The NIST curve seeds had no secret and no lost phrase. Bitcoin's curve has no seed at all. And 894 lines of my own Swift signed a payment to Kraken.*

## There was no phrase

For 29 years, the seeds behind NIST's elliptic curves were cryptography's favourite conspiracy theory. Every curve from P-192 to P-521 in [FIPS 186](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf) is "verifiably random": its coefficient comes from the SHA-1 hash of a published 160-bit seed. Anyone could check the hash. Nobody could say where the seeds came from. And once NIST [dropped Dual_EC_DRBG](https://www.nist.gov/news-events/news/2014/04/nist-removes-cryptography-algorithm-random-number-generator-recommendations) in 2014, an unexplained number in a NIST curve looked like a place to hide something.

The seeds were apparently made by Jerry Solinas at the NSA in 1997, and the story that came down from him was charming. He reportedly said they were hashes of English phrases, something like `SHA1("Jerry deserves a raise.")`, and that the phrases were lost with an old computer. He tried every phrase he could remember. None matched.[^weis] Solinas died in 2023. That October, Filippo Valsorda offered [$12,288](https://words.filippo.io/dispatches/seeds-bounty/) to anyone who found them.

On 16 October, Anthropic's Frontier Red Team [published the answer](https://www.anthropic.com/research/ecdsa-curve-origins). There was no phrase.

An Anthropic employee asked Claude how the seeds were made, without pointing it at the clue. In under half an hour it guessed that a 1990s program had used a weak random number generator, wrote a scanner for that generator's fingerprints, spotted a pattern of zero top bits, and recovered the generator's state with lattice reduction. The seeds are outputs of the C library's `lrand48`, seeded with Unix timestamps from 1997 and 1998. In Anthropic's code, P-256's seed is candidate 1,842 from a generator started at 01:52:34 UTC on 16 August 1997. The bounty goes to the Internet Security Research Group.

## Bitcoin's curve has no seed

Bitcoin doesn't use P-256. It uses secp256k1, from Certicom's [SEC 2](https://www.secg.org/sec2-v2.pdf): y² = x³ + 7 over the prime p = 2²⁵⁶ − 2³² − 977. Nothing in it is random. The prime is shaped to make arithmetic cheap, and 0 and 7 are about as small as constants get. There's no seed to explain.

There is one loose end. Halve Bitcoin's generator G and the x-coordinate of the result is `0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63`. That's 166 bits, where a random point's would have about 256. So G is twice a point somebody picked for its small x-coordinate, and nobody has said why. The appendix has the twenty lines of Python that show it.

It doesn't matter for security. Every point except infinity generates the same group, and a discrete log with respect to one generator converts to any other for free. A chosen generator can't hide a weakness the way a chosen curve could.

## Every wallet brings its own curve

Bitcoin pays for its own curve in compatibility. Apple's Secure Enclave only does P-256.[^apple-se] Android's StrongBox documentation lists P-256, and secp256k1 isn't on the page.[^android] Browsers' Web Crypto offers P-256, P-384 and P-521.[^mdn] So a Bitcoin wallet can't hand its keys to the phone's secure hardware or use the platform's signatures. It brings its own curve, and it has to keep it right everywhere it runs.

There are plenty of implementations, in Go,[^dcrd] Rust[^k256] and JavaScript.[^noble] But one is everywhere: libsecp256k1, the C library inside Bitcoin Core.[^libsecp,core] Rust's `secp256k1` crate wraps it,[^rustsecp] and so do Python's coincurve,[^coincurve] the Swift package P256K[^p256k] and go-ethereum's cgo build.[^geth] Winnow was one of those wrappers. One library means one thing to review very well. It also means one mistake lands everywhere at once, and you'd only notice with an independent implementation.

## Why I trust SHA-256

Bitcoin also leans on SHA-256, another NSA design. I trust it, but not because it's a standard. I trust it because the evidence can be checked.

Its constants have a recipe. The eight initial values are the fractional parts of the square roots of the first eight primes, and the 64 round constants come from the cube roots of the first 64 primes ([FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf), sections 4.2.2 and 5.3.3). Anyone can reproduce them, so nobody tuned those numbers. That doesn't prove the design is secure. That part comes from people attacking it in public.

And public attacks work. In 2017, researchers produced [two different PDFs with the same SHA-1 digest](https://eprint.iacr.org/2017/190). That broke SHA-1's collision resistance, and it's why "industry standard" never means "secure forever". It says nothing about SHA-256. SHA-3 came out of an [open competition](https://csrc.nist.gov/Projects/hash-functions/sha-3-project), with public submissions, public comments and a [final report](https://nvlpubs.nist.gov/nistpubs/ir/2012/NIST.IR.7896.pdf) on why Keccak won. It's a different design alongside SHA-2, not a sign that SHA-2 failed.

So when someone claims a break, I ask four things. The full algorithm, or fewer rounds? A collision, or a preimage? What did it cost? Has anyone reproduced it? Those answers make even bad news useful.

## So I wrote the curve

That's the kind of trust I want Winnow to earn: publish the design, show the assumptions, and change course when the evidence does. A Swift rewrite doesn't inherit anyone's correctness. Passing known-answer tests proves agreement on those answers and nothing more. It says nothing about timing leaks, bad randomness or malformed input, which is why the [native Swift research](/research/#native-swift) tracks those separately.

Winnow has been a Bitcoin wallet written in Swift for a while, with one exception. Every key, tweak and signature went through P256K, a Swift wrapper around libsecp256k1. That library is excellent. It was also the one part of the wallet I couldn't read end to end, from the screen down to the arithmetic. Owning it meant writing the curve, because Apple won't: CryptoKit's [`P256`](https://developer.apple.com/documentation/cryptokit/p256) is NIST's curve, and there's no system secp256k1.

I started from a [proof of concept](https://github.com/posix4e/native-secp256k1-swift-test) that did field arithmetic and BIP340's `lift_x`, and nothing else. It couldn't derive a key or sign anything. Getting from there to a wallet that pays was the interesting part.

The result is [`NativeSecp256k1`](https://github.com/winnowwallet/winnow/tree/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1): nine files, 894 lines of Swift, 781 of them not blank, importing Foundation and CryptoKit and nothing else. It does what a single-key wallet needs and no more: field and scalar arithmetic, point addition and multiplication, compressed and x-only keys, the BIP32[^bip32] and Taproot[^bip341] tweaks, BIP340 signing and verification,[^bip340] and the tagged hash. I shipped it in a single-key build of Winnow with shared accounts taken out.

It's variable-time, and it doesn't wipe secrets from memory; libsecp256k1 guards against both. On a phone, neither is the worry yet. Exploiting them takes code running on the device or a way to time thousands of my signatures. The worry is whether the math is right.

## Four layers

Each layer only uses the one below it.

[`Integer256`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Integer256.swift) is a 256-bit number in four 64-bit limbs, because Swift's `UInt128` needs iOS 18[^uint128] and the app supports [iOS 17](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/project.yml#L21). Squaring computes each cross product once and adds it twice, so it takes ten 64-bit multiplications instead of sixteen.

[`FieldElement`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/FieldElement.swift) works modulo p, and p's shape is the trick. Because p is 2²⁵⁶ minus a small constant, 2²⁵⁶ is congruent to that constant, 2³² + 977. Anything that spills past 256 bits gets multiplied by the constant and added back in:

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

The [full function](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/FieldElement.swift#L106-L130) explains, in a comment, why a few folds and one conditional subtraction always land below p. Inversion is Fermat's little theorem. Square roots work because p ≡ 3 (mod 4), and the code squares the answer to check it.

[`Scalar`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Scalar.swift) is the same idea modulo the group order, and it's what private keys, nonces and tweaks are. It multiplies the slow, simple way, because the wallet does that once per signature.

[`Point.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Point.swift) uses Jacobian coordinates and the a = 0 formulas from the Explicit-Formulas Database.[^efd] The addition formula breaks when the two points are equal or opposite, so [the code](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Point.swift#L56-L77) checks for those cases first, and they have [tests of their own](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Tests/BitcoinCoreTests/NativeSecp256k1CurveTests.swift#L219). [`GeneratorTable`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/GeneratorTable.swift) precomputes 960 multiples of G, 61 KB built in about a millisecond, so any multiple of G costs at most 64 additions and no doublings.

On top, [`Secp256k1Keys.swift`](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Keys.swift) copies the validation rules and parity behaviour of the four libsecp256k1 tweak calls it replaces. That's why nothing above it had to change. Nothing in it traps on bad input, which matters because the Taproot tweak also runs on control blocks from other people's transactions. And [the signer](https://github.com/winnowwallet/winnow/blob/ff892b9039fe2bc5beae08d992dfd6f3057bfb6d/Sources/NativeSecp256k1/Secp256k1Schnorr.swift#L13-L36) ends the way BIP340's reference does, by verifying its own signature before handing it back:

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

BIP340 recommends that, because a signature broken by a computation error can leak the key.[^bip340] It can't catch a bug the signer and verifier share, though. That takes a second implementation.

## Is the math right?

A broken signer usually fails loudly: its signatures don't verify. The dangerous bugs are quiet. Some live on rare paths, like a carry out of the top limb that ordinary inputs never reach. Others are consistent: a wrong constant or a wrong hash that signing and verifying share, so every signature still checks out against the same wrong code.

Three things check the module. Recorded answers from libsecp256k1 and BIP340's reference code cover hand-picked edge cases. The official BIP32, BIP86, BIP340 and BIP341 vectors cover the specs. And a fuzzer throws mutated inputs at it on every pull request.

I wanted to know whether the fuzzer was doing its job, so I planted 21 realistic bugs in the curve code, one at a time, and ran the pull-request fuzz job against each. It caught 13. It missed three of the five consistent bugs, because it only checked the module against itself, and five of the seven rare-path ones, because random bytes never got there. Running it 25 times longer caught nothing more. The unit tests did better, at 20, and the one they missed, a lost carry in the multiplier, got past everything.

So the fuzzer now has something to argue with: [a second implementation](https://github.com/winnowwallet/winnow/blob/d47ba8335e58a3125c830f6065520f5b89bfd20e/Tools/Fuzz/Sources/WinnowFuzzCore/ReferenceSecp256k1.swift), about 300 lines of deliberately plain Swift that shares none of the module's algorithms. It uses 32-bit limbs instead of 64, Montgomery multiplication instead of p's special form, affine points instead of Jacobian, and BIP340 written straight from the spec. It has to reproduce BIP340's own vectors before it's trusted. The fuzzer demands byte-for-byte agreement between the two and pushes half its inputs to the edges: around the group order and p, or long runs of ones. A new test feeds both implementations operands built from awkward limbs, all ones or the top bit alone, which is what it takes to reach that carry.

Against the same 21 bugs, the fuzzer now catches 19, and with the new test the unit tests catch all 21. The two the fuzzer still misses sit deep in field arithmetic that keys and points can't steer, which is what that test is for.

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

One 64-byte witness item is a Taproot key-path spend with the default sighash, which commits to every input and output.[^bip341] The locktime tells you when it was signed. Winnow sets it the way Bitcoin Core does, never above its own tip, so the phone signed after it saw block 972,341 and before 972,342 was mined: between 14:16 and 15:03 UTC, by the miners' timestamps.

I checked the signature two ways. Winnow's own sighash code and Swift verifier accept it, and so does libsecp256k1. Then, with nothing from the wallet, a short Python script rebuilt the sighash from the raw bytes, and BIP340's [`reference.py`](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340/reference.py) accepted the signature too. Flip one bit, or change the amount by one satoshi, and both reject it. The appendix has both programs.

The chain can't say which code signed. libsecp256k1 would have made a signature that verifies the same way. The evidence is the build: build 97's job never compiled libsecp256k1, and that's what the phone was running. The signature adds one thing. To make it, the Swift code had to derive the private key through BIP32 and BIP86,[^bip32,bip86] and it arrived at exactly the key the coin was locked to.

![The payment detail for the funding coin: Received from Kraken, 100,000 sats, confirmed, with the receive address labelled Kraken](/images/blog/native-swift-secp256k1/funding-coin.png)

*The coin the first send spent. The label is my own note on the address; the screen says it doesn't verify who sent the payment.*

That first payment didn't reach my account. Kraken's [minimum Bitcoin deposit](https://support.kraken.com/articles/360000292886-cryptocurrency-deposit-fees-and-minimums) is 10,000 sats, ten times what I sent, and smaller deposits are marked failed and lost. A 1,000-sat lesson.

So I sent [another](https://blockstream.info/tx/3e28224cb67f95a1909a34b7bfceca5c10305d94a031fdc34b374007bc0ae7a6): 12,345 sats, the same shape, one 64-byte signature at 5.0 sat/vbyte, mined in block 972,351. That one went through. Its input was the first payment's change, so build 97 signed the transaction that made the coin and then spent it. Both coins arrived after the upgrade. A 4,230-sat coin from before it was still unspent when I wrote this, and spending it would show the Swift code signing for a coin the C build received.

## Multisig needed no new curve code

The latest internal build, [0.8.11](https://github.com/winnowwallet/winnow/releases/tag/v0.8.11), adds Taproot multisig in Advanced mode: two phones and a Ledger in a 2-of-3, say, with an optional recovery path that lets fewer signers move a coin that has sat still for a while. Each signer makes an ordinary BIP340 signature over a different message,[^bip342] so between `3794057` and [`7b7ff30`](https://github.com/winnowwallet/winnow/tree/7b7ff30db3156224e2cf1da3d93b591a59c88844), the curve module's Swift files didn't change at all. The price is paid on-chain: a 2-of-2 spend is about 42 vbytes bigger per input than a single signature, and anyone can see it's multisig.

None of it has signed on a physical Ledger yet. That's the next test. The [research page](/research/#thresholds) has the details, and the whole line is [draft pull request #241](https://github.com/winnowwallet/winnow/pull/241).

## The bar

The NIST seeds waited 29 years for an explanation, and the story everyone told turned out to be wrong. What settled it was evidence anyone can rerun, and that's the bar for a wallet too.

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

For the multisig line, run the same loop over `3794057 7b7ff30`: the curve module stays at 781 lines.

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

## References

[^weis]: Stephen A. Weis, “How were the NIST ECDSA curve parameters generated?”, September 2023, updated since. The account of Solinas's phrase is second-hand there too. [https://saweis.net/posts/nist-curve-seed-origins.html](https://saweis.net/posts/nist-curve-seed-origins.html) Accessed 20 October 2026.
[^apple-se]: Apple, “Protecting keys with the Secure Enclave”, Apple Developer Documentation. [https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave) Accessed 20 October 2026.
[^android]: Android Developers, “Android Keystore system”. [https://developer.android.com/privacy-and-security/keystore](https://developer.android.com/privacy-and-security/keystore) Accessed 20 October 2026.
[^mdn]: MDN Web Docs, “EcKeyGenParams”. [https://developer.mozilla.org/en-US/docs/Web/API/EcKeyGenParams](https://developer.mozilla.org/en-US/docs/Web/API/EcKeyGenParams) Accessed 20 October 2026.
[^dcrd]: Decred developers, dcrd, package dcrec/secp256k1 (README). [https://github.com/decred/dcrd/tree/master/dcrec/secp256k1](https://github.com/decred/dcrd/tree/master/dcrec/secp256k1) Accessed 20 October 2026.
[^k256]: RustCrypto, k256, “secp256k1 (K-256) elliptic curve” (README). [https://github.com/RustCrypto/elliptic-curves/tree/master/k256](https://github.com/RustCrypto/elliptic-curves/tree/master/k256) Accessed 20 October 2026.
[^noble]: Paul Miller, noble-secp256k1 (README). [https://github.com/paulmillr/noble-secp256k1](https://github.com/paulmillr/noble-secp256k1) Accessed 20 October 2026.
[^libsecp]: Bitcoin Core developers, libsecp256k1 (README). [https://github.com/bitcoin-core/secp256k1](https://github.com/bitcoin-core/secp256k1) Accessed 20 October 2026.
[^core]: Bitcoin Core, source tree, src/secp256k1. [https://github.com/bitcoin/bitcoin/tree/master/src/secp256k1](https://github.com/bitcoin/bitcoin/tree/master/src/secp256k1) Accessed 20 October 2026.
[^rustsecp]: rust-bitcoin developers, rust-secp256k1, a wrapper around libsecp256k1 (README). [https://github.com/rust-bitcoin/rust-secp256k1](https://github.com/rust-bitcoin/rust-secp256k1) Accessed 20 October 2026.
[^coincurve]: Ofek Lev, coincurve, Python bindings for libsecp256k1 (README). [https://github.com/ofek/coincurve](https://github.com/ofek/coincurve) Accessed 20 October 2026.
[^p256k]: 21.dev, swift-secp256k1, whose P256K module wraps libsecp256k1; the README notes that secp256k1 is not Apple's P256 curve (README). [https://github.com/21-DOT-DEV/swift-secp256k1](https://github.com/21-DOT-DEV/swift-secp256k1) Accessed 20 October 2026.
[^geth]: go-ethereum developers, crypto/secp256k1/secp256.go, whose package comment says it wraps the Bitcoin secp256k1 C library, built when cgo is enabled. [https://github.com/ethereum/go-ethereum/blob/master/crypto/secp256k1/secp256.go](https://github.com/ethereum/go-ethereum/blob/master/crypto/secp256k1/secp256.go) Accessed 20 October 2026.
[^bip32]: Pieter Wuille, “BIP 32: Hierarchical Deterministic Wallets”. [https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0032.mediawiki](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0032.mediawiki)
[^bip341]: Pieter Wuille, Jonas Nick and Anthony Towns, “BIP 341: Taproot: SegWit version 1 spending rules”. [https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0341.mediawiki](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0341.mediawiki)
[^bip340]: Pieter Wuille, Jonas Nick and Tim Ruffing, “BIP 340: Schnorr Signatures for secp256k1”. [https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340.mediawiki](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0340.mediawiki)
[^uint128]: Apple, “UInt128”, Swift standard library documentation; available from iOS 18.0. [https://developer.apple.com/documentation/swift/uint128](https://developer.apple.com/documentation/swift/uint128) Accessed 20 October 2026.
[^efd]: Daniel J. Bernstein and Tanja Lange, Explicit-Formulas Database, “Jacobian coordinates with a4=0 for short Weierstrass curves” (doubling `dbl-2009-l`, mixed addition `madd-2007-bl`). [https://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html](https://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html) Accessed 20 October 2026.
[^bip86]: Ava Chow, “BIP 86: Key Derivation for Single Key P2TR Outputs”. [https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0086.mediawiki](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0086.mediawiki)
[^bip342]: Pieter Wuille, Jonas Nick and Anthony Towns, “BIP 342: Validation of Taproot Scripts”. [https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0342.mediawiki](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0342.mediawiki)
