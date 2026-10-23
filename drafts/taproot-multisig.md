# Two Phones and a Ledger

Draft — Alex Newman · October 23, 2026

*Taproot multisig in Winnow's Advanced mode, a Ledger as the second signer, and a way back for coins that sit still. The curve code didn't have to grow.*

**Shelved 23 October 2026.** This replaces the MuSig2 draft. Keep it shelved until a physical Ledger has signed.

Winnow's latest internal builds let you hold a coin with several signers. I'll explain how the account works, what the Ledger does, and what I haven't been able to test yet.

## One output, one script

An account is a single Taproot output: `tr(NUMS, sortedmulti_a(2, key1, key2, key3))`. The internal key is one nobody can sign for, so the only way to spend is the script. It asks for two of the three signatures.

Each signer makes an ordinary BIP340 signature over the BIP342 script-path message. Nobody has to wait on anybody. Each signature is made alone, in any order, and the spend reveals the script and every signature on-chain. It costs about 42 extra vbytes per input for a 2-of-2, and anyone can see it's multisig.

## Why the curve code didn't grow

I started with MuSig2, which merges several keys and signatures into one, so a spend looks like any single-key payment. That needs key aggregation, nonces that must never repeat, and two rounds of messages. I built it, shipped it as 0.8.8, and parked it.

Script-path needed none of that. Between `3794057` and `7b7ff30`, the curve module's Swift files didn't change. The 781 lines that were there for a single key were enough.

## A Ledger as one of the signers

I wanted hardware people already own. SeedSigner can't do this. Version 0.8.7 refuses any key inside a Taproot script tree, and it trims script-path signatures away on the way back to the phone. The Satochip fork that drives a card signs ECDSA only.

Ledger's Bitcoin app signs these leaves. The phone pairs with the Ledger over Bluetooth and registers the account on it, and the Ledger shows the policy for approval. "Verify on Ledger" shows a receive address on the device's screen. When you spend, the Ledger shows the payment before it signs. The phone keeps its signature only if it verifies against the sighash the phone computes.

Two version numbers matter here. Version 2.1.2 signs `multi_a` leaves. A recovery leaf needs 2.2.0, because it's miniscript. And if the recovery leaf reuses a signer on `/<2;3>/*`, you need 2.2.1, because earlier versions return the wrong leaf hashes for keys on that path.

The internal key has to be an xpub, because BIP388 wallet policies accept only extended keys. I build it the way Liana does: BIP341's NUMS point, with the SHA-256 of the signers' keys as the chain code. Every child of that point is still unspendable.

## A way back for coins that sit still

Version 0.8.10 adds a second leaf. It's either `and_v(v:pk(K),older(N))` or `and_v(v:multi_a(m,…),older(N))`, with N from 1 to 65,535 blocks.

Once a coin has sat still for N blocks, fewer of the same signers can move it, or a separate recovery key can. A reused signer signs that leaf from its own `/<2;3>/*` branch, because BIP388 doesn't let one derived key appear in two leaves. The input's sequence number picks the path. A recovery spend only selects coins that are at least N blocks deep.

Testing against Bitcoin Core turned up one disagreement. Core writes a two-leaf tree into the PSBT in reverse order. Both orders are valid, but Winnow's combiner refused the two values. Winnow now writes Core's order, and the combiner stays strict.

## What's tested, and what isn't

Bitcoin Core 31.1 produced the checksums and addresses for four timelocked descriptors, and the tests compare against those. In the signet journey in the 0.8.10 release run, Core cosigns a 2-of-2 spend. After a three-block delay, it accepts and mines a spend that the phone signs alone through the recovery leaf.

Nothing has been signed on a physical Ledger yet. The Ledger tests use Ledger's published vectors and a simulator I wrote from the same documentation. Agreeing with it proves little. The next test is a Nano X on signet.

## Where it stands

[Draft pull request #241](https://github.com/winnowwallet/winnow/pull/241) proposes the whole line as one change to Winnow's main branch. Merging it would make this the App Store build, and it would take MuSig2 savings, vaults and cosigner cards out of the shipping app. It stays a draft until a Ledger has signed and that trade is decided.
