# SILE Part B 2026 - Isolated iPad Staging and Acceptance

**Status:** Draft branch only. Not an examination-ready production release.

## 1. Safety preconditions

The production app remains at `https://zanjohan-dot.github.io/sile-ipad-reference/`.
Do **not** deploy the candidate to another folder or GitHub Pages project under the
same `zanjohan-dot.github.io` host. These paths have the same web origin and can
share Safari storage (IndexedDB), regardless of repository names.

A valid test environment uses a distinct **HTTPS hostname** such as
`https://<your-staging-name>.pages.dev` or
`https://<your-staging-name>.netlify.app`. A port or a path change is not
a sufficient substitute for a separate hostname on iPad.

Only the **public application shell** and a deliberately synthetic test dataset
may be uploaded to the hosting provider. No SILE course PDFs, official answer
keys, private calculators, legal content dataset, personal study progress,
or on-device language model weights are to be uploaded to public hosting.

Do not clear Safari website data, remove the existing production Home Screen
icon, or reset IndexedDB. Do not import a private dataset into staging until
the hosting environment, privacy practices, and release controls are verified.

## 2. Obtain the built and tested candidate

Open the GitHub Actions workflow **SILE non-private regression checks** for
the current draft branch commit. Download the artifact `sile-static-candidate`.
Check the workflow status is **Success**, and that the artifact comes from the
intended draft commit rather than production `main`.

The artifact includes `SILE_Synthetic_323_Questions.json` (test-only data).
It is intentionally distinct from all private SILE examination materials.
Unzip the artifact. Keep the relative paths and the filenames unchanged.

The `index.html` and `manifest.webmanifest` resolve files relative to their
hosting directory. The service worker scope is also relative. Both portrait
and landscape orientation are allowed.

## 3. Isolated static HTTPS hosting

Publish the extracted public files to a new HTTPS staging domain using a
trusted static-hosting account you control (for example, a **separate-domain**
Cloudflare Pages or Netlify static site).

Do not use the existing `zanjohan-dot.github.io` host, even under another
repository or folder. Do not overwrite its existing SILE site.

For a root deployment, `index.html`, `app.js`, `sw.js`,
`manifest.webmanifest` and their CSS/JS/assets must all resolve under the
new origin. Check the Developer Tools network response for JavaScript is
JavaScript, not an HTML fallback.

**No automatic staging publication is configured or claimed by this repository.**

## 4. Safari acceptance checklist (use the synthetic file first)

On the iPad connect to Wi-Fi, open the NEW staging HTTPS URL in Safari,
and check:

- [ ] The URL hostname is different from `zanjohan-dot.github.io`.
- [ ] The opening screen says no local data and offers import.
- [ ] Import **SILE_Synthetic_323_Questions.json** from Files.
- [ ] The status confirms 323 questions (test records only).
- [ ] Tap Paper 1 and Paper 2 and confirm the subject context changes.
- [ ] Tap Rapid and Learn and confirm both pages load.
- [ ] Tap Ask, enter `fiduciary duties`, then tap **Find explanation and questions**.
- [ ] A source-based explanation appears and is clearly labelled **not AI**.
- [ ] Related test questions appear, with source and status labels.
- [ ] Tap **Show all** and confirm 323 synthetic test questions are accessible.
- [ ] Open a question and use Back to return to Ask.
- [ ] In Learn, select an option; record the attempt and view feedback.
- [ ] Mark a question for revision. Check the revision screen.
- [ ] Reload Safari. The synthetic dataset and recorded progress remain.
- [ ] Turn on Airplane Mode (with Wi-Fi and cellular disconnected), close Safari,
      reopen the staging URL while offline, and repeat Ask and practice checks.
- [ ] After turning connectivity back on, export the synthetic dataset backup
      and progress backup and verify that files were created.
- [ ] Record any error or screenshot; do not clear or reset storage as a fix.

## 5. Home Screen acceptance (distinct app)

While connected to Wi-Fi, use Safari Share -> Add to Home Screen on the
**staging domain** and leave Open as Web App enabled if that option appears.
Label the icon **SILE TEST** so it cannot be confused with the production app.

- [ ] The staging Home Screen icon opens to the staging hostname.
- [ ] If it starts without data, import the synthetic JSON separately.
      This is expected on iPadOS where web apps can have separate storage.
- [ ] Repeat Ask, question navigation, practice and persistence.
- [ ] Test app relaunch with Airplane Mode and Wi-Fi off.
- [ ] Check portrait orientation, landscape and Split View.
- [ ] Check slow loading, scroll behaviour and touch target visibility.
- [ ] Confirm the live production Home Screen icon and its stored
      private dataset/progress are completely unaffected.

## 6. Approval and release gate

Record a PASS/FAIL/BLOCKED/NOT TESTED for each check with the test date,
staging URL, iPadOS version, device model and screenshots for failures.

**Release remains NO-GO until:**
1. Safari and Home Screen checks succeed on the actual iPad with isolated storage.
2. Actual private installed data and revision backups can be verified safely.
3. The newer 93/170/57/3 per-question legal-status ledger is reconciled and
   the substantive 22 findings are adjudicated.
4. The original legal materials, source citations, question options and
   323-record IDs are verified against an approved release dataset.
5. The optional on-device AI is either tested for genuine offline inference
   and legal grounding, or clearly labelled unavailable and excluded from
   the Stage 1 release.

**Important:** passing a Linux WebKit smoke test is not a substitute for
the actual iPadOS Safari/Home Screen test.
