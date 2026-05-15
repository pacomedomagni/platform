import * as crypto from 'crypto';
import { EbayWebhookService } from './ebay-webhook.service';

/**
 * Signature-verification unit tests.
 *
 * The contract here mirrors eBay's official event-notification-java-sdk
 * (SignatureValidator.java): the signature covers the RAW REQUEST BODY
 * bytes alone, using the algorithm reported by getPublicKey. Anything else
 * (folding in timestamp/endpoint/verificationToken, hardcoding SHA-256) is
 * a regression — this test exists to catch that.
 */
describe('EbayWebhookService.verifySignature', () => {
  let service: EbayWebhookService;
  let keyPair: crypto.KeyPairKeyObjectResult;

  beforeAll(() => {
    keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  });

  beforeEach(() => {
    // Mock mode must be off for real verification logic to run.
    delete process.env.MOCK_EXTERNAL_SERVICES;
    service = new EbayWebhookService({} as any);
  });

  /** Build an X-EBAY-SIGNATURE header matching eBay's wire format. */
  function buildSignatureHeader(body: string, digestAlgo: 'sha1' | 'sha256', kid = 'test-key'): string {
    const signature = crypto.sign(digestAlgo, Buffer.from(body, 'utf8'), keyPair.privateKey);
    return Buffer.from(
      JSON.stringify({ kid, signature: signature.toString('base64') }),
      'utf8',
    ).toString('base64');
  }

  function stubGetPublicKey(digest: 'SHA1' | 'SHA256') {
    jest.spyOn(service, 'getPublicKey').mockResolvedValue({
      key: keyPair.publicKey,
      algorithm: 'ECDSA',
      digest,
    });
  }

  it('accepts a valid SHA1/ECDSA signature over the raw body', async () => {
    const body = '{"metadata":{"topic":"ITEM_SOLD"},"data":{"itemId":"1234"}}';
    stubGetPublicKey('SHA1');
    const header = buildSignatureHeader(body, 'sha1');

    await expect(service.verifySignature(body, header)).resolves.toBe(true);
  });

  it('accepts a valid SHA256/ECDSA signature (newer eBay keys)', async () => {
    const body = '{"metadata":{"topic":"RETURN_CREATED"},"data":{"returnId":"r1"}}';
    stubGetPublicKey('SHA256');
    const header = buildSignatureHeader(body, 'sha256');

    await expect(service.verifySignature(body, header)).resolves.toBe(true);
  });

  it('rejects when the body is tampered after signing', async () => {
    const body = '{"metadata":{"topic":"ITEM_SOLD"}}';
    stubGetPublicKey('SHA1');
    const header = buildSignatureHeader(body, 'sha1');

    const tampered = body.replace('ITEM_SOLD', 'MARKETPLACE_ACCOUNT_DELETION');
    await expect(service.verifySignature(tampered, header)).resolves.toBe(false);
  });

  it('rejects when the signature is corrupted', async () => {
    const body = '{"x":1}';
    stubGetPublicKey('SHA1');
    const header = buildSignatureHeader(body, 'sha1');

    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    decoded.signature = Buffer.from(
      crypto.randomBytes(Buffer.from(decoded.signature, 'base64').length),
    ).toString('base64');
    const corrupted = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64');

    await expect(service.verifySignature(body, corrupted)).resolves.toBe(false);
  });

  it('rejects when the digest algorithm mismatches (SHA256 reported but signed with SHA1)', async () => {
    const body = '{"x":1}';
    stubGetPublicKey('SHA256');
    // Signed with SHA1 — declared SHA256. Real-world manifestation of key
    // metadata drift; verifier must catch it instead of silently accepting.
    const header = buildSignatureHeader(body, 'sha1');

    await expect(service.verifySignature(body, header)).resolves.toBe(false);
  });

  it('rejects when header is missing kid or signature', async () => {
    await expect(
      service.verifySignature(
        '{"x":1}',
        Buffer.from(JSON.stringify({ kid: 'x' }), 'utf8').toString('base64'),
      ),
    ).resolves.toBe(false);
  });

  it('does NOT fold verification-token/endpoint/timestamp into the digest', async () => {
    // Regression guard: a signature created over only the body must verify
    // regardless of what EBAY_VERIFICATION_TOKEN or EBAY_WEBHOOK_ENDPOINT
    // is set to. The previous (broken) implementation folded both into the
    // hash, so this test would have failed against it.
    const body = '{"meta":"hello"}';
    stubGetPublicKey('SHA1');
    const header = buildSignatureHeader(body, 'sha1');

    process.env.EBAY_VERIFICATION_TOKEN = 'this-must-not-affect-verification';
    process.env.EBAY_WEBHOOK_ENDPOINT = 'https://example.com/totally-different';

    await expect(service.verifySignature(body, header)).resolves.toBe(true);
  });
});

describe('EbayWebhookService.computeChallengeResponse', () => {
  let service: EbayWebhookService;

  beforeEach(() => {
    process.env.EBAY_VERIFICATION_TOKEN = 'verification-token-12345';
    process.env.EBAY_WEBHOOK_ENDPOINT = 'https://example.com/ebay/webhooks/account-deletion';
    service = new EbayWebhookService({} as any);
  });

  it('returns hex SHA256(challengeCode || verificationToken || endpoint)', () => {
    const code = 'ebay-challenge-abc';
    const expected = crypto
      .createHash('sha256')
      .update(code + process.env.EBAY_VERIFICATION_TOKEN + process.env.EBAY_WEBHOOK_ENDPOINT)
      .digest('hex');

    expect(service.computeChallengeResponse(code)).toBe(expected);
  });

  it('produces a 64-char hex digest (not base64)', () => {
    const result = service.computeChallengeResponse('any-code');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
