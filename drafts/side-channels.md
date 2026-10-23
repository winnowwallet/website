# Fuzzing and Timing Two Wallets

Draft — Alex Newman · October 23, 2026

*A follow-up to [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): Winnow owns its curve and Winnow Rescue borrows libsecp256k1's. I fuzzed both, then timed both curves.*

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

That's the asymmetry. Owning the curve adds a whole kind of bug for the fuzzer to find. To see whether Winnow's finds them, I planted 21 bugs in the curve code, one at a time. The fuzzer on every pull request caught 13. With a second implementation to check against, it catches 19, and the unit tests catch all 21. [Part 2](/blog/two-implementations/) has the details. I haven't done the same for Rescue's parsers. That's the obvious next experiment, with the same method.

## Why timing

A side channel is anything a computation reveals besides its answer, like how long it took. A signature can be perfect and still leak through the time it took to make.

Elliptic-curve signatures are sensitive to this because of the nonce. Every Schnorr or ECDSA signature uses a fresh secret number, and the equation ties it to the private key. If an attacker learns a few bits of it from each of many signatures, a lattice algorithm can recover the key. [Minerva](https://eprint.iacr.org/2020/728) did that to a smartcard and five libraries from the timing of ECDSA nonces. [TPM-Fail](https://www.usenix.org/conference/usenixsecurity20/presentation/moghimi-tpm) did it to TPM chips, including Schnorr signatures, and [LadderLeak](https://eprint.iacr.org/2020/615) did it with less than one bit of leak per signature.

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

## What fixing it takes, and how I'll know

It takes branch-free arithmetic, complete point formulas, the processor's DIT flag on Apple silicon, and a read of the release assembly, because source that looks branch-free can compile to branches. Winnow's secrets also aren't wiped from memory. That's its own job, because Swift copies values freely.

When that's done, I'll run these two probes again. They're about 70 lines each, and the pass condition is simple: Winnow's two numbers should look like libsecp256k1's. Until then the module's limits stay in its guide, and the build stays internal.
