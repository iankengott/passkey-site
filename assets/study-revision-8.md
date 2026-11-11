# Passkey feasibility: credential filling with inline approval

Passkey project · Feasibility study of a proposed device · 22 October 2026

## Abstract

Passkey is a proposed USB device that stores credentials and helps its owner sign in to websites, selected local applications and supported computer login screens. Version 1 uses an inline prompt beside a detected login field. The user selects an account and clicks once to fill. The adapter never submits the form. The user then presses the site's login control. The adapter fills only enrolled sites. This is a narrow promise about the adapter's own actions. A compromised enrolled site can still read or forward the password and submit without Enter.

The browser design replaces page authentication methods and reads frame context. Cross origin frames are required. The frame's own origin must be enrolled, and every different parent origin must be on that credential's allowed parent list. The prompt shows the site and parent context before the first approval. The device does not require computer enrollment. Support still depends on the browser and operating system integrations. A hostile or infected computer can lie about the site. The design cannot stop that.

A documentation survey of 20 popular services found zero whose public documentation confirmed the exact FIDO2 profile. The proposed key allows user presence, which in this design is the on screen click, but no PIN or biometric verification, uses a credential chosen after the user enters an account name, and provides no attestation statement about the authenticator. Five services were inferred not to accept the documented passkey route, and 15 were unknown. No service was measured in that survey. Password filling is the main compatibility path until live tests establish FIDO2 support for specific services. T15 now fills separate login steps, unusual field names, script handlers and GET forms in Chromium and Firefox on the measured fixtures and public demos, with one approval per step and no adapter submission. It blocks the tried Firefox label patches and prompt text probes. Pages still see the prompt's presence, position and frame address. Firefox frame passkeys remain refused. The current test register has 54 rows: 34 Repeatable, 0 Tested, and 20 Not tested. No row has hardware evidence. Software results support a limited browser concept. They do not show that a USB device, finished extension, operating system adapter or product works.

## 1. Purpose, evidence and decisions

Passkey, with a capital letter, names the project and its proposed device. A passkey in lower case is a FIDO2 key credential. Ian is the project owner. Hermes is the owner's home server, which runs the test virtual machines. The host is the computer receiving a credential. An enrolled site is a website origin registered by the owner for a specific account. An origin is the scheme, host name and port used by browser security checks. A frame is a page embedded inside another page. Cross origin means the two pages have different origins. A credential may be a password or a FIDO2 key credential. A discoverable credential can be selected without an account name; a non-discoverable credential requires one first. Attestation is a signed statement about an authenticator's source or type. FIDO2 combines WebAuthn, the browser interface, with the Client to Authenticator Protocol, or CTAP, used between a computer and an authenticator. Linux Pluggable Authentication Modules, or PAM, provide the login interface used by the proposed Linux adapter. User presence, or UP, means that someone is using an authenticator. User verification, or UV, means the authenticator checked a PIN or biometric. An adapter is software that fills a login in one setting, and the extension is the browser adapter. The extension is the browser add on that finds login fields and shows the prompt. Its field finder is the part that decides which fields on a page are login fields. A signer produces digital signatures using a private key. A broker is a service that routes approved requests between an adapter and the signer. A disk image file is often called an ISO.

This study separates sourced claims, measured observations, calculations and proposed design. T numbers name planned tests and G numbers name gap checks that settled open design questions. R numbers name rows of the test register in Table 4. Table 1 lists the decisions, Table 2 summarizes recent results, Table 3 lists attack findings and Table 4 is the register. The numbered tables and figures follow the text, and the references come last. A result marked Repeatable has a saved one command rerun. Repeatable describes the evidence process. It does not mean the result was a pass. Tested means one recorded run without an equivalent rerun. Not tested means no test has been run for the claim as written, even where a row cites related local results. Evidence labels name the source. Synthetic page is the register label for scripted browser tests with software credentials. Local fixtures were built for the experiments. Rows that name public demos used live pages. Neither is a production account or hardware result. Simulated means Chrome's virtual authenticator, a software stand in for a security key. Model means a program that encodes a rule. Host software means software run on the test computer. Document means a document review only. Calculation means arithmetic on stated assumptions. None of these labels means hardware unless the row says Hardware. Some Repeatable rows record failures, so read each row's result before treating the status as a pass. There is no Hardware evidence in the current register.

**Table 1. Decisions that define the current version 1 study.**

| Decision | Current treatment |
|---|---|
| Platforms | Windows and Linux. Apple and macOS are out of scope. |
| Login cases | Websites, selected local applications and computer login after the operating system starts. |
| Routine approval | A prompt appears inline beside the detected login field. The device has no touch sensor or user button. Routine use has no PIN or fingerprint check. |
| Password flow | The user chooses the account in the prompt, clicks once to fill, then presses the website's login control. The adapter never submits. |
| Enrolled destinations | Passwords are filled only for enrolled sites. A compromised enrolled site can still take the password. |
| Frames | Same origin and cross origin frames are required. The frame origin must be enrolled. Different parent origins must be on that credential's allowed parent list. |
| Computer trust | No pairing or computer enrollment. Software compatibility must be established separately. A hostile computer can lie about the site, and the design cannot prevent that. |
| Account choice | The prompt shows the available account and requires the user's choice. The adapter does not guess. |
| Passkey route | FIDO2 remains the preferred route when a service is shown to accept the key. The current compatibility evidence does not justify assuming broad acceptance. |
| Password store key | Derive the password store key from the enrolled credential through the WebAuthn pseudorandom function extension, or PRF. Confirm this on a real board. |
| Browser interface | Drop Chrome's webAuthenticationProxy interface. Use page replacement for WebAuthn requests. |
| Certification | Skip FIDO certification. Do not describe this design as a certified security key. |
| Typing mode | Out of version 1. Startup prompts and encrypted disk unlock are unsupported in version 1. |
| Linux login | Lane D: a direct Linux PAM adapter with a system broker to the signer. Console text approval is acceptable. Polkit testing has its own allowance, sized in the T8 plan. |
| Test environment | Windows and Linux virtual machines run on Hermes. Discord is the selected application for adapter tests. |

The study's current design follows these decisions. The inline prompt is not a trusted display on the device. It is software on the host. FIDO certification is out of scope by decision, and the report makes no claim that a screen click is a physical presence test. FIDO's WebAuthn and CTAP definitions distinguish user presence from user verification. Presence means that someone is using an authenticator. Verification means that the authenticator checked a PIN or biometric. A host prompt establishes consent only within the software boundary [1, 2, 3].

## 2. Browser design

### 2.1 Fill and submit

The extension looks for a login form, checks the browser supplied origin and compares it with the enrolled site. It lists the enrolled accounts for that site beside the detected login field. A username only step has its own prompt. The user chooses an account, and the adapter does not choose for them. One click approves one fill. Figure 1 shows the sequence. The adapter checks the form and fields again before assigning values. It does not call a submit method or click the site's login control. The user submits after seeing the filled fields. HTML defines common autofill field purposes, but a page can use other structures and scripts [5].

T15 extended the field finder to separate username and password steps, unusual names such as user-name, script handlers and GET forms. Each step needs its own click. The account selected at the first step may be preselected only in the same tab and exact origin, and the user still approves the next fill. A different origin gets nothing unless separately enrolled, and then gets only its own account. The measured local classes and named public routes work in Chromium and Firefox. This does not establish support for arbitrary forms.

A GET form sends field values in the address when the user submits it. The prompt warns about that exposure. GET actions must stay on the same origin. Ambiguous forms, hidden decoys, alternate destinations and fields changed while approval is pending are refused. Inputs without a form element remain unsupported because the destination cannot be checked. Script handlers receive input events, but the adapter never submits.

**Figure 1. Intended password flow and trust boundary.**

| Step | Description |
|---|---|
| 1 | The browser reads the requesting frame origin, the top page origin and each parent origin. |
| 2 | The extension checks that the frame origin is enrolled and that each different parent origin is allowed for the selected credential. |
| 3 | The inline prompt names the site, shows the parent context and asks the user to choose an account. |
| 4 | One user click fills the selected step. Each later step needs a fresh click. The adapter does not submit. |
| 5 | The user presses the website's login control. The page can read the filled value, so a hostile enrolled site can still take it. |

An allowed parent is a parent origin the owner has approved for use with one credential. The policy is intended to support third party logins embedded in services such as Canvas, a course website. The frame itself must still match an enrolled origin. On first use, the prompt identifies any parent not yet listed and asks the user to allow it. Later fills still need a fresh click. The T14 prototype stores the allowance per credential, not per site across all accounts. Table 1 summarizes the frame rule.

For nested frames, T14 tested a policy model and T15 tested password fills with a prompt that lists each different parent and adds every newly listed parent to that credential after one approval click. These software observations are Repeatable. Whether one click may add several parents is still open. The proposed rule is that one click may add every new parent only if the prompt names every one. Ian has not yet chosen between that rule and a separate click for each parent. T15 also measured short frames. A 230 pixel frame allowed a prompt above the password field that could cover the username field. A 150 pixel frame refused. Long parent names that could not fit caused refusal. Allowing the prompt to cover the username field is a proposal awaiting Ian. A parent that was allowed earlier can later turn hostile. The current list does not detect that change.

### 2.2 No pairing

The computer is not enrolled with the device. On a computer with compatible software installed, the owner can use the device without first enrolling that computer. A normal browser can report the page origin and frame ancestry to the extension. Without pairing or a trusted display on the device, the owner has no independent way to confirm that a hostile computer reported the truth. An infected computer can show a fake site name, change what the user sees or control the extension. The design cannot stop it.

The same trust limit applies after a valid fill. Password fields are visible to the page. A compromised enrolled page can copy the password to another origin and can submit the login without a person pressing Enter. The adapter can promise that its own code does not submit. It cannot promise that a page will wait for the user's action.

### 2.3 WebAuthn page replacement

For passkey registration and login, the extension replaces the page's WebAuthn methods, navigator.credentials.create and navigator.credentials.get. Page replacement lets the extension observe the request and show the same inline approval. The extension can include the top origin when a request comes from a cross origin frame. Chromium completed synthetic create and get requests from local cross origin and nested frame fixtures, and an independent verifier checked the signatures. The WebAuthn browser interface binds a credential to a relying party, the service that requests authentication, and verifies origin rules, but server settings still decide whether a key without user verification is accepted [1, 4].

Firefox 158 refused frame passkey requests in both T14 and T15. A permissions policy is a browser rule controlling whether an embedded page may use a feature. Neither supported page API exposed the effective frame policy to this prototype. Different native error messages do not supply a supported inspection route. This is a prototype limit, not a claim that Firefox lacks native frame WebAuthn support. Top level passkeys worked in both browsers. Keeping frame passkeys Chromium only until Firefox offers a supported route is a proposal awaiting Ian. Password filling in frames works in both measured browsers and is a separate capability.

The Chrome webAuthenticationProxy interface is dropped. Its Linux probe attached without a remote session and forwarded synthetic create and get responses, but it did not pass the intended test. The timeout stayed open until the harness stopped, and cross origin requests did not include the top origin string. Windows and distribution were not tested. The intended test asked whether the interface could support version 1, which needs the top origin for requests from cross origin frames. The test plan set a stop condition for lost context, and the missing top origin met it. Page replacement is the selected direction. The two interfaces have different scope: the proxy accepts WebAuthn requests but does not intercept ordinary password forms or operating system login calls [6, 7].

## 3. Compatibility and measured results

### 3.1 FIDO2 coverage

FIDO2 avoids sending a reusable password to the host and scopes a signed response to a service. It is the preferred route where the service accepts the proposed key and its policy. It is not a universal solution. A service can require user verification, require a discoverable credential, or apply an attestation policy that considers information about the authenticator. In WebAuthn terminology, a credential selected without the service first supplying its identifier is discoverable. The proposed key uses a non-discoverable credential. The browser simulation found that Chrome refused creation and use of discoverable credentials for its tested key without verification. This is a Chrome virtual authenticator result, not a general claim about all services or hardware.

A software simulation in Chrome 155 ran 1,440 trials. All 120 cases that required user verification failed with the key configured without verification. The username first cases that discouraged or preferred verification succeeded with presence set and verification unset. Chrome refused 40 credential creation trials and 20 login trials for discoverable credentials. The saved results are Repeatable and Simulated. They test Chrome's virtual authenticator and a local service, not a real service, a real key or a device.

T1 is the planned test of whether services accept the proposed key. Its documentation stage is complete and its live stage is Not tested. The documentation survey covered 20 services selected as a student and gamer profile. It included Google, Microsoft, Apple, Yahoo, Discord, Instagram, TikTok, Reddit, Twitch, Netflix, Amazon, PayPal, GitHub, Canvas, Duolingo, Steam, Epic Games, PlayStation Network, Roblox and Nintendo Account. The evidence status is Not tested for service acceptance. No accounts were created, no user signed in and no request was sent to these services.

The survey found zero services whose public documentation confirmed the exact key type. Five were inferred not to accept the documented passkey route, because instructions called for local device verification and no suitable separate security key route was documented. Those five are Microsoft, Instagram, TikTok, Reddit and Twitch. They are not measured refusals. Fifteen services remained unknown. GitHub documentation says its security key second factor does not require user validation, but does not settle discoverability, attestation or the exact request settings. The survey therefore does not establish that GitHub accepts the whole key profile [19].

Until the live stage of T1 shows otherwise, password filling is the main compatibility path. Treat FIDO2 as available only for a service whose route is documented or measured to accept the key. This is a decision about evidence and support claims. It does not rule out FIDO2 support at services still marked unknown.

### 3.2 Live demo sites

T13 tested software prototypes on public demo sites with generated identities and dummy credentials. The saved runs are Repeatable, but they are not measurements of Ian's accounts, production accounts, hardware or certification.

The reference adapter filled three live demo login forms: AuthenticationTest's simple form, its same origin iframe form and The Internet's login form. Seven dummy fills were recorded, with no observed submit event. Six of the seven were also observed with an isolated network capture, which showed no POST. The first fill has submit event evidence only. A separate Enter input from the harness produced an actual POST. That observation supports the narrow promise only: the adapter did not submit during its short fill step. It cannot guarantee what a page does later.

Microsoft Passkey Playground and Duo WebAuthn.io accepted a create and get request with verification unset. The two assertions were independently verified. Microsoft required changes to its demo settings; its defaults refused the request. This public demo is separate from the personal Microsoft account login surveyed in T1. Token2 also accepted a custom registration and authentication with verification unset. The first Token2 run continued to authentication before an attestation notice had been reviewed. The stop rule then in force required a stop at any warning, so that run is recorded as a rule violation. A later rerun stopped at the notice under the same rule. On 22 October Ian changed the rule. Plain informational notices are now recorded and the run continues, while bans, abuse warnings, rate limits and access blocks still stop it. A rerun under the new rule completed. Its signature verified and the signed verification flag was unset.

Yubico Passkey.org and passwordless.id refused requests that required discoverable credentials without an explicit credential identifier. Those results do not show that either service rejected a valid key only for lacking user verification. T13's field finder refused AuthenticationTest's separate steps, SauceDemo's user-name field and Randomly Online's GET form. T15 filled those routes in both browsers. One approval filled the username step and another filled the password step. The harness explicitly pressed the site's Next control to reach AuthenticationTest's password page. Each browser observed one username POST and no password step submission. The adapter did not submit. Randomly Online's later code challenge was not exercised. No production account was created.

The final T15 live run completed 18 records, including availability checks. fill.dev returned error 522 and XQA had a certificate error, so their compatibility remains Not tested. No certificate error was bypassed. Stopping only the affected site on a certificate error is implemented in this prototype but remains a proposal awaiting Ian. A rate limit, access block, CAPTCHA challenge to distinguish a person from software, or abuse warning stops the whole live run. Ian allowed one exact static footer describing rate limits to count as information; a restriction elsewhere still stops the run. Live demo sites can change [16, 17, 18]. Table 2 summarizes the results and limits.

**Table 2. Recent result summary and limits.**

| Result | Status and evidence | Observation | Main limit |
|---|---|---|---|
| T2 browser approval | Repeatable, synthetic page | Chromium 155 and Firefox 158 passed 12 fixed create and get cases twice with a software signer. Cancel, timeout, wrong identifier, stale navigation, replay and forbidden frame requests did not sign. | Software keys only. No USB signer, hardware removal, real account, Windows behavior or human prompt recognition. |
| T3 Chrome proxy | Repeatable, synthetic page | Linux attach, synthetic create and get, and caller abort worked. The timeout did not complete. The request omitted the cross origin top origin. | T3 did not pass. Windows and extension distribution remain Not tested. |
| T10 destination checks | Repeatable, synthetic page | 111 local trials, from 37 variants run three times each and excluding the hostile page case, produced 33 expected fills, 78 refusals and zero direct wrong fills. | A hostile enrolled page forwarded the dummy password and submitted without Enter. This is a stop finding. |
| G1 Linux bridge probe | Repeatable, host software | Eight private PAM checks passed with Linux PAM 1.7.2 and pam_u2f 1.4.0. The user could not open root owned /dev/uhid. | No virtual device, signer, PAM adapter, broker, polkit check or real login surface was run. Lane D is a design choice, not an implementation result. |
| G8 page behavior | Repeatable, synthetic page | Seven of seven checks passed. Page script read 100 of 100 filled values, and the fixture canceled 100 scripted submit events. | No human pressing Enter, real site, extension, device or firmware was tested. |
| G9 PRF audit | Repeatable audit of simulated responses | Sixty Chrome virtual authenticator assertions each returned two 32 byte PRF outputs, with signed UV equal to zero and user presence set. | The saved data do not identify the hmac-secret key family. This does not prove a standards violation or hardware behavior. |
| G10 URL parsing | Repeatable, Chrome URL API and model | All 129 cases passed the runner. Four Chrome and model parsing differences did not change any allow or refuse decision. | Does not resolve the allowed parent policy or establish behavior on hostile computers. |
| T13 demo sites | Repeatable, synthetic page on live demos | Seven dummy password fills, two independently verified passkey assertions on Microsoft and Duo, and a verified Token2 rerun with UV unset. | No real account or hardware. Microsoft settings changed. Live sites can change. Its form refusals were later addressed in T15 for the named routes. |
| T14 inline prompt and frames | Repeatable, synthetic page | 136 local records in Chromium 155 and Firefox 158 completed. The tested parent list model matched 20 observed policy outcomes. Four attack paths against the prompt succeeded in at least one recorded run. | No real Canvas account, cross origin live login frame, Windows, hardware or user study. |
| T15 adapter extension and hardening | Repeatable, software fixtures and live demos | Separate steps, unusual names, script handlers and GET forms filled in both browsers. Two final patch grids measured 0 of 96 successes each per browser, 0 of 192 per browser in total. Tested text probes were blocked. | Presence, position and frame address remain visible. Firefox frame passkeys stay refused. Hostile enrolled pages still take filled passwords. No hardware or production account evidence. |
| T1 service survey | Not tested for service acceptance, document review only | Zero of 20 services documented as accepting the exact key type. Five were inferred not to accept the documented passkey route and 15 were unknown. | No account was created or tested. The five inferences are not measured server refusals. |
| Hermes test machines | Not tested for Passkey behavior | Linux NixOS VM and Windows 11 Pro VM are prepared. Discord is installed on both as the selected application. | No adapter or account was used. Windows reports activated despite no product key. Windows Home is absent. |

### 3.3 Virtual machines and applications

The test machines are fixtures, not product tests. The Linux VM on Hermes matches the owner's main NixOS computer with the Simple Desktop Display Manager, or SDDM, the Wayland display protocol and the Plasma desktop. It boots to the login screen and accepts dummy passwords for login and unlock. The PAM package is present but Passkey is not installed. No direct adapter, broker, USB signer or enrollment path has been built.

The Windows guest runs Windows 11 Pro build 26300 from a consumer ISO supplied by the owner. It uses a local account, Secure Boot and a virtual Trusted Platform Module, or TPM. Chrome and Discord are installed. The desktop login, lock and cold boot password path were checked as VM setup. The guest reports that it is permanently activated even though no key was entered. The reason is unknown. It is recorded because it could affect how closely the guest matches a licensed install. No Windows Home guest is present.

Discord was installed on both machines and both empty login screens were recorded. No Discord account was created. Its policy prohibits automating a normal user account outside the bot system, so application testing needs a permitted account and a small controlled test. This setup is not a Discord adapter test and does not establish application compatibility [20].

## 4. Security findings

### 4.1 The Enter promise

Ian chose a narrow promise. The adapter never submits a form and fills only enrolled sites. T10 directly tested a stronger guarantee and failed it. After an approved fill, an enrolled hostile page read the dummy password, forwarded it to another origin and called requestSubmit without Enter. The run saved the forwarded password and the submitted form. The adapter itself did not submit.

T14 and T15 reproduced the same behavior in both Chromium and Firefox. The site enrollment check cannot protect a user from a site that has been compromised after enrollment. A user may still submit through the site's own login control, but a hostile page can act first. Password filling exposes the password to the host page. It is not phishing resistant in the same way as a correctly scoped FIDO2 signature [15].

### 4.2 Four attack findings and T15 hardening

Four attack paths against the prompt succeeded in T14, as Table 3 records. They were a hostile enrolled page after a fill, a small decoy patch over the prompt label, a transparent parent frame that captures the click, and page script that detects the prompt and probes its text. The first concerns page behavior after filling. The other three concern the prompt. The final T14 screenshot check blocked the transparent frame attack. Its Firefox label patch and text probes still worked at that point.

**Table 3. T14 attack findings and the later T15 results.**

| Attack finding | Recorded T14 result | T15 result and current limit |
|---|---|---|
| Hostile enrolled page after fill | Both browsers read and forwarded the password, then submitted without Enter. | Reproduced in both browsers. The adapter did not submit. This remains the accepted narrow promise limit. |
| Small decoy patch over the prompt label | Firefox accepted a patch over about eight percent of the label and added a hostile parent. Chromium refused it. | The original patch and tested later patches were blocked. Each browser had 0 of 96 successes in each of two final grids, 0 of 192 total. Earlier successes remain recorded. Other patterns and timing are not ruled out. |
| Transparent parent frame clickjacking | Firefox filled in 11 of 11 attempts before a screenshot check. The final T14 check refused all 11 attempts in both browsers. | The tried transparency, covers, clipping, flicker and focus removal decoys were refused. Screenshot checks remain heuristics. |
| Prompt detection and text probing | Both browsers exposed presence and position to pages. window.find probed guessed text; Firefox also returned it. | Tested text probes returned false with no selection text. Pages still detect presence, position, size, style and the frame address. No complete privacy fix is claimed. |

T15 moved the prompt into a page owned by the extension inside a frame. Direct page access to its document was refused. The host element gets a random name, and the background checks the requesting document before accepting approval. The screenshot check now covers the whole prompt and looks for patches and repeating checker patterns. Firefox also samples while waiting. Approval needs a trusted click and at least 650 milliseconds of stable visibility.

Earlier T15 versions admitted shade and checker patches, including two Firefox successes among 96 attempts in a saved run. The final full local run in Chromium 155 and Firefox 158 completed 200 records and a targeted run repeated the patch grid. Each run measured zero patch successes among 96 attempts per browser. The final evidence analysis checked 584 conditions across 247 selected records without a failed check. Those records comprise the 200 record local run, ten targeted regression records, nine focused dynamic address records, ten clean double density records and 18 live records. Counts include expected refusals and availability observations. They are not a security verdict. Clean prompts worked at double pixel density, but the full patch grid was not rerun at that density after the final change.

The checks block tried attacks, not every overlay. Screenshot sampling and random shading do not create a private browser approval surface. A page can imitate or remove the prompt, and human recognition of fakes is Not tested. Chromium blocked four fetch probes aimed at a fixed extension address by using a changing resource address. A page hosting a prompt can still read its current frame address. The full dynamic address suite was not repeated after a harness correction; only nine focused cases were rerun successfully.

### 4.3 Frame policy

Three software policies were compared. Exact frame origin equality alone allows an enrolled login inside any parent without showing the parent. Requiring every ancestor to match the frame origin blocks the Canvas use case. The selected allowed parent list requires the child frame to match an enrolled origin and requires each different parent origin to be allowed for that credential. The first prompt shows the parent origin and asks for approval.

The model matched all 20 measured outcomes. All three policies refused wrong child origins, lookalikes, lookalikes using Punycode, an encoding for international host names, HTTP, alternate ports, opaque sandbox frames and about:srcdoc documents. The selected list supports a third party tool frame, but it cannot stop a parent that was allowed once and later turns hostile. Neither T14 nor T15 measured a live cross origin login frame. Local top level, same origin, cross origin and nested password fixtures worked. The public demos did not supply the required live cross origin login case. A real Canvas tool and account are still needed to validate that case.

### 4.4 Password store key and hardware

Ian chose to derive the password store key from the credential through the WebAuthn pseudorandom function extension, or PRF. A pseudorandom function derives a stable output from a secret and an input. The result is a design decision, not a measured device property. G9 audited saved Chrome virtual authenticator responses. The hmac-secret extension is the CTAP feature behind PRF, and the signed UV flag is the verification bit inside the signed authenticator data. The audit found PRF outputs with signed UV equal to zero. The standard expects PRF to use the secret tied to user verification, and the records do not show which secret produced these outputs. The audit does not show that a real device will derive the selected key without verification, and it does not prove a standards violation. Confirm the design on a real board before relying on it [1].

The computer mocks and enclosure calculations do not establish a working USB device. The reference storage calculation assumes 4 MiB of flash, with 1 MiB reserved for firmware and 0.5 MiB for metadata and journal space. This leaves 2,560 KiB for records. Figure 2 plots storage use against the budget for three assumed record sizes. The record sizes are assumptions, and no flash writes, interrupted updates, key protection or extraction tests were run [14].

**Figure 2. Calculated record capacity under the stated flash assumptions.**

| Records | 256 bytes each | 512 bytes each | 1,024 bytes each |
|---|---|---|---|
| 1,000 | 250 KiB | 500 KiB | 1,000 KiB |
| 2,000 | 500 KiB | 1,000 KiB | 2,000 KiB |
| 3,000 | 750 KiB | 1,500 KiB | 3,000 KiB, over budget |

## 5. Operating system and application scope

### 5.1 Windows

The proposed Windows first login route is a credential provider that displays approval on the Windows login screen, fills a stored password after approval and leaves submission to the person. Windows Hello provides login through a PIN, face recognition or fingerprint. Microsoft's credential provider documentation describes components loaded by the login screen, but no Passkey provider has been implemented or tested [8]. The guest supports fixture preparation only. A personal Microsoft account with a password remains a proposed case. A passwordless Microsoft account cannot use a stored password. The Hello only setting removes the password login option while it is enabled, which also prevents the stored password route.

### 5.2 Linux

Two Linux routes were compared. Lane U keeps the stock pam_u2f module and a virtual USB device. Lane D, the selected route, is a direct PAM adapter with a system broker that sends an approved request to the signer. The request must bind the account, service, challenge and one transaction. The adapter and broker must keep an independent password fallback. The G1 design note recommends this route based on source review and the private probe. No adapter was implemented. The private PAM probe and access check for /dev/uhid, the Linux interface for creating virtual input devices, are Repeatable host software evidence, not a real login result.

The proposed Linux tests, grouped as T8, cover a login manager, lock screen, console and sudo with the signer. Console text approval is acceptable for this version. Polkit is the Linux service that asks for approval of privileged actions. Its testing has its own time allowance, separate from the 12 hour cap on T8, the planned Linux login test. The size of that allowance is left to the T8 plan. PAM and pam_u2f documentation support the test design, but the stock pam_u2f interactive option is not itself a yes or no approval gate [9, 10, 11].

### 5.3 Local applications

Windows UI Automation and Linux's AT-SPI2 accessibility interface expose application controls that an adapter may inspect. These interfaces do not verify which remote service receives a password. An adapter must check the application, control and endpoint, then recheck before filling. If it cannot identify those safely, it must refuse [12, 13].

Discord is the selected test application for both VMs. The application is installed, but no account exists and no field was filled. The adapter test is Not tested. A later test must respect Discord's account and automation rules.

## 6. Version 1 boundary and maintenance

Typing credentials as a USB keyboard is outside version 1. Startup prompts and encrypted disk unlock are therefore unsupported. This also removes keyboard layout testing from the selected design. FIDO2 passkeys in supported applications and website login remain distinct from typing. The Linux broker, Windows credential provider and application adapters are still proposals.

Page replacement has browser compatibility and maintenance costs. The extension must track changes to browser APIs, page behavior, frame permission rules and field patterns. Versioned messages and signed firmware updates remain design requirements, not implemented features. The project has no evidence for a no update promise, a maintenance schedule or a total support cost.

No current engineering hour or cash estimate covers the selected version 1 design. Commercial viability is not established.

## 7. Current test register

Table 4 retains the 54 source register rows, their statuses and evidence labels. Its claims and notes distinguish local results from untested production integration. Figure 3 counts the rows by status. R20, R21 and R28 are outside version 1. R14 and R15 compare alternative release policies. R26 and R27 concern stock pam_u2f, lane U. The selected design has no pairing and uses the direct PAM route, lane D. T2 maps to R07 and R08, T3 to R09, G9 to R06, G8 to R12, T10 to R37 and R38, G1 to R39, T13 to R40 to R46 and T14 to R47 to R52. T15 updates R41, R49 to R51 and adds R53 and R54. Table 3 gives the patch count: each of two final grids had 96 attempts per browser, 192 per browser in total.

**Figure 3. Test status counts in the 54 row register.**

| Status | Count |
|---|---:|
| Repeatable | 34 |
| Tested | 0 |
| Not tested | 20 |

**Table 4. Test register as of 22 October 2026.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R01 | Key with no user verification fails a service that requires verification | Repeatable | Simulated | WV-01: 120 of 120 trials failed | webauthn-virtual/run.sh |
| R02 | A key without user verification succeeds when the service discourages or prefers verification, with presence reported and verification not reported, and the username supplied | Repeatable | Simulated | WV-01: 120 of 120 successful responses from keys with no verification were accepted by the server checks. All 270 successful responses in the whole matrix passed | webauthn-virtual/run.sh |
| R03 | Discoverable credentials: creation and login without a username were refused with no verification in Chrome | Repeatable | Simulated | WV-01: 40 credential creation trials and 20 login trials failed | webauthn-virtual/run.sh |
| R04 | Without a presence signal, standard browser requests wait and time out | Repeatable | Simulated | WV-01: 720 of 720 timed out | webauthn-virtual/run.sh |
| R05 | Browser and service enforce the identifier and the origin after changes to the port or host | Repeatable | Simulated | WV-01: wrong port rejected by the service, wrong host refused by Chrome | webauthn-virtual/run.sh |
| R06 | hmac-secret secret requested through the browser PRF extension, without verification | Repeatable | Simulated | G9 audit: 60 Chrome virtual authenticator assertions each returned two 32 byte PRF outputs with signed UV equal to zero. Saved data do not identify the hmac-secret key family. Ian chose to derive the store key through PRF. Confirm on a real board. No hardware behavior established. | webauthn-virtual/run.sh, g9-prf/run.sh |
| R07 | On screen approval pop up releases a signature | Repeatable | Synthetic page | T2 on 21 October 2026: 12 cases, twice each, in Chromium 155 and Firefox 158. Create and get pass with the verification flag unset. Cancel, timeout, wrong identifier, forbidden frames, stale requests and replay were refused without signing. One click approved one request. A page can imitate the pop up and fake its own success result, and the verifier rejected the forgery. The browser native credential API stays reachable. Software signer, not hardware | t2-approval-popup/run.sh |
| R08 | Browser extension that takes over WebAuthn requests and asks a USB key to sign | Not tested | Document | T2 shows the extension part works in software for create and get in Chromium and Firefox, with a software signer. The USB part is Not tested. Signer removal passed as a model only | t2-approval-popup/run.sh; USB part none |

**Table 4. Test register continued.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R09 | Chrome webAuthenticationProxy API for this purpose | Repeatable | Synthetic page | T3 on 21 October 2026, Linux only: does not pass. Attach without a remote session, synthetic create and get, and caller abort worked. A timeout request stayed pending until the harness deadline. The proxy supplies the caller origin and a same origin flag but not the top origin of a cross origin frame, which meets the test plan stop condition for lost context because version 1 requires iframe requests. Windows and store approval Not tested | t3-chrome-proxy/run.sh |
| R10 | Windows passkey plugin accepts a provider that returns approval with no PIN | Not tested | Document | Research only | research on-screen-approval-research.md |
| R11 | Password release only for the exact enrolled origin | Repeatable | Model | OR-01: 129 URL cases, 0 release decision differences. 4 differences between the model and Chrome in how they read addresses, flagged | logic-tests/origin-rule/rerun.sh |
| R12 | Page code can read filled values, scripted submit is cancelable, 12 origin cases | Repeatable | Synthetic page | G8 runner on 21 October 2026: 7 of 7 checks pass in headless Chromium, with 100 readable values, 100 canceled scripted submits and 12 origin fixtures. No manual steps remain. A real person pressing Enter is outside this test | g8-runner/run.sh |
| R13 | Service style identifier scope is wider than the exact origin rule | Repeatable | Model | OR-01: 20 scope examples | logic-tests/origin-rule/rerun.sh |
| R14 | Release policy outcomes for possession, enrolled host, touch and software manager, plus enrolled host and touch, with removal, replay of earlier requests, expired replies and unenrolled profiles | Repeatable | Model | Alternative release policies, not the selected design. RP-01: 71 passed. Covers 12 outcomes for the four release policies named in the claim and 3 more for enrolled host and touch. The two pop up rows are not modeled | logic-tests/release-policy/rerun.sh |
| R15 | Host enrollment with a browser profile key as an alternative release policy | Not tested | Document | Design only. Outside the selected design, which has no computer pairing | none |
| R16 | Vendor protocol version rules and malformed frame handling | Repeatable | Model | PV-01: 36 passed, 120,000 randomly generated messages, no forbidden acceptance | logic-tests/protocol-versioning/rerun.sh |
| R17 | USB vendor HID transport through WebHID or a native helper | Not tested | Document | Design only. No device | none |
| R18 | Field finding and fill on production account login pages | Not tested | Document | No production account login was tested. T10 local fixtures are covered by R37 and R38. T13 and T15 filled named public demos, see R40 and R41. Those are narrower results | t13-real-sites/run.sh |

**Table 4. Test register continued.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R19 | Choosing among several accounts on production account login pages | Not tested | Document | Explicit user choice among three accounts filled correctly in local T10 fixtures. Production account pages were not tested. Version 1 requires user choice and does not use automatic account selection | t10-destination-checks/run.sh |
| R20 | Keyboard fallback: text to key positions on six layouts, wrong layout gives wrong characters | Repeatable | Model | Outside version 1. KL-01: 26 passed, 570 character reproductions on six layouts | logic-tests/keyboard-layout/rerun.sh |
| R21 | Typing accepted at startup, disk and login prompts; Ctrl+Alt+Del from a hardware keyboard | Not tested | Document | Outside version 1. Needs a real board | none |
| R22 | Windows local account login through a credential provider with an approval dialog | Not tested | Document | Research only | research windows-local-and-microsoft-account-research.md |
| R23 | Windows personal Microsoft account with a password through a credential provider | Not tested | Document | Research only | research windows-local-and-microsoft-account-research.md |
| R24 | Passwordless Microsoft account, and the Windows Hello only setting | Not tested | Document | Research: no password exists to submit | research windows-local-and-microsoft-account-research.md |
| R25 | Windows session unlock and first login after an update, with automatic restart sign on | Not tested | Document | Research only | research windows-local-and-microsoft-account-research.md |
| R26 | Stock pam_u2f route for Linux login, lock screen and sudo with a key without a PIN | Not tested | Document | Alternative lane U, not the selected lane D. Documented options and the G1 private probe exist, see R39. No PAM to USB signing or real login surface was exercised. The selected direct PAM adapter also remains unimplemented | linux-bridge-design/design.md |
| R27 | Stock pam_u2f interactive prompt in a real greeter | Not tested | Document | Alternative lane U. Source inspection shows pam_u2f 1.4.0 interactive mode is not a yes or no approval gate. No real greeter test was run | linux-bridge-design/design.md |
| R28 | Linux disk unlock through systemd-cryptenroll, using a key without a PIN | Not tested | Document | Outside version 1. Documented options only | none |

**Table 4. Test register continued.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R29 | Application adapters on Windows and Linux | Not tested | Document | Discord is selected and installed on both prepared VMs. No application adapter was implemented and no Discord credential was filled. Test account policy remains open | none |
| R30 | Storage budget of 2,560 KiB and calculated record capacities | Repeatable | Calculation | The record capacity table in Figure 2 was recomputed from the stated assumptions when the paper was built | calculation in this study |
| R31 | Power supply and USB interface circuitry modeled in ngspice, an electronic circuit simulator | Repeatable | Model | Simulated supply of 3.294 V in the active state, a 4.5 mV change between idle and active | hardware-mockups/circuit |
| R32 | Enclosure dimensions and computer model geometry for two models, a key shaped one and a tiny one | Repeatable | Calculation | Checks confirmed that the key model at 45 by 25 by 5.5 mm and the tiny model at 24.25 by 12 by 3.5 mm form closed surfaces. Physical fit was not tested | hardware-mockups/enclosure |
| R33 | Firmware update, signature check and recovery | Not tested | Document | Design only | none |
| R34 | Backup and restore of the password store | Not tested | Document | Design only | none |
| R35 | Protection of stored keys against extraction | Not tested | Document | Design only | none |
| R36 | Loss and revocation steps | Not tested | Document | Design only | none |
| R37 | Destination checks refuse lookalike origins, subdomains, Punycode impostors, HTTP, other ports, stale documents, changed form actions and replaced frames | Repeatable | Synthetic page | T10: 111 ordinary trials gave 33 expected fills, 78 refusals and zero direct wrong fills. Frame policies disagree between exact origin equality and matching ancestors. The allowed parent list in Section 4.3 is the proposed answer to the frame policy question | t10-destination-checks/run.sh |
| R38 | Strong Enter guarantee against a hostile enrolled page after fill | Repeatable | Synthetic page | Failed in T10. An enrolled hostile page forwarded the dummy password and submitted without Enter. Exit code 2 reproduces the stop finding. The selected promise covers only the adapter, which did not submit | t10-destination-checks/run.sh |

**Table 4. Test register continued.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R39 | Private PAM stack probe and access to /dev/uhid | Repeatable | Host software | G1: Linux-PAM 1.7.2 and pam_u2f 1.4.0 passed 8 checks in a private configuration with synthetic fallback modules. /dev/uhid is root owned mode 0600 and was refused for the test user, also inside a user namespace. No virtual device was started | linux-bridge-design/probe.py |
| R40 | Real form detection, approval and fill on three named live demo login forms AuthenticationTest, The Internet, same origin iframe | Repeatable | Synthetic page | T13: seven dummy fills, no observed submit events, unrelated enrollment refused. Reference adapter on live demo pages. Live sites can change | t13-real-sites/run.sh |
| R41 | Multi step logins, unfamiliar username field names and JavaScript forms | Repeatable | Synthetic page | T15: separate steps with one click each, unusual names, script handlers and GET forms filled in Chromium and Firefox on local fixtures and the named AuthenticationTest, SauceDemo and Randomly Online routes. The adapter never submitted. The harness explicitly advanced the username step. No production account or arbitrary form coverage. T13 refusals remain recorded | t15-adapter-hardening/verify.sh local; live: t15-adapter-hardening/run.sh live |
| R42 | Same origin iframe fill and nested document traversal on live pages | Repeatable | Synthetic page | T13: one iframe form filled and five nested fixture documents inspected. Nested password filling and cross origin frames Not tested | t13-real-sites/run.sh |
| R43 | T2 create and get on Microsoft Passkey Playground and Duo WebAuthn.io with verification unset | Repeatable | Synthetic page | T13: two independently verified assertions. Microsoft needed changed demo settings and refused defaults. Not Ian accounts, not hardware. Feeds R01 to R03 and T1 | t13-real-sites/run.sh |
| R44 | T2 compatibility with sites that require discoverable credentials Yubico, passwordless.id | Repeatable | Synthetic page | T13 refusals. Does not show a server rejecting a key only for lacking verification | t13-real-sites/run.sh |
| R45 | Token2 creation and authentication with verification unset | Repeatable | Synthetic page | T13 rerun on 22 October 2026 under the stop rule Ian set on 22 October: creation and authentication with verification unset succeeded, signature independently verified, the attestation note was recorded as informational and no blocking notice appeared. The first run had continued past the warning against the old rule, which stays recorded as a rule violation | t13-real-sites/run.sh |
| R46 | XQA and fill.dev live login compatibility | Not tested | Document | T13 availability checks found a certificate error and a server timeout | t13-real-sites/run.sh |
| R47 | Inline prompt beside the login field, one click fills, in top level, same origin, cross origin and nested frames | Repeatable | Synthetic page | T14, Chromium 155 and Firefox 158: 136 local trial records completed. Completion is not a security pass. The prompt names the site and top origin. The adapter never submits. Successful attacks are recorded in R50 and R51 and Table 3 | t14-inline-prompt-frames/run.sh, local and live modes |
| R48 | Allowed parent list for cross origin frames: first time Allow click per credential | Repeatable | Model | T14: policy model matched all 20 measured outcomes. Exact origin lets a hostile parent through silently; matching ancestors breaks the Canvas case. No policy blocks a parent that was allowed once and later turns hostile | t14-inline-prompt-frames/run.sh, local and live modes |

**Table 4. Test register continued.**

| ID | Claim | Status | Evidence | Result and limit | Source |
|---|---|---|---|---|---|
| R49 | Passkey create and get from frames with page replacement and a visible top origin | Repeatable | Synthetic page | T14 and T15: Chromium frame create and get worked with software signatures verified. Firefox frame passkeys remain refused because no supported API exposes the effective policy to this prototype. Top level passkeys worked. Chromium only frame support pending a Firefox route is a proposal awaiting Ian | t14-inline-prompt-frames/run.sh, local and live modes; t15-adapter-hardening/verify.sh local |
| R50 | Resistance of the inline prompt to clickjacking and decoys | Repeatable | Synthetic page | Partial failure in T14. Firefox label patches worked. The final T14 screenshot check blocked the transparent frame attack in all 11 attempts per browser. T15 blocked the original patch and measured 0 of 96 successes in each of two final grids per browser, 0 of 192 total per browser. Earlier successes stay recorded. No proof against every overlay | t14-inline-prompt-frames/run.sh, local and live modes; t15-adapter-hardening/verify.sh local |
| R51 | Whether the inline prompt is hidden from page script | Repeatable | Synthetic page | Failed in T14: presence, position and window.find text probes were exposed. T15 blocked tested text probes through an extension owned frame. Presence, position, size, style and the frame address remain visible. No complete privacy fix | t14-inline-prompt-frames/run.sh, local and live modes; t15-adapter-hardening/verify.sh local |
| R52 | Inline prompt on live demo sites | Repeatable | Synthetic page | T14: AuthenticationTest simple form and same origin iframe, and The Internet, filled in both browsers. Public demos send X-Frame-Options SAMEORIGIN, so no live cross origin frame was measured. XQA and fill.dev unavailable | t14-inline-prompt-frames/run.sh live |
| R53 | Hidden and decoy fields, changes while approval is pending and alternate destinations | Repeatable | Synthetic page | T15 local refusals in both browsers. Exact origin boundary unchanged. Field identity, action, method and document are rechecked before fill. Inputs without a form remain unsupported | t15-adapter-hardening/verify.sh local |
| R54 | Dynamic resource address for the extension, against fixed address probes | Repeatable | Synthetic page | T15, Chromium: four fixed address fetch probes blocked. Not complete fingerprinting protection | t15-adapter-hardening/verify.sh local |

## 8. Limits and next steps

The main limit is the absence of a physical board. No result verifies the device, its PRF output, USB transport, storage, firmware, signing key or resistance to extraction. All trials used software signers, synthetic credentials and public demo pages.

T15 blocks the tried Firefox label patches and text probes, but pages still detect the prompt and its frame address. The patch counts in Table 3 do not prove security against every pattern or timing. A hostile enrolled page can still capture and submit the password. A hostile computer can lie about the site because there is no pairing or device display.

The T1 survey is not a compatibility test. The browser prototype has measured software behavior, while the operating system and Discord adapters remain unimplemented. There is no hardware test, human recognition study, certification or current version 1 cost estimate.

Ian still needs to decide four proposals demonstrated or used by T15: whether one Allow click may add every different ancestor when the prompt names each one; whether a prompt may cover the username field in a short frame; whether a certificate error should stop only that site; and whether frame passkeys should stay Chromium only until Firefox exposes a supported policy inspection route. None is presented as an approved decision.

Next, test the allowed parent policy on a real Canvas tool chosen by Ian and decide whether further prompt privacy work is needed. Build the Linux lane D broker and Windows credential provider on the Hermes VMs. Run live T1 and Discord tests once Ian settles the disposable account policy and permitted method. Confirm PRF derivation and USB behavior on a real board once one exists. T15 is complete within its recorded software scope. Arbitrary form support, Firefox frame passkeys and complete prompt privacy remain unresolved.

## References

1. W3C. Web Authentication Level 3. Recommendation, 25 August 2026. www.w3.org/TR/2026/REC-webauthn-3-20260825/
2. FIDO Alliance. Client to Authenticator Protocol 2.3. Proposed Standard, 26 February 2026. fidoalliance.org/specs/fido-v2.3-ps-20260226/fido-client-to-authenticator-protocol-v2.3-ps-20260226.html
3. FIDO Alliance. Authenticator Security and Privacy Requirements 1.6. Final requirements, 12 March 2025. fidoalliance.org/specs/fido-security-requirements/fido-authenticator-security-requirements-v1.6-fd-20250312.html
4. WHATWG. URL Standard. url.spec.whatwg.org/
5. WHATWG. HTML Standard, autofill fields. html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
6. Chrome for Developers. webAuthenticationProxy API reference. developer.chrome.com/docs/extensions/reference/api/webAuthenticationProxy
7. Bitwarden. Browser extension passkey provider. contributing.bitwarden.com/architecture/deep-dives/passkeys/implementations/provider/browser-extension/
8. Microsoft. Credential providers in Windows. learn.microsoft.com/en-us/windows/win32/secauthn/credential-providers-in-windows
9. Linux-PAM. PAM configuration syntax. raw.githubusercontent.com/linux-pam/linux-pam/master/doc/man/pam.conf-syntax.xml
10. Yubico. pam_u2f manual. developers.yubico.com/pam-u2f/Manuals/pam_u2f.8.html
11. Linux kernel. UHID userspace HID I/O driver. www.kernel.org/doc/html/latest/hid/uhid.html
12. Microsoft. UI Automation. learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32
13. Freedesktop. AT-SPI2. www.freedesktop.org/wiki/Accessibility/AT-SPI2/
14. Raspberry Pi. RP2350 platform specifications. www.raspberrypi.com/products/rp2350/
15. NIST. SP 800-63B-4, verifier requirements. pages.nist.gov/800-63-4/sp800-63b.html#verifimpers
16. Microsoft. WebAuthn Passkey Playground. github.com/microsoft/webauthntest
17. Duo. WebAuthn.io demonstration source. github.com/duo-labs/webauthn.io
18. Token2. FIDO2 demo. www.token2.com/tools/fido2-demo
19. GitHub. Configure two factor authentication. docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication
20. Discord. Automated User Accounts and self bot policy. support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots

