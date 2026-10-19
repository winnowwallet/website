# Bitcoin Beyond Conspiracy Theories

*Why I trust standard hashes, what that trust cannot promise, and why recovery belongs in the same conversation.*

I want Winnow's research to make the wallet's assumptions easier to inspect. That includes an uncomfortable question: why should we trust the cryptography underneath Bitcoin?

It is reasonable to ask who designed an algorithm, how its parameters were chosen, and who has tried to break it. The useful next step is to look for evidence that can change our minds. An institution's name cannot settle the question in either direction. Neither can the fact that Bitcoin has money riding on the answer.

I would not say that we proved the standard hashes were safe. We have reasons for confidence in particular algorithms, used for particular jobs, under particular assumptions. That is a more useful foundation for a wallet than either unconditional trust or an unfalsifiable suspicion.

A hash turns a message into a fixed-size digest. Because there are more possible messages than digests, different messages must sometimes have the same digest. The security question is how hard it is to find a useful example. Finding two different messages with the same digest is a collision attack. Finding a message for a given digest is a preimage attack. Finding a different message with the same digest as a particular message is a second-preimage attack. Those are different jobs for an attacker; evidence about one does not automatically settle the others.

SHA-256, part of the SHA-2 family used by Bitcoin, has a public specification. Even the apparently arbitrary constants have a recipe. Its initial values come from the fractional parts of square roots of the first eight primes; its round constants come from cube roots of the first sixty-four primes. The exact rules are in [FIPS 180-4, sections 4.2.2 and 5.3.3](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf). Anyone can reproduce them.

That answers a narrow and worthwhile question about where those numbers came from. It does not prove that every design choice was inevitable, that the whole construction is secure, or that no attack will be discovered. A reproducible origin for constants removes some mystery. It does not replace cryptanalysis.

I want to be able to follow an attack claim back to its method. Does it attack the full algorithm or a version with fewer rounds? Does it find a collision or recover a preimage? What resources does it require? Can other researchers reproduce the result? These questions make a claim useful even when the result is bad news.

We have a concrete example of bad news changing what people should use. In 2017, researchers demonstrated a collision for full SHA-1, producing two different PDF files with the same SHA-1 digest. The [original research paper](https://eprint.iacr.org/2017/190) explains the attack. That is evidence against SHA-1's collision resistance. It is not a demonstration that SHA-256 is broken, or that any arbitrary digest can be reversed. It is also a reason never to use “industry standard” as a synonym for permanently secure.

SHA-3 offers another kind of evidence: an open selection process and a different design. NIST's [SHA-3 competition archive](https://csrc.nist.gov/Projects/hash-functions/sha-3-project) includes submissions, public comments, and conferences. Its [final-round report](https://nvlpubs.nist.gov/nistpubs/ir/2012/NIST.IR.7896.pdf) explains the choice of Keccak after years of analysis. [FIPS 202](https://csrc.nist.gov/pubs/fips/202/final) specifies the resulting SHA-3 family and SHAKE functions. That history is inspectable. SHA-3 supplies design diversity alongside SHA-2; its existence is not a finding that SHA-2 failed.

This is the kind of trust I want Winnow to earn too. Publish the design, make the assumptions visible, invite attempts to find mistakes, and respond when the evidence changes. A Swift rewrite does not inherit correctness from the language. Passing known-answer tests establishes agreement on those cases. It does not establish resistance to timing leaks, bad randomness, or every malformed input. Our [native Swift cryptography research](/research/#native-swift) has to earn confidence separately from the algorithms it implements.

The same distinction becomes especially important when we talk about hash-based signatures and recovery.

[SLH-DSA, standardized in FIPS 205](https://csrc.nist.gov/pubs/fips/205/final), is a stateless hash-based signature scheme based on SPHINCS+. Its security depends on the construction's specified assumptions and parameters, not simply on calling something a hash. “Stateless” means the signer does not have to maintain an advancing record of which one-time signing keys have been consumed. It still has secret key material to protect, and it still needs a correct implementation.

That is a property of the signature scheme. It does not mean a wallet has nothing else to back up. FIPS 205 does not define a Bitcoin wallet's recovery words, derivation conventions, or backup format. A future wallet would have to specify how its key material is preserved and how another implementation reconstructs the same account.

I find it useful to separate four recovery responsibilities:

- **Signing authority:** the secrets that authorize a spend, including any other signers the policy requires.
- **Coin discovery:** enough information and chain access to find the payments belonging to the wallet.
- **Account meaning:** the derivation rules, scripts, signer configuration, and metadata needed to interpret what was restored.
- **Safe signing state:** any information that must survive so the next signature does not repeat a dangerous earlier action.

Recovery words can be central to the first responsibility without completing the other three.

There is already a concrete distinction in Winnow. Its [import bundle implementation](https://github.com/winnowwallet/winnow/blob/6566871db0a40be481dd63b7960790ef4de9192e/Sources/WalletCore/Wallet/ImportBundle.swift) imports historical records and begins its forward scan after the saved height. That is a particular restore path with particular inputs. It should not be described as proof that words alone reconstruct every account, record, and coin. A shared account also needs its spending policy and enough of the independently held signing keys.

Privacy changes the discovery part of this job. Winnow's normal design emphasizes local matching of compact filters from Bitcoin peers. [Winnow Rescue](/research/#rescue) has a different task: understand older backups and help move funds into an existing Taproot account. Its [current repository](https://github.com/winnowwallet/winnowrescue/blob/79ffa4da975b4134af20ce35986a39002cd76bc9/README.md) is an early scaffold, and its scope explicitly does not make privacy the primary goal. We should not transfer Winnow's privacy expectations to a recovery tool just because the names are related.

In a recovery design that asks a server about wallet-specific scripts, the server can associate those queries. Encrypting the connection does not hide the questions from that server. A server the user controls changes who sees them; it does not make the choice irrelevant. Combining recovered coins in one sweep can also reveal associations on-chain. I want the recovery flow to explain these disclosures before making them, and to test what can be found without them.

[Silent Payments](/research/#silent-payments) makes this research more urgent. The receiving process needs scanning information as well as spending authority, and labels affect how receipts are recognized. [BIP352](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki) specifies the protocol; it does not make a mobile restore cheap by itself. Our experiments need to identify which secrets and label information must be preserved, what can be reconstructed, and how much chain data a fresh phone must process. Winnow does not currently implement Silent Payments.

Stateful hash-based signatures add a sharper failure mode. Schemes such as XMSS and LMS rely on tracking one-time signing keys so the same one is not used for different messages. [NIST SP 800-208](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-208.pdf) explains the consequences of reuse. For conforming signing implementations, it requires advancing and durably storing the signing index before a signature leaves the module or another signing request is accepted. A backup that rolls this record backward can compromise the scheme's security even if every secret was restored perfectly.

Consider a hypothetical wallet that saves a backup, signs a transaction, and loses its phone. The signature was exported, but the transaction never reached the chain. Restoring the old backup restores the old record of unused keys. A blockchain rescan cannot reveal the signature that somebody may still hold. This is an engineering consequence of the state requirement: chain history alone cannot establish which signing keys remain safe to use. A cloned signer creates the same coordination problem from another direction.

A stateless scheme avoids that particular consumed-key bookkeeping problem. It does not erase the wallet's discovery and policy requirements. A stateful scheme needs an explicit design for durable updates, failures, backups, device replacement, and concurrent signers. I would want evidence from crashes and stale-backup restores before asking anyone to rely on such a design. This is research, not an announcement that Winnow or Rescue can recover these accounts today.

[P2MR research](/research/#p2mr) belongs in this conversation because the spending policy and its backup must remain understandable as output designs change. BIP360 is a draft proposal for committing directly to a script tree. It does not by itself supply a post-quantum signature scheme or settle a wallet's recovery strategy.

The experiment I want next is a recovery record for each proposed design: what must be saved, what can be rediscovered, who learns something during discovery, and what evidence permits signing again. Then we can lose the phone, restore an old copy, replace the hardware signer, interrupt the scan, and see where those answers fail.

Confidence in a hash and confidence in a wallet are connected, but neither substitutes for the other. I want to be able to explain both: why the primitive deserves trust, and how a person gets their money back when the original device is gone.
