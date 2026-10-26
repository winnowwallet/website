# Two Phones and a Ledger

Draft — Alex Newman · October 23, 2026

*Taproot multisig in Winnow's Advanced mode: your phone, a Ledger and a trustee's phone, a way back for coins that sit still, and the recovery wallet that could help. The curve code didn't have to grow.*

**Shelved 23 October 2026, unshelved 26 October 2026.** This replaces the MuSig2 draft. A Nano X has now signed on mainnet; the sections below still describe the state before that and need rewriting before this is published.

Winnow's latest internal builds let you hold a coin with several signers. I'll explain how the account works, what the Ledger does, and what I haven't been able to test yet.

## One output, one script

An account is a single Taproot output: `tr(NUMS, sortedmulti_a(2, key1, key2, key3))`. The internal key is one nobody can sign for, so the only way to spend is the script. It asks for two of the three signatures.

Each signer makes an ordinary BIP340 signature over the BIP342 script-path message. Nobody has to wait on anybody. Each signature is made alone, in any order, and the spend reveals the script and every signature on-chain. It costs about 42 extra vbytes per input for a 2-of-2, and anyone can see it's multisig.

## Why the curve code didn't grow

I started with MuSig2, which merges several keys and signatures into one, so a spend looks like any single-key payment. That needs key aggregation, nonces that must never repeat, and two rounds of messages. I built it, shipped it as 0.8.8, and parked it.

Script-path needed none of that. Between `3794057` and `7b7ff30`, the curve module's Swift files didn't change. The 781 lines that were there for a single key were enough.

## A Ledger as one of the signers

I wanted hardware people already own. SeedSigner can't do this. Version 0.8.7 refuses any key inside a Taproot script tree, and it trims script-path signatures away on the way back to the phone. The Satochip fork that drives a card signs ECDSA only.

Ledger's Bitcoin app signs these leaves, and Winnow talks to it without linking any Ledger code. The client is written from the app's protocol: the Bluetooth framing, Merkle proofs and BIP388 wallet policies, in a folder of its own. The phone pairs with the Ledger and registers the account on it, and the Ledger shows the policy for approval. "Pair a Ledger" builds a 2-of-2 between you and the device. For anything bigger, "New multisig account" has an "Include a Ledger" switch, with or without a recovery path. "Verify on Ledger" shows a receive address on the device's screen. When you spend, the Ledger shows the payment before it signs, and the phone adds the signature only after it verifies on the leaf the Ledger says it signed, against the sighash the phone computed. It's all in Advanced mode, and Simple mode refuses it.

Two version numbers matter here. Version 2.1.2 signs `multi_a` leaves. A recovery leaf needs 2.2.0, because it's miniscript. And if the recovery leaf reuses a signer on `/<2;3>/*`, you need 2.2.1, because earlier versions return the wrong leaf hashes for keys on that path.

The internal key has to be an xpub, because BIP388 wallet policies accept only extended keys. I build it the way Liana does: BIP341's NUMS point, with the SHA-256 of the signers' keys as the chain code. Every child of that point is still unspendable.

## Who holds the third key

A 2-of-3 needs three keys, and the interesting question is whose. The second phone doesn't have to be yours. It can belong to a trustee, someone you trust to help and not to spend: a relative, a friend, a lawyer.

Day to day you sign with your phone and your Ledger, and the trustee's phone sits idle. If you lose the Ledger, your phone and the trustee's sign together. If you lose your phone, the Ledger and the trustee sign. The trustee alone can't spend, and neither can a thief with one device. The trustee joins the way the second phone does in the test notes: their phone shows its key, you build the account with it, and the descriptor goes back to them.

The recovery path in the next section can change that. If it lets any one of the same three signers spend alone after the delay, the trustee can spend alone after the delay too. That's a choice to make on purpose. The other mode, a separate recovery key that you keep somewhere else, gives the trustee nothing extra.

## A way back for coins that sit still

Version 0.8.10 adds a second leaf. It's either `and_v(v:pk(K),older(N))` or `and_v(v:multi_a(m,…),older(N))`, with N from 1 to 65,535 blocks.

Once a coin has sat still for N blocks, fewer of the same signers can move it, or a separate recovery key can. A reused signer signs that leaf from its own `/<2;3>/*` branch, because BIP388 doesn't let one derived key appear in two leaves. The input's sequence number picks the path. A recovery spend only selects coins that are at least N blocks deep.

Testing against Bitcoin Core turned up one disagreement. Core writes a two-leaf tree into the PSBT in reverse order. Both orders are valid, but Winnow's combiner refused the two values. Winnow now writes Core's order, and the combiner stays strict.

## A recovery wallet

[Winnow Rescue](https://github.com/winnowwallet/winnowrescue) is a separate project, and the other half of this story. It's a rescue-only tool that gets coins out of any old wallet, from recovery words, a single key or another wallet's export, and sweeps them into a taproot account you already own. That account can be one of these. Its core is a Rust library that wallets are meant to embed, and the standalone tool is a command line and a desktop window. It's open source under the MIT license.

It's early. Only the core exists, about 11,800 lines that read words and keys, plan which derivation paths to check, verify header chains and coin proofs, and work through discovery in tiers. The command line, the window and the Electrum client are stubs, and signing and sweeping come in a later milestone. It can't move a coin yet.

Its [plan](https://github.com/winnowwallet/winnowrescue/blob/2ee03b5/docs/plan.md) has a later step that matters here: descriptors and wallets made elsewhere. It would discover the coins, sign where it holds a key, and otherwise build a PSBT for the device that can. For a multisig account that's the lost-phone story. Your Ledger and the trustee sign a PSBT that the recovery tool built, and the coins move to a new account. None of that is built.

Rescue takes its curve from libsecp256k1, and that's on purpose. If the Swift curve in Winnow ever has a bug nobody's found, the tool that rescues coins shouldn't share it. [Part 2](/blog/two-implementations/) is about why.

## An exchange as a signer

Picture the third key sitting with an exchange instead of with a person. You sign with your phone and your Ledger. If you lose one, the exchange co-signs, after it checks that it's you. And if the exchange embeds Rescue's core, it could also take in coins from a customer's old wallets and sweep them straight into that account.

Nothing like this exists, in Winnow or in Rescue, and I haven't discussed it with an exchange. The pieces it would need are small. The exchange makes an ordinary BIP340 signature over a spend it can read, and it has to show the payment to a person or a rule, the way a Ledger shows it on a screen. A button that signs whatever it's given isn't enough.

The harder parts are about trust. Rescue's [own design](https://github.com/winnowwallet/winnowrescue/blob/2ee03b5/docs/design.md) leaves service-cosigned wallets out, and two-factor seeds too, since a service holds a key. Its exchange check only asks whether an address is in your deposit list, refuses a login that can trade or withdraw, and never supplies a deposit address. An exchange that signs is a different relationship. In a 2-of-3 it can't spend alone, but anyone who can talk it into signing becomes the second factor, so the exchange's own login becomes part of the wallet's security. That's the design question, more than the code.

## What's tested, and what isn't

Bitcoin Core 31.1 produced the checksums and addresses for four timelocked descriptors, and the tests compare against those. In the signet journey in the 0.8.10 release run, Core cosigns a 2-of-2 spend. After a three-block delay, it accepts and mines a spend that the phone signs alone through the recovery leaf.

On 26 October 2026 a Nano X co-signed a mainnet spend from a Winnow 2-of-2 ([the transaction](https://mempool.space/tx/6d2b391e7bdabcb69a133e49ae40ee54f956be8057edc7974742ad3a0d85c589)): the first time a physical Ledger agreed with the phone's client. Until then the evidence was Ledger's own policy and address vectors, a software Ledger I wrote from the same documentation, and a fuzz target that feeds the client hostile frames, commands and signatures. Agreeing with the simulator proves little: it shows the phone's client is consistent, not that the device agrees.

## Where it stands

Two draft pull requests carry this. [#246](https://github.com/winnowwallet/winnow/pull/246) is the native curve, the multisig accounts, the recovery leaf and a fuzz oracle, proposed to Winnow's main branch. Merging it would make this the App Store build, and it would take MuSig2 savings, vaults and cosigner cards out of the shipping app, so that trade has to be decided first. [#247](https://github.com/winnowwallet/winnow/pull/247) is the Ledger signer alone, one commit on top of #246 and split out so #246 can be reviewed and landed without it. Merge #246 first. #247 waits for a Nano X to sign.
