# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Playbook (read this for how to build/ship apps like this one)

`PLAYBOOK.md` is the reusable, end-to-end guide for building & releasing a mobile
app with this stack (architecture, reusable `lib/` parts, dev/preview/release
workflow, and how to spin up a NEW app from this template). Start there.

Hard rules: run `npm run typecheck` before finishing; store secrets via
expo-secure-store (never plaintext); no ads/tracking SDKs; keep web export
working; commit small and refresh the web preview.

