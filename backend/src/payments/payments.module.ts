import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { SandboxController } from './sandbox.controller';
import { PAYMENT_PROVIDER } from './payments.constants';
import { DevSandboxProvider } from './providers/dev-sandbox.provider';
import { PaymobProvider } from './providers/paymob.provider';
import { KashierProvider } from './providers/kashier.provider';
import { ManualTransferProvider } from './providers/manual-transfer.provider';
import { ManualTransfersController } from './manual-transfers.controller';
import { PaymentsLogController } from './payments-log.controller';
import { TransferSettingsService } from './transfer-settings.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [
    PaymentsController,
    SandboxController,
    ManualTransfersController,
    PaymentsLogController,
  ],
  providers: [
    OrdersService,
    TransferSettingsService,
    DevSandboxProvider,
    PaymobProvider,
    KashierProvider,
    ManualTransferProvider,
    {
      // One provider is active per deployment, selected by PAYMENT_PROVIDER.
      // Everything downstream depends on the interface, not the adapter.
      provide: PAYMENT_PROVIDER,
      inject: [
        ConfigService,
        DevSandboxProvider,
        PaymobProvider,
        KashierProvider,
        ManualTransferProvider,
      ],
      useFactory: (
        config: ConfigService,
        dev: DevSandboxProvider,
        paymob: PaymobProvider,
        kashier: KashierProvider,
        manual: ManualTransferProvider,
      ) => {
        const key = config.get<string>('payments.provider');
        if (key === 'manual') return manual;
        if (key === 'paymob') return paymob;
        if (key === 'kashier') return kashier;
        return dev;
      },
    },
  ],
  exports: [OrdersService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
