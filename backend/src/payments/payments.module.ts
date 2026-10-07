import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { SandboxController } from './sandbox.controller';
import { PAYMENT_PROVIDER } from './payments.constants';
import { DevSandboxProvider } from './providers/dev-sandbox.provider';
import { PaymobProvider } from './providers/paymob.provider';
import { ManualTransferProvider } from './providers/manual-transfer.provider';
import { ManualTransfersController } from './manual-transfers.controller';

@Module({
  imports: [EntitlementsModule],
  controllers: [PaymentsController, SandboxController, ManualTransfersController],
  providers: [
    OrdersService,
    DevSandboxProvider,
    PaymobProvider,
    ManualTransferProvider,
    {
      // One provider is active per deployment, selected by PAYMENT_PROVIDER.
      // Everything downstream depends on the interface, not the adapter.
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, DevSandboxProvider, PaymobProvider, ManualTransferProvider],
      useFactory: (
        config: ConfigService,
        dev: DevSandboxProvider,
        paymob: PaymobProvider,
        manual: ManualTransferProvider,
      ) => {
        const key = config.get<string>('payments.provider');
        return key === 'manual' ? manual : key === 'paymob' ? paymob : dev;
      },
    },
  ],
  exports: [OrdersService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
