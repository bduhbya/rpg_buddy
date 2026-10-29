# Phase 4: Secure application boundary - Requirements

## 1. Context

Roadmap Phase 4 proves the architectural process boundary before application services arrive. Authority: ../mission.md, ../tech-stack.md, ../roadmap.md. User confirmed the proposed plan, requirements and validation on 2026-10-29.

## 2. Scope

Add one read-only application-info request through a typed preload bridge, runtime request validation, trusted main-frame checks and navigation restrictions. Exclude logging (Phase 5), filesystem APIs, domain behavior and persistence.

## 3. Product decisions

Display application name/version and Electron, Chrome and Node versions. Show understandable loading and failure feedback. No raw IPC, generic channel selection or privileged object is exposed. No open product decisions.

## 4. Technical requirements

- SB-1: Shared TypeScript contracts specify a versioned application-info request and discriminated success/failure result. Runtime validation rejects malformed, extra-key and unsupported-version payloads without leaking errors or paths. Validate responses before exposing them to the renderer. Transport failures yield a stable safe failure.
- SB-2: A sandbox-compatible contextBridge exposes only getApplicationInfo(). Context isolation and sandbox remain enabled; renderer Node integration remains disabled. Main validates the owning live webContents, exact trusted document URL and main frame on every request. Untrusted senders receive no application information.
- SB-3: Deny window creation, webview attachment and navigation away from the configured document; allow normal loading and reload. Do not open external URLs or grant renderer filesystem access.
- SB-4: Both development and packaged builds load the preload and show actual main-process application/runtime versions. Retain the existing startup screen and clean lifecycle behavior.

## 5. Accessibility requirements

Use a named application-information section and semantic labels for versions. Announce loading with status semantics and failure with alert semantics. Retain language, title, main heading, readable contrast, keyboard usability and no horizontal clipping at 360px with doubled text.

## 6. Completion requirements

SB-1–SB-4 and the accessibility requirements pass the defined automated checks; production packaging, strict TypeScript and formatting pass. Record actual evidence and supply a reproducible human walkthrough. Human execution and other-platform launches are not completion gates and must not be claimed as performed.
