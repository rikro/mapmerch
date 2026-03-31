import { buildPrintfulPayload } from '../../src/services/orderService.js';
import { Draft, ShippingAddress } from '../../src/types.js';

const mockDraft: Draft = {
  id: 'draft-123',
  sessionToken: 'session-abc',
  polygon: { type: 'Polygon', coordinates: [] },
  style: 'minimal-line-art',
  svg: '<svg></svg>',
  createdAt: new Date(),
};

const mockAddress: ShippingAddress = {
  name: 'Jane Smith',
  address1: '123 Main St',
  city: 'Chicago',
  state: 'IL',
  zip: '60601',
  country: 'US',
  email: 'jane@example.com',
};

describe('buildPrintfulPayload', () => {
  it('includes the idempotency key as external_id', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.external_id).toBe('idem-key-xyz');
  });

  it('maps shipping address fields correctly', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.recipient.name).toBe('Jane Smith');
    expect(payload.recipient.state_code).toBe('IL');
    expect(payload.recipient.country_code).toBe('US');
  });

  it('includes one item with a file URL', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].files[0].url).toBe('data:image/svg+xml;base64,abc');
  });

  it('throws for an unknown product/size combination', () => {
    expect(() =>
      buildPrintfulPayload(
        mockDraft,
        'print',
        '99x99',
        mockAddress,
        'idem-key-xyz',
        'data:image/svg+xml;base64,abc',
      ),
    ).toThrow('Unknown product/size');
  });
});
