import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { AppConfig } from '../../config/configuration';

export interface PresignedUpload {
  url: string;
  key: string;
  expiresIn: number;
}

/**
 * S3-compatible object storage.
 *
 * Two buckets, with deliberately different exposure:
 *   videos  — PRIVATE. Source files and HLS renditions. Never publicly
 *             readable; access is only ever handed out as a presigned URL
 *             after the caller's entitlement has been checked server-side.
 *   public  — public-read. Thumbnails, posters, brand artwork. Nothing here
 *             is access-controlled, so nothing paid may be written to it.
 *
 * Development runs MinIO from docker-compose. Production points the same
 * config at S3 / Spaces / R2 — the API surface used here is the common subset.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  /** Server-side operations. Reaches storage over the internal network. */
  private readonly client: MinioClient;

  /**
   * Presigning only.
   *
   * A presigned URL embeds the endpoint host in both the URL and the
   * signature, so a URL signed against the internal hostname (`minio`) is
   * unusable by a browser — it cannot resolve that name, and rewriting the
   * host afterwards would invalidate the signature.
   *
   * This second client is configured with the PUBLIC endpoint, so URLs handed
   * to a browser are reachable and correctly signed. With a real S3 bucket the
   * two endpoints are identical and this collapses to the same client.
   */
  private readonly signingClient: MinioClient;

  private readonly cfg: AppConfig['storage'];

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['storage']>('storage')!;

    const credentials = {
      accessKey: this.cfg.accessKey,
      secretKey: this.cfg.secretKey,
      region: this.cfg.region,
      pathStyle: this.cfg.forcePathStyle,
    };

    this.client = new MinioClient({
      endPoint: this.cfg.endpoint,
      port: this.cfg.port,
      useSSL: this.cfg.useSsl,
      ...credentials,
    });

    const sameAsInternal =
      this.cfg.publicEndpoint === this.cfg.endpoint &&
      this.cfg.publicPort === this.cfg.port &&
      this.cfg.publicUseSsl === this.cfg.useSsl;

    this.signingClient = sameAsInternal
      ? this.client
      : new MinioClient({
          endPoint: this.cfg.publicEndpoint,
          port: this.cfg.publicPort,
          useSSL: this.cfg.publicUseSsl,
          ...credentials,
        });
  }

  get videoBucket(): string {
    return this.cfg.videoBucket;
  }

  get publicBucket(): string {
    return this.cfg.publicBucket;
  }

  /**
   * Provisions both buckets at boot. Doing this in the app rather than an
   * `mc` sidecar keeps the compose stack to one fewer image and makes the
   * bucket policy visible in code.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket(this.cfg.videoBucket, false);
      await this.ensureBucket(this.cfg.publicBucket, true);
    } catch (error) {
      // A storage outage must not stop the API from serving the catalogue,
      // registrations or the dashboard. Uploads will fail loudly instead.
      this.logger.error(
        `Object storage unavailable at boot: ${(error as Error).message}. ` +
          'Uploads and playback will fail until it recovers.',
      );
    }
  }

  private async ensureBucket(bucket: string, publicRead: boolean): Promise<void> {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket, this.cfg.region);
      this.logger.log(`Created bucket "${bucket}"`);
    }

    if (publicRead) {
      await this.client.setBucketPolicy(
        bucket,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      );
    }
  }

  /** Presigned PUT for a browser upload that bypasses the API process. */
  async presignUpload(bucket: string, key: string, expiresIn = 3600): Promise<PresignedUpload> {
    const url = await this.signingClient.presignedPutObject(bucket, key, expiresIn);
    return { url, key, expiresIn };
  }

  /**
   * Presigned GET. Used for every paid video byte, with a short expiry.
   *
   * A presigned URL limits *how long* a link works and ties it to our
   * authorisation decision. It does not stop a determined student from
   * re-sharing the stream or screen-recording it — that needs DRM, which is a
   * separate commercial capability. See docs/architecture/video-pipeline.md.
   */
  async presignDownload(
    bucket: string,
    key: string,
    expiresIn = 300,
    responseHeaders?: Record<string, string>,
  ): Promise<string> {
    return this.signingClient.presignedGetObject(bucket, key, expiresIn, responseHeaders);
  }

  /** Stable public URL for an object in the public bucket. */
  publicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;
    const base = this.cfg.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key.replace(/^\//, '')}`;
  }

  async putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(bucket, key, body, body.length, {
      'Content-Type': contentType,
    });
  }

  async getObjectStream(bucket: string, key: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(bucket, key);
  }

  async statObject(bucket: string, key: string) {
    return this.client.statObject(bucket, key);
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  /** Removes an entire HLS output prefix, e.g. when a lesson video is replaced. */
  async removePrefix(bucket: string, prefix: string): Promise<number> {
    const keys: string[] = [];
    const stream = this.client.listObjectsV2(bucket, prefix, true);

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => obj.name && keys.push(obj.name));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (keys.length) await this.client.removeObjects(bucket, keys);
    return keys.length;
  }

  async healthCheck(): Promise<boolean> {
    return this.client.bucketExists(this.cfg.videoBucket).then(
      () => true,
      () => false,
    );
  }
}
