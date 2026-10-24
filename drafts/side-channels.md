# Fuzzing and Timing Two Wallets

Draft — Alex Newman · October 23, 2026

*A follow-up to [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): Winnow owns its curve and Winnow Rescue borrows libsecp256k1's. I fuzzed both, timed both curves, and asked what a proof could add.*

I write two Bitcoin projects that treat the curve differently. Winnow, the iOS wallet, signs with its own Swift implementation. [Winnow Rescue](https://github.com/winnowwallet/winnowrescue), the recovery tool, finds coins in old wallets and will sweep them into an account you already have. Its core is about 11,800 lines of Rust, tests included, and it gets secp256k1 from libsecp256k1 through the rust-bitcoin crate.

Rescue is early. Only the core exists, and the command-line tool, the window and the Electrum adapter are stubs. It can't sweep anything yet. It does parse, derive and check, and that's enough to fuzz.

## What each one fuzzes

| | Winnow | Rescue |
|---|---|---|
| Fuzzer | its own deterministic mutator, from small seed inputs | cargo-fuzz, which is libFuzzer, steering by coverage |
| Targets | 16: PSBTs, descriptors, transactions, blocks, peer messages, filters, addresses, imports, and more, plus the curve and a Ledger's Bluetooth bytes | 9: header chains, address history, Merkle proofs, destinations, `dumpwallet` files, derivation paths, secrets, saved progress and transaction ids |
| On every pull request | 1,000 iterations per target, 16,000 cases, fixed seed | 10,000 runs per target, 90,000 runs, fixed seed |
| Longer runs | weekly, 25,000 iterations per target under AddressSanitizer and again under ThreadSanitizer, with rotating seeds | none yet |
| Saved findings | 4 inputs (3 filter, 1 PSBT), replayed in the test suite | none |
| Run today | 16,000 cases, no failure, 48 seconds | 90,000 runs, no crash, about half a minute |

Neither fuzzer is better. Rescue's follows coverage, so a few seconds reach deep into its parsers and the state they feed. Winnow's has no feedback. It mutates from fixed seeds and hopes. In return Winnow fuzzes things Rescue doesn't have to: the curve arithmetic and a hostile device. None of Rescue's nine targets tests curve arithmetic, because libsecp256k1 does that and has its own tests.

That's the asymmetry. Owning the curve adds a whole kind of bug for the fuzzer to find. To see whether Winnow's finds them, I planted 21 bugs in the curve code, one at a time. The fuzzer on every pull request caught 13. With a second implementation to check against, it catches 19, and the unit tests catch all 21. [Part 2](/blog/two-implementations/) has the details. I haven't done the same for Rescue's parsers. That's the obvious next experiment, with the same method. A clean fuzz run only means it found nothing. Further down I come back to what would show more.

## Why timing

A side channel is anything a computation reveals besides its answer, like how long it took. A signature can be perfect and still leak through the time it took to make.

Elliptic-curve signatures are sensitive to this because of the nonce. Every Schnorr or ECDSA signature uses a fresh secret number, and the equation ties it to the private key. If an attacker learns a few bits of it from each of many signatures, a lattice algorithm can recover the key. [Minerva](https://eprint.iacr.org/2020/728) did that to a smartcard and five libraries from the timing of ECDSA nonces. [TPM-Fail](https://www.usenix.org/conference/usenixsecurity20/presentation/moghimi-tpm) did it to TPM chips, including Schnorr signatures, and [LadderLeak](https://eprint.iacr.org/2020/615) did it with less than one bit of leak per signature.

![A diagram of a Schnorr signature: the private key d, a fresh secret nonce k, the public point R = k times G, the challenge e, and the signature s = k + e times d, with three ways a leaked nonce gives up the key](/images/blog/fuzzing-and-timing-two-wallets/nonce.png)

*The nonce is as secret as the key. Learn it, reuse it, or learn a few bits of it many times over, and the key falls out.*

Winnow's curve is variable-time, and I knew where. Point multiplication skips zero windows and adds only where a scalar has a one. The generator table is indexed by the secret, and signing multiplies the generator by the nonce. Libsecp256k1 is built to avoid all of that. Its README promises it's "completely free of timing sidechannels for secret-key operations", on reasonable hardware and toolchains. I'd never measured either one.

## The test

I used the idea behind [dudect](https://eprint.iacr.org/2016/1123). Sign one message many times, picking one of two classes at random for each signature, and compare the timings with Welch's t-test.

The first version compared one fixed key with fresh random keys. It flagged Winnow by 33 to 39 percent, and it did so even when the fixed key was just a random one. The reason is that a fixed key repeats the identical computation every time, and a processor learns a repeated computation. Code that branches on its data speeds up. Constant-time code can't. Libsecp256k1 moved by 0.01 to 0.08 percent in the same runs. That's a real difference between the two, but it doesn't say anything about a secret.

So the second version compares two fixed keys. Both classes repeat, and only the key differs. One class is a weak key, either 3 or all ones. The other is a random key. Each probe times key derivation and signing together, because Winnow derives the public key inside `sign`. I gave the Rust one the same job.

| | Key 3 against a random key | All-ones key against a random key |
|---|---|---|
| Winnow, Swift | 17.2 µs faster (9.5%), t = −178 | 4.0 µs faster (2.2%), t = −43 |
| libsecp256k1, through Rescue's dependencies | 8 ns faster (0.05%), t = −0.8 | 9 ns faster (0.05%), t = −1.7 |

The t values are uncropped. A signature takes between 160 and 280 µs in Winnow's Swift, depending on the key and how warm the processor is, and about 17 µs in libsecp256k1.

Winnow's signing time depends on the key by 2 to 10 percent, and 100,000 signatures show it plainly. Key 3 has one nonzero window, so it skips most of the generator table. Libsecp256k1's differences are under a tenth of a percent, and its t values are small enough to be noise at this sample size.

Two caveats. Dudect also crops slow outliers and keeps the largest t. Under that rule every libsecp256k1 run reaches a t between 20 and 39, the control run included, from mean differences of 13 ns or less. I read that as the cropping magnifying noise on a 17-microsecond signature, but I can't prove nothing's there. And this is one machine, an Apple M5 Max on macOS 27, release builds, timing one call in-process. It shows that the code's speed depends on the key. It doesn't show that anyone could recover a key from it.

## Who could measure it

Not a remote attacker. The phone signs on its own schedule and doesn't answer signing requests from the network. Of the attacks above, none worked from one signature.

Software on the same phone is a different matter, because apps share the processor's caches. A secret-indexed table lookup is what cache attacks look for. Physical access adds power measurement. And the number of signatures will grow, since a hardware signer can be asked to sign repeatedly.

## What a proof would add

A fuzzer can only tell you what it found. The 21 planted bugs showed that mine finds some and misses others, and a clean run says nothing about the rest. Formal methods work the other way. You write down what the code must do, which is a specification, and a proof checker confirms that the code does it for every input, not just the ones you tried. [Lean](https://lean-lang.org) is one such checker.

I've tried it twice, on branches that aren't published yet.

**The curve arithmetic.** I wrote the integer, field and scalar arithmetic once in Lean, proved it there, and had Lean print the Swift. The app builds without Lean. Twenty-eight theorems cover it. Each operation returns the exact residue for every input, and the bounds the old comments only claimed are now checked facts. Then I planted twenty bugs in the Lean version, one at a time. The proofs rejected every one, including a lost carry, the kind that got past the original tests.

**Spend review.** I wrote a Lean specification of the code that decides what a signer is shown before it signs a multisig spend, and had it generate 1,506 test cases. I planted 27 bugs in the Swift. The package tests caught 8, and the specification caught all 27. It also found a real bug: review crashed on a coin stored at the very top of the block-height range, which a restored backup can contain. That's fixed on the branch.

A proof is only as good as what you trust. Here that is Lean's kernel, my model of what Swift's integer operations do, and the specification, which is my reading of what the code should do. The printer that turns Lean into Swift is checked by tests, not proved. The hand-written code around the generated arithmetic is still tested, not proved. Most of a wallet, its parsers, networking and screens, is better served by fuzzing. And neither trial says anything about timing. A correct signature can still be slow in the wrong way, so timing stays a measurement, and the last section is about how I'll make it.

## What fixing it takes, and how I'll know

It takes branch-free arithmetic, complete point formulas, the processor's DIT flag on Apple silicon, and a read of the release assembly, because source that looks branch-free can compile to branches. Winnow's secrets also aren't wiped from memory. That's its own job, because Swift copies values freely.

When that's done, I'll run these two probes again. They're about 70 lines each, and the pass condition is simple: Winnow's two numbers should look like libsecp256k1's. Until then the module's limits stay in its guide, and the build stays internal.
