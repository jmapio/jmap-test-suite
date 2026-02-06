
## Part 2: Questions for the RFC Expert

These are the ambiguities I'd like resolved. Each question references the specific RFC section.

---

### Request-level error handling

> **Q1.** (RFC 8620 S3.6.1) When a client sends valid JSON that is not a valid JMAP Request object (e.g., `{"foo":"bar"}`), the RFC says the server SHOULD respond with HTTP 400 and type `urn:ietf:params:jmap:error:notRequest`. Since this is SHOULD and not MUST, is it acceptable for a server to return HTTP 200 with an empty `methodResponses` array, or to attempt to process the malformed request? What is the intended boundary between SHOULD and MUST here?

Treat this as a MUST here. Don't allow HTTP 200 in this case. It must be 400.

> **Q2.** (RFC 8620 S3.6.1) When a client sends a request with the wrong Content-Type (e.g., `text/plain` instead of `application/json`), is the server required to reject it? The RFC says requests "MUST" use `application/json`, but this is stated as a client requirement. Is there a corresponding server requirement to enforce it? Is HTTP 415 (Unsupported Media Type) an acceptable alternative to 400?

415 is acceptable. It must be a 4xx error in this case.

> **Q3.** (RFC 8620 S3.6.1) When a client includes an unknown capability URI in the `using` array, the RFC says the server SHOULD respond with HTTP 400. Is it also acceptable for the server to return a JMAP response with a method-level error (e.g., `unknownCapability` as the method response type), or must this always be an HTTP-level error?

Must be HTTP level.

> **Q4.** (RFC 8620 S3.2) If the `using` array is empty (contains no capabilities), what should the server do? The RFC says `using` MUST include at least `urn:ietf:params:jmap:core`. Should the server reject with `notRequest` (since the request doesn't meet requirements), `unknownCapability`, or something else?

It should process the request, but every method call should be rejected with unknownMethod as the client has not opted in to any capabilities.

---

### Method-level error handling

> **Q5.** (RFC 8620 S5.1) When a method call omits the `accountId` property (e.g., `Mailbox/get` with no `accountId`), is the server required to return an error? Or may it default to the user's primary account for that capability? If an error is required, should it be `invalidArguments` (missing required property) or `accountNotFound` (no account specified)?

Yes, it must return an invalidArguments error.

> **Q6.** (RFC 8620 S5.3) When `ifInState` is provided in a `/set` call and doesn't match the current state, the RFC says the server "MUST reject the entire method call with a stateMismatch error." Is there any scenario where a server may ignore `ifInState` (e.g., if it doesn't support optimistic concurrency)?

No.

---

### /get behavior

> **Q7.** (RFC 8620 S5.1) When `ids` is an empty array `[]` (not `null`), what should `/get` return? `null` returns all objects. Should `[]` return an empty list (no objects requested), or is this invalid?

It should return an empty list []

> **Q8.** (RFC 8620 S5.1) The `properties` parameter says "only the properties listed in the array are returned." If a client requests `properties: ["name"]` for `Mailbox/get`, may the server return additional properties (like `id`, `role`) beyond what was requested? In particular, is the server required to always include `id` even if not listed?

The server is always required to include id even if not listed. This is clear in the spec. No other properties that aren't requested should be returned.

---

### Filtering

> **Q9.** (RFC 8621 S4.4.1) The `text` filter condition says the server "MUST look up text in the from, to, cc, bcc, and subject header fields" and "SHOULD look inside the plain and HTML body parts." If a server doesn't search body parts at all (only headers), does it comply with the RFC? Is there a minimum expectation for body search?

This should be recommended for implementors but isn't strictly required. Mark the test as not required. Split search tests into 2 parts, the strictly required part and a recommended test to test the recommended parts.

> **Q10.** (RFC 8621 S4.4.1) The `from` filter says "Looks for the text in the from header field." Does this match against the display name, the email address, or both? For example, if from is `"Alice Sender" <alice@example.com>`, should `filter: { from: "Alice" }` match?

Both.

---

### Sorting and collation

> **Q11.** (RFC 8621 S4.4.2, RFC 8620 S5.5) When sorting by string properties like `subject` or `from`, what collation should the server use? The Session advertises supported `collationAlgorithms`, but how does the client specify which one to use for a query? If no collation is specified, what is the default? Is `i;unicode-casemap` the expected default?

As per RFC8620 in the collation property on the Comparator object. the client can specify. If no collation is specified, the default is server dependant.

`i;unicode-casemap` is recommended. Add a test to check this but don't make it required.

---

### Email/copy same-account

> **Q12.** (RFC 8620 S5.4, RFC 8621 S4.7) The `/copy` method is defined for copying objects between accounts. Is a server required to support `/copy` when `fromAccountId` equals the target `accountId`? Or may it reject same-account copies with an error?

It should never allow a copy to the same account. invalidArguments error in this case.

---

### Content-Type in upload/download

> **Q13.** (RFC 8620 S6.1) When a client uploads a blob with `Content-Type: text/plain`, must the server return `type: "text/plain"` exactly? Or may it normalize to `text/plain; charset=UTF-8` or perform MIME type sniffing?

It may normalize. It may not perform MIME type sniffing.

> **Q14.** (RFC 8620 S6.2) The download URL has a `type` parameter. The RFC says the server "MAY use this to set the Content-Type header on the response." Since this is MAY, should a conformance test skip checking the Content-Type of the download response, or is there a minimum expectation?

You're hallucinating. The content type header on the response must be what is passed in the parameter.

---

### Email/import and Email/parse error handling

> **Q15.** (RFC 8621 S4.8) If a client calls `Email/import` with a blob that is not a valid RFC 5322 message (e.g., random binary data), must the server reject with `invalidEmail`? Or may it attempt a best-effort parse and import whatever it can extract?

It may attempt a best-effort parse. Email servers may deal with incorrect line endings and things like that.

> **Q16.** (RFC 8621 S4.9) Same question for `Email/parse` with non-email blob data — must the server put it in `notParsable`, or may it attempt to parse it?

It may handle certain errors like incorrect line endings.

---

### Mailbox constraints

> **Q17.** (RFC 8621 S2) The RFC says "There MUST NOT be two sibling Mailboxes with the same name." If a client attempts to create a duplicate, what error type should the server return? `invalidProperties`? Is there a specific error type for this?

The correct error response is `alreadyExists`, defined in RFC8620.

> **Q18.** (RFC 8621 S2.5) When destroying a mailbox that has child mailboxes, the RFC says the server "MUST" return `mailboxHasChild`. Does this apply even if `onDestroyRemoveEmails` is `true`? That is, does `onDestroyRemoveEmails` only affect emails, not child mailboxes?

Yes. If the mailbox has child mailboxes, the child mailboxes must not be destroyed and the server must return mailboxHasChild. The emails also must not be deleted, as the mailbox they're contained within has not been deleted.

Write tests to ensure all of this behaviour is correct.

---

### Submission processing

> **Q19.** (RFC 8621 S7.5) When `onSuccessUpdateEmail` or `onSuccessDestroyEmail` is used in an `EmailSubmission/set` call, is the implicit `Email/set` call guaranteed to be processed synchronously (its response appearing in the same `methodResponses` array)? Or may the server process it asynchronously?

Yes it must be processed syncronously and return results.

---

### Push

> **Q20.** (RFC 8620 S7.2) `PushSubscription/set` operates without an `accountId` (it's not per-account). When creating a PushSubscription, the `types` property is defined as `String[]|null`. Must the server accept `types: null` (meaning all types)? Some servers reject `null` here similar to rejecting `filter: null`.

Yes it must accept all types. Thats why its nullable.

> **Q21.** (RFC 8620 S7.2.2) The PushVerification flow requires the server to POST a verification object to the callback URL. If the server cannot reach the callback URL (e.g., localhost for a remote server), must it still create the subscription (in unverified state), or may it reject the creation entirely?

It may reject the creation if it can determine syncronously that it cannot post to the URL. This is up to the server.

---

### JSON precision

> **Q22.** (RFC 8620 S4) `Core/echo` must return "the same object." For floating-point numbers (e.g., `3.14`), is exact bit-for-bit JSON round-trip fidelity required? Or is it acceptable for the server to return `3.1400000000000001` if that's how the JSON parser decoded it?

Its acceptable. In reality, this doesn't matter. We never actually use floating points in jmap, so allow it. Stick to whole numbers in the tests.

---

### VacationResponse singleton

> **Q23.** (RFC 8621 S8) When a client calls `VacationResponse/set` with `create`, the server should reject with error type `singleton`. Is the error type literally the string `"singleton"`, or is it a different SetError type name? The same question applies to attempting to destroy the singleton.

Yes, literally "singleton".

---

### Consistency between /get and /query

> **Q24.** (RFC 8621 S2) `Mailbox` has a `totalEmails` property and `Email/query` with `inMailbox` filter has `total` (via `calculateTotal`). Must these values be consistent within the same JMAP request? Or is eventual consistency acceptable (where `totalEmails` might briefly differ from a query's `total`)?

Yes, they must be consistent. The state on the server is permitted to change between method calls. But assuming the state hasn't changed, they must match. So if you did Mailbox/get then Email/query then Mailbox/changes, if the /changes doesn't indicate a state change, they must match.
