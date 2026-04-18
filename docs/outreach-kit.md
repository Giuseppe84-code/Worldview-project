# LinkedIn Outreach Kit — Maritime & OSINT Freelance

## 1. LinkedIn Profile — Optimized Bio

Copy-paste these into your LinkedIn profile fields:

### Headline (max 120 chars)
```
Freelance Developer — Real-time Maritime & OSINT Dashboards | React · D3 · WebSocket · PWA
```

### About (max 2600 chars)
```
I build real-time geospatial command centers for maritime security, OSINT, and operations teams.

My reference project is WorldView — an open-source situational-awareness globe that aggregates live ADS-B flights, AIS vessel positions, satellite tracks, seismic events, and GPS-jamming zones onto a single interactive display. It runs entirely in the browser, installs as a PWA, costs $0/month to host, and renders 500+ animated markers at 60 fps on a phone.

→ Live demo: https://giuseppe84-code.github.io/Worldview-project/
→ Source: https://github.com/Giuseppe84-code/Worldview-project

What I deliver for clients:

• White-label dashboards — your feeds, your branding, your domain. 2-3 weeks, fixed price, source code yours.
• Custom MVPs — new dashboard built around your specific data sources and workflow. 3-5 weeks.
• Maintenance retainers — ongoing feature additions and monitoring at a predictable monthly rate.

Stack: React 18, Vite, D3.js (geoOrthographic), Canvas 2D, WebSocket, Service Worker, GitHub Actions CI/CD.

Principles: no vendor lock-in, no unnecessary backend, mobile-first, ship fast.

Based in Italy, working remotely with clients across EU and US timezones.

Open to new projects — DM me or book a call.
```

### Featured section
Add these links to your LinkedIn "Featured" section:
1. WorldView Live Demo → https://giuseppe84-code.github.io/Worldview-project/
2. Consulting Pitch → https://giuseppe84-code.github.io/Worldview-project/landing.html
3. GitHub Profile → https://github.com/Giuseppe84-code

---

## 2. LinkedIn DM Templates

### Rules
- Keep under 120 words
- Personalize the first line (their company/role/recent post)
- Link to demo, not to "hire me"
- No attachments on first message
- End with a soft question, not a hard sell

---

### Template A — Maritime Security / Shipping

**Target:** Head of Operations, Security Manager, Fleet Manager at shipping firms, P&I clubs, maritime security consultancies (Ambrey, MAST, Neptune P2P, Diaplous), port authorities.

**LinkedIn search query:** `"maritime security" OR "fleet operations" OR "vessel tracking" AND (manager OR head OR director OR CTO)`

```
Hi [Name],

I noticed [Company] works in maritime security/operations — wanted to share something that might be relevant.

I built an open-source real-time vessel tracking globe that streams live AIS data, overlays GPS-jamming zones, and runs entirely in the browser with no backend:

→ https://giuseppe84-code.github.io/Worldview-project/

I build custom versions of this for security firms and fleet operators — white-label, your feeds, your domain, fixed price, 2-4 weeks.

Would something like this be useful for your team's workflow? Happy to do a 20-min demo call if you're curious.

Best,
Giuseppe
```

---

### Template B — Newsroom / OSINT / Investigative Journalism

**Target:** OSINT researchers, investigative editors, data journalists at Bellingcat, OCCRP, Correctiv, IRPI, Reuters, AP, BBC, Il Sole 24 Ore, Domani, Internazionale.

**LinkedIn search query:** `"OSINT" OR "investigative" OR "data journalist" AND (editor OR researcher OR analyst)`

```
Hi [Name],

I follow [outlet]'s investigative work — especially [mention a recent piece or topic they cover, e.g. "the shipping sanctions coverage" or "the GPS spoofing analysis"].

I'm a developer who built an open-source OSINT globe that correlates live flights, vessels, satellites, and GPS-jamming zones in real time:

→ https://giuseppe84-code.github.io/Worldview-project/

It's browser-only, no install, works on mobile. I've been thinking about adding a replay mode for incident reconstruction — would that be useful for your desk?

Happy to chat if this is relevant to your workflow.

Giuseppe
```

---

### Template C — Corporate Security / SOC / Duty of Care

**Target:** Global Security Manager, SOC Analyst, Duty of Care Officer at Oil&Gas (ENI, Shell, TotalEnergies), utilities (Enel, EDF), mining, large NGOs (ICRC, MSF, WFP), risk consultancies (Control Risks, International SOS).

**LinkedIn search query:** `"global security" OR "duty of care" OR "security operations center" AND (manager OR director OR analyst)`

```
Hi [Name],

I build real-time situational-awareness dashboards for security teams monitoring staff and assets in high-risk regions.

Here's a live demo — an OSINT globe showing flights, vessels, satellites, GPS-jamming zones, and seismic events on a single screen:

→ https://giuseppe84-code.github.io/Worldview-project/

It runs in the browser, installs as a PWA for offline use, and I can customize it with your internal feeds and alert triggers. Fixed-price builds, 3-5 weeks, source code delivered.

Would this fit into your team's operational picture? Happy to walk you through it in 20 minutes.

Giuseppe
```

---

## 3. Follow-up Template (if no reply after 5-7 days)

```
Hi [Name], just bumping this in case it got buried — no pressure at all.

Here's a 30-second version: I build custom real-time dashboards like this one (https://giuseppe84-code.github.io/Worldview-project/) for [maritime/security/newsroom] teams. Fixed price, 2-4 weeks, no lock-in.

If the timing isn't right, totally understand. Feel free to bookmark it for later.

Best,
Giuseppe
```

---

## 4. LinkedIn Post Template (for your own feed)

Post this on your LinkedIn with the hero screenshot attached as image:

```
I built a real-time OSINT command center that runs entirely in the browser.

WorldView aggregates live data from 5 sources onto a single interactive globe:
→ AIS vessel positions (WebSocket stream)
→ ADS-B flight tracking
→ Satellite orbital propagation
→ USGS seismic events
→ GPS-jamming zones

No backend. No auth. No database. ~84 kB gzipped JS. Installs as a PWA, works offline.

The hardest bug? aisstream.io delivers AIS data as binary WebSocket frames. The initial handler silently dropped every frame because it checked `typeof ev.data === "string"`. Fixed by forcing `ws.binaryType = "arraybuffer"` and decoding with TextDecoder.

Live demo (try it on your phone): https://giuseppe84-code.github.io/Worldview-project/

Source code: https://github.com/Giuseppe84-code/Worldview-project

I build custom versions of this for maritime security, newsroom OSINT, fleet ops, and SOC teams. If you need a real-time geospatial dashboard, DM me.

#OSINT #maritime #geospatial #react #d3js #webdev #opensourcedashboard
```

---

## 5. Show HN Post (Hacker News)

**Title (max 80 chars):**
```
Show HN: WorldView – real-time OSINT globe (flights, vessels, satellites, quakes)
```

**Body:**
```
WorldView is a browser-based situational-awareness dashboard that aggregates five live public feeds onto an interactive orthographic globe:

- ADS-B flights via OpenSky Network (15s poll)
- AIS vessels via aisstream.io (WebSocket stream)
- Satellites via CelesTrak GP elements (Kepler + J2 propagation)
- USGS seismic events
- Published GPS-jamming zones

No backend, no auth, no database. The whole thing is a ~84 kB gzipped JS bundle served as a static site on GitHub Pages ($0/month). PWA with offline fallback.

Stack: React 18, Vite, D3.js (geoOrthographic projection), Canvas 2D, WebSocket, Service Worker.

The interesting technical challenge was AIS streaming: aisstream.io delivers data as binary WebSocket frames (ArrayBuffer), not text. The initial handler silently dropped every frame. Fixed by forcing binaryType = "arraybuffer" and decoding with TextDecoder("utf-8").

Live demo: https://giuseppe84-code.github.io/Worldview-project/
Source: https://github.com/Giuseppe84-code/Worldview-project

I'm a freelance developer building custom versions of this for maritime security and OSINT teams. Feedback welcome.
```

---

## 6. Initial Target List — Companies to Contact

### Maritime Security (Priority 1)
1. Ambrey Intelligence (UK) — maritime threat intelligence
2. MAST (UK) — maritime security consultancy
3. Neptune P2P Group (UK) — maritime security
4. Diaplous (Greece) — maritime security, armed guards
5. Dryad Global (UK) — maritime intelligence platform
6. Risk Intelligence (Denmark) — maritime risk
7. Pole Star (UK) — vessel tracking/compliance
8. Windward (Israel) — maritime AI (competitor, but they subcontract)
9. MarineTraffic (Greece) — they might need custom embeds
10. Kpler (France) — commodity intelligence, vessel tracking

### Newsroom / OSINT (Priority 2)
11. Bellingcat (Netherlands) — open-source investigation
12. OCCRP (Sarajevo/global) — organized crime reporting
13. Correctiv (Germany) — investigative journalism
14. IRPI Media (Italy) — Italian investigative reporting
15. Lighthouse Reports (Netherlands) — investigative
16. Domani (Italy) — Italian newspaper with data desk
17. Il Sole 24 Ore data desk (Italy)
18. Reuters Graphics (London)
19. BBC Visual Journalism (London)
20. SkyTruth (US) — satellite monitoring for environment

### Corporate Security / SOC (Priority 3)
21. Control Risks (UK) — global risk consultancy
22. International SOS (Singapore/London) — duty of care
23. Global Guardian (US) — duty of care / travel security
24. Drum Cussac (UK) — travel risk management
25. WorldAware / Crisis24 (US) — security intelligence
26. ENI corporate security (Italy)
27. Fincantieri (Italy) — shipbuilding, interested in fleet dashboards
28. Leonardo (Italy) — defense, may subcontract tooling
29. Saipem (Italy) — offshore operations monitoring
30. MSC Group (Switzerland/Italy) — largest shipping company

### How to find the right person
- LinkedIn search: company name + "security" OR "operations" OR "CTO" OR "head of"
- Filter: 2nd/3rd connections (so you can send InMail or connect first)
- Look for people who post about: maritime, OSINT, geospatial, situational awareness
- Ideal title: "Head of Maritime Security", "SOC Manager", "Fleet Operations Director", "OSINT Analyst", "Data Editor"

---

## 7. Outreach Cadence

| Week | Action |
|---|---|
| Week 1 | Send 10 connection requests with Template A/B/C as note |
| Week 2 | Follow up with non-responders (follow-up template). Send 10 new requests |
| Week 3 | Post LinkedIn article (template above). Send 10 new requests |
| Week 4 | Post Show HN. Follow up week 2 non-responders. Send 10 new |
| Ongoing | 10 new contacts/week + 1 LinkedIn post/month + respond to all comments |

**Expected conversion:** 2-5% of cold outreach → discovery call. Out of 40 contacts/month → 1-2 calls → 0-1 project. Compounding: month 6+ you start getting referrals.

---

## 8. X (formerly Twitter) Post Template

```
Built an open-source OSINT command center that runs entirely in the browser.

Live flights, vessels, satellites, quakes, GPS-jamming zones — all on one globe.

~84 kB gzipped. No backend. Works offline. Free.

Try it: https://giuseppe84-code.github.io/Worldview-project/

Thread 🧵👇
```

Reply 1:
```
The stack: React 18 + D3.js orthographic projection + Canvas 2D.

Why Canvas instead of Mapbox/Leaflet? Because I need 500+ animated markers at 60fps on a phone. SVG DOM chokes. Tile layers cost bandwidth. Canvas stays flat.
```

Reply 2:
```
Hardest bug: AIS vessel data from aisstream.io arrives as binary WebSocket frames.

My handler checked `typeof ev.data === "string"` — silently dropped every frame.

Fix: force ws.binaryType = "arraybuffer", decode with TextDecoder. Ships appeared instantly.
```

Reply 3:
```
I build custom versions of this for maritime security, newsroom OSINT, and SOC teams.

Your feeds, your branding, your domain. Fixed price, 2-4 weeks, source code delivered.

DM me or see the pitch: https://giuseppe84-code.github.io/Worldview-project/landing.html
```
