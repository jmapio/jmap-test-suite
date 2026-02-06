// RFC 8620: The JSON Meta Application Protocol (JMAP)

// --- Primitive Types ---

/** A string of 1-255 characters matching [A-Za-z0-9_-] */
export type Id = string;

/** An integer in the range -(2^53-1) to 2^53-1 */
export type Int = number;

/** An integer in the range 0 to 2^53-1 */
export type UnsignedInt = number;

/** RFC 3339 date-time string */
export type UTCDate = string;

// --- Session Resource (RFC 8620, Section 2) ---

export interface Session {
  capabilities: Record<string, unknown>;
  accounts: Record<Id, Account>;
  primaryAccounts: Record<string, Id>;
  username: string;
  apiUrl: string;
  downloadUrl: string;
  uploadUrl: string;
  eventSourceUrl: string;
  state: string;
}

export interface Account {
  name: string;
  isPersonal: boolean;
  isReadOnly: boolean;
  accountCapabilities: Record<string, unknown>;
}

// --- Core Capabilities ---

export interface CoreCapability {
  maxSizeUpload: UnsignedInt;
  maxConcurrentUpload: UnsignedInt;
  maxSizeRequest: UnsignedInt;
  maxConcurrentRequests: UnsignedInt;
  maxCallsInRequest: UnsignedInt;
  maxObjectsInGet: UnsignedInt;
  maxObjectsInSet: UnsignedInt;
  collationAlgorithms: string[];
}

// --- API Request/Response (RFC 8620, Section 3) ---

/** A method call: [methodName, arguments, callId] */
export type Invocation = [string, Record<string, unknown>, string];

export interface JmapRequest {
  using: string[];
  methodCalls: Invocation[];
  createdIds?: Record<Id, Id>;
}

export interface JmapResponse {
  methodResponses: Invocation[];
  createdIds?: Record<Id, Id>;
  sessionState: string;
}

// --- Result Reference (RFC 8620, Section 3.7) ---

export interface ResultReference {
  resultOf: string;
  name: string;
  path: string;
}

// --- Standard /get (RFC 8620, Section 5.1) ---

export interface GetRequest {
  accountId: Id;
  ids?: Id[] | null;
  properties?: string[] | null;
}

export interface GetResponse<T> {
  accountId: Id;
  state: string;
  list: T[];
  notFound: Id[];
}

// --- Standard /changes (RFC 8620, Section 5.2) ---

export interface ChangesRequest {
  accountId: Id;
  sinceState: string;
  maxChanges?: UnsignedInt;
}

export interface ChangesResponse {
  accountId: Id;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: Id[];
  updated: Id[];
  destroyed: Id[];
}

// --- Standard /set (RFC 8620, Section 5.3) ---

export interface SetRequest<T> {
  accountId: Id;
  ifInState?: string | null;
  create?: Record<Id, Partial<T>> | null;
  update?: Record<Id, Partial<T> | Record<string, unknown>> | null;
  destroy?: Id[] | null;
}

export interface SetResponse<T> {
  accountId: Id;
  oldState: string | null;
  newState: string;
  created?: Record<Id, T> | null;
  updated?: Record<Id, T | null> | null;
  destroyed?: Id[] | null;
  notCreated?: Record<Id, SetError> | null;
  notUpdated?: Record<Id, SetError> | null;
  notDestroyed?: Record<Id, SetError> | null;
}

export interface SetError {
  type: string;
  description?: string | null;
  properties?: string[] | null;
}

// --- Standard /query (RFC 8620, Section 5.5) ---

export interface QueryRequest {
  accountId: Id;
  filter?: FilterOperator | FilterCondition | null;
  sort?: Comparator[] | null;
  position?: Int;
  anchor?: Id | null;
  anchorOffset?: Int;
  limit?: UnsignedInt | null;
  calculateTotal?: boolean;
}

export interface FilterOperator {
  operator: "AND" | "OR" | "NOT";
  conditions: (FilterOperator | FilterCondition)[];
}

export interface FilterCondition {
  [key: string]: unknown;
}

export interface Comparator {
  property: string;
  isAscending?: boolean;
  collation?: string;
  keyword?: string;
}

export interface QueryResponse {
  accountId: Id;
  queryState: string;
  canCalculateChanges: boolean;
  position: UnsignedInt;
  ids: Id[];
  total?: UnsignedInt;
  limit?: UnsignedInt;
}

// --- Standard /queryChanges (RFC 8620, Section 5.6) ---

export interface QueryChangesRequest {
  accountId: Id;
  filter?: FilterOperator | FilterCondition | null;
  sort?: Comparator[] | null;
  sinceQueryState: string;
  maxChanges?: UnsignedInt | null;
  upToId?: Id | null;
  calculateTotal?: boolean;
}

export interface QueryChangesResponse {
  accountId: Id;
  oldQueryState: string;
  newQueryState: string;
  total?: UnsignedInt;
  removed: Id[];
  added: AddedItem[];
}

export interface AddedItem {
  id: Id;
  index: UnsignedInt;
}

// --- Standard /copy (RFC 8620, Section 5.4) ---

export interface CopyRequest<T> {
  fromAccountId: Id;
  ifFromInState?: string | null;
  accountId: Id;
  ifInState?: string | null;
  create: Record<Id, T>;
  onSuccessDestroyOriginal?: boolean;
  destroyFromIfInState?: string | null;
}

export interface CopyResponse<T> {
  fromAccountId: Id;
  accountId: Id;
  oldState: string | null;
  newState: string;
  created?: Record<Id, T> | null;
  notCreated?: Record<Id, SetError> | null;
}

// --- Binary Data (RFC 8620, Section 6) ---

export interface UploadResponse {
  accountId: Id;
  blobId: Id;
  type: string;
  size: UnsignedInt;
}

export interface BlobCopyRequest {
  fromAccountId: Id;
  accountId: Id;
  blobIds: Id[];
}

export interface BlobCopyResponse {
  fromAccountId: Id;
  accountId: Id;
  copied: Record<Id, Id> | null;
  notCopied: Record<Id, SetError> | null;
}

// --- Push (RFC 8620, Section 7) ---

export interface StateChange {
  "@type": "StateChange";
  changed: Record<Id, TypeState>;
}

export type TypeState = Record<string, string>;

export interface PushSubscription {
  id: Id;
  deviceClientId: string;
  url: string;
  keys?: PushKeys | null;
  verificationCode?: string;
  expires?: UTCDate | null;
  types?: string[] | null;
}

export interface PushKeys {
  p256dh: string;
  auth: string;
}

// --- Request-Level Error (RFC 8620, Section 3.6.1) ---

export interface ProblemDetails {
  type: string;
  status?: number;
  title?: string;
  detail?: string;
  limit?: string;
}

// --- Method-Level Error Types ---

export const MethodErrorTypes = [
  "serverUnavailable",
  "serverFail",
  "serverPartialFail",
  "unknownMethod",
  "invalidArguments",
  "invalidResultReference",
  "forbidden",
  "accountNotFound",
  "accountNotSupportedByMethod",
  "accountReadOnly",
  "requestTooLarge",
  "cannotCalculateChanges",
  "stateMismatch",
  "anchorNotFound",
  "unsupportedSort",
  "unsupportedFilter",
  "tooManyChanges",
] as const;
