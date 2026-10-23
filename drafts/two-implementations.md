# Two Implementations Are Better Than One

Draft — Alex Newman · October 23, 2026

*A follow-up to [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): I planted 21 bugs in Winnow's Swift curve code to see whether my tests would notice. Most of the time the fuzzer didn't. So I gave it a second implementation to argue with.*

Winnow signs with its own Swift secp256k1. On a phone, timing leaks and stray secrets in memory aren't the worry yet. The worry is simpler: is the math right? I thought I was checking that. This is how I found out how well.

## One implementation is the rules. Two is an oracle.

Bitcoin learned to be wary of second implementations the hard way. In March 2013 a large block split the chain because versions before 0.8 ran out of database locks processing it and 0.8 didn't ([BIP50](https://github.com/bitcoin/bips/blob/master/bip-0050.mediawiki)). Two years later, [BIP66](https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki) made strict DER signatures a rule, because OpenSSL's signature parser had quietly become part of consensus and then changed. For consensus code, a second implementation is a liability unless it reproduces every quirk of the first.

A wallet's signing code isn't consensus code. It doesn't decide which blocks are valid. It makes signatures the network accepts or rejects. For that job, a second implementation isn't a fork risk. It's an oracle.

## Who else wrote their own

The [curves post](/blog/bitcoin-beyond-conspiracy-theories/) lists ten implementations. Five are independent: [decred's](https://github.com/decred/dcrd/tree/master/dcrec/secp256k1) in Go, [Bouncy Castle's](https://github.com/bcgit/bc-java) in Java, [noble-curves](https://github.com/paulmillr/noble-curves) in JavaScript, [Trezor's](https://github.com/trezor/trezor-firmware/tree/main/crypto) in C, and Winnow's. I read each project's own pages to see what it chose and how it checks itself, and where the pages are silent, the table says so.

| | Field numbers | Constant time | How it checks itself |
|---|---|---|---|
| [libsecp256k1](https://github.com/bitcoin-core/secp256k1) (C), for reference | 5 limbs of 52 bits, plus an experimental 10 × 26 build for 32-bit ARM | The goal is to be "completely free of timing sidechannels for secret-key operations", on reasonable hardware and toolchains | "Extensive testing infrastructure", which the README doesn't itemise |
| decred secp256k1 (Go), under btcec | 10 limbs of 26 bits | Constant-time field and scalar arithmetic for secret-dependent operations | Differential tests against other implementations, libsecp256k1 included |
| [NBitcoin.Secp256k1](https://github.com/MetacoSA/NBitcoin/blob/master/NBitcoin.Secp256k1/README.md) (C#), a port | Not in its README | Not claimed | Ports libsecp256k1's unit tests along with its code. The maintainers say they're "unable to review the underlying mathematical soundness" |
| Bouncy Castle (Java) | 8 limbs of 32 bits | Not in the source I read | I didn't look |
| noble-curves (JavaScript) | JavaScript BigInts, in projective coordinates | "Algorithmic constant time", with caveats about JIT compilers and garbage collection | Property-based, cross-library and Wycheproof vectors, fuzzing in CI, and four audits listed between 2023 and 2026 |
| trezor-crypto (C) | 9 limbs of 29 bits | Not in the header I read | I didn't look |
| Winnow (Swift) | 4 limbs of 64 bits, kept fully reduced | No. It's variable-time, which [Part 1](/blog/fuzzing-and-timing-two-wallets/) measures | Recorded vectors, a second implementation, a fuzzer, and 21 planted bugs |
| Winnow Rescue (Rust) | libsecp256k1's, through rust-bitcoin | libsecp256k1's | libsecp256k1's own tests. Its nine fuzz targets don't test curve arithmetic |

A few things stand out.

The independent implementations disagree about nearly everything. Limbs of 26, 29, 32, 52 and 64 bits are all in use, and nobody seems to think any of them is the obvious choice.

Two of them agree on one trick. Bouncy Castle and Winnow both reduce a product by folding its top half back into the bottom with 2³² + 977, which p's shape allows. If that trick had a flaw, both would share it. That's why my reference implementation uses Montgomery multiplication instead.

And the checks differ in where they come from. Decred compares itself with other implementations. NBitcoin ports libsecp256k1's own tests, so its checks come from the same place as its code. Noble borrows vectors from other libraries and from Wycheproof, and pays for audits. Winnow started with recorded answers, and only got a second implementation after the planted bugs showed what it was missing.

[Winnow Rescue](https://github.com/winnowwallet/winnowrescue), my recovery tool, is on the other side of the line. It takes its curve from libsecp256k1, and I want it to stay there. If Winnow's curve has a bug I haven't found, the tool that rescues coins shouldn't share it. Between them the two projects have no curve code in common. The Swift module signs payments in the app, and libsecp256k1 derives the keys when Rescue reads an old wallet. Both do the same job for the same kinds of keys, so a disagreement between them would be a finding. I haven't built that comparison yet. Rescue's core doesn't sign anything until its sweep milestone.

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

## Appendix: checking it yourself

These programs check three claims in [the curves post](/blog/bitcoin-beyond-conspiracy-theories/): the halved generator, the line counts, and the signature on the first mainnet payment.

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
