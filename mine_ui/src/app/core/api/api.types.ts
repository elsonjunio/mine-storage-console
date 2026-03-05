// Standard envelope returned by every backend endpoint
export interface StandardResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error?: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponseData {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export interface MeResponse {
  user_id: string;
  username: string | null;
  email: string;
  roles: string[];
  client_roles: Record<string, string[]>;
  is_admin: boolean;
  raw_claims: {
    email: string;
    fname: string;
    sub: string;
    username: string;
    roles: string[];
    policy: string[];
    [key: string]: unknown;
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface GroupMembership {
  name: string;
  policies?: string[] | null;
}

export interface UserResponse {
  status: string;
  access_key?: string | null;
  member_of?: GroupMembership[] | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface GroupListResponse {
  groups?: string[] | null;
}

export interface GroupResponse {
  status: string;
  group_name: string;
  members?: string[] | null;
}

export interface CreateGroupRequest {
  name: string;
  users?: string[];
}

export interface GroupUsersRequest {
  name: string;
  users: string[];
}

export interface DeleteGroupUsersRequest {
  users: string[];
}

export interface GroupPolicyRequest {
  group: string;
  policy: string;
}

export interface GroupPolicyAttached {
  group: string;
  policies_attached?: string[] | null;
}

export interface GroupPolicyDeatached {
  group: string;
  policies_detached?: string[] | null;
}

export interface GroupMappingsReponse {
  group: string;
  policies?: string[] | null;
}

export interface ResultGroupMappingsReponse {
  timestamp: string;
  group_mappings?: GroupMappingsReponse[] | null;
}

export interface GroupPolicyMappReponse {
  result?: ResultGroupMappingsReponse | null;
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export interface CredentialsResponse {
  access_key: string;
}

export interface CreatedCredentialsResponse {
  status: string;
  access_key: string;
  secret_key: string;
  expiration: string;
}

export interface CreateCredentialRequest {
  username: string;
  policy?: Record<string, unknown> | null;
  expiration?: string | null;
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export interface PolicyInfoResponse {
  policy_name: string;
  policy?: Record<string, unknown> | null;
  create_date?: string | null;
  update_date?: string | null;
}

export interface PolicyResponse {
  policy: string;
  is_group: boolean;
  policy_info?: PolicyInfoResponse | null;
}

export interface CreatePolicyRequest {
  name: string;
  document: Record<string, unknown>;
}

export interface AttachPolicyRequest {
  policy: string;
  username: string;
}

export interface PolicyAttachedResponse {
  policies_attached?: string[] | null;
  user: string;
}

export interface PolicyDetachedResponse {
  policies_detached?: string[] | null;
  user: string;
}

// ─── Buckets ──────────────────────────────────────────────────────────────────

export interface BucketResponse {
  name: string;
  creation_date: string;
}

export interface BucketStatusResponse {
  message: string;
  bucket?: string | null;
}

export interface BucketVersionResponse {
  bucket: string;
  versioning: string;
}

export interface BucketQuotaGetResponse {
  bucket: string;
  type: string;
  quota_bytes: number;
}

export interface BucketUsageResponse {
  bucket: string;
  objects: number;
  size_bytes: number;
}

export interface BucketPolicyResponse {
  bucket: string;
  policy: Record<string, unknown> | null;
}

export interface UpdateBucketPolicyRequest {
  policy: Record<string, unknown>;
}

export interface UpdateBucketLifecycleRequest {
  lifecycle: Record<string, unknown>;
}

export interface LifecycleValidationResponse {
  valid: boolean;
  errors: string[];
}

export interface PolicyValidationResponse {
  valid: boolean;
  errors: string[];
}

// ─── Objects ──────────────────────────────────────────────────────────────────

export interface ObjectItemResponse {
  key: string;
  size: number;
  last_modified: string;
  etag: string;
  storage_class?: string | null;
}

export interface ListObjectsResponse {
  bucket: string;
  prefix?: string | null;
  count: number;
  objects: ObjectItemResponse[];
  is_truncated: boolean;
  next_continuation_token?: string | null;
}

export interface ObjectMessageReponse {
  message: string;
}

export interface GenerateUploadUrlResponse {
  bucket: string;
  key: string;
  upload_url: string;
  expires_in: number;
}

export interface GenerateDownloadUrlResponse {
  bucket: string;
  key: string;
  download_url: string;
  expires_in: number;
}

export interface PresignedDownloadRequest {
  bucket: string;
  key: string;
  expires_in?: number;
  content_type?: string | null;
  download_as?: string | null;
}

export interface ObjectVersionItemResponse {
  version_id: string;
  is_latest: boolean;
  last_modified: string;
  size: number;
}

export interface ListObjectVersionsResponse {
  bucket: string;
  key: string;
  versions: ObjectVersionItemResponse[];
}

export interface DeleteObjectVersionResponse {
  bucket: string;
  key: string;
  version_id?: string | null;
  message: string;
}

export interface RestoreObjectVersionResponse {
  message: string;
  bucket: string;
  key: string;
  restored_from_version?: string | null;
}

export interface ObjectMetadataResponse {
  bucket: string;
  key: string;
  size: number;
  etag: string;
  last_modified: string;
  content_type?: string | null;
  metadata?: Record<string, string> | null;
}

export interface UpdateObjectMetadataRequest {
  bucket: string;
  key: string;
  metadata: Record<string, string>;
}

export interface UpdateObjectMetadataResponse {
  bucket: string;
  key: string;
  message: string;
}

export interface ObjectTagsResponse {
  bucket: string;
  key: string;
  tags?: Record<string, string> | null;
}

export interface UpdateObjectTagsRequest {
  bucket: string;
  key: string;
  tags: Record<string, string>;
}

export interface UpdateObjectTagsResponse {
  bucket: string;
  key: string;
  tags?: Record<string, string> | null;
  message: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ConfigKeyValue {
  key: string;
  value: string;
}

export interface SubSystemConfig {
  subSystem: string;
  target?: string | null;
  kv: ConfigKeyValue[];
}

export interface NotificationConfigResponse {
  status: string;
  config: SubSystemConfig[];
}

export interface CreateWebhookRequest {
  identifier: string;
  config: Record<string, unknown>;
}
