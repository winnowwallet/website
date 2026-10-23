# Halving Bitcoin's Generator

Draft — Alex Newman · October 23, 2026

*A follow-up to [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): Bitcoin's generator is twice a point whose x-coordinate is 90 bits too short, and three other curves from the same standard share the pattern. Somebody noticed in 2019. I can't find anyone who has explained it.*

Every Bitcoin public key is a multiple of one fixed point, G. It comes from [SEC 2](https://www.secg.org/sec2-v2.pdf), the standard that defines secp256k1, and the standard doesn't say where G came from. [The curves post](/blog/bitcoin-beyond-conspiracy-theories/) called that a loose end. Here it is.

## Halve it

G has prime order n, so doubling is a one-to-one map on its group, and exactly one point H has 2H = G. Multiplying G by (n + 1) / 2 finds it. Its x-coordinate is:

`0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63`

That's 166 bits. A random point's x-coordinate fills the field: usually 255 or 256 bits. The chance of 166 or fewer is about 2⁻⁹⁰. I halved 500 random points to check, and the shortest x was 247 bits. G itself looks random, at 255 bits. Only the halving gives it away.

It's specific to 1/2. I tried all 359 fractions a/b of G with a and b up to 24. The shortest of the other 358 was 247 bits, about what chance gives from that many tries.

So G isn't what a random pick would give. The simplest reading is that someone chose H first and published 2H.

## It isn't only Bitcoin's

secp256k1 is one of four prime-field Koblitz curves in SEC 2. I halved the generator on the other three too. (secp160k1 is only in the 2000 edition of the standard.)

![A table of four rows, one per curve, showing the hex x-coordinate of the halved generator. The same 38 hex digits appear in all four rows, highlighted. secp224k1 and secp256k1 have the identical number.](/images/blog/bitcoin-generator-loose-end/four-curves.png)

*The same 38 hex digits appear in all four. Only the digits around them change.*

All four halves share 152 bits. The two biggest curves give the same number exactly, even though their fields are 224 and 256 bits wide. NIST's curves, run through the same test, give full-size x-coordinates every time.

That rules out luck. One curve being 90 bits short is a one-in-2⁹⁰ accident, and four curves sharing a 152-bit string is not an accident at all. These points came from a procedure, and the procedure reused a number.

## Somebody noticed

The [Crypto 2019 rump session](https://crypto.iacr.org/2019/rump.html) had a talk by Nadia Heninger, Travis Scholl and Dan Shumow whose title was `48ce563f89a0ed9414f5aa28ad0d96d6795f9c62`. That's the secp160k1 number in the picture. The program has no abstract, and I couldn't find notes or slides.

John Zweng put the four-curve table in [a gist](https://gist.github.com/johnzweng/863f412689ee383cc41ac7c709ca662c) in 2025, and says it doesn't look like a backdoor. [A 2026 blog post](https://www.publish0x.com/cryptodeep/structural-anomalies-of-base-points-in-secpxxxk1-elliptic-cu-xwrmqjv) repeated it and added a story I couldn't confirm: that the number first turned up while hunting for repeated nonces on the blockchain. The arithmetic does fit. A signature made with nonce (n − 1) / 2 has R = −H, so its r is exactly this 166-bit number. Joachim Breitner and Nadia Heninger's [slides on Bitcoin nonces](https://www.joachim-breitner.de/publications/BiasedNonces-GPN20-2022-05-20.pdf) list "(n − 1)/2" as one kind of repeated nonce, though they don't say what it is. That's my reading.

## What nobody has said

SEC 2 has one sentence on how the Koblitz parameters were chosen. They tried curves with an efficient endomorphism until one had prime order. That covers the field and the constants, and it's in the 2000 and 2010 editions alike. Neither says anything about how G was picked.

NIST's curves have the same gap. Anthropic's [write-up on the NIST seeds](https://anthropic.com/research/ecdsa-curve-origins) traced six base points to the random number generator in a 1990s long-integer library, but couldn't explain the one for P-256. It says nothing about secp256k1.

So here is what I can't tell you: what the 152-bit string is, why G is twice a point rather than the point, or who chose it.

Three guesses, none tested:

- One program generated all four curves, and it carried the same number from one to the next. The shared 152 bits say so.
- The x-coordinate came from a source of numbers 160 to 190 bits long, whatever the field size. A full-width hash reduced modulo p would fill the field, so it wasn't that.
- The doubling is a leftover step from a general procedure. It isn't clearing a cofactor, because all four curves have cofactor 1.

If the recipe turns up, it should reproduce all four numbers exactly. That's the test that settled the NIST seeds.

## Does it matter?

No, for signatures. Every point except the identity generates a group of prime order. If Q = d·G, then Q = 2d·H, so a discrete log to base H gives one to base G with a single doubling, and back again. Nobody knows d for G. The relation to H is just "times two", which hands an attacker nothing. ECDSA and Schnorr use one generator, so there's no second point for a relation to hurt.

It would matter in a protocol that needs two points with no known relation. Pedersen commitments are the standard case. Use H as the second point and its discrete log to base G is 1/2 mod n, which anyone can compute, and the commitments stop binding.

Bitcoin ran into this itself. Taproot needed a point nobody has the key for, and [BIP 341](https://github.com/bitcoin/bips/blob/927b6de9915c9262615a6399de51b200f81e5aa4/bip-0341.mediawiki) builds one by hashing G's uncompressed encoding and using the result as an x-coordinate. I checked: SHA-256 of that encoding is `0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0`, the number in the BIP. When Bitcoin needed a point it could stand behind, it published the recipe. SEC 2 never published one for G.

## Appendix: checking it yourself

[Part 2's appendix](/blog/two-implementations/#appendix-checking-it-yourself) has the point arithmetic and the halving for secp256k1 alone. This program needs the same `add` and `mul` pasted above it. They read `p` when called, so changing `p` for each curve works. It halves all four generators, scans the small fractions, and checks the Taproot point.

SEC 2's 2010 edition gives secp192k1, secp224k1 and secp256k1. secp160k1's numbers are from the 2000 edition, via the [Standards for Elliptic Curves database](https://std.neuromancer.sk/secg/secp160k1).

```python
import hashlib
import random
from math import gcd

CURVES = {  # name: (p, b, Gx, Gy, n); a = 0 on all four
    "secp160k1": (2**160 - 2**32 - 2**14 - 2**12 - 2**9 - 2**8 - 2**7 - 2**3 - 2**2 - 1, 7,
                  0x3b4c382ce37aa192a4019e763036f4f5dd4d7ebb, 0x938cf935318fdced6bc28286531733c3f03c4fee,
                  0x0100000000000000000001b8fa16dfab9aca16b6b3),
    "secp192k1": (2**192 - 2**32 - 2**12 - 2**8 - 2**7 - 2**6 - 2**3 - 1, 3,
                  0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d, 0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d,
                  0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d),
    "secp224k1": (2**224 - 2**32 - 2**12 - 2**11 - 2**9 - 2**7 - 2**4 - 2 - 1, 5,
                  0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c, 0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5,
                  0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7),
    "secp256k1": (2**256 - 2**32 - 977, 7,
                  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798, 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8,
                  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141),
}

for name, (p, b, gx, gy, n) in CURVES.items():
    G = (gx, gy)
    assert (gy * gy - gx**3 - b) % p == 0 and mul(n, G) is None   # on the curve, order n
    half = mul((n + 1) // 2, G)
    assert add(half, half) == G
    print(f"{name}  {half[0].bit_length():3} bits  {half[0]:#x}")

p, b, gx, gy, n = CURVES["secp256k1"]
G = (gx, gy)

# 500 random points, halved: how short does the x-coordinate get?
random.seed(1)
print("shortest random:", min(mul((n + 1) // 2, mul(random.randrange(1, n), G))[0].bit_length() for _ in range(500)))

# every fraction a/b of G with a, b up to 24: which x-coordinates are under 250 bits?
short = []
for a in range(1, 25):
    for d in range(1, 25):
        if gcd(a, d) == 1:
            bits = mul(a * pow(d, -1, n) % n, G)[0].bit_length()
            if bits < 250: short.append((a, d, bits))
print("short fractions:", short)

# the relation between G and its half is just "times two"
d = random.randrange(1, n)
assert mul(d, G) == mul(2 * d % n, half)

# a nonce of (n - 1) / 2 gives R = -H, so r is the same 166-bit number
print(hex(mul((n - 1) // 2, G)[0]))

# BIP 341's point: SHA-256 of G's uncompressed encoding, used as an x-coordinate
print(hashlib.sha256(b"\x04" + gx.to_bytes(32, "big") + gy.to_bytes(32, "big")).hexdigest())
```

```text
secp160k1  159 bits  0x48ce563f89a0ed9414f5aa28ad0d96d6795f9c62
secp192k1  187 bits  0x554123b78ce563f89a0ed9414f5aa28ad0d96d6795f9c66
secp224k1  166 bits  0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63
secp256k1  166 bits  0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63
shortest random: 247
short fractions: [(1, 2, 166), (2, 21, 247)]
0x3b78ce563f89a0ed9414f5aa28ad0d96d6795f9c63
50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0
```
