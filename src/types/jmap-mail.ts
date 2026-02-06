// RFC 8621: The JSON Meta Application Protocol (JMAP) for Mail

import type { Id, UnsignedInt, UTCDate, FilterCondition, FilterOperator, Comparator } from "./jmap-core.js";

// --- Mail Capabilities ---

export interface MailCapability {
  maxMailboxesPerEmail: UnsignedInt | null;
  maxMailboxDepth: UnsignedInt | null;
  maxSizeMailboxName: UnsignedInt;
  maxSizeAttachmentsPerEmail: UnsignedInt;
  emailQuerySortOptions: string[];
  mayCreateTopLevelMailbox: boolean;
}

export interface SubmissionCapability {
  maxDelayedSend: UnsignedInt;
  submissionExtensions: Record<string, string[]>;
}

// --- Mailbox (RFC 8621, Section 2) ---

export interface Mailbox {
  id: Id;
  name: string;
  parentId: Id | null;
  role: MailboxRole | null;
  sortOrder: UnsignedInt;
  totalEmails: UnsignedInt;
  unreadEmails: UnsignedInt;
  totalThreads: UnsignedInt;
  unreadThreads: UnsignedInt;
  myRights: MailboxRights;
  isSubscribed: boolean;
}

export type MailboxRole =
  | "all"
  | "archive"
  | "drafts"
  | "flagged"
  | "important"
  | "inbox"
  | "junk"
  | "sent"
  | "subscriptions"
  | "trash"
  | null;

export interface MailboxRights {
  mayReadItems: boolean;
  mayAddItems: boolean;
  mayRemoveItems: boolean;
  maySetSeen: boolean;
  maySetKeywords: boolean;
  mayCreateChild: boolean;
  mayRename: boolean;
  mayDelete: boolean;
  maySubmit: boolean;
}

export interface MailboxFilterCondition extends FilterCondition {
  parentId?: Id | null;
  name?: string;
  role?: string | null;
  hasAnyRole?: boolean;
  isSubscribed?: boolean;
}

export interface MailboxSortProperty extends Comparator {
  property: "sortOrder" | "name";
}

// --- Thread (RFC 8621, Section 3) ---

export interface Thread {
  id: Id;
  emailIds: Id[];
}

// --- Email (RFC 8621, Section 4) ---

export interface Email {
  // Metadata
  id: Id;
  blobId: Id;
  threadId: Id;
  mailboxIds: Record<Id, boolean>;
  keywords: Record<string, boolean>;
  size: UnsignedInt;
  receivedAt: UTCDate;

  // Convenience header properties
  messageId: string[] | null;
  inReplyTo: string[] | null;
  references: string[] | null;
  sender: EmailAddress[] | null;
  from: EmailAddress[] | null;
  to: EmailAddress[] | null;
  cc: EmailAddress[] | null;
  bcc: EmailAddress[] | null;
  replyTo: EmailAddress[] | null;
  subject: string | null;
  sentAt: string | null; // Date header

  // Body
  bodyStructure?: EmailBodyPart;
  bodyValues?: Record<string, EmailBodyValue>;
  textBody?: EmailBodyPart[];
  htmlBody?: EmailBodyPart[];
  attachments?: EmailBodyPart[];
  hasAttachment: boolean;
  preview: string;

  // Dynamic header:* properties are accessed by string key
  [key: `header:${string}`]: unknown;
}

export interface EmailAddress {
  name: string | null;
  email: string;
}

export interface EmailAddressGroup {
  name: string | null;
  addresses: EmailAddress[];
}

export interface EmailBodyPart {
  partId?: string | null;
  blobId?: Id | null;
  size?: UnsignedInt;
  headers?: EmailHeader[];
  name?: string | null;
  type?: string;
  charset?: string | null;
  disposition?: string | null;
  cid?: string | null;
  language?: string[] | null;
  location?: string | null;
  subParts?: EmailBodyPart[] | null;
}

export interface EmailHeader {
  name: string;
  value: string;
}

export interface EmailBodyValue {
  value: string;
  isEncodingProblem: boolean;
  isTruncated: boolean;
}

// --- Email Filter (RFC 8621, Section 4.4.1) ---

export interface EmailFilterCondition extends FilterCondition {
  inMailbox?: Id;
  inMailboxOtherThan?: Id[];
  before?: UTCDate;
  after?: UTCDate;
  minSize?: UnsignedInt;
  maxSize?: UnsignedInt;
  allInThreadHaveKeyword?: string;
  someInThreadHaveKeyword?: string;
  noneInThreadHaveKeyword?: string;
  hasKeyword?: string;
  notKeyword?: string;
  hasAttachment?: boolean;
  text?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  header?: [string] | [string, string];
}

export type EmailFilterOperator = FilterOperator & {
  conditions: (EmailFilterOperator | EmailFilterCondition)[];
};

// --- Email Sort (RFC 8621, Section 4.4.2) ---

export interface EmailComparator extends Comparator {
  property:
    | "receivedAt"
    | "size"
    | "from"
    | "to"
    | "subject"
    | "sentAt"
    | "hasKeyword"
    | "allInThreadHaveKeyword"
    | "someInThreadHaveKeyword";
  keyword?: string;
}

// --- Email Submission (RFC 8621, Section 7) ---

export interface EmailSubmission {
  id: Id;
  identityId: Id;
  emailId: Id;
  threadId: Id;
  envelope?: Envelope | null;
  sendAt: UTCDate;
  undoStatus: "pending" | "final" | "canceled";
  deliveryStatus: Record<string, DeliveryStatus> | null;
  dsnBlobIds: Id[];
  mdnBlobIds: Id[];
}

export interface Envelope {
  mailFrom: EmailSubmissionAddress;
  rcptTo: EmailSubmissionAddress[];
}

export interface EmailSubmissionAddress {
  email: string;
  parameters?: Record<string, string | null> | null;
}

export interface DeliveryStatus {
  smtpReply: string;
  delivered: "queued" | "yes" | "no" | "unknown";
  displayed: "unknown" | "yes";
}

export interface EmailSubmissionFilterCondition extends FilterCondition {
  identityIds?: Id[];
  emailIds?: Id[];
  threadIds?: Id[];
  undoStatus?: string;
  before?: UTCDate;
  after?: UTCDate;
}

// --- Identity (RFC 8621, Section 6) ---

export interface Identity {
  id: Id;
  name: string;
  email: string;
  replyTo?: EmailAddress[] | null;
  bcc?: EmailAddress[] | null;
  textSignature: string;
  htmlSignature: string;
  mayDelete: boolean;
}

// --- Vacation Response (RFC 8621, Section 8) ---

export interface VacationResponse {
  id: Id; // Always "singleton"
  isEnabled: boolean;
  fromDate?: UTCDate | null;
  toDate?: UTCDate | null;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
}

// --- Search Snippet (RFC 8621, Section 5) ---

export interface SearchSnippet {
  emailId: Id;
  subject: string | null;
  preview: string | null;
}

// --- Email/import (RFC 8621, Section 4.8) ---

export interface EmailImport {
  blobId: Id;
  mailboxIds: Record<Id, boolean>;
  keywords?: Record<string, boolean>;
  receivedAt?: UTCDate;
}

export interface EmailImportResponse {
  accountId: Id;
  oldState: string | null;
  newState: string;
  created?: Record<Id, Email> | null;
  notCreated?: Record<Id, { type: string; description?: string }> | null;
}

// --- Email/parse (RFC 8621, Section 4.9) ---

export interface EmailParseRequest {
  accountId: Id;
  blobIds: Id[];
  properties?: string[];
  bodyProperties?: string[];
  fetchTextBodyValues?: boolean;
  fetchHTMLBodyValues?: boolean;
  fetchAllBodyValues?: boolean;
  maxBodyValueBytes?: UnsignedInt;
}

export interface EmailParseResponse {
  accountId: Id;
  parsed: Record<Id, Email> | null;
  notParsable: Id[];
  notFound: Id[];
}
