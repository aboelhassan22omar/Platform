import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { SandboxController } from './sandbox.controller';
import { PAYMENT_PROVIDER } from './payments.constants';
import { DevSandboxProvider } from './providers/dev-sandbox.provider';
import { PaymobProvider } from './providers/paymob.provider';

@Module({
  imports: [EntitlementsModule],
  controllers: [PaymentsController, SandboxController],
  providers: [
    OrdersService,
    DevSandboxProvider,
    PaymobProvider,
    {
      // One provider is active per deployment, selected by PAYMENT_PROVIDER.
      // Everything downstream depends on the interface, not the adapter.
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, DevSandboxProvider, PaymobProvider],
      useFactory: (config: ConfigService, dev: DevSandboxProvider, paymob: PaymobProvider) =>
        config.get<string>('payments.provider') === 'paymob' ? paymob : dev,
    },
  ],
  exports: [OrdersService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
