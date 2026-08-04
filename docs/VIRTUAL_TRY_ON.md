# Photo-based virtual try-on

Takeer supports a photo-based clothing preview on physical product pages.

## Shopper flow

1. The shopper opens a physical product with try-on enabled.
2. The shopper taps **Try it on with your photo**.
3. The shopper uploads a JPG, PNG, or WebP portrait and accepts the temporary-processing notice.
4. Takeer queues the generation job, polls the private session, and displays the result.
5. Portraits are deleted after processing. Expired result files and unfinished portraits are pruned every 15 minutes.

## Merchant setup

Open a physical product in the merchant dashboard, upload a garment image, then enable **Photo virtual try-on**. A transparent, front-facing PNG gives the best result. Product-wide assets are supported now; variant-specific assets are supported by the data model and API.

## Provider configuration

The default `fake` driver is a local development adapter that composites a garment image over the portrait. It exists so the complete flow can be tested without an external AI service.

For production, configure a synchronous HTTP provider:

```dotenv
TRY_ON_DRIVER=http
TRY_ON_ENDPOINT=https://provider.example/v1/try-on
TRY_ON_API_KEY=...
TRY_ON_STORAGE_DISK=s3
TRY_ON_TIMEOUT=180
```

The provider receives two multipart image fields (`person_image` and `garment_image` by default), plus `product_id`, `variant_id`, and `category`. It may return either:

- an image response body;
- JSON containing `image_base64`; or
- JSON containing `image_url`.

Field names can be changed with `TRY_ON_PORTRAIT_FIELD`, `TRY_ON_GARMENT_FIELD`, `TRY_ON_RESPONSE_BASE64_FIELD`, and `TRY_ON_RESPONSE_URL_FIELD`.

## API surface

- `POST /api/try-on/products/{product}/sessions` — start a guest or authenticated session.
- `GET /api/try-on/sessions/{session}?token=...` — read processing status.
- `GET /api/try-on/sessions/{session}/result?token=...` — stream the private result.
- `GET /api/merchant/products/{product}/try-on` — merchant configuration.
- `POST /api/merchant/products/{product}/try-on/assets` — upload a garment asset.
- `PATCH /api/merchant/products/{product}/try-on` — enable or disable the feature.

Portraits and results are token-protected and are not added to the normal public media gallery. The generated image is an approximation and must not be presented as a measurement or fit guarantee.
