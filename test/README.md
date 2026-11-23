# SILE TEST — Same-repository testing
The test page is at https://zanjohan-dot.github.io/sile-ipad-reference/test/staging-check.html
This page is under the SAME web origin as production and does not provide full origin-level isolation.
- Production app uses IndexedDB sile-ipad-stage3; test app uses sile-ipad-test-v1.
- Production worker uses sile-study-* shell caches; test worker uses sile-test-shell-* only.
- Test worker controls only the /sile-ipad-reference/test/ path and never deletes production-named caches.
- Test import rejects any file lacking meta.built=synthetic-browser-smoke.
- Optional AI and private-calculator scripts are omitted from the test shell.
- Do NOT clear Safari website data, delete production Home Screen app, or use private legal content in test.
- Do not regard synthetic reference outputs as legal revision material.
- Test Safari and separately installed Home Screen app; test iPad airplane mode only after online shell caches successfully.
This /test/ folder can be deleted independently of the root app code, but deleting website storage from Safari settings would affect both.
