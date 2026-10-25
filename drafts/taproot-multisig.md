# Keys in Layers

Draft — Alex Newman · October 23, 2026

*The first of [Three Counterintuitive Bets](/blog/three-counterintuitive-bets/): a hardware wallet works better with your phone beside it, two of two, and a timelock for the day you lose one. Around that goes a second layer: two of three among you, a trustee and an exchange, each bringing their own keys. Here's the argument, what Winnow builds today, and what it doesn't yet.*

**Shelved 23 October 2026.** This replaces the MuSig2 draft. Keep it shelved until a physical Ledger has signed.

Hardware wallets are good at one thing: they keep the key off your computer and show you the payment on their own screen before they sign. Most setups stop there, with one device and a sheet of paper. I think keys work better in two layers.

## Layer one: your own keys

Usually that's two of two: a hardware wallet and your phone. Nothing moves unless both sign. The hardware wallet shows the payment on its screen. The phone runs its own review of the spend before it signs, and that review is held to a Lean specification in [draft pull request #248](https://github.com/winnowwallet/winnow/pull/248). Two devices running different code, from different makers, have to agree before a coin moves. That's the argument for two implementations of the curve, applied to signing. So the phone's curve shouldn't be the hardware wallet's. Ledger's Bitcoin app calls the curve routines in Ledger's own SDK, not libsecp256k1, so a phone on either libsecp256k1 or Winnow's Swift module is different code. It doesn't have to be Winnow's own. The Swift module is worth keeping as a backup: if a flaw ever turns up in the library the phone leans on, there's a second implementation ready, with a reference implementation to check it against.

The phone's key is backed up to iCloud automatically, as every Winnow wallet's is. The backup holds the recovery phrase, sealed with AES-256-GCM under a key kept in iCloud Keychain, and the account's descriptor. The descriptor matters as much as the key: it's the list of every signer's public key, and without it even both keys can't find the coins. Lose the phone, and a new one restores both.

Trusting iCloud with a key means trusting your Apple account: whoever controls it could recover that key. For a phone wallet, I think that's the right default, because a lost phone is a far more common way to lose coins than a stolen Apple account. In two of two it's an easy call, because that key can't spend alone.

The weak spot of two of two is the hardware wallet. Lose it, and the coins are stuck unless you kept its seed words. So add a timelock. A Winnow account can carry a second path that opens once a coin has sat still for a chosen number of blocks, up to about 455 days. After that, one device can move it alone. Lose the hardware wallet, wait out the delay, and the phone moves the coins. Nobody has to find a sheet of paper.

For small amounts, the phone alone is fine. That's Winnow's ordinary single-key wallet.

| Your keys | Who signs | Lose the hardware wallet | Lose the phone |
|---|---|---|---|
| Phone only | the phone | | restore from iCloud |
| Hardware wallet and phone | both | stuck, unless you kept its seed words | restore from iCloud |
| Hardware wallet and phone, with a timelock | both, or one alone after the delay | wait out the delay, then the phone signs | restore from iCloud |

## What it would have caught

Most hardware wallet thefts in the news come down to one implementation failing: one device's random numbers, one device's firmware, one app's screen. Two of two means a thief has to beat two implementations, made by different people, at once.

| What happened | What failed | With a hardware wallet and a phone, two of two |
|---|---|---|
| [Coldcard](https://thehackernews.com/2026/08/coldcard-hardware-wallet-flaw-linked-to.html), disclosed 30 July 2026 | Since a firmware change in March 2021, the devices had made seeds from a predictable software generator instead of their hardware one: about 40 bits of real randomness on the Mk3 and 72 on later models. Galaxy Research tied a sweep of 1,196 addresses that day, about $70 million in 41 minutes, to the flaw, and later waves to more. No one has yet rebuilt a victim's seed to prove it. | A guessed hardware seed is one key of two. The phone's key comes from a different generator, in different code. As The Hacker News put it, "multisig helps only when the quorum is not built entirely from affected devices." |
| [Counterfeit Ledgers](https://www.cryptotimes.io/2026/04/17/counterfeit-ledger-wallet-scam-traced-to-chinese-marketplace/), April 2026 | Fake Nano S Plus devices sold on a Chinese marketplace kept the seed and PIN in plain text. A QR code in the box led to a fake Ledger Live that sat between the app and the device and always passed its own genuine check. | The fake device's key is one of two. Winnow talks to a Ledger with its own client, not Ledger Live, and the phone's key never touches the device. |
| [Bybit](https://www.nccgroup.com/research/in-depth-technical-analysis-of-the-bybit-hack/), February 2025 | Three of six signers approved a transaction through the same web app, which attackers had altered to show them a different one. It handed over the wallet, and about $1.46 billion left within minutes. | Each device reads the spend itself: the hardware wallet on its own screen, the phone in its own review. A swapped transaction has to fool two independent readings, not one shared one. |
| [Milk Sad](https://github.com/advisories/GHSA-prgj-h7jq-7p9h) and [Trust Wallet](https://www.ledger.com/blog/Funds-of-every-wallet-created-with-the-Trust-Wallet-browser-extension-could-have-been-stolen), 2023 | Two software wallets made seeds from a generator with 32 bits of entropy, few enough to try them all. Both were exploited. | A weak generator on one side leaves the other side's key standing. |
| [Dark Skippy](https://cointelegraph.com/news/dark-skippy-method-can-steal-bitcoin-hardware-wallet-keys), a published demonstration | Malicious firmware can leak a device's whole seed through the nonces of just two signatures. | The leaked seed is one key of two. |

That's the point of not relying on one implementation. Every row above is one piece of code doing its job badly, and two of two survives any single one.

It doesn't catch everything. If you check the wrong address on both screens, because malware swapped it before you looked, both devices will faithfully sign the wrong payment. A mistake both implementations share, a misreading of the same BIP, gets through too. And someone who corners you can make you sign with both devices. That one is what the second layer is for.

## Layer two: people

Layer one protects you from losing a device. It doesn't help if you lose everything at once, or if you're the one who can't be reached. That's what people are for.

The second layer is two of three among parties: you, a trustee, and maybe an exchange. Each party brings its own layer one. Your share might be your hardware wallet and your phone, two of two. A trustee's might be their phone. Any two parties can move the coins, and no single party can, you included. Lose all of your own keys, and the trustee and the exchange can still get the coins back to you. Lose touch with the trustee, and you and the exchange still can.

What the people layer buys is the part one person can't do alone:

- **Wrench attacks.** Someone who corners you can't make you spend, because you're one party of three. The trustee and the exchange can refuse, or take their time checking who's asking.
- **Borrowing.** An exchange holding one key can lend against the coins without taking them. Lenders already do this: [Unchained](https://help.unchained.com/what-is-loan-collateral-and-what-does-unchained-do-with-it) keeps loan collateral in two-of-three addresses held by the borrower, Unchained and a key agent, so no one of them can move it alone.
- **Inheritance.** If something happens to you, the trustee and the exchange can move the coins to your spouse, as a trust directs, without anyone ever having held your keys.

Winnow doesn't build layer two yet. An account today is one list of signers plus an optional timelocked path. Two of three among parties, where your share needs both your devices, takes a tree with one leaf for each pair of parties, each leaf asking for every key it needs. Taproot can express that, and the descriptor language can too. Winnow's account code can't yet. The closest it gets is a flat two of three, below.

## The closest you can build today

Winnow can't nest layers yet, but it can build a flat two of three, and one of the three keys can sit on someone else's phone. It can belong to a trustee, someone you trust to help and not to spend: a relative, a friend, a lawyer.

Then you sign with your phone and your Ledger, and the trustee's phone sits idle. If you lose the Ledger, your phone and the trustee's sign together. If you lose your phone, the Ledger and the trustee sign. The trustee alone can't spend, and neither can a thief with one device. The difference from layer two is that here the trustee plus either of your devices can spend, so your share is two separate keys. In layer two your share counts once and needs both. The trustee joins the way the second phone does in the test notes: their phone shows its key, you build the account with it, and the descriptor goes back to them.

The recovery path described in [Two Phones and a Ledger](/blog/two-phones-and-a-ledger/) can change that. If it lets any one of the same three signers spend alone after the delay, the trustee can spend alone after the delay too. That's a choice to make on purpose. The other mode, a separate recovery key that you keep somewhere else, gives the trustee nothing extra.

## An exchange as a signer

In layer two, one of the parties can be an exchange. You sign with your own keys and the trustee with theirs. If one of you can't, the exchange co-signs, after it checks who's asking. And if the exchange embeds Rescue's core, it could also take in coins from a customer's old wallets and sweep them straight into that account.

Nothing like this exists, in Winnow or in Rescue, and I haven't discussed it with an exchange. The pieces it would need are small. The exchange makes an ordinary BIP340 signature over a spend it can read, and it has to show the payment to a person or a rule, the way a Ledger shows it on a screen. A button that signs whatever it's given isn't enough.

The harder parts are about trust. Rescue's [own design](https://github.com/winnowwallet/winnowrescue/blob/2ee03b5/docs/design.md) leaves service-cosigned wallets out, and two-factor seeds too, since a service holds a key. Its exchange check only asks whether an address is in your deposit list, refuses a login that can trade or withdraw, and never supplies a deposit address. An exchange that signs is a different relationship. In a 2-of-3 it can't spend alone, but anyone who can talk it into signing becomes the second factor, so the exchange's own login becomes part of the wallet's security. That's the design question, more than the code.

## A recovery wallet

[Winnow Rescue](https://github.com/winnowwallet/winnowrescue) is a separate project, and the other half of this story. It's a rescue-only tool that gets coins out of any old wallet, from recovery words, a single key or another wallet's export, and sweeps them into a taproot account you already own. That account can be one of these. Its core is a Rust library that wallets are meant to embed, and the standalone tool is a command line and a desktop window. It's open source under the MIT license.

It's early. Only the core exists, about 11,800 lines that read words and keys, plan which derivation paths to check, verify header chains and coin proofs, and work through discovery in tiers. The command line, the window and the Electrum client are stubs, and signing and sweeping come in a later milestone. It can't move a coin yet.

Its [plan](https://github.com/winnowwallet/winnowrescue/blob/2ee03b5/docs/plan.md) has a later step that matters here: descriptors and wallets made elsewhere. It would discover the coins, sign where it holds a key, and otherwise build a PSBT for the device that can. For a multisig account that's the lost-phone story. Your Ledger and the trustee sign a PSBT that the recovery tool built, and the coins move to a new account. None of that is built.

Rescue takes its curve from libsecp256k1, and that's on purpose. If the Swift curve in Winnow ever has a bug nobody's found, the tool that rescues coins shouldn't share it. [Two Implementations Are Better Than One](/blog/two-implementations/) is about why.

## What "better" means here

That's the claim: hardware wallets, but arranged so that losing any one thing doesn't lose the coins, and every signer checks the payment for itself. It only holds if each part does its job:

- **Each signer checks.** The hardware wallet shows the payment. The phone reviews it independently, against a specification.
- **Losing a device isn't losing coins.** The phone restores from iCloud, and the timelock covers the hardware wallet.
- **The account matches Bitcoin Core.** A differential test builds 60 accounts on each of two seeds and has Core check them. [Two Phones and a Ledger](/blog/two-phones-and-a-ledger/) has the details.
- **What isn't done is said.** No physical Ledger has signed yet, and layer two isn't built.

## How it's built

Layer one is real code, in Winnow's internal builds. [Two Phones and a Ledger](/blog/two-phones-and-a-ledger/) covers how an account is put together, how a Ledger joins it, how the timelocked path works, and what has and hasn't been tested, including the comparison with Bitcoin Core.
