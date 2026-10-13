import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Where students send manual transfers. Kept in site_settings so the owner can
 * change the number, InstaPay link or recipient name from the dashboard,
 * without a redeploy. PAYMENT_TRANSFER_PHONE is only the first-run default.
 */
export interface TransferSettings {
  /** Vodafone Cash wallet that receives transfers. */
  vodafoneCashPhone: string;
  /** Mobile number registered on InstaPay (often the same number). */
  instapayPhone: string;
  /** InstaPay payment link (ipn.eg/...) — opens the app; also used for the QR. */
  instapayLink: string;
  /** InstaPay address, e.g. name@instapay. Optional. */
  instapayAddress: string;
  /** Name the student should see in their app before confirming. */
  recipientName: string;
}

const KEY = 'payments.transfer';

@Injectable()
export class TransferSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private defaults(): TransferSettings {
    const phone = this.config.get<string>('payments.transferPhone') ?? '';
    return {
      vodafoneCashPhone: phone,
      instapayPhone: phone,
      instapayLink: '',
      instapayAddress: '',
      recipientName: '',
    };
  }

  async get(): Promise<TransferSettings> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<TransferSettings>;
    const defaults = this.defaults();
    return {
      vodafoneCashPhone: stored.vodafoneCashPhone || defaults.vodafoneCashPhone,
      instapayPhone: stored.instapayPhone || defaults.instapayPhone,
      instapayLink: stored.instapayLink ?? defaults.instapayLink,
      instapayAddress: stored.instapayAddress ?? defaults.instapayAddress,
      recipientName: stored.recipientName ?? defaults.recipientName,
    };
  }

  async set(settings: TransferSettings): Promise<TransferSettings> {
    const value = settings as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    return this.get();
  }
}
