# Security Policy

## Scope

WorldView is a client-only single-page application served as a static site via GitHub Pages. It has no backend, no authentication layer, no user accounts, and no server-side state.

All data processing, including optional API keys supplied by the end user, happens in the browser. The codebase in this repository is the complete attack surface of the deployed product.

## Supported Versions

Only the `main` branch (currently deployed to GitHub Pages) receives security updates. Older tags and feature branches are not supported.

| Branch / Tag | Supported |
|---|---|
| `main` (live) | Yes |
| Previous tags / releases | No |
| Feature / experimental branches | No |

## What Counts as a Security Issue

Relevant classes of vulnerability for this project:

- Cross-site scripting (XSS) in rendered HTML or injected data from public feeds
- Exposure or logging of user-supplied API keys (e.g., `aisstream.io`) beyond the browser's `localStorage`
- Insecure transport (mixed content, non-TLS requests to third-party feeds)
- Dependency vulnerabilities with a practical impact on the deployed bundle
- Service worker issues that could allow cache poisoning or persistent compromise
- Prototype pollution or unsafe deserialization in parsing of third-party feed payloads

Out of scope:

- The accuracy, freshness, or availability of third-party OSINT feeds (OpenSky, aisstream.io, CelesTrak, USGS). These are public data sources; WorldView displays them "as-is".
- Rate limiting or denial-of-service on upstream APIs — users supply their own keys and are responsible for respecting provider terms.
- Social engineering, physical attacks, or compromise of a user's device.
- Any issue that requires a pre-compromised browser, malicious browser extension, or admin-level local access.

## Reporting a Vulnerability

Please report security issues privately. Do **not** open a public GitHub issue for undisclosed vulnerabilities.

Preferred channels, in order:

1. **GitHub Security Advisories** — use the "Report a vulnerability" button on the [Security tab](https://github.com/Giuseppe84-code/Worldview-project/security/advisories/new) of this repository. This creates a private advisory visible only to maintainers.
2. **Direct contact** — open a minimal issue titled "Security contact request" without vulnerability details, and a maintainer will respond with a private channel.

When reporting, please include:

- A clear description of the issue and its impact
- Steps to reproduce (URL, browser, console output, minimal PoC if possible)
- The affected commit SHA or deployment date
- Your assessment of severity
- Whether you intend to disclose publicly and on what timeline

## Response Process

This project is maintained by a single developer on a best-effort basis. Realistic expectations:

- **Acknowledgement:** within 5 business days of report
- **Initial triage:** within 10 business days
- **Fix or mitigation:** prioritised by severity; critical issues aimed at 14 days, lower severity on a best-effort basis
- **Public disclosure:** coordinated with the reporter; a GitHub Security Advisory is published once a fix ships to `main`

Reporters acting in good faith will be credited in the advisory unless they request anonymity.

## Safe Harbour

Security research conducted in good faith against the deployed site and this source code is welcome. Researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service interruption to third-party providers,
- Only interact with accounts they own or have explicit permission to test,
- Do not exploit an issue beyond what is necessary to confirm it, and
- Report findings privately before any public disclosure,

will not be pursued or reported by the maintainer for their research activity.

## Data Handling Notes for Reporters

The deployed application stores the following in the browser's `localStorage`:

- `wv_aisstream_key` — user-supplied API key for aisstream.io
- Region, filter, and ship-type preferences

Nothing is transmitted to any server operated by this project. All third-party requests go directly from the user's browser to the respective public feed provider.

## No Warranty

WorldView aggregates public OSINT feeds for situational-awareness demonstration. It is **not certified for operational, safety-critical, or navigation use**. See [README.md](./README.md) for the full disclaimer.
