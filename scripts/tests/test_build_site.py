import hashlib
import importlib.machinery
import importlib.util
import json
import re
from pathlib import Path
import tempfile
import unittest
import unittest.mock

loader = importlib.machinery.SourceFileLoader("build_site", str(Path(__file__).parents[1] / "build-site"))
spec = importlib.util.spec_from_loader(loader.name, loader)
site = importlib.util.module_from_spec(spec)
loader.exec_module(site)

class JourneyOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "docs/videos").mkdir(parents=True)
        (self.root / "docs/screenshots").mkdir(parents=True)
        (self.root / "docs/screenshots/receive.png").write_bytes(b"image fixture")
        (self.root / "upstream/UITests").mkdir(parents=True)
        self.source = self.root / "upstream" / site.TEST_PATH
        self.source.write_text("    func test01Receive() {}\n")
        (self.root / "docs" / site.VIDEO_PATH).write_bytes(b"recording fixture")
        # the homepage's checkpoints must exist and be captured by the journey
        self.checkpoints = [name for _, shots in site.ACTS for name, _ in shots]
        for name in self.checkpoints:
            (self.root / f"docs/screenshots/{name}.png").write_bytes(b"image fixture")
        (self.root / "upstream/UITests/Checkpoints.swift").write_text("extension WinnowAppUITests {\n" + "".join(
            f'        Screenshots.capture(app, "{name}", testCase: self)\n' for name in self.checkpoints) + "}\n")
        self.journeys = [{"id": "receive", "section": "everyday", "tests": ["test01Receive"]}]
        self.save()

    def save(self):
        (self.root / "docs/journeys.json").write_text(json.dumps(self.journeys))

    def test_real_scenario_and_recording_are_accepted(self):
        journeys, cases = site.load_journeys(self.root)
        self.assertEqual(len(journeys), 1)
        self.assertEqual(set(cases), {"test01Receive"})

    def test_removed_test_cannot_keep_supporting_a_claim(self):
        self.source.write_text("")
        with self.assertRaisesRegex(ValueError, "missing app test"):
            site.load_journeys(self.root)

    def test_new_scenario_needs_a_documented_purpose(self):
        self.source.write_text(self.source.read_text() + "    func test02Undocumented() {}\n")
        with self.assertRaisesRegex(ValueError, "need a documented journey"):
            site.load_journeys(self.root)

    def test_missing_recording_is_rejected(self):
        (self.root / "docs" / site.VIDEO_PATH).unlink()
        with self.assertRaisesRegex(ValueError, "missing journey video"):
            site.load_journeys(self.root)

    def test_unresolved_recording_is_rejected(self):
        (self.root / "docs" / site.VIDEO_PATH).write_bytes(
            b"version https://git-lfs.github.com/spec/v1\n")
        with self.assertRaisesRegex(ValueError, "unresolved LFS pointer"):
            site.load_journeys(self.root)

    def test_inventory_can_include_features_without_ui_coverage(self):
        guide = {"id": "savings", "section": "everyday", "tests": [],
                 "title": "Shared savings", "description": "Choose co-owners.",
                 "journey": ["Review the signing policy."]}
        self.journeys.append(guide)
        self.save()
        journeys, _ = site.load_journeys(self.root)
        self.assertEqual(len(journeys), 2)
        self.assertEqual(journeys[1]["tests"], [])

    def test_feature_guidance_cannot_claim_another_tests_screenshot(self):
        self.journeys.append({"id": "savings", "section": "everyday",
                              "tests": [], "image": "receive"})
        self.save()
        with self.assertRaisesRegex(ValueError, "not captured by its app tests"):
            site.load_journeys(self.root)

    def test_optional_screenshot_needs_its_owning_capture(self):
        self.journeys[0]["image"] = "receive"
        self.save()
        with self.assertRaisesRegex(ValueError, "not captured by its app tests"):
            site.load_journeys(self.root)
        self.source.write_text('    func test01Receive() {\n'
                               '        Screenshots.capture(app, "receive", testCase: self)\n'
                               '    }\n')
        journeys, _ = site.load_journeys(self.root)
        self.assertEqual(journeys[0]["image"], "receive")
        (self.root / "docs/screenshots/receive.png").unlink()
        with self.assertRaisesRegex(ValueError, "missing screenshot"):
            site.load_journeys(self.root)

    def test_duplicate_journey_is_rejected(self):
        self.journeys.append(dict(self.journeys[0]))
        self.save()
        with self.assertRaisesRegex(ValueError, "duplicate or invalid"):
            site.load_journeys(self.root)

    def documented_inventory(self):
        """One fully documented journey with a test, and one guide without."""
        self.journeys = [
            {"id": "receive", "section": "everyday", "title": "Receive bitcoin",
             "description": "Share an address.", "tests": ["test01Receive"],
             "journey": ["Tap Receive.", "Read the address."],
             "limitations": "Labels stay on this device."},
            {"id": "fees", "section": "advanced", "title": "Replace a pending payment",
             "description": "Bump the fee.", "journey": ["Choose Bump fee."],
             "tests": [], "guide": "/vaults"},
        ]
        self.save()
        (self.root / "docs/vaults.html").write_text("<p>the signing guide</p>")
        return site.load_journeys(self.root)

    def test_homepage_modes_keep_the_complete_journey_available(self):
        journeys, cases = self.documented_inventory()
        homepage = site.homepage(journeys, cases)
        recording = site.recording_page(self.root)
        self.assertIn("Download for iPhone", homepage)
        self.assertIn("TestFlight", homepage)
        for mode in ("everyday", "both", "shared"):
            self.assertIn(f'id="mode-{mode}"', homepage)
            self.assertIn(f'aria-controls="policy-{mode} screen-{mode}"', homepage)
            self.assertIn(f'id="policy-{mode}"', homepage)
            self.assertIn(f'id="screen-{mode}"', homepage)
        self.assertIn('href="/recording" data-watch', homepage)
        self.assertIn('<video controls playsinline preload="none"', homepage)
        self.assertNotIn("autoplay", homepage)
        self.assertNotIn('href="/advanced', homepage)
        self.assertNotIn('href="/testing', homepage)
        self.assertEqual(recording.count("<video "), 1)
        self.assertIn(f'<source src="/{site.VIDEO_PATH}" type="video/mp4">', recording)
        self.assertNotIn("autoplay", recording)
        gallery = homepage.split('id="screens"', 1)[1].split('</details>', 1)[0]
        shown = re.findall(r'<img src="screenshots/([a-z0-9-]+)\.png"', gallery)
        self.assertEqual(shown, self.checkpoints)
        hero = homepage.split('class="wallet-screens"', 1)[1].split('</section>', 1)[0]
        featured = re.findall(r'<img src="screenshots/([a-z0-9-]+)\.png"', hero)
        self.assertEqual(len(featured), 3)
        self.assertTrue(set(featured).issubset(self.checkpoints))

    def test_homepage_cannot_show_a_screen_the_journey_never_captured(self):
        (self.root / "upstream/UITests/Checkpoints.swift").write_text("")
        with self.assertRaisesRegex(ValueError, "not captured by the journey"):
            site.load_journeys(self.root)

    def test_missing_checkpoint_image_is_rejected(self):
        (self.root / f"docs/screenshots/{self.checkpoints[0]}.png").unlink()
        with self.assertRaisesRegex(ValueError, "missing checkpoint screenshot"):
            site.load_journeys(self.root)


SHA = "0123456789abcdef0123456789abcdef01234567"
RUN = "https://github.com/winnowwallet/winnow/actions/runs/42"


class CIMediaTests(unittest.TestCase):
    """docs/journey-provenance.json version 2: the wallet CI's media drive the pages."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "docs/videos").mkdir(parents=True)
        (self.root / "docs/screenshots").mkdir(parents=True)
        # no upstream/: the CI journeys stand on their own results
        self.shots = [("01-onboarding", "testCreateReceiveSendConfirm"),
                      ("07-home-after-send", "testCreateReceiveSendConfirm"),
                      ("13b-multisig-transactions", "testMultisigTwoOfThreeWithRecovery"),
                      ("13-multisig-sent", "testMultisigTwoOfThreeWithRecovery"),
                      ("22-ledger-confirmed", "testLedgerPairVerifySpend"),
                      ("41-silent-confirmed", "testFutureJourney")]
        self.evidence = {
            "version": 2, "source_sha": SHA, "run_url": RUN, "branch": "main", "network": "regtest",
            "test": "WinnowLeanUITests", "result": "passed", "test_seconds": 30.5,
            "device": {"name": "iPhone 17 Pro", "os": "iOS 26.5"},
            "tests": [{"name": name, "result": "passed", "seconds": 7.625} for name in
                      ["testCreateReceiveSendConfirm", "testMultisigTwoOfThreeWithRecovery",
                       "testLedgerPairVerifySpend", "testFutureJourney"]],
            "screenshots": [self.media(f"screenshots/{name}.png", b"\x89PNG\r\n\x1a\n" + name.encode(),
                                       name=name, test=test, width=1179, height=2556)
                            for name, test in self.shots],
            "video": self.media(site.VIDEO_PATH, b"recording fixture", width=720, height=1562,
                                duration_seconds=31.25, path=site.VIDEO_PATH),
            "original_video": {"width": 1179, "height": 2556, "duration_seconds": 31.3, "bytes": 1000},
        }
        self.journeys = [{"id": "send", "section": "everyday", "tests": ["test01CreateReceiveSendConfirm"],
                          "screenshots": {"01-onboarding": "Create a wallet",
                                          "07-home-after-send": "History keeps the receipt"}}]
        self.save()

    def media(self, relative, data, **entry):
        (self.root / "docs" / relative).write_bytes(data)
        return dict(entry, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

    def save(self):
        (self.root / "docs/journeys.json").write_text(json.dumps(self.journeys))
        (self.root / site.MANIFEST).write_text(json.dumps(self.evidence))

    def build(self):
        manifest = site.load_manifest(self.root)
        journeys, cases = site.load_journeys(self.root, manifest)
        media = site.ci_media(manifest, site.check_inventory(self.root, journeys))
        return (site.homepage(journeys, cases, media),
                site.recording_page(self.root, dict(manifest, poster=media["poster"])))

    def test_gallery_is_the_manifest_in_order_grouped_by_test(self):
        homepage, _ = self.build()
        gallery = homepage.split('id="screens"', 1)[1].split('</details>', 1)[0]
        self.assertEqual(re.findall(r'<img src="screenshots/([a-z0-9-]+)\.png"', gallery),
                         [name for name, _ in self.shots])
        self.assertEqual(re.findall(r"<h3>(.*?)</h3>", gallery),
                         ["An ordinary payment", "Two of three, and the recovery path", "A Ledger as the second key",
                          "Future journey"])
        captions = re.findall(r"<figcaption>(.*?)</figcaption>", gallery)
        # journeys.json captions, else the name in words
        self.assertEqual(captions, ["Create a wallet", "History keeps the receipt", "Multisig transactions",
                                    "Multisig sent", "Ledger confirmed", "Silent confirmed"])
        self.assertIn('width="1179" height="2556"', gallery)
        self.assertNotIn(f'width="{site.SHOT_WIDTH}"', gallery)
        self.assertIn("Explore all 6 screens", gallery)

    def test_hero_and_poster_come_from_the_manifest(self):
        homepage, recording = self.build()
        hero = homepage.split('class="wallet-screens"', 1)[1].split('</section>', 1)[0]
        self.assertEqual(re.findall(r'<img src="screenshots/([a-z0-9-]+)\.png"', hero),
                         ["07-home-after-send", "22-ledger-confirmed", "13-multisig-sent"])
        self.assertNotIn("MuSig2", homepage)
        self.assertIn("2-of-2 · 2 signatures", homepage)
        self.assertIn("RECORDED BY CI ON REGTEST", homepage)
        self.assertIn('poster="/screenshots/07-home-after-send.png"', homepage)
        self.assertIn('poster="/screenshots/07-home-after-send.png"', recording)
        for mode in ("everyday", "both", "shared"):
            self.assertIn(f'id="screen-{mode}"', homepage)

    def test_checked_section_is_the_run(self):
        homepage, _ = self.build()
        checked = homepage.split('id="checked"', 1)[1].split("</section>", 1)[0]
        tests = re.findall(r'<code>(test[A-Za-z0-9]+)</code>', checked)
        self.assertEqual(tests, [test["name"] for test in self.evidence["tests"]])
        self.assertIn("A Ledger as the second key", checked)
        self.assertIn("Future journey", checked)  # a test with no heading gets its name in words
        self.assertIn(f'/commit/{SHA}"><code>{SHA[:7]}</code>', checked)
        self.assertIn(f'href="{RUN}"', checked)
        self.assertIn("iPhone 17 Pro · iOS 26.5", checked)
        self.assertIn("2 screens", checked)  # the ordinary payment's two captures
        self.assertIn("8 s", checked)
        self.assertEqual(checked.count('class="test-result">passed<'), 4)
        self.assertIn('href="#checked">Evidence', homepage)

    def test_lean_section_names_the_source_and_framework(self):
        homepage, _ = self.build()
        lean = homepage.split('id="lean"', 1)[1].split("</section>", 1)[0]
        for link in ("https://github.com/winnowwallet/winnow-lean", "https://leannative.com", "/architecture"):
            self.assertIn(f'href="{link}', lean)

    def test_reference_media_have_no_run_section(self):
        media = site.reference_media()
        self.assertIsNone(media["run"])
        self.assertEqual(site.checked_section(media["run"]), "")
        self.assertEqual(site.duration(58.4), "58 s")
        self.assertEqual(site.duration(618.306), "10 min 18 s")

    def test_a_mode_without_a_ci_screenshot_keeps_its_reference_screen(self):
        self.evidence["screenshots"] = [s for s in self.evidence["screenshots"] if s["name"] != "22-ledger-confirmed"]
        self.save()
        homepage, _ = self.build()
        self.assertIn('src="screenshots/40-extra-device-confirmed.png"', homepage)
        self.assertIn("2-of-2 · 2 signatures", homepage)

    def test_recording_page_shows_the_run_tests_and_device(self):
        _, recording = self.build()
        self.assertIn(f'<a href="{RUN}">this successful CI run</a>', recording)
        self.assertIn("iPhone 17 Pro simulator (iOS 26.5)", recording)
        self.assertIn(f"https://github.com/winnowwallet/winnow/commit/{SHA}", recording)
        self.assertIn("<code>main</code>", recording)
        self.assertEqual(recording.count("<li><code>test"), 4)
        self.assertIn("<code>testLedgerPairVerifySpend</code>: passed, 7.625 seconds", recording)
        self.assertIn("720 × 1562, 31.250 seconds, 17 bytes", recording)
        self.assertIn(f'<source src="/{site.VIDEO_PATH}" type="video/mp4">', recording)

    def test_build_is_deterministic(self):
        self.assertEqual(self.build(), self.build())

    def test_a_failed_test_is_rejected(self):
        self.evidence["tests"][1]["result"] = "failed"
        self.save()
        with self.assertRaisesRegex(ValueError, "did not pass: testMultisigTwoOfThreeWithRecovery"):
            site.load_manifest(self.root)

    def test_a_missing_or_changed_file_is_rejected(self):
        (self.root / "docs/screenshots/13-multisig-sent.png").write_bytes(b"\x89PNG\r\n\x1a\nother")
        with self.assertRaisesRegex(ValueError, "13-multisig-sent.png does not match"):
            site.load_manifest(self.root)
        (self.root / "docs/screenshots/13-multisig-sent.png").unlink()
        with self.assertRaisesRegex(ValueError, "missing screenshots/13-multisig-sent.png"):
            site.load_manifest(self.root)

    def test_a_manifest_without_video_is_rejected(self):
        self.evidence["video"] = None
        self.save()
        with self.assertRaisesRegex(ValueError, "no video"):
            site.load_manifest(self.root)

    def test_an_unresolved_lfs_video_is_rejected(self):
        data = b"version https://git-lfs.github.com/spec/v1\noid sha256:00\n"
        self.evidence["video"] = self.media(site.VIDEO_PATH, data, width=1, height=1, duration_seconds=1)
        self.save()
        with self.assertRaisesRegex(ValueError, "unresolved LFS pointer"):
            site.load_manifest(self.root)

    def test_a_screenshot_naming_an_unlisted_test_is_rejected(self):
        self.evidence["screenshots"][0]["test"] = "testNeverRan"
        self.save()
        with self.assertRaisesRegex(ValueError, "names a test the run does not list"):
            site.load_manifest(self.root)

    def test_a_screenshot_captioned_twice_is_rejected(self):
        self.journeys.append({"id": "again", "section": "everyday", "tests": [],
                              "screenshots": {"01-onboarding": "Again"}})
        self.save()
        with self.assertRaisesRegex(ValueError, "already captioned"):
            site.load_journeys(self.root, site.load_manifest(self.root))

    def test_a_version_1_manifest_keeps_the_reference_path(self):
        (self.root / site.MANIFEST).write_text(json.dumps({"version": 1}))
        self.assertIsNone(site.load_manifest(self.root))

    def test_main_check_detects_stale_pages(self):
        argv = ["build-site", "--root", str(self.root)]
        with unittest.mock.patch("sys.argv", argv):
            site.main()
        with unittest.mock.patch("sys.argv", argv + ["--check"]):
            site.main()
        self.evidence["tests"][0]["seconds"] = 8.0
        self.save()
        with unittest.mock.patch("sys.argv", argv + ["--check"]), self.assertRaises(SystemExit):
            site.main()

    def test_lean_journeys_have_headings_and_captions(self):
        expected_tests = [
            "testCreateReceiveSendConfirm",
            "testLedgerPairVerifySpend",
            "testLedgerCardTwoOfTwo",
            "testMultisigTwoOfThreeWithRecovery",
            "testFeeBumpReplaceConfirm",
            "testRetryAfterNoPeers",
            "testShippedCensus",
            "testSilentPaymentSend",
            "testSpentElsewhere",
            "testCardForOnePerson",
            "testCardRestoreFromBackup",
            "testSegwitMultisigJoinSign",
            "testAccountFollowsDevices",
            "testTwoWalletsOneDevice",
        ]
        for test_name in expected_tests:
            self.assertIn(test_name, site.TEST_HEADINGS)
        journeys = json.loads((site.ROOT / "docs/journeys.json").read_text())
        captions = site.check_inventory(site.ROOT, journeys)
        self.assertNotIn("50-card-for-dana", captions)
        self.assertNotIn("51-card-payments-from-dana", captions)
        self.assertIn("50-fee-bump-review", captions)
        self.assertIn("51-fee-bump-confirmed", captions)
        new_shots = [
            ("70-card-for-dana-address", "testCardForOnePerson"),
            ("71-card-for-dana-card", "testCardForOnePerson"),
            ("72-card-payer-review", "testCardForOnePerson"),
            ("73-card-payments-from-dana", "testCardForOnePerson"),
            ("74-card-address-rotated", "testCardForOnePerson"),
            ("75-card-coins-spent", "testCardForOnePerson"),
            ("76-card-restore-icloud", "testCardRestoreFromBackup"),
            ("77-card-restore-found", "testCardRestoreFromBackup"),
            ("78-card-restore-spent", "testCardRestoreFromBackup"),
            ("80-segwit-join", "testSegwitMultisigJoinSign"),
            ("81-segwit-funded", "testSegwitMultisigJoinSign"),
            ("82-segwit-review", "testSegwitMultisigJoinSign"),
            ("83-segwit-signed", "testSegwitMultisigJoinSign"),
            ("84-segwit-confirmed", "testSegwitMultisigJoinSign"),
            ("85-devices-first", "testAccountFollowsDevices"),
            ("86-devices-second-watching", "testAccountFollowsDevices"),
            ("87-devices-watch-only", "testAccountFollowsDevices"),
            ("88-devices-ledger-sync", "testAccountFollowsDevices"),
            ("90-profiles-one", "testTwoWalletsOneDevice"),
            ("91-profiles-add", "testTwoWalletsOneDevice"),
            ("92-profiles-two-renamed", "testTwoWalletsOneDevice"),
            ("93-profiles-inactive-funded", "testTwoWalletsOneDevice"),
            ("94-profiles-one-signature", "testTwoWalletsOneDevice"),
            ("95-profiles-switched", "testTwoWalletsOneDevice"),
            ("96-profiles-two-signatures", "testTwoWalletsOneDevice"),
        ]
        for shot_name, _ in new_shots:
            self.assertIn(shot_name, captions)
        manifest = {"screenshots": [{"name": name, "test": test, "width": 1179, "height": 2556}
                                    for name, test in new_shots]}
        acts = site.ci_acts(manifest, captions)
        self.assertEqual([heading for heading, _ in acts], [
            site.TEST_HEADINGS["testCardForOnePerson"],
            site.TEST_HEADINGS["testCardRestoreFromBackup"],
            site.TEST_HEADINGS["testSegwitMultisigJoinSign"],
            site.TEST_HEADINGS["testAccountFollowsDevices"],
            site.TEST_HEADINGS["testTwoWalletsOneDevice"],
        ])
        rendered_captions = [caption for _, shots in acts for _, caption, _, _ in shots]
        self.assertEqual(rendered_captions, [captions[name] for name, _ in new_shots])

if __name__ == "__main__":
    unittest.main()
