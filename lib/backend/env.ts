type RequiredEnvKey =
  | 'DATABASE_URL'
  | 'AUTH_SECRET'
  | 'APP_URL';

type OptionalEnvKey =
  | 'APP_ENV'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GOOGLE_REDIRECT_URI'
  | 'GOOGLE_DRIVE_ROOT_FOLDER_ID'
  | 'GOOGLE_SHARED_DRIVE_ID'
  | 'GOOGLE_WORKSPACE_ADMIN_EMAIL'
  | 'GMAIL_SENDER_EMAIL'
  | 'GMAIL_REPLY_TO'
  | 'AI_PROVIDER'
  | 'ANTHROPIC_API_KEY'
  | 'AI_MODEL'
  | 'AI_ASSISTANT_NAME'
  | 'AI_VECTOR_STORE_URL'
  | 'OBJECT_STORAGE_BUCKET'
  | 'OBJECT_STORAGE_REGION'
  | 'OBJECT_STORAGE_ACCESS_KEY_ID'
  | 'OBJECT_STORAGE_SECRET_ACCESS_KEY'
  | 'ESIGN_PROVIDER'
  | 'ESIGN_API_KEY'
  | 'CARRIER_TRACKING_PROVIDER'
  | 'CARRIER_TRACKING_API_KEY'
  | 'PAYMENTS_PROVIDER'
  | 'PAYMENTS_API_KEY';

const requiredKeys: RequiredEnvKey[] = ['DATABASE_URL', 'AUTH_SECRET', 'APP_URL'];

function readEnv(key: RequiredEnvKey | OptionalEnvKey): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : undefined;
}

export function getBackendEnv() {
  const missing = requiredKeys.filter((key) => !readEnv(key));

  return {
    ok: missing.length === 0,
    missing,
    app: {
      env: readEnv('APP_ENV') ?? process.env.NODE_ENV ?? 'development',
      url: readEnv('APP_URL'),
    },
    database: {
      url: readEnv('DATABASE_URL'),
    },
    auth: {
      secret: readEnv('AUTH_SECRET'),
    },
    google: {
      clientId: readEnv('GOOGLE_CLIENT_ID'),
      clientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
      redirectUri: readEnv('GOOGLE_REDIRECT_URI'),
      driveRootFolderId: readEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
      sharedDriveId: readEnv('GOOGLE_SHARED_DRIVE_ID'),
      workspaceAdminEmail: readEnv('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
    },
    gmail: {
      senderEmail: readEnv('GMAIL_SENDER_EMAIL') ?? 'ad@italprotein.com',
      replyTo: readEnv('GMAIL_REPLY_TO') ?? 'ad@italprotein.com',
    },
    ai: {
      provider: readEnv('AI_PROVIDER') ?? 'anthropic',
      apiKey: readEnv('ANTHROPIC_API_KEY'),
      model: readEnv('AI_MODEL') ?? 'claude-opus-4-8',
      assistantName: readEnv('AI_ASSISTANT_NAME') ?? 'Amina',
      vectorStoreUrl: readEnv('AI_VECTOR_STORE_URL'),
    },
    storage: {
      bucket: readEnv('OBJECT_STORAGE_BUCKET'),
      region: readEnv('OBJECT_STORAGE_REGION'),
      accessKeyId: readEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: readEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    },
    integrations: {
      esignProvider: readEnv('ESIGN_PROVIDER'),
      esignApiKey: readEnv('ESIGN_API_KEY'),
      carrierProvider: readEnv('CARRIER_TRACKING_PROVIDER'),
      carrierApiKey: readEnv('CARRIER_TRACKING_API_KEY'),
      paymentsProvider: readEnv('PAYMENTS_PROVIDER'),
      paymentsApiKey: readEnv('PAYMENTS_API_KEY'),
    },
  };
}
