import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API } from './api.config';
import { ConfigService } from './config.service';
import type {
  StandardResponse,
  AuthResponseData,
  MeResponse,
  UserResponse,
  CreateUserRequest,
  GroupListResponse,
  GroupResponse,
  CreateGroupRequest,
  GroupUsersRequest,
  DeleteGroupUsersRequest,
  GroupPolicyRequest,
  GroupPolicyAttached,
  GroupPolicyDeatached,
  GroupPolicyMappReponse,
  CredentialsResponse,
  CreatedCredentialsResponse,
  CreateCredentialRequest,
  PolicyResponse,
  CreatePolicyRequest,
  AttachPolicyRequest,
  PolicyAttachedResponse,
  PolicyDetachedResponse,
  BucketResponse,
  BucketStatusResponse,
  BucketVersionResponse,
  BucketQuotaGetResponse,
  BucketUsageResponse,
  BucketPolicyResponse,
  UpdateBucketPolicyRequest,
  UpdateBucketLifecycleRequest,
  LifecycleValidationResponse,
  PolicyValidationResponse,
  ListObjectsResponse,
  ObjectMessageReponse,
  GenerateUploadUrlResponse,
  GenerateDownloadUrlResponse,
  PresignedDownloadRequest,
  ListObjectVersionsResponse,
  DeleteObjectVersionResponse,
  RestoreObjectVersionResponse,
  ObjectMetadataResponse,
  UpdateObjectMetadataRequest,
  UpdateObjectMetadataResponse,
  ObjectTagsResponse,
  UpdateObjectTagsRequest,
  UpdateObjectTagsResponse,
  NotificationConfigResponse,
  CreateWebhookRequest,
} from './api.types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private url(path: string): string {
    return `${this.config.apiBaseUrl}${path}`;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  /** Exchange the current Bearer token (Keycloak) for an internal MINE token. */
  authenticate(): Observable<StandardResponse<AuthResponseData>> {
    return this.http.post<StandardResponse<AuthResponseData>>(this.url(API.AUTH), null);
  }

  me(): Observable<StandardResponse<MeResponse>> {
    return this.http.get<StandardResponse<MeResponse>>(this.url(API.ME));
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  listUsers(): Observable<StandardResponse<UserResponse[]>> {
    return this.http.get<StandardResponse<UserResponse[]>>(this.url(API.USERS));
  }

  createUser(body: CreateUserRequest): Observable<StandardResponse<UserResponse[]>> {
    return this.http.post<StandardResponse<UserResponse[]>>(this.url(API.USERS), body);
  }

  getUser(username: string): Observable<StandardResponse<UserResponse>> {
    return this.http.get<StandardResponse<UserResponse>>(this.url(API.USER(username)));
  }

  deleteUser(username: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.USER(username)));
  }

  enableUser(username: string): Observable<StandardResponse<UserResponse[]>> {
    return this.http.post<StandardResponse<UserResponse[]>>(this.url(API.USER_ENABLE(username)), null);
  }

  disableUser(username: string): Observable<StandardResponse<UserResponse[]>> {
    return this.http.post<StandardResponse<UserResponse[]>>(this.url(API.USER_DISABLE(username)), null);
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  listGroups(): Observable<StandardResponse<GroupListResponse[]>> {
    return this.http.get<StandardResponse<GroupListResponse[]>>(this.url(API.GROUPS));
  }

  createGroup(body: CreateGroupRequest): Observable<StandardResponse<GroupResponse[]>> {
    return this.http.post<StandardResponse<GroupResponse[]>>(this.url(API.GROUPS), body);
  }

  getGroup(name: string): Observable<StandardResponse<GroupResponse[]>> {
    return this.http.get<StandardResponse<GroupResponse[]>>(this.url(API.GROUP(name)));
  }

  deleteGroup(name: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.GROUP(name)));
  }

  addGroupUsers(body: GroupUsersRequest): Observable<StandardResponse<GroupResponse[]>> {
    return this.http.post<StandardResponse<GroupResponse[]>>(this.url(API.GROUP_USERS), body);
  }

  removeGroupUsers(
    name: string,
    body: DeleteGroupUsersRequest,
  ): Observable<StandardResponse<GroupResponse[]>> {
    return this.http.delete<StandardResponse<GroupResponse[]>>(
      this.url(API.GROUP_REMOVE_USERS(name)),
      { body },
    );
  }

  enableGroup(name: string): Observable<StandardResponse<unknown>> {
    return this.http.post<StandardResponse<unknown>>(this.url(API.GROUP_ENABLE(name)), null);
  }

  disableGroup(name: string): Observable<StandardResponse<unknown>> {
    return this.http.post<StandardResponse<unknown>>(this.url(API.GROUP_DISABLE(name)), null);
  }

  attachGroupPolicy(body: GroupPolicyRequest): Observable<StandardResponse<GroupPolicyAttached[]>> {
    return this.http.post<StandardResponse<GroupPolicyAttached[]>>(
      this.url(API.GROUP_ATTACH_POLICY),
      body,
    );
  }

  detachGroupPolicy(
    body: GroupPolicyRequest,
  ): Observable<StandardResponse<GroupPolicyDeatached[]>> {
    return this.http.post<StandardResponse<GroupPolicyDeatached[]>>(
      this.url(API.GROUP_DETACH_POLICY),
      body,
    );
  }

  getGroupPolicies(name: string): Observable<StandardResponse<GroupPolicyMappReponse[]>> {
    return this.http.get<StandardResponse<GroupPolicyMappReponse[]>>(
      this.url(API.GROUP_POLICIES(name)),
    );
  }

  // ─── Credentials ──────────────────────────────────────────────────────────

  listCredentials(username: string): Observable<StandardResponse<CredentialsResponse[]>> {
    const params = new HttpParams().set('username', username);
    return this.http.get<StandardResponse<CredentialsResponse[]>>(this.url(API.CREDENTIALS), {
      params,
    });
  }

  createCredential(
    body: CreateCredentialRequest,
  ): Observable<StandardResponse<CreatedCredentialsResponse[]>> {
    return this.http.post<StandardResponse<CreatedCredentialsResponse[]>>(
      this.url(API.CREDENTIALS),
      body,
    );
  }

  deleteCredential(accessKey: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.CREDENTIAL(accessKey)));
  }

  // ─── Policies ─────────────────────────────────────────────────────────────

  listPolicies(): Observable<StandardResponse<PolicyResponse[]>> {
    return this.http.get<StandardResponse<PolicyResponse[]>>(this.url(API.POLICIES));
  }

  createPolicy(body: CreatePolicyRequest): Observable<StandardResponse<PolicyResponse[]>> {
    return this.http.post<StandardResponse<PolicyResponse[]>>(this.url(API.POLICIES), body);
  }

  getPolicy(name: string): Observable<StandardResponse<PolicyResponse>> {
    return this.http.get<StandardResponse<PolicyResponse>>(this.url(API.POLICY(name)));
  }

  deletePolicy(name: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.POLICY(name)));
  }

  attachPolicy(body: AttachPolicyRequest): Observable<StandardResponse<PolicyAttachedResponse[]>> {
    return this.http.post<StandardResponse<PolicyAttachedResponse[]>>(
      this.url(API.POLICY_ATTACH),
      body,
    );
  }

  detachPolicy(body: AttachPolicyRequest): Observable<StandardResponse<PolicyDetachedResponse[]>> {
    return this.http.post<StandardResponse<PolicyDetachedResponse[]>>(
      this.url(API.POLICY_DETACH),
      body,
    );
  }

  // ─── Buckets ──────────────────────────────────────────────────────────────

  listBuckets(): Observable<StandardResponse<BucketResponse[]>> {
    return this.http.get<StandardResponse<BucketResponse[]>>(this.url(API.BUCKETS));
  }

  createBucket(name: string): Observable<StandardResponse<BucketStatusResponse>> {
    const params = new HttpParams().set('name', name);
    return this.http.post<StandardResponse<BucketStatusResponse>>(this.url(API.BUCKETS), null, {
      params,
    });
  }

  deleteBucket(name: string): Observable<StandardResponse<BucketStatusResponse>> {
    return this.http.delete<StandardResponse<BucketStatusResponse>>(this.url(API.BUCKET(name)));
  }

  getBucketVersioning(name: string): Observable<StandardResponse<BucketVersionResponse>> {
    return this.http.get<StandardResponse<BucketVersionResponse>>(this.url(API.BUCKET_VERSIONING(name)));
  }

  setBucketVersioning(
    name: string,
    enabled: boolean,
  ): Observable<StandardResponse<BucketVersionResponse>> {
    const params = new HttpParams().set('enabled', enabled);
    return this.http.put<StandardResponse<BucketVersionResponse>>(
      this.url(API.BUCKET_VERSIONING(name)),
      null,
      { params },
    );
  }

  setBucketQuota(
    name: string,
    quotaBytes: number,
  ): Observable<StandardResponse<BucketQuotaGetResponse>> {
    const params = new HttpParams().set('quota_bytes', quotaBytes);
    return this.http.put<StandardResponse<BucketQuotaGetResponse>>(
      this.url(API.BUCKET_QUOTA(name)),
      null,
      { params },
    );
  }

  getBucketQuota(name: string): Observable<StandardResponse<BucketQuotaGetResponse[]>> {
    return this.http.get<StandardResponse<BucketQuotaGetResponse[]>>(
      this.url(API.BUCKET_QUOTA(name)),
    );
  }

  getBucketUsage(name: string): Observable<StandardResponse<BucketUsageResponse>> {
    return this.http.get<StandardResponse<BucketUsageResponse>>(this.url(API.BUCKET_USAGE(name)));
  }

  getBucketPolicy(name: string): Observable<StandardResponse<BucketPolicyResponse>> {
    return this.http.get<StandardResponse<BucketPolicyResponse>>(
      this.url(API.BUCKET_POLICY(name)),
    );
  }

  setBucketPolicy(
    name: string,
    body: UpdateBucketPolicyRequest,
  ): Observable<StandardResponse<BucketPolicyResponse>> {
    return this.http.put<StandardResponse<BucketPolicyResponse>>(
      this.url(API.BUCKET_POLICY(name)),
      body,
    );
  }

  deleteBucketPolicy(name: string): Observable<StandardResponse<BucketStatusResponse>> {
    return this.http.delete<StandardResponse<BucketStatusResponse>>(
      this.url(API.BUCKET_POLICY(name)),
    );
  }

  validateBucketPolicy(
    name: string,
    body: UpdateBucketPolicyRequest,
  ): Observable<StandardResponse<PolicyValidationResponse>> {
    return this.http.post<StandardResponse<PolicyValidationResponse>>(
      this.url(API.BUCKET_POLICY_VALIDATE(name)),
      body,
    );
  }

  getBucketLifecycle(name: string): Observable<StandardResponse<unknown>> {
    return this.http.get<StandardResponse<unknown>>(this.url(API.BUCKET_LIFECYCLE(name)));
  }

  setBucketLifecycle(
    name: string,
    body: UpdateBucketLifecycleRequest,
  ): Observable<StandardResponse<unknown>> {
    return this.http.put<StandardResponse<unknown>>(this.url(API.BUCKET_LIFECYCLE(name)), body);
  }

  deleteBucketLifecycle(name: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.BUCKET_LIFECYCLE(name)));
  }

  validateBucketLifecycle(
    name: string,
    body: UpdateBucketLifecycleRequest,
  ): Observable<StandardResponse<LifecycleValidationResponse>> {
    return this.http.post<StandardResponse<LifecycleValidationResponse>>(
      this.url(API.BUCKET_LIFECYCLE_VALIDATE(name)),
      body,
    );
  }

  getBucketEvents(name: string): Observable<StandardResponse<unknown>> {
    return this.http.get<StandardResponse<unknown>>(this.url(API.BUCKET_EVENTS(name)));
  }

  setBucketEvents(name: string, body: unknown): Observable<StandardResponse<unknown>> {
    return this.http.put<StandardResponse<unknown>>(this.url(API.BUCKET_EVENTS(name)), body);
  }

  deleteBucketEvents(name: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(this.url(API.BUCKET_EVENTS(name)));
  }

  // ─── Objects ──────────────────────────────────────────────────────────────

  listObjects(
    bucket: string,
    prefix?: string,
    limit?: number,
    continuationToken?: string,
  ): Observable<StandardResponse<ListObjectsResponse>> {
    let params = new HttpParams().set('bucket', bucket);
    if (prefix != null) params = params.set('prefix', prefix);
    if (limit != null) params = params.set('limit', limit);
    if (continuationToken != null) params = params.set('continuation_token', continuationToken);
    return this.http.get<StandardResponse<ListObjectsResponse>>(this.url(API.OBJECTS), { params });
  }

  deleteObject(bucket: string, key: string): Observable<StandardResponse<ObjectMessageReponse>> {
    const params = new HttpParams().set('bucket', bucket).set('key', key);
    return this.http.delete<StandardResponse<ObjectMessageReponse>>(this.url(API.OBJECTS), {
      params,
    });
  }

  copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Observable<StandardResponse<ObjectMessageReponse>> {
    const params = new HttpParams()
      .set('source_bucket', sourceBucket)
      .set('source_key', sourceKey)
      .set('dest_bucket', destBucket)
      .set('dest_key', destKey);
    return this.http.post<StandardResponse<ObjectMessageReponse>>(
      this.url(API.OBJECTS_COPY),
      null,
      { params },
    );
  }

  moveObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Observable<StandardResponse<ObjectMessageReponse>> {
    const params = new HttpParams()
      .set('source_bucket', sourceBucket)
      .set('source_key', sourceKey)
      .set('dest_bucket', destBucket)
      .set('dest_key', destKey);
    return this.http.post<StandardResponse<ObjectMessageReponse>>(
      this.url(API.OBJECTS_MOVE),
      null,
      { params },
    );
  }

  uploadObject(bucket: string, key: string, file: File): Observable<HttpEvent<StandardResponse<ObjectMessageReponse>>> {
    const params = new HttpParams()
      .set('bucket', bucket)
      .set('key', key)
      .set('content_type', file.type || 'application/octet-stream');
    const formData = new FormData();
    formData.append('file', file);
    const req = new HttpRequest('POST', this.url(API.OBJECTS_UPLOAD), formData, {
      params,
      reportProgress: true,
    });
    return this.http.request(req);
  }

  generateUploadUrl(
    bucket: string,
    key: string,
    contentType?: string,
    expiresIn?: number,
  ): Observable<StandardResponse<GenerateUploadUrlResponse>> {
    let params = new HttpParams().set('bucket', bucket).set('key', key);
    if (contentType != null) params = params.set('content_type', contentType);
    if (expiresIn != null) params = params.set('expires_in', expiresIn);
    return this.http.post<StandardResponse<GenerateUploadUrlResponse>>(
      this.url(API.OBJECTS_UPLOAD_URL),
      null,
      { params },
    );
  }

  generatePresignedDownload(
    body: PresignedDownloadRequest,
  ): Observable<StandardResponse<GenerateDownloadUrlResponse>> {
    return this.http.post<StandardResponse<GenerateDownloadUrlResponse>>(
      this.url(API.OBJECTS_PRESIGNED_DOWNLOAD),
      body,
    );
  }

  listObjectVersions(
    bucket: string,
    key: string,
  ): Observable<StandardResponse<ListObjectVersionsResponse>> {
    const params = new HttpParams().set('bucket', bucket).set('key', key);
    return this.http.get<StandardResponse<ListObjectVersionsResponse>>(
      this.url(API.OBJECTS_VERSIONS),
      { params },
    );
  }

  deleteObjectVersion(
    bucket: string,
    key: string,
    versionId: string,
  ): Observable<StandardResponse<DeleteObjectVersionResponse>> {
    const params = new HttpParams()
      .set('bucket', bucket)
      .set('key', key)
      .set('version_id', versionId);
    return this.http.delete<StandardResponse<DeleteObjectVersionResponse>>(
      this.url(API.OBJECTS_VERSION),
      { params },
    );
  }

  restoreObjectVersion(
    bucket: string,
    key: string,
    versionId: string,
  ): Observable<StandardResponse<RestoreObjectVersionResponse>> {
    const params = new HttpParams()
      .set('bucket', bucket)
      .set('key', key)
      .set('version_id', versionId);
    return this.http.post<StandardResponse<RestoreObjectVersionResponse>>(
      this.url(API.OBJECTS_RESTORE_VERSION),
      null,
      { params },
    );
  }

  getObjectMetadata(
    bucket: string,
    key: string,
  ): Observable<StandardResponse<ObjectMetadataResponse>> {
    const params = new HttpParams().set('bucket', bucket).set('key', key);
    return this.http.get<StandardResponse<ObjectMetadataResponse>>(
      this.url(API.OBJECTS_METADATA),
      { params },
    );
  }

  updateObjectMetadata(
    body: UpdateObjectMetadataRequest,
  ): Observable<StandardResponse<UpdateObjectMetadataResponse>> {
    return this.http.put<StandardResponse<UpdateObjectMetadataResponse>>(
      this.url(API.OBJECTS_METADATA),
      body,
    );
  }

  getObjectTags(bucket: string, key: string): Observable<StandardResponse<ObjectTagsResponse>> {
    const params = new HttpParams().set('bucket', bucket).set('key', key);
    return this.http.get<StandardResponse<ObjectTagsResponse>>(this.url(API.OBJECTS_TAGS), {
      params,
    });
  }

  updateObjectTags(
    body: UpdateObjectTagsRequest,
  ): Observable<StandardResponse<UpdateObjectTagsResponse>> {
    return this.http.put<StandardResponse<UpdateObjectTagsResponse>>(
      this.url(API.OBJECTS_TAGS),
      body,
    );
  }

  // ─── Admin Notifications ──────────────────────────────────────────────────

  listWebhooks(type: string): Observable<StandardResponse<NotificationConfigResponse[]>> {
    return this.http.get<StandardResponse<NotificationConfigResponse[]>>(
      this.url(API.NOTIFICATIONS(type)),
    );
  }

  createWebhook(
    type: string,
    body: CreateWebhookRequest,
  ): Observable<StandardResponse<NotificationConfigResponse>> {
    return this.http.post<StandardResponse<NotificationConfigResponse>>(
      this.url(API.NOTIFICATIONS(type)),
      body,
    );
  }

  deleteWebhook(type: string, identifier: string): Observable<StandardResponse<unknown>> {
    return this.http.delete<StandardResponse<unknown>>(
      this.url(API.NOTIFICATION(type, identifier)),
    );
  }
}
