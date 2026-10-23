# What a Variable-Time Curve Can Leak

Draft — Alex Newman · October 20, 2026

**Shelved 23 October 2026.** Timing leaks and unwiped secrets aren't the worry on a phone yet; whether the math is right is, and that story is in `two-implementations.md`. Revisit before the native curve ships outside internal TestFlight.

*Part 1 of the series that starts with [Bitcoin Beyond Conspiracy Theories](/blog/bitcoin-beyond-conspiracy-theories/): side channels, what Winnow's Swift secp256k1 gives away today, and what it would take to stop.*

The [introduction](/blog/bitcoin-beyond-conspiracy-theories/) ended with a trade-off. Winnow's single-key build does its curve math in its own Swift module, and every operation in it is variable-time: how long it takes depends on the numbers it is working on, including secret ones. Its secrets are not cleared from memory afterwards either. I accepted both for an internal test build on a phone I control. This part is about what that acceptance means.

## A signature is not the only output

A side channel is anything a computation reveals besides its answer: how long it took, which memory it touched, how much power it drew, what it radiated. A signature can be mathematically perfect and still leak through the time it took to make.

Elliptic-curve signatures are unusually sensitive to this, because of the nonce. Every Schnorr or ECDSA signature uses a fresh secret number k, and the signature equation ties k to the private key. If an attacker learns even a few bits of k from each of many signatures, the problem of recovering the key becomes the hidden number problem, which lattice algorithms solve. The attacker does not need all of k, or even most of it.

Three results show how little is enough:

- **[Minerva](https://eprint.iacr.org/2020/728)** (2020) found implementations that leaked the bit length of the ECDSA nonce through timing: a smartcard chip and five libraries, including libgcrypt, wolfSSL and Java's SunEC. On a 256-bit curve the authors recovered full keys from roughly 500 signatures in simulation, about 1,200 from real library timings, and about 2,100 from the card.
- **[TPM-Fail](https://www.usenix.org/conference/usenixsecurity20/presentation/moghimi-tpm)** (2020) timed TPM chips, an Intel firmware TPM and a hardware TPM, and recovered 256-bit ECDSA and ECSchnorr keys from the timing of signature generation. Schnorr is not immune; it has a nonce too.
- **[LadderLeak](https://eprint.iacr.org/2020/615)** (2020) recovered ECDSA keys from OpenSSL's Montgomery ladder when the leak was less than one bit of the nonce per signature: the top bit, and only with some probability.

The pattern is the same each time. A tiny, statistical leak per signature, many signatures, and a lattice or Fourier attack that turns them into a key.

## Where Winnow's module leaks

The module is small enough to point at each place. These are from its own [source](https://github.com/winnowwallet/winnow/tree/3794057eae11a18e33af2ffba76d91dce71b5da8/Sources/NativeSecp256k1):

- **Conditional subtraction.** The field and scalar types finish each operation by subtracting the modulus only when the result reached it. Whether that happened depends on the values.
- **Point multiplication branches on every bit.** General scalar multiplication is double-and-add: it adds only where the scalar has a one. In verification the scalar is public, but the same code path exists.
- **The generator table is indexed by the secret.** Multiplying the generator splits the scalar into 64 four-bit windows, skips windows that are zero, and reads the table at an index taken from each window. In signing, that scalar is the nonce. A skipped window and a cache line touched are exactly the kind of signal Minerva and its relatives use.
- **The scalar product branches on the private key.** Signing computes e·d with a binary method that adds only where a bit of d is one.
- **Nothing is cleared.** Private keys, tweaked keys and nonces live in plain `Data` values and limb arrays. When they are no longer needed they are released, not overwritten, and Swift may have made copies along the way.

None of this is hidden. The module's guide says it in its first section, and so do the wallet's own documents. What it does not say is how much of it an attacker could actually observe.

## Who could measure it on a phone

That is the honest open question, and I have not measured it. Some things are clear enough to say.

A remote attacker cannot time Winnow's signing directly. The phone signs on its own schedule, a handful of times, and does not answer signing requests from the network. Of the three attacks above, none worked from a single signature, and an ordinary wallet does not make hundreds of signatures with one key in a way an attacker can trigger and time.

Software on the same phone is a different matter. iOS sandboxes apps from each other's memory, but apps share the processor's caches and timing resources. Cache-timing attacks between processes are a well-studied class, and a secret-indexed table lookup is what they look for. Physical access adds power and electromagnetic measurement, which is how smartcards like the one in Minerva are attacked.

And the number of signatures will grow. A MuSig2 account signs once per spend per signer, a hardware-signer flow can be asked to sign repeatedly, and Silent Payments would add secret scalar multiplication to every scan. "Few signatures" is a property of how the wallet is used today, not a defence.

## What constant time takes

[libsecp256k1](https://github.com/bitcoin-core/secp256k1) is the standard here. Its README promises "constant time, constant memory access signing and public key generation", "no data-dependent branches", table access "with branch-free conditional moves so memory access is uniform", and optional blinding of the computation to frustrate power analysis. That is years of deliberate work, and the reason Winnow used it before.

Doing the same in Swift has four parts.

1. **Branch-free arithmetic.** Replace every conditional subtraction with a mask: compute both results and select one with bitwise operations. Replace double-and-add with a fixed sequence of operations, and read the generator table by touching every entry and keeping the one you want.
2. **Complete formulas.** The point addition today branches on its exceptional cases: infinity, doubling and opposite points. Complete addition formulas handle every case with the same operations, which is also what the formally verified code described in Part 2 uses.
3. **The processor.** On Apple silicon some instructions take data-dependent time unless the processor's DIT flag is set. Apple [tells cryptographic code to set it](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms#Enable-DIT-for-constant-time-cryptographic-operations), with calls available from iOS 18.2 and a lower-level route for older systems. Winnow still supports iOS 17. CryptoKit sets DIT internally for its own P-256 operations; a Swift secp256k1 has to do it itself.
4. **The compiler.** Swift source that looks branch-free can compile to branches, and its overflow and bounds checks add branches of their own. The only way to know is to read the generated assembly for the release build, on the architecture that ships.

Clearing secrets is its own problem. Swift's value types copy freely, and `Data` can be reallocated behind your back. Doing it properly means keeping secrets in buffers the module owns, overwriting them with a call the optimizer cannot remove, and accepting that registers and stack frames are outside even that.

## How I would know it worked

Constant time is a property of the binary on the device, not of the source, and it is measured, not asserted. [dudect](https://eprint.iacr.org/2016/1123), from "Dude, is my code constant time?", is the simplest serious method. It runs the code on two classes of input, a fixed secret against random ones, and applies Welch's t-test to the timings. A large t value is evidence of a leak; a small one is evidence of nothing beyond the inputs tried. Run on the phone, against the release build, together with the assembly review, it would turn "variable-time" into a measured statement either way.

Until that pass exists, the module's limits stay in its guide, the build stays internal, and the wallet's documents keep saying so. The [introduction](/blog/bitcoin-beyond-conspiracy-theories/) explains why I took the trade. Part 3 shows why it matters more once MuSig2 is back: its secret nonces go through the same arithmetic.
