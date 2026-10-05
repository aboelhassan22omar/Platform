import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp OTP transport', () => {
  const config = new ConfigService({ whatsapp: { phoneNumberId: 'phone-id', token: 'secret-token', graphVersion: 'v22.0', otpTemplate: 'platform_otp', otpLanguage: 'ar' } });
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('sends the same six-digit OTP in the authentication template and copy-code button', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'message-id' }] }) });
    await new WhatsAppService(config).sendOtp('01012345678', '001234');
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v22.0/phone-id/messages');
    expect(options.headers.Authorization).toBe('Bearer secret-token');
    const body = JSON.parse(options.body);
    expect(body.to).toBe('201012345678');
    expect(body.template.name).toBe('platform_otp');
    expect(body.template.language.code).toBe('ar');
    expect(body.template.components.map((component: { parameters: { text: string }[] }) => component.parameters[0].text)).toEqual(['001234', '001234']);
    expect(body.template.components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: '0' });
  });

  it('refuses to claim delivery when Meta rejects the message', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: 132001 } }) });
    await expect(new WhatsAppService(config).sendOtp('01012345678', '123456')).rejects.toMatchObject({ status: 503 });
  });

  it('treats timeouts and an accepted response with no message id as failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    await expect(new WhatsAppService(config).sendOtp('01012345678', '123456')).rejects.toMatchObject({ status: 503 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(new WhatsAppService(config).sendOtp('01012345678', '123456')).rejects.toMatchObject({ status: 503 });
  });

  it('does not fall back to exposing or logging codes when configuration is missing', async () => {
    global.fetch = jest.fn();
    await expect(new WhatsAppService(new ConfigService({})).sendOtp('01012345678', '123456')).rejects.toMatchObject({ status: 503 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
