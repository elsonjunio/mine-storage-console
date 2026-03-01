export const TOKEN_STORAGE_KEY = 'mine_access_token';

export const API = {
  // Auth
  AUTH: '/auth/',
  AUTH_CALLBACK: '/auth/callback',
  ME: '/me',

  // Users
  USERS: '/users',
  USER: (username: string) => `/users/${encodeURIComponent(username)}`,
  USER_ENABLE: (username: string) => `/users/${encodeURIComponent(username)}/enable`,
  USER_DISABLE: (username: string) => `/users/${encodeURIComponent(username)}/disable`,

  // Groups
  GROUPS: '/groups',
  GROUP: (name: string) => `/groups/${encodeURIComponent(name)}`,
  GROUP_USERS: '/groups/users',
  GROUP_REMOVE_USERS: (name: string) => `/groups/${encodeURIComponent(name)}/users`,
  GROUP_ENABLE: (name: string) => `/groups/enable/${encodeURIComponent(name)}`,
  GROUP_DISABLE: (name: string) => `/groups/disable/${encodeURIComponent(name)}`,
  GROUP_ATTACH_POLICY: '/groups/attach-policy',
  GROUP_DETACH_POLICY: '/groups/detach-policy',
  GROUP_POLICIES: (name: string) => `/groups/${encodeURIComponent(name)}/policies`,

  // Credentials
  CREDENTIALS: '/credentials',
  CREDENTIAL: (accessKey: string) => `/credentials/${encodeURIComponent(accessKey)}`,

  // Policies
  POLICIES: '/policies',
  POLICY: (name: string) => `/policies/${encodeURIComponent(name)}`,
  POLICY_ATTACH: '/policies/attach',
  POLICY_DETACH: '/policies/detach',

  // Buckets
  BUCKETS: '/buckets',
  BUCKET: (name: string) => `/buckets/${encodeURIComponent(name)}`,
  BUCKET_VERSIONING: (name: string) => `/buckets/${encodeURIComponent(name)}/versioning`,
  BUCKET_QUOTA: (name: string) => `/buckets/${encodeURIComponent(name)}/quota`,
  BUCKET_USAGE: (name: string) => `/buckets/${encodeURIComponent(name)}/usage`,
  BUCKET_POLICY: (name: string) => `/buckets/${encodeURIComponent(name)}/policy`,
  BUCKET_LIFECYCLE: (name: string) => `/buckets/${encodeURIComponent(name)}/lifecycle`,
  BUCKET_EVENTS: (name: string) => `/buckets/${encodeURIComponent(name)}/events`,

  // Objects
  OBJECTS: '/objects',
  OBJECTS_COPY: '/objects/copy',
  OBJECTS_MOVE: '/objects/move',
  OBJECTS_UPLOAD: '/objects/upload',
  OBJECTS_UPLOAD_URL: '/objects/upload-url',
  OBJECTS_PRESIGNED_DOWNLOAD: '/objects/presigned-download',
  OBJECTS_VERSIONS: '/objects/versions',
  OBJECTS_VERSION: '/objects/version',
  OBJECTS_RESTORE_VERSION: '/objects/restore-version',
  OBJECTS_METADATA: '/objects/metadata',
  OBJECTS_TAGS: '/objects/tags',

  // Admin Notifications
  NOTIFICATIONS: (type: string) => `/admin/notifications/${encodeURIComponent(type)}`,
  NOTIFICATION: (type: string, identifier: string) =>
    `/admin/notifications/${encodeURIComponent(type)}/${encodeURIComponent(identifier)}`,
};
