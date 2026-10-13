import 'reflect-metadata';
import { PaymentsModule } from './payments.module';

/**
 * A circular import between payment files leaves a constructor parameter type
 * `undefined`, and Nest then refuses to boot — which unit tests that build
 * classes by hand never notice. Load the module as the app does and check
 * every injected class resolved.
 */
describe('PaymentsModule wiring', () => {
  it('has no undefined constructor dependency (no circular imports)', () => {
    const classes = [
      ...(Reflect.getMetadata('controllers', PaymentsModule) ?? []),
      ...(Reflect.getMetadata('providers', PaymentsModule) ?? []).filter(
        (provider: unknown) => typeof provider === 'function',
      ),
    ] as Array<new (...args: never[]) => unknown>;
    expect(classes.length).toBeGreaterThan(3);
    for (const cls of classes) {
      const params: unknown[] = Reflect.getMetadata('design:paramtypes', cls) ?? [];
      params.forEach((param, index) =>
        expect({ class: cls.name, index, resolved: param !== undefined }).toEqual({
          class: cls.name,
          index,
          resolved: true,
        }),
      );
    }
  });
});
