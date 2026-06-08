# Selcom Developers - PHP & Laravel API Reference

Welcome to the Selcom Developers integration guide. This document provides a complete, structured API reference designed for **PHP and Laravel** developers. 

Selcom offers a set of Application Programming Interfaces (APIs) that allow you to incorporate payment aggregation, utilities, wallets, virtual card networks (VCN), checkouts, and international money transfers into your PHP/Laravel projects.

---

## Takeer Implementation Notes

This project does **not** install or use the official Selcom Composer package directly. We keep Selcom behind our own payment-provider layer so the rest of Takeer can route between Selcom, AzamPay, DPO, and future providers without changing checkout, wallet, or admin code.

Current Takeer files:

- `app/Payments/Drivers/Selcom/SelcomClient.php` signs and sends Selcom HTTP requests.
- `app/Payments/Drivers/Selcom/SelcomGateway.php` implements checkout pay-in and payout calls.
- `app/Services/SelcomPayoutService.php` submits approved withdrawals to Selcom.
- `app/Services/PaymentDisplayDirectory.php` maps friendly names to Selcom codes.
- `app/Http/Controllers/Api/Payments/SelcomCallbackController.php` normalizes callbacks.
- `routes/web.php` exposes `/api/payments/selcom/payin-callback` and `/api/payments/selcom/payout-callback`.

Reference package only:

```bash
# Reference only. Do not install unless we intentionally decide to replace SelcomClient.
# composer require selcom/selcom-apigw-client
```

* GitHub Repository: [selcompaytechltd/selcom-apigw-client-php](https://github.com/selcompaytechltd/selcom-apigw-client-php)

---

### Takeer Environment Configuration

Add real values only after Selcom issues credentials. Until then, keep simulation enabled.

```env
SELCOM_GATEWAY_ENABLED=false
LIVE_GATEWAY_CHECKOUT=false
SELCOM_SIMULATE=true
SELCOM_BASE_URL=https://apigw.selcommobile.com
SELCOM_API_KEY=
SELCOM_API_SECRET=
SELCOM_VENDOR=
SELCOM_VENDOR_PIN=
SELCOM_SENDER_ACCOUNT=
SELCOM_SENDER_NAME="${APP_NAME}"
SELCOM_SENDER_MSISDN=
SELCOM_PAYOUT_CALLBACK_URL="${APP_URL}/api/payments/selcom/payout-callback"
```

Registered in `config/services.php`:

```php
'selcom' => [
    'simulate' => env('SELCOM_SIMULATE', true),
    'base_url' => env('SELCOM_BASE_URL', 'https://apigw.selcommobile.com'),
    'api_key' => env('SELCOM_API_KEY'),
    'api_secret' => env('SELCOM_API_SECRET'),
    'vendor' => env('SELCOM_VENDOR'),
    'vendor_pin' => env('SELCOM_VENDOR_PIN'),
    'sender_account' => env('SELCOM_SENDER_ACCOUNT'),
    'sender_name' => env('SELCOM_SENDER_NAME', env('APP_NAME', 'Takeer')),
    'sender_msisdn' => env('SELCOM_SENDER_MSISDN'),
    'callback_url' => env('SELCOM_PAYOUT_CALLBACK_URL'),
],
```

---

## Authentication & Signature Generation

Every API request made to Selcom (GET, POST, or DELETE) must be authenticated using your API Key and API Secret. You must generate a cryptographic signature (Digest) for each request.

### Required HTTP Headers

| Header | Description | Format / Rules |
| :--- | :--- | :--- |
| **Authorization** | Base64-encoded API Key prefixed with `SELCOM` | `SELCOM <Base64(API_KEY)>` |
| **Timestamp** | Datetime in ISO 8601 format. Must match signature generation exactly. | `YYYY-MM-DDThh:mm:ssTZD` (e.g., `2026-06-06T18:30:00+03:00`) |
| **Digest-Method** | Signature algorithm used | `HS256` (HMAC-SHA256) or `RS256` (RSA-SHA256) |
| **Digest** | Base64-encoded signature of request payload | `Base64(HMAC_SHA256(signing_string, API_SECRET))` |
| **Signed-Fields** | Comma-separated list of request payload keys | Case-sensitive list of request body parameters used in signing. |

### Signature Generation Steps

1. **Construct Signing String**: Create a string using the exact format:
   `timestamp=<TIMESTAMP>&field1=value1&field2=value2&...`
   * *Rules*: Fields must follow the exact order listed in your `Signed-Fields` header. The `timestamp` field must always be included first (even though it is not listed in `Signed-Fields`). There must be no extra spaces.
2. **Generate Hash**: Use `HS256` (HMAC-SHA256) with your `API_SECRET` as the key.
3. **Encode to Base64**: Encode the raw binary hash to obtain your final `Digest` value.

---

### Takeer Request Signing

Selcom signing is implemented in `App\Payments\Drivers\Selcom\SelcomClient`. It uses the documented Selcom authentication rules:

- `Authorization: SELCOM <Base64(API_KEY)>`
- ISO-8601 `Timestamp`
- `Digest-Method: HS256`
- `Signed-Fields` in the same order used in the digest
- signing string format: `timestamp=<TIMESTAMP>&field1=value1&field2=value2`

```php
namespace App\Payments\Drivers\Selcom;

use Illuminate\Support\Facades\Http;

class SelcomClient
{
    public function post(string $path, array $payload, array $signedFields)
    {
        return Http::withHeaders($this->headers($payload, $signedFields))
            ->post($this->url($path), $payload);
    }

    private function digest(array $payload, array $signedFields, string $timestamp): string
    {
        $signingParts = ["timestamp={$timestamp}"];
        foreach ($signedFields as $field) {
            $value = data_get($payload, $field, '');
            if (is_array($value)) {
                $value = json_encode($value, JSON_UNESCAPED_SLASHES);
            }
            $signingParts[] = "{$field}={$value}";
        }

        return base64_encode(hash_hmac('sha256', implode('&', $signingParts), $this->apiSecret, true));
    }
}
```

---

### Takeer Checkout Pay-In Flow

Implemented in `SelcomGateway::createPayin()`:

1. Create a minimal Selcom checkout order with `/v1/checkout/create-order-minimal`.
2. Trigger wallet USSD push with `/v1/checkout/wallet-payment`.
3. Wait for `/api/payments/selcom/payin-callback`.
4. `PaymentCallbackProcessor` updates the order and merchant wallet.

```php
$result = app(\App\Payments\Drivers\Selcom\SelcomGateway::class)->createPayin([
    'takeer_reference' => $order->transaction_ref,
    'order_id' => $order->transaction_ref,
    'amount' => $order->customer_total_amount,
    'currency' => $order->customer_currency_code,
    'msisdn' => $order->payment_phone,
    'buyer_email' => $order->buyer?->email,
    'buyer_name' => $order->buyer?->name,
    'buyer_phone' => $order->buyer?->phone_number,
    'webhook' => url('/api/payments/selcom/payin-callback'),
]);
```

---

### Takeer Payout Flow

Implemented in `SelcomPayoutService::submit()` and `SelcomGateway::createPayout()`.

Mobile money payouts use **Wallet Cashin**, not IMT:

- `/v1/walletcashin/process`
- `/v1/walletcashin/query`
- `utilitycode` maps friendly names to Selcom codes:
  - `M-Pesa` -> `VMCASHIN`
  - `Airtel Money` -> `AMCASHIN`
  - `Mixx by Yas` -> `TPCASHIN`
  - `HaloPesa` -> `HPCASHIN`
  - default fallback -> `CASHIN`

Bank payouts use **Qwiksend**:

- `/v1/qwiksend/process`
- `/v1/qwiksend/query`
- `recipientFiCode` maps friendly bank names to Selcom shortcodes:
  - `NMB Bank` -> `NMB`
  - `CRDB Bank` -> `CRDBBANK`
  - `Akiba Commercial Bank` -> `AKIBA`

```php
$result = app(\App\Services\SelcomPayoutService::class)->submit($withdrawal);
```

Simulation mode returns Selcom-shaped responses without moving money:

```json
{
  "simulated": true,
  "provider": "selcom",
  "resultcode": "111",
  "result": "PENDING",
  "message": "Simulated Selcom response. No real money moved."
}
```

---

## Global API Response Format

All responses from Selcom follow a standardized JSON structure.

### Response Scenario Examples

#### 1. Failure Scenario Example
```json
{
  "transid": "F10001",
  "reference": "0289999288",
  "resultcode": "403",
  "result": "FAIL",
  "message": "No response from upstream system",
  "data": []
}
```

#### 2. Success Scenario Example
```json
{
  "transid": "F10002",
  "reference": "0270720833",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Airtime recharge\nReference 0270720833\nPhone 0773820XXX\nAmount TZS 10,000\nVendor XYZVENDOR\n\nPowered by Selcom",
  "data": []
}
```

### Response Status Definitions

| Result | Error Code | Description |
| :--- | :--- | :--- |
| **SUCCESS** | `000` | Transaction was successfully executed. |
| **INPROGRESS**| `111`, `927` | Transaction is currently in progress. Repeat query status checks to determine completion. |
| **AMBIGUOUS** | `999` | Transaction status is unknown. Maintain balance state and wait for resolution/reconciliation. |
| **FAIL** | Any other code | Transaction failed to execute. Check error code details. |

### Handling INPROGRESS and AMBIGUOUS States

When encountering a status response of `INPROGRESS` or `AMBIGUOUS`, implement the following flow:
1. Wait for **3 minutes** before executing any status enquiry.
2. Invoke the corresponding status query API matching your initial transaction method.
3. If the status remains unresolved, repeat queries at 3-minute intervals over a reasonable retry window (e.g., 15 minutes).
4. If the transaction status does not resolve, escalate the case to the Selcom Helpdesk via `helpdesk@selcom.net`.
5. **Important**: Do not immediately re-attempt the request using the same customer details or a different transaction ID to prevent duplicate billing processing.

---

## Utility Payments API

Integrates core functions to validate customer billing/prepaid metrics, request instant credit payments, and check real-time settlement status.

---

### 1. Utility Look Up

Fetches and validates dynamic customer registration information before committing monetary funds. Highly recommended for validating prepaid utility credentials.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/utilitypayment/lookup`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **utilitycode** | Mandatory | `LUKU` | System destination identifier. |
| **utilityref** | Mandatory | `01234567891` | Billing account value reference. |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function lookupUtility(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/utilitypayment/lookup', [
        'utilitycode' => 'LUKU',
        'utilityref' => '6927759116',
        'transid' => '10001'
    ]);

    if ($response->successful()) {
        return response()->json($response->json());
    }

    return response()->json(['error' => 'Lookup failed'], 500);
}
```

#### Lookup Response Examples

##### Prepaid Electricity (LUKU) Lookup Response
```json
{
  "reference": "6927759116",
  "transid": "10001",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "LUKU Confirmation\nFIROZ\nMeter# 4300071XXXX\n",
  "data": [
    {
      "name": "FIROZ MOH"
    }
  ]
}
```

##### Government Payment (GEPG) Lookup Response
```json
{
  "reference": "6927768243",
  "transid": "10001",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "DAWASA\nName MNYANGA\nControl# 99104217XXXX\nTZS 5,000",
  "data": [
    {
      "name": "MNYANGA",
      "amount": "5000",
      "institution": "DAWASA",
      "type": "PART",
      "desc": "Bill Charges 2019-2"
    }
  ]
}
```

---

### 2. Utility Payment Request

Submits a payment request for a specific service provider account after completing validation.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/utilitypayment/process`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |
| **utilitycode** | Mandatory | `LUKU` | Destination provider system key. |
| **utilityref** | Mandatory | `654944949` | Customer utility account/meter number. |
| **amount** | Mandatory | `8000` | Numeric value representing transaction value. |
| **vendor** | Mandatory | `66546846845` | Master float system account identifier. |
| **pin** | Mandatory | `48585` | Numeric float authorization access pin. |
| **msisdn** | Optional | `255055555555`| End-user mobile phone contact reference. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processUtilityPayment(SelcomService $selcom)
{
    $payload = [
        'transid' => '1218d5Qb',
        'utilitycode' => 'LUKU',
        'utilityref' => '654944949',
        'amount' => 8000,
        'vendor' => '66546846845',
        'pin' => '48585',
        'msisdn' => '255055555555',
    ];

    $response = $selcom->send('POST', '/v1/utilitypayment/process', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Query Payment Status

Checks the execution status of a transaction after a timeout or system drift.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/utilitypayment/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `1218d5Qb` | Transaction ID of the target payment request. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryPaymentStatus(SelcomService $selcom, $transId)
{
    $response = $selcom->send('GET', '/v1/utilitypayment/query', [
        'transid' => $transId
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### Status Response Example
```json
{
  "messageId": "20200721001",
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Transaction successful",
  "data": [
    {
      "receipt": "12344"
    }
  ]
}
```

---

### Utility Code Definitions

Use the exact codes below when assigning values to the `utilitycode` parameter.

#### Utility Services
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LUKU** | Meter No | Numeric(11) | `01234567891` | Yes | Prepaid Electricity |
| **TOP** | Mobile No | Numeric(10,12) | `068XXXXXXX` | No | Prepaid Airtime |
| **TUKUZA** | Meter No | Numeric(11,16) | `01234567891` | Yes | Prepaid Electricity |
| **NCARD** | Card No | Numeric(16) | `8888111188881111` | Yes | N-Card Top up |

*Note: NHC and DAWASA payments have migrated to the GEPG system.*

#### Government Bill Payments
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GEPG** | Control No | Numeric(12) | `991234567891` | Yes | Government Bill Payment (inc. DAWASA, NHC, etc.) |
| **ZANMALIPO**| Control No | Numeric(12) | `991234567891` | Yes | Zanzibar Government Bill Payment |

#### TV Subscriptions
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DSTV** | Smartcard No | Numeric(11) | `01234567891` | Yes | DSTV Subscriptions |
| **DSTVBO** | Smartcard No | Numeric(11) | `01234567891` | Yes | DSTV Box Office |
| **AZAMTV** | Smartcard No | Numeric(12) | `012345678912`| Yes | AZAMTV Subscriptions |
| **STARTIMES**| Customer ID / Smartcard | Numeric(10,11) | `01234567891` | Yes | StarTimes Subscriptions |
| **ZUKU** | Account No | Numeric(6) | `012345` | Yes | Zuku Subscriptions |

#### Prepaid Internet Providers
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SMILE** | Account No | Numeric(10) | `01234567891` | Yes | Smile 4G Internet |
| **ZUKUFIBER**| Account No | Numeric(6) | `012345` | Yes | Zuku Fiber Internet |
| **TTCL** | Mobile No | Numeric(10) | `01234567891` | No | TTCL Prepaid and Broadband |

#### Travel & Flight Bookings
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PW** | Booking Ref | Numeric(5-10) | `01234567891` | Yes | Precision Air |
| **COASTAL** | Booking Ref | Numeric(8) | `0123456` | Yes | Coastal Aviation |
| **AURIC** | Booking Ref | Numeric(6) | `012345` | Yes | Auric Air |
| **ATCL** | Booking Ref | AlphaNumeric(6-10) | `2QCD123` | Yes | Air Tanzania |

#### Investment & Pension Funds
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UTT** | Account No | Numeric(9) | `012345678` | Yes | UTT AMIS Scheme Accounts |

#### Unified Merchant Payments (Over 20K Merchants)
| Utilitycode | Ref Label | Ref Type | Ref Example | Lookup Avail | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELCOMPAY**| Account No | AlphaNumeric(6-20) | `01234567891` | Yes | SelcomPay/Masterpass Merchant Payments |

---

## Wallet Cashin API

Allows you to transfer funds directly from your master balance to external mobile money wallets.

---

### 1. Wallet Cashin Name Look Up

Fetches and validates the wallet owner's registered name before initiating a cash-in transaction.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/walletcashin/namelookup`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **utilitycode** | Mandatory | `VMCASHIN` | Target mobile carrier system code. |
| **utilityref** | Mandatory | `25575XXXXXXXXX`| Target customer wallet mobile number. |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function lookupWalletName(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/walletcashin/namelookup', [
        'utilitycode' => 'VMCASHIN',
        'utilityref' => '255754000000',
        'transid' => '1218d5Qb'
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 2. Cashin Request

Initiates a direct balance disbursement to a mobile wallet account.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/walletcashin/process`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |
| **utilitycode** | Mandatory | `VMCASHIN` | Code representing the destination carrier. |
| **utilityref** | Mandatory | `075XXXXXXX` | Recipient customer wallet mobile number. |
| **amount** | Mandatory | `8000` | Numeric value of the transfer amount. |
| **vendor** | Mandatory | `64654949` | Master float system account identifier. |
| **pin** | Mandatory | `3545846` | Numeric float authorization access pin. |
| **msisdn** | Optional | `01854595959` | Sender or system initiator mobile number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processWalletCashin(SelcomService $selcom)
{
    $payload = [
        'transid' => '1218d5Qb',
        'utilitycode' => 'VMCASHIN',
        'utilityref' => '0754000000',
        'amount' => 8000,
        'vendor' => '64654949',
        'pin' => '3545846',
        'msisdn' => '01854595959',
    ];

    $response = $selcom->send('POST', '/v1/walletcashin/process', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Query Transaction Status

Checks the execution status of a wallet cash-in request.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/walletcashin/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Original system transaction reference string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryWalletCashinStatus(SelcomService $selcom, $transId)
{
    $response = $selcom->send('GET', '/v1/walletcashin/query', [
        'transid' => $transId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### Carrier Wallet Utility Codes

| Utilitycode | Ref Type | Ref Example | Lookup Avail | Carrier Description |
| :--- | :--- | :--- | :--- | :--- |
| **VMCASHIN** | Numeric(10,12) | `076XXXXXXX` | No | Vodacom M-Pesa |
| **AMCASHIN** | Numeric(10,12) | `068XXXXXXX` | Yes | Airtel Money |
| **TPCASHIN** | Numeric(10,12) | `065XXXXXXX` | Yes | Mixx by Yas (Tigo Pesa) |
| **EZCASHIN** | Numeric(10,12) | `077XXXXXXX` | Yes | EzyPesa |
| **HPCASHIN** | Numeric(10,12) | `062XXXXXXX` | Yes | HaloPesa |
| **TTCASHIN** | Numeric(10,12) | `073XXXXXXX` | Yes | TTCL Pesa |
| **CASHIN** | Numeric(10,12) | `073XXXXXXX` | Yes | Automated routing based on MNP Lookup |

---

## Selcom Pesa API

Provides endpoints to transfer funds directly to a Selcom Pesa account using either a mobile carrier contact number or a specific account card number.

---

### 1. Selcom Pesa Name Look Up

Resolves and validates a Selcom Pesa recipient's registration name.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/selcompesa/namelookup`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **utilityref** | Mandatory | `0149449499` | Target Selcom Pesa account or mobile number. |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function lookupSelcomPesaName(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/selcompesa/namelookup', [
        'utilityref' => '0149449499',
        'transid' => '1218d5Qb'
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 2. Selcom Pesa Cashin Request

Transfers funds to a Selcom Pesa wallet recipient.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/selcompesa/cashin`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |
| **utilityref**| Mandatory | `075XXXXXXX` | Destination Selcom Pesa account or mobile number. |
| **utilitycode**| Static | `SPSCASHIN` | System routing identifier code. |
| **amount** | Mandatory | `8000` | Numeric value representing the transfer amount. |
| **vendor** | Mandatory | `64654949` | Master float system account identifier. |
| **pin** | Mandatory | `3545846` | Numeric float authorization access pin. |
| **msisdn** | Optional | `01854595959` | Sender's mobile number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processSelcomPesaCashin(SelcomService $selcom)
{
    $payload = [
        'transid' => '1218d5Qb',
        'utilityref' => '0754000000',
        'utilitycode' => 'SPSCASHIN',
        'amount' => 8000,
        'vendor' => '64654949',
        'pin' => '3545846',
        'msisdn' => '01854595959'
    ];

    $response = $selcom->send('POST', '/v1/selcompesa/cashin', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Selcom Pesa Query Transaction Status

Checks the status of a Selcom Pesa cash-in request.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/selcompesa/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Original system transaction reference string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function querySelcomPesaStatus(SelcomService $selcom, $transId)
{
    $response = $selcom->send('GET', '/v1/selcompesa/query', [
        'transid' => $transId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

## POS/Agent Cashout API

Allows third-party systems to send voucher/withdrawal codes to users. The funds are reserved in a temporary system wallet. The customer can cash out these funds at any Selcom Huduma agent by dialing `*150*50#` and entering the agent code and amount.

---

### 1. Agent Cashout Process

* **HTTP Method**: `POST`
* **Route Path**: `/v1/hudumacashin/process`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |
| **utilitycode** | Mandatory | `HUDUMACI` | Static cash-out system value. |
| **utilityref** | Mandatory | `075XXXXXXX` | Recipient's mobile number. |
| **amount** | Mandatory | `8000` | Numeric value representing the withdrawal amount. |
| **vendor** | Mandatory | `VENDORXYZ` | System identifier for the master float account. |
| **pin** | Mandatory | `3122` | Numeric float authorization access pin. |
| **name** | Optional | `John Mushi` | Full name of the recipient customer. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processAgentCashout(SelcomService $selcom)
{
    $payload = [
        'transid' => '1218d5Qb',
        'utilitycode' => 'HUDUMACI',
        'utilityref' => '0754000000',
        'amount' => 8000,
        'vendor' => 'VENDORXYZ',
        'pin' => '3122',
        'name' => 'John Mushi'
    ];

    $response = $selcom->send('POST', '/v1/hudumacashin/process', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Cashout Response Example
```json
{
  "reference": "6927759116",
  "transid": "10001",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "0312332222 Confirmed. You have received TZS 1,000 from VENDORXYZ. Dial *150*50# choose Selcom Huduma Cashout to cashout at any Selcom Huduma agent.",
  "data": []
}
```

---

### 2. POS/Agent Cashout Transaction Status Query

* **HTTP Method**: `GET`
* **Route Path**: `/v1/hudumacashin/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Original system transaction reference string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryAgentCashoutStatus(SelcomService $selcom, $transId)
{
    $response = $selcom->send('GET', '/v1/hudumacashin/query', [
        'transid' => $transId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

## Float Account Management

Checks the current balance of your master system float account.

---

### Get Float Balance

* **HTTP Method**: `POST`
* **Route Path**: `/v1/vendor/balance`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **vendor** | Mandatory | `12186889` | Vendor/Merchant float ID allocated by Selcom. |
| **pin** | Mandatory | `123456` | Numeric float authorization access pin. |
| **transid**| Mandatory | `001` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function checkFloatBalance(SelcomService $selcom)
{
    $payload = [
        'vendor' => '12186889',
        'pin' => '123456',
        'transid' => '001'
    ];

    $response = $selcom->send('POST', '/v1/vendor/balance', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Balance Response Example
```json
{
  "reference": "6927759116",
  "transid": "10001",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Balance successful",
  "data": [
    {
      "balance": "1000000"
    }
  ]
}
```

---

## C2B/Collection Services (Push USSD & Pull API)

Real-time processing framework that manages customer-to-business (C2B) payments made to your platform from various sources, including mobile wallets, banking channels, and physical agent networks.

---

### 1. Bearer Authentication Requirements

All inbound requests received from Selcom to your platform's integration controllers must include a dynamic bearer authentication header token. This token is defined and assigned by your platform.

* Example Header: `Authorization: Bearer your_predefined_api_bearer_token_here`

---

### 2. Payment Lookup

Inbound check received from Selcom to your application's lookup route to verify account references before a payment is committed.

* **Inbound Route Pattern**: `POST /lookup` (To be implemented in your Laravel routes)

#### Incoming Request Parameters
| Parameter | Example | Description |
| :--- | :--- | :--- |
| **operator** | `AIRTELMONEY` | Originating carrier value code (`MPESA-TZ`, `TIGOPESATZ`, `AIRTELMONEY`, `HALOPESATZ`, `TTCLMOBILE`, `ZANTELEZPESA`). |
| **transid** | `XYZ123444` | Unique channel transaction tracing reference string. |
| **reference** | `033XX12211` | Unique Selcom tracking reference string. |
| **utilityref**| `AB12345` | Payment identifier value input by the customer. |
| **msisdn** | `06534567891` | Paying customer's mobile number. |

#### Expected Response Format
Return this JSON format back to the Selcom Gateway:
```json
{
  "reference": "033XX12211",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Verification approved",
  "name": "Firoz Mushi",
  "amount": "10000"
}
```

---

### 3. Payment Validation

Inbound request received from Selcom to validate transaction metrics (e.g., matching invoice amounts) before executing a charge request. 

*If your platform returns an error or fails to respond within the timeout window, Selcom will automatically reverse the customer's funds.*

* **Inbound Route Pattern**: `POST /validation`

#### Incoming Request Parameters
| Parameter | Example | Description |
| :--- | :--- | :--- |
| **operator** | `AIRTELMONEY` | Originating carrier value code. |
| **transid** | `XYZ123444` | Unique channel transaction tracing reference string. |
| **reference** | `033XX12211` | Unique Selcom tracking reference string. |
| **utilityref**| `AB12345` | Customer-entered payment reference. |
| **amount** | `1000` | Numeric value representing the payment amount. |
| **msisdn** | `06534567891` | Paying customer's mobile number. |

#### Expected Response Format
Return this JSON format back to the Selcom Gateway:
```json
{
  "reference": "033XX12211",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Validation Approved",
  "name": "Firoz Mushi"
}
```

---

### 4. Payment Notification

Inbound call received from Selcom to notify your platform of a successful charge transaction after the validation step has passed.

*Note: If your system fails to respond to this notification or encounters a timeout, Selcom will **not** reverse the funds. The transaction will be marked as ambiguous for manual reconciliation.*

* **Inbound Route Pattern**: `POST /notification`

#### Incoming Request Parameters
Matches the validation payload structure:
| Parameter | Example | Description |
| :--- | :--- | :--- |
| **operator** | `AIRTELMONEY` | Originating carrier value code. |
| **transid** | `XYZ123444` | Unique channel transaction tracing reference string. |
| **reference** | `033XX12211` | Unique Selcom tracking reference string. |
| **utilityref**| `AB12345` | Customer-entered payment reference. |
| **amount** | `1000` | Numeric value representing the payment amount. |
| **msisdn** | `06534567891` | Paying customer's mobile number. |

#### Expected Response Format
Return this JSON format back to the Selcom Gateway:
```json
{
  "reference": "033XX12211",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Receipt Processed Successfully"
}
```

---

### 5. Laravel Controller Example for Inbound Collection Services

This sample controller implements the required lookup, validation, and notification handlers for your Laravel application:

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SelcomC2BController extends Controller
{
    /**
     * Middleware check to validate the Bearer token assigned in the route definition.
     */
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $token = $request->bearerToken();
            if ($token !== config('services.selcom.c2b_token')) {
                return response()->json([
                    'result' => 'FAIL',
                    'resultcode' => '401',
                    'message' => 'Unauthorized entry'
                ], 401);
            }
            return $next($request);
        });
    }

    public function handleLookup(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|string',
            'utilityref' => 'required|string',
        ]);

        // Logic check: Validate account existence
        $accountExists = true; // Replace with database query
        
        if (!$accountExists) {
            return response()->json([
                'reference' => $request->reference,
                'resultcode' => '010', // Invalid reference code
                'result' => 'FAIL',
                'message' => 'The provided account reference is invalid.'
            ]);
        }

        return response()->json([
            'reference' => $request->reference,
            'resultcode' => '000',
            'result' => 'SUCCESS',
            'message' => 'Account lookup successful',
            'name' => 'Firoz Mushi'
        ]);
    }

    public function handleValidation(Request $request)
    {
        // Execute validation checks (e.g., limit controls, invoice status matching)
        return response()->json([
            'reference' => $request->reference,
            'resultcode' => '000',
            'result' => 'SUCCESS',
            'message' => 'Validation approved',
            'name' => 'Firoz Mushi'
        ]);
    }

    public function handleNotification(Request $request)
    {
        // Credit the customer's account in your database
        return response()->json([
            'reference' => $request->reference,
            'resultcode' => '000',
            'result' => 'SUCCESS',
            'message' => 'Notification processed successfully'
        ]);
    }
}
```

#### System Error Code Mapping for your Response
Return these codes in your system's JSON response when handling Lookup, Validation, or Notification requests:

| Error Code | Meaning |
| :--- | :--- |
| `000` | Process Success. |
| `010` | Invalid account or payment reference (`utilityref`). |
| `012` | Invalid amount. |
| `014` | Amount exceeds the allowed transaction limit. |
| `015` | Amount is below the minimum allowed limit. |
| `4XX` | General system execution failure. |

---

### 6. Wallet Pull Funds (Push USSD)

Sends a push USSD notification to a customer's phone, requesting their mobile wallet PIN to authorize a real-time debit transaction.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/wallet/pushussd`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |
| **utilityref** | Mandatory | `AB12345` | Payment identifier or account number to credit. |
| **amount** | Mandatory | `1000` | Numeric value representing the payment amount. |
| **vendor** | Mandatory | `01234567891` | Master float system account identifier. |
| **msisdn** | Mandatory | `06534567891` | Paying customer's mobile wallet number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function triggerPushUssd(SelcomService $selcom)
{
    $payload = [
        'transid' => 'XYZ123444',
        'utilityref' => 'AB12345',
        'amount' => 1000,
        'vendor' => '01234567891',
        'msisdn' => '06534567891'
    ];

    $response = $selcom->send('POST', '/v1/wallet/pushussd', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 7. Query C2B Transaction Status

Checks the execution status of a payment collection transaction.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/c2b/query-status`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Conditional | `XYZ123444` | Original system transaction reference string (Optional if `reference` is used). |
| **reference** | Conditional | `XYZ123444` | Selcom gateway reference string (Optional if `transid` is used). |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryC2BStatus(SelcomService $selcom, Request $request)
{
    $response = $selcom->send('GET', '/v1/c2b/query-status', [
        'transid' => $request->query('transid'),
        'reference' => $request->query('reference'),
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### Status Response Example
```json
{
  "reference": "6927759116",
  "transid": "10001",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "   | COMPLETE | CONFIRMED | Payment successful\nUtility 255620685292\nAmt TZS 15,000\nTransID NBCBULK-0000024388-154\nReference 0406046312\n#RunsOnSelcom",
  "data": []
}
```

---

## Qwiksend API (Bank Disbursements)

Provides endpoints to transfer funds directly to any commercial bank account in Tanzania.

---

### 1. Bank Account Name Lookup

Resolves and validates a bank account number's registered owner name before executing a transfer.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/qwiksend/lookup/`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **bank** | Mandatory | `AKIBA` | Target destination bank shortcode. |
| **account** | Mandatory | `000000040000`| Destination bank account number. |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function lookupBankAccount(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/qwiksend/lookup/', [
        'bank' => 'AKIBA',
        'account' => '000000040000',
        'transid' => '1218d5Qb'
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 2. Bank Transfer

Executes a balance disbursement to a verified bank account.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/qwiksend/process`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `1218d5Qb` | Unique tracking sequence string. |
| **recipientFiCode**| Mandatory | `AKIBA` | Destination bank shortcode. |
| **recipientAccount**| Mandatory | `000000040000`| Recipient's bank account number. |
| **recipientName**| Mandatory | `Jon Jon` | Recipient account's registered full name. |
| **senderAccount**| Mandatory | `3545846654` | Sender's wallet or source account ID. |
| **senderName** | Mandatory | `Jil Jill` | Sender account's registered full name. |
| **amount** | Mandatory | `8000` | Numeric value representing the transfer value. |
| **vendor** | Mandatory | `3545846` | Float system provider identification code. |
| **pin** | Mandatory | `09959` | Numeric float authorization access pin. |
| **msisdn** | Mandatory | `0101855855` | Sender's mobile number. |
| **purpose** | Mandatory | `GIFT` | Code representing transaction purpose. |
| **remarks** | Optional | `None` | Custom transaction memo description string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processBankTransfer(SelcomService $selcom)
{
    $payload = [
        'transid' => '1218d5Qb',
        'recipientFiCode' => 'AKIBA',
        'recipientAccount' => '000000040000',
        'recipientName' => 'Jon Jon',
        'senderAccount' => '3545846654',
        'senderName' => 'Jil Jill',
        'amount' => 8000,
        'vendor' => '3545846',
        'pin' => '09959',
        'msisdn' => '0101855855',
        'purpose' => 'GIFT',
        'remarks' => 'Birthday Gift'
    ];

    $response = $selcom->send('POST', '/v1/qwiksend/process', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Query Transaction Status Qwiksend

Checks the execution status of a bank transfer request.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/qwiksend/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `XYZ123444` | Original system transaction reference string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryQwiksendStatus(SelcomService $selcom, $transId)
{
    $response = $selcom->send('GET', '/v1/qwiksend/query', [
        'transid' => $transId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### Target Bank Shortcodes

Use the exact shortcode keys below when assigning values to the `recipientFiCode` or `bank` parameters:

| Bank Name | Name Lookup Support | recipientFiCode / Bank Code |
| :--- | :--- | :--- |
| **ABSA Bank** | Yes | `ABSA` |
| **Selcom Microfinance Bank / Selcom Pesa** | Yes | `SPSCASHIN` |
| **Akiba Commercial Bank** | Yes | `AKIBA` |
| **Amana Bank** | Yes | `AMANABANK` |
| **Azania Bancorp Bank** | Yes | `AZANIA` |
| **Access Bank Tanzania** | Yes | `BANCABC` |
| **Bank of Africa (Tanzania) Ltd** | Yes | `BOA` |
| **Bank of Baroda (T) Ltd** | Yes | `BANKOFBARODA` |
| **Bank of India (T) Ltd** | Yes | `BANKOFINDIA` |
| **China Dasheng Bank Ltd** | Yes | `CHINADASHENG` |
| **Citibank Tanzania Limited** | Yes | `CITIBANK` |
| **CRDB Bank Limited** | Yes | `CRDBBANK` |
| **DCB Commercial Bank** | Yes | `DCBBANK` |
| **Diamond Trust Bank** | Yes | `DTB` |
| **Ecobank Tanzania Ltd** | Yes | `ECOBANK` |
| **Equity Bank (T) Ltd** | Yes | `EQUITYBANK` |
| **Exim Bank** | Yes | `EXIMBANK` |
| **Finca Microfinance Bank** | Yes | `FINCA` |
| **Guaranty Trust Bank Tanzania Ltd** | Yes | `GTBANK` |
| **Habib African Bank** | Yes | `HABIBBANK` |
| **I&M Bank (T) Ltd** | Yes | `IMBANK` |
| **International Commercial Bank (T)** | Yes | `ICB` |
| **KCB Bank Tanzania Limited** | Yes | `KCB` |
| **Coop Bank Tanzania** | Yes | `KILIMANJARO` |
| **Letshego Bank Tanzania Ltd** | Yes | `LETSHEGO` |
| **Maendeleo Bank** | Yes | `MAENDELEO` |
| **Mkombozi Commercial Bank Public Ltd** | Yes | `MKOMBOZI` |
| **Mwalimu Commercial Bank of Tanzania** | Yes | `MWALIMU` |
| **Mwanga Hakika Microfinance Bank** | Yes | `MWANGA` |
| **National Microfinance Bank (NMB)** | Yes | `NMB` |
| **NBC Limited** | Yes | `NBC` |
| **NCBA Bank Tanzania Ltd** | Yes | `NCBA` |
| **People's Bank of Zanzibar** | Yes | `PBZ` |
| **Stanbic Bank Tanzania** | Yes | `STANBIC` |
| **Tanzania Commercial Bank PLC** | Yes | `TCB` |
| **Uchumi Commercial Bank** | Yes | `UCHUMI` |
| **United Bank for Africa** | Yes | `UBA` |

---

## Virtual Card Network (VCN) API

Provides endpoints to issue, display, suspend, and manage transaction limits for Virtual Visa and Mastercard accounts.

---

### 1. Create VCN

Issues a new virtual Mastercard or Visa account for a customer.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/vcn/create`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `255781234567` | Customer mobile number (international format). |
| **account** | Mandatory | `013222244` | Funding account/wallet number. |
| **first_name** | Mandatory | `ROBERT` | Recipient's first name. |
| **last_name** | Mandatory | `MUSHI` | Recipient's last name. |
| **middle_name** | Optional | `E` | Recipient's middle name. |
| **gender** | Mandatory | `MALE` | `MALE` or `FEMALE`. |
| **dob** | Mandatory | `11071987` | Date of Birth (`DDMMYYYY` format). |
| **address** | Mandatory | `Mktaba St, Upanga`| Street address details. |
| **city** | Mandatory | `Dar es Salaam` | Residential city location. |
| **region** | Optional | `Dar es Salaam` | Residential region. |
| **nationality**| Mandatory | `Tanzanian` | Nationality designation. |
| **validity** | Optional | `12` | VCN validity in months (`6`, `12`, or `24`. Default `24`). |
| **email** | Optional | `test@example.com`| Customer email address. |
| **language** | Optional | `sw` | SMS language preference (`en` or `sw`). |
| **marital_status**| Optional | `SINGLE` | `SINGLE`, `MARRIED`, `DIVORCED`, or `WIDOW`. |
| **maiden_name** | Optional | `EPHRAIM` | Mother's maiden name. |
| **vendor** | Mandatory | `XYZBANK` | System identifier for the master float account. |
| **pin** | Mandatory | `4321` | Numeric float authorization access pin. |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |
| **product_code**| Optional | `AAVCN001` | Static product code assigned by issuer. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function issueVcn(SelcomService $selcom)
{
    $payload = [
        'msisdn' => '255781234567',
        'account' => '013222244',
        'first_name' => 'ROBERT',
        'last_name' => 'MUSHI',
        'middle_name' => 'E',
        'gender' => 'MALE',
        'dob' => '11071987',
        'address' => 'Mktaba St, Upanga',
        'city' => 'Dar es Salaam',
        'region' => 'Dar es Salaam',
        'nationality' => 'Tanzanian',
        'validity' => '12',
        'email' => 'test@example.com',
        'language' => 'sw',
        'marital_status' => 'SINGLE',
        'maiden_name' => 'EPHRAIM',
        'vendor' => 'XYZBANK',
        'pin' => '4321',
        'transid' => 'XYZ123444',
        'product_code' => 'AAVCN001'
    ];

    $response = $selcom->send('POST', '/v1/vcn/create', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Issuance Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "VCN creation success",
  "data": {
    "card_id": "0000021111",
    "masked_card": "533322******0320",
    "card_url": "dfnldafalnfalnalfnaln"
  }
}
```

---

### 2. Create VCN Status Enquiry

Checks the status of a card issuance request. This request does not trigger an SMS notification to the customer.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/vcn/create-status-enquiry`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `25577XXXXXXXX`| Customer mobile number used during registration. |
| **transid** | Mandatory | `T1000932222` | Unique tracking sequence string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function checkVcnIssuanceStatus(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/vcn/create-status-enquiry', [
        'msisdn' => '255770000000',
        'transid' => 'T1000932222'
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Change Card Status (Block/Unblock/Suspend)

Updates a card's active state. Note: Suspending a card (`SUSPEND`) permanently ends its life cycle.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/vcn/changestatus`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `255781234567` | Customer mobile number used during registration. |
| **account** | Mandatory | `T1000932222` | Associated VCN account ID. |
| **status** | Mandatory | `BLOCK` | Target state (`BLOCK`, `UNBLOCK`, or `SUSPEND`). |
| **remarks** | Optional | `LOST` | Reason for updating the card status. |
| **card_id** | Optional | `0113322` | Unique system card ID. |
| **requestid** | Mandatory | `XYZ123444` | Tracking request ID string. |
| **language** | Optional | `SW` | SMS language preference (`EN` or `SW`). |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function updateVcnStatus(SelcomService $selcom)
{
    $payload = [
        'msisdn' => '255781234567',
        'account' => 'T1000932222',
        'status' => 'BLOCK',
        'remarks' => 'LOST',
        'card_id' => '0113322',
        'requestid' => 'XYZ123444',
        'language' => 'SW'
    ];

    $response = $selcom->send('POST', '/v1/vcn/changestatus', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Status Change Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "VCN status change successful",
  "data": {
    "new_status": "BLOCKED"
  }
}
```

---

### 4. Show Card Secure Web Link

Sends a secure URL to the customer via SMS, allowing them to view sensitive card credentials (PAN, CVV, Expiry Date).

* **HTTP Method**: `POST`
* **Route Path**: `/v1/vcn/show`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `255781234567` | Customer mobile number used during registration. |
| **account** | Mandatory | `T1000932222` | Associated VCN account ID. |
| **card_id** | Optional | `0113322` | Unique system card ID. |
| **requestid** | Mandatory | `XYZ123444` | Tracking request ID string. |
| **language** | Optional | `SW` | SMS language preference (`EN` or `SW`). |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function sendVcnViewLink(SelcomService $selcom)
{
    $payload = [
        'msisdn' => '255781234567',
        'account' => 'T1000932222',
        'card_id' => '0113322',
        'requestid' => 'XYZ123444',
        'language' => 'SW'
    ];

    $response = $selcom->send('POST', '/v1/vcn/show', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 5. Get Card Status

Checks a card's current active state. This request does not trigger an SMS notification to the customer.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/vcn/status`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `25577XXXXXXXX`| Customer mobile number used during registration. |
| **account** | Mandatory | `T1000932222` | Associated VCN account ID. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function queryVcnStatus(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/vcn/status', [
        'msisdn' => '255770000000',
        'account' => 'T1000932222'
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### Status Fetch Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "VCN status fetch successful",
  "data": [
    {
      "masked_card": "512342XXXXXX1234",
      "status": "UNBLOCKED"
    }
  ]
}
```

---

### 6. Set Transaction Limit

Sets e-commerce transaction limits for a virtual card.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/vcn/set-limit`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **msisdn** | Mandatory | `255781234567` | Customer mobile number used during registration. |
| **account** | Mandatory | `T1000932222` | Associated VCN account ID. |
| **limit_amount**| Mandatory | `100000` | Numeric value representing the limit value. |
| **limit_type** | Mandatory | `MONTHLY` | Limit period type (`DAILY`, `MONTHLY`, or `TRANSACTION`). |
| **card_id** | Optional | `0113322` | Unique system card ID. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function setVcnLimits(SelcomService $selcom)
{
    $payload = [
        'msisdn' => '255781234567',
        'account' => 'T1000932222',
        'limit_amount' => 100000,
        'limit_type' => 'MONTHLY',
        'card_id' => '0113322'
    ];

    $response = $selcom->send('POST', '/v1/vcn/set-limit', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

## Checkout & E-Commerce API

Integrates support for card payments (Visa, Mastercard, Amex), mobile wallet USSD push, and secondary till aliases.

*Note: All redirection and callback URLs in payment payloads must be Base64-encoded.*

---

### 1. Create Order

Initializes a payment order and generates checkout assets (e.g., redirect URL, token, QR codes).

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/create-order`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **vendor** | Mandatory | `SHOP203` | Merchant ID allocated by Selcom. |
| **order_id** | Mandatory | `123` | Unique merchant order reference. |
| **buyer_email** | Mandatory | `buyer@example.com`| Customer email address. |
| **buyer_name** | Mandatory | `Joe John` | Customer full name. |
| **buyer_userid** | Optional | `joejohn20` | Customer ID (use empty string for guests). |
| **buyer_phone** | Mandatory | `255781234000` | Customer mobile number. |
| **gateway_buyer_uuid**| Optional| `A1233232` | Stored card token generated on first purchase. |
| **amount** | Mandatory | `5000` | Total order amount value. |
| **currency** | Mandatory | `TZS` | ISO Currency code (`TZS` or `USD`). |
| **payment_methods**| Mandatory | `ALL` | Comma-separated list (`ALL`, `MASTERPASS`, `CARD`, `MOBILEMONEYPULL`). |
| **redirect_url** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded success redirect URL. |
| **cancel_url** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded cancellation redirect URL. |
| **webhook** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded payment notification webhook URL. |
| **billing.firstname**| Mandatory| `Joe` | Billing address first name. |
| **billing.lastname**| Mandatory| `John` | Billing address last name. |
| **billing.address_1**| Mandatory| `23, Street X` | Billing address line 1. |
| **billing.address_2**| Optional | `Upanga Area` | Billing address line 2. |
| **billing.city** | Mandatory | `Dar es Salaam` | Billing address city. |
| **billing.state_or_region**| Mandatory| `Dar es Salaam`| Billing address region. |
| **billing.postcode_or_pobox**| Mandatory| `43434` | Billing address postal code/P.O. Box. |
| **billing.country**| Mandatory| `TZ` | ISO country code. |
| **billing.phone** | Mandatory | `255781234000` | Billing address contact number. |
| **shipping.firstname**| Optional | `Joe` | Shipping address first name. |
| **shipping.lastname**| Optional | `John` | Shipping address last name. |
| **shipping.address_1**| Optional | `23, Street X` | Shipping address line 1. |
| **shipping.address_2**| Optional | `Upanga Area` | Shipping address line 2. |
| **shipping.city** | Optional | `Dar es Salaam` | Shipping address city. |
| **shipping.state_or_region**| Optional| `Dar es Salaam`| Shipping address region. |
| **shipping.postcode_or_pobox**| Optional| `43434` | Shipping address postal code/P.O. Box. |
| **shipping.country**| Optional | `TZ` | ISO country code. |
| **shipping.phone** | Optional | `255781234000` | Shipping address contact number. |
| **buyer_remarks** | Optional | `Payer note` | Custom buyer notes/remarks. |
| **merchant_remarks**| Optional | `Merchant note` | Custom merchant notes/remarks. |
| **no_of_items** | Mandatory | `3` | Total item count in order. |
| **header_colour** | Optional | `#FF0012` | Gateway page header hex color code. |
| **link_colour** | Optional | `#FF0012` | Gateway page link text hex color code. |
| **button_colour** | Optional | `#FF0012` | Gateway page button hex color code. |
| **expiry** | Optional | `60` | Order expiration limit in minutes. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function generateOrder(SelcomService $selcom)
{
    $payload = [
        'vendor' => 'SHOP203',
        'order_id' => 'Order-' . uniqid(),
        'buyer_email' => 'customer@example.com',
        'buyer_name' => 'Joe John',
        'buyer_userid' => 'user-102',
        'buyer_phone' => '255781234000',
        'gateway_buyer_uuid' => '',
        'amount' => 5000,
        'currency' => 'TZS',
        'payment_methods' => 'ALL',
        'redirect_url' => base64_encode('https://yourdomain.com/checkout/success'),
        'cancel_url' => base64_encode('https://yourdomain.com/checkout/cancel'),
        'webhook' => base64_encode('https://yourdomain.com/api/webhooks/selcom'),
        'billing' => [
            'firstname' => 'Joe',
            'lastname' => 'John',
            'address_1' => '23, street X',
            'address_2' => 'Upanga Area',
            'city' => 'Dar es Salaam',
            'state_or_region' => 'Dar es Salaam',
            'postcode_or_pobox' => '43434',
            'country' => 'TZ',
            'phone' => '255781234000'
        ],
        'shipping' => [
            'firstname' => 'Joe',
            'lastname' => 'John',
            'address_1' => '23, street X',
            'address_2' => 'Upanga Area',
            'city' => 'Dar es Salaam',
            'state_or_region' => 'Dar es Salaam',
            'postcode_or_pobox' => '43434',
            'country' => 'TZ',
            'phone' => '255781234000'
        ],
        'buyer_remarks' => 'Order purchase',
        'merchant_remarks' => 'Internal processing',
        'no_of_items' => 1
    ];

    $response = $selcom->send('POST', '/v1/checkout/create-order', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Order Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Payment notification logged",
  "data": [
    {
      "gateway_buyer_uuid": "12344321",
      "payment_token": "80008000",
      "qr": "QR_CODE_DATA_STRING",
      "payment_gateway_url": "https://api.selcommobile.com/pay/secured_page_uri"
    }
  ]
}
```

---

### 2. Create Order - Minimal (Mobile Wallet Direct Redirection Only)

Generates a payment order for mobile wallets. This endpoint does **not** support card processing or display card payment methods.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/create-order-minimal`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **vendor** | Mandatory | `SHOP203` | Merchant ID allocated by Selcom. |
| **order_id** | Mandatory | `123` | Unique merchant order reference. |
| **buyer_email** | Mandatory | `customer@example.com`| Customer email address. |
| **buyer_name** | Mandatory | `Joe John` | Customer full name. |
| **buyer_phone** | Mandatory | `255781234000` | Customer mobile number. |
| **amount** | Mandatory | `5000` | Total order amount value. |
| **currency** | Mandatory | `TZS` | ISO Currency code (`TZS` or `USD`). |
| **redirect_url** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded success redirect URL. |
| **cancel_url** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded cancellation redirect URL. |
| **webhook** | Optional | `aHR0cDovL3VybC5jb20=`| Base64-encoded payment notification webhook URL. |
| **buyer_remarks** | Optional | `Payer note` | Custom buyer notes/remarks. |
| **merchant_remarks**| Optional | `Merchant note` | Custom merchant notes/remarks. |
| **no_of_items** | Mandatory | `1` | Total item count in order. |
| **expiry** | Optional | `60` | Order expiration limit in minutes. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function generateMinimalOrder(SelcomService $selcom)
{
    $payload = [
        'vendor' => 'SHOP203',
        'order_id' => 'Min-Order-' . uniqid(),
        'buyer_email' => 'customer@example.com',
        'buyer_name' => 'Joe John',
        'buyer_phone' => '255781234000',
        'amount' => 5000,
        'currency' => 'TZS',
        'redirect_url' => base64_encode('https://yourdomain.com/checkout/success'),
        'cancel_url' => base64_encode('https://yourdomain.com/checkout/cancel'),
        'webhook' => base64_encode('https://yourdomain.com/api/webhooks/selcom'),
        'buyer_remarks' => 'Minimal order',
        'merchant_remarks' => 'Direct wallet pull',
        'no_of_items' => 1
    ];

    $response = $selcom->send('POST', '/v1/checkout/create-order-minimal', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 3. Cancel Order

Cancels a pending order before payment is completed. Complete or expired orders cannot be cancelled.

* **HTTP Method**: `DELETE`
* **Route Path**: `/v1/checkout/cancel-order`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **order_id** | Mandatory | `123` | Original merchant order reference ID. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function cancelOrder(SelcomService $selcom, $orderId)
{
    $response = $selcom->send('DELETE', '/v1/checkout/cancel-order', [
        'order_id' => $orderId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 4. Get Order Status

* **HTTP Method**: `GET`
* **Route Path**: `/v1/checkout/order-status`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **order_id** | Mandatory | `123` | Original merchant order reference ID. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function checkOrderStatus(SelcomService $selcom, $orderId)
{
    $response = $selcom->send('GET', '/v1/checkout/order-status', [
        'order_id' => $orderId
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### Order Status Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Order fetch successful",
  "data": [
    {
      "order_id": "123",
      "creation_date": "2026-06-06 22:00:00",
      "amount": "1000",
      "payment_status": "PENDING",
      "transid": null,
      "channel": null,
      "reference": null,
      "phone": null
    }
  ]
}
```

#### Status Parameter Mapping
* **payment_status**: Target state (`PENDING`, `COMPLETED`, `CANCELLED`, `USERCANCELLED`, `REJECTED`, or `INPROGRESS`).
* **transid**: Payment provider transaction reference ID (available only for `COMPLETED` orders).
* **channel**: Target provider used (e.g., `AIRTELMONEY`, `MASTERCARD`).

---

### 5. List All Orders

Retrieves checkout orders registered within a specific date range.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/checkout/list-orders`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **fromdate** | Mandatory | `2026-06-01` | Starting date filter (`YYYY-MM-DD` format). |
| **todate** | Mandatory | `2026-06-06` | Ending date filter (`YYYY-MM-DD` format). |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function listOrders(SelcomService $selcom, Request $request)
{
    $response = $selcom->send('GET', '/v1/checkout/list-orders', [
        'fromdate' => $request->query('fromdate'),
        'todate' => $request->query('todate')
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 6. Fetch Stored Card Tokens

Retrieves dynamic card tokens associated with a verified customer account.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/checkout/stored-cards`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **buyer_userid** | Mandatory | `user-102` | Customer identification ID. |
| **gateway_buyer_uuid**| Mandatory | `124343434` | Gateway customer key assigned by Selcom. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function getSavedCards(SelcomService $selcom)
{
    $response = $selcom->send('GET', '/v1/checkout/stored-cards', [
        'buyer_userid' => 'user-102',
        'gateway_buyer_uuid' => '12344321'
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### Saved Cards Response Example
```json
{
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Order fetch successful",
  "data": [
    {
      "masked_card": "5555-12XX-XXXX-1234",
      "creation_date": "2026-06-06 22:00:00",
      "card_token": "ABC123423232",
      "name": "JOE JOHN",
      "card_type": "001"
    }
  ]
}
```

---

### 7. Delete Stored Card

Removes a saved card profile from the gateway tokenization vault.

* **HTTP Method**: `DELETE`
* **Route Path**: `/v1/checkout/delete-card`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **id** | Mandatory | `23` | Stored card resource ID. |
| **gateway_buyer_uuid**| Mandatory | `124343434` | Gateway customer key assigned by Selcom. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function removeCard(SelcomService $selcom, $cardId, $gatewayUuid)
{
    $response = $selcom->send('DELETE', '/v1/checkout/delete-card', [
        'id' => $cardId,
        'gateway_buyer_uuid' => $gatewayUuid
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 8. Process Order - Card Payment

Charges a tokenized card directly without redirecting the customer to an external web page. Useful for e-commerce recurring subscription models.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/card-payment`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `A1234` | Unique transaction ID. |
| **vendor** | Mandatory | `VENDORTILL` | Merchant ID allocated by Selcom. |
| **order_id** | Mandatory | `85gh9p7l8` | Merchant order reference ID. |
| **card_token** | Mandatory | `ABC123423232`| Card token key. |
| **buyer_userid** | Mandatory | `user-102` | Customer identification ID. |
| **gateway_buyer_uuid**| Mandatory | `12434343` | Gateway customer key assigned by Selcom. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function processDirectCardCharge(SelcomService $selcom)
{
    $payload = [
        'transid' => 'T' . uniqid(),
        'vendor' => 'VENDORTILL',
        'order_id' => '85gh9p7l8',
        'card_token' => 'ABC123423232',
        'buyer_userid' => 'user-102',
        'gateway_buyer_uuid' => '12434343'
    ];

    $response = $selcom->send('POST', '/v1/checkout/card-payment', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 9. Process Order - Wallet Pull Payment

Charges a customer's wallet directly by triggering a USSD push payment on their mobile device.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/wallet-payment`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `A1234` | Unique transaction ID. |
| **order_id** | Mandatory | `85gh9p7l8` | Merchant order reference ID. |
| **msisdn** | Mandatory | `255682855555`| Paying customer's mobile wallet number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function chargeWalletPush(SelcomService $selcom)
{
    $payload = [
        'transid' => 'W-' . uniqid(),
        'order_id' => '85gh9p7l8',
        'msisdn' => '255682855555'
    ];

    $response = $selcom->send('POST', '/v1/checkout/wallet-payment', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 10. Process Order - Selcom Pesa Push Payment

Triggers an in-app payment request directly to a customer's registered Selcom Pesa account.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/selcompesa-payment`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **transid** | Mandatory | `A1234` | Unique transaction ID. |
| **order_id** | Mandatory | `85gh9p7l8` | Merchant order reference ID. |
| **msisdn** | Mandatory | `255xxxxxxxxx`| Customer's Selcom Pesa mobile number. |
| **remarks** | Optional | `PNR 123123` | Requestor transaction reference memo. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function chargeSelcomPesaPush(SelcomService $selcom)
{
    $payload = [
        'transid' => 'SP-' . uniqid(),
        'order_id' => '85gh9p7l8',
        'msisdn' => '255711223344',
        'remarks' => 'Invoice 8127'
    ];

    $response = $selcom->send('POST', '/v1/checkout/selcompesa-payment', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 11. Create Till Alias

Generates secondary Lipa-numbers (till aliases) dynamically. These are linked to your master merchant account for unified settlement processing.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/create-till-alias`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **vendor** | Mandatory | `SHOP203` | Master merchant ID allocated by Selcom. |
| **name** | Mandatory | `TEST CUSTOMER` | Name associated with the till alias. |
| **memo** | Mandatory | `TEST-CUSTOMER-1`| Tracking identifier or description string. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function registerTillAlias(SelcomService $selcom)
{
    $payload = [
        'vendor' => 'SHOP203',
        'name' => 'BENJAMIN JON',
        'memo' => 'ERP-ACC-00921'
    ];

    $response = $selcom->send('POST', '/v1/checkout/create-till-alias', $payload);

    return response()->json($response->json(), $response->status());
}
```

#### Till Alias Response Example
```json
{
  "reference": "S19901380962",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Payment token 63675386 created for TEST CUSTOMER (61085258) - TESTCUSTOMER-001",
  "data": [
    {
      "till_alias": "63675386"
    }
  ]
}
```

---

### 12. Handling Incoming Webhook Callbacks

When an order payment is successfully completed, Selcom sends a real-time HTTP POST callback notification to your registered webhook URL.

#### Incoming Webhook JSON Payload
```json
{
  "result": "SUCCESS",
  "resultcode": "000",
  "order_id": "602021152",
  "transid": "7945454515",
  "reference": "856266164161",
  "channel": "TIGOPESATZ",
  "amount": "10000",
  "phone": "255000000001",
  "payment_status": "COMPLETED"
}
```

#### Laravel Webhook Controller Handler Example

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SelcomWebhookController extends Controller
{
    public function handlePaymentCallback(Request $request)
    {
        // 1. Log the incoming payload
        Log::info('Selcom Payment Webhook Received:', $request->all());

        // 2. Perform signature validation checks to confirm the source is Selcom
        // Obtain header parameters and perform validation using your API secret
        
        $orderId = $request->input('order_id');
        $status = $request->input('payment_status');

        if ($status === 'COMPLETED' && $request->input('resultcode') === '000') {
            // Update order status in your database
            // Order::where('merchant_order_ref', $orderId)->update(['status' => 'paid']);
            
            return response()->json(['message' => 'Processed successfully'], 200);
        }

        return response()->json(['message' => 'Processed with status: ' . $status], 200);
    }
}
```

---

## Integrated Merchants API (POS & Terminal Flow)

Enables merchant billing systems, cashier terminals, or ERPs to initiate card or wallet transactions directly on physical Selcom POS terminals.

---

### 1. Prompt Payment Flow on POS Terminal

Initiates a payment prompt on a physical POS terminal.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/checkout/initiate-pos-payment`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **currency** | Mandatory | `TZS` | ISO Currency code. |
| **amount** | Mandatory | `5000` | Transaction value amount. |
| **payment_method**| Optional | `CARD` | `MOBILEMONEY` or `CARD`. |
| **msisdn** | Optional | `255XXXXXXXX` | Paying customer's mobile wallet number (Mandatory for `MOBILEMONEY` payments). |
| **invoice_no** | Optional | `BAD001` | Merchant system invoice number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function triggerTerminalPaymentPrompt(SelcomService $selcom)
{
    $payload = [
        'currency' => 'TZS',
        'amount' => 5000,
        'payment_method' => 'CARD',
        'invoice_no' => 'BAD001'
    ];

    $response = $selcom->send('POST', '/v1/checkout/initiate-pos-payment', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 2. POS Payment Status

Checks the execution status of a payment initiated on a POS terminal.

* **HTTP Method**: `GET`
* **Route Path**: `/v1/checkout/pos-payment-status`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **invoice_no** | Mandatory | `BAD001` | Merchant system invoice number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function checkTerminalPaymentStatus(SelcomService $selcom, $invoiceNo)
{
    $response = $selcom->send('GET', '/v1/checkout/pos-payment-status', [
        'invoice_no' => $invoiceNo
    ]);

    return response()->json($response->json(), $response->status());
}
```

#### POS Status Response Examples

##### In-Progress POS Transaction Response
```json
{
  "reference": "S20495509162",
  "resultcode": "999",
  "result": "INPROGRESS",
  "message": "Transaction pending",
  "data": []
}
```

##### Successful POS Transaction Response
```json
{
  "reference": "300913382877",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Selcom Pay\nSELCOM P2000 (DEBUG)\nSALE-8127\nTZS 100.00\nReceipt 300913382877\nMID 60349337\n09/04/2026 1:40:03 PM",
  "data": [
    {
      "invoice_no": "SELTEST004",
      "card_number": "8127",
      "payment_method": "CARD",
      "payer_mobile": "-",
      "amount": "100",
      "currency": "TZS",
      "channel": "SELCOMPOS",
      "transid": "000037732842",
      "reference": "300913382877"
    }
  ]
}
```

---

## International Money Transfer (IMT) API

Enables financial institutions to route cross-border remittances directly to banking and mobile money network destinations in Tanzania.

---

### 1. IMT Wallet Name Look Up

* **HTTP Method**: `GET`
* **Route Path**: `/v1/imt/wallet-namelookup`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **utilitycode** | Mandatory | `MPREMITIN` | System carrier code identifier. |
| **utilityref** | Mandatory | `25575XXXXXXXXX`| Target customer wallet mobile number. |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |

#### IMT Carrier Codes
Use the exact codes below when assigning values to the `utilitycode` parameter:

| Wallet Brand Carrier Name | IMT System Utility Code |
| :--- | :--- |
| **Vodacom M-Pesa** | `MPREMITIN` |
| **Tigo Pesa (Mixx by Yas)** | `TPREMITIN` |
| **HaloPesa** | `HPREMITIN` |
| **Airtel Money** | `AMREMITIN` |
| **TTCL Pesa** | `TTREMITIN` |

---

### 2. IMT Bank Account Name Lookup

* **HTTP Method**: `GET`
* **Route Path**: `/v1/imt/bank-namelookup/`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **bank** | Mandatory | `AKIBA` | Target destination bank shortcode. |
| **account** | Mandatory | `000000040000`| Destination bank account number. |
| **transid** | Mandatory | `XYZ123444` | Unique tracking sequence string. |

---

### 3. Send Money Remittance

Submits an international money transfer request to credit a verified bank account or mobile wallet. This endpoint is asynchronous. The final transaction status is delivered via webhook.

* **HTTP Method**: `POST`
* **Route Path**: `/v1/imt/send-money`

#### JSON Payload Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **messageId** | Mandatory | `M1234` | Unique transaction ID for the remittance request. |
| **end2endId** | Mandatory | `E1234` | End-to-end transaction reference ID. |
| **sender.firstname**| Mandatory| `John` | Sender's first name. |
| **sender.lastname** | Mandatory| `Mushi` | Sender's last name. |
| **sender.country** | Mandatory| `USA` | ISO 3166-1 alpha-3 country code of the sender. |
| **sender.mobile** | Mandatory| `15551234567` | Sender's mobile number (international format). |
| **sender.idType** | Optional | `PASSPORT` | Document type (`PASSPORT`, `NATIONALID`, etc.). |
| **sender.idNo** | Mandatory| `GS1002223` | Sender's identity document number. |
| **sender.idIssuedCountry**| Mandatory| `USA` | Issuing country code of the sender's identity document. |
| **sender.dateOfBirth**| Mandatory| `2011-02-26` | Sender's Date of Birth (`YYYY-MM-DD` format). |
| **sender.nationality**| Mandatory| `USA` | Nationality country code of the sender. |
| **sender.placeOfBirth**| Mandatory| `Springfield` | Sender's place of birth. |
| **sender.occupation**| Mandatory| `DOCTOR` | Sender's occupation. |
| **sender.address** | Mandatory| `1234 Elm St` | Sender's physical address. |
| **sender.city** | Optional | `Springfield` | Sender's residential city. |
| **sourceOfFunds** | Mandatory| `SALARY` | Source of funds (`SALARY`, `BUSINESS`, etc.). |
| **recipient.firstname**| Mandatory| `Benjamin` | Recipient's first name. |
| **recipient.lastname**| Mandatory| `Sata` | Recipient's last name. |
| **recipient.country**| Mandatory| `TZA` | Recipient's country code (`TZA`). |
| **recipient.mobile**| Mandatory| `255700123456` | Recipient's mobile number (international format). |
| **vendor** | Mandatory| `IMTHUB001` | IMT float partner key provided by Selcom. |
| **pin** | Mandatory| `1212` | Float account authorization access pin. |
| **currency** | Mandatory| `TZS` | Target disbursement currency (`TZS` or `USD`). |
| **amount** | Mandatory| `49200` | Disbursement amount value. |
| **billingAmount** | Mandatory| `20` | Billing amount charged to the sender. |
| **billingCurrency**| Mandatory| `USD` | ISO Currency code for billing amount. |
| **purpose** | Mandatory| `BUSINESS` | Remittance purpose (`GENERAL`, `BUSINESS`, `GIFT`). |
| **personalMessage**| Optional | `Happy birthday`| Personal message to pass to the recipient. |
| **secretMessage** | Optional | `MANGO` | Secret pick-up code (for cash pick-up models). |
| **sourceFI.type** | Mandatory| `BANK` | Originating payment channel (`BANK`, `WALLET`, `CARD`, `AGENT`). |
| **sourceFI.name** | Mandatory| `Citibank` | Name of the originating bank/institution. |
| **sourceFI.country**| Mandatory| `USA` | Originating bank country code. |
| **sourceFI.code** | Mandatory| `CITIBANKUSA` | Originating bank routing code. |
| **sourceFI.account**| Mandatory| `5000123` | Sender's source bank account number. |
| **destinationFI.type**| Mandatory| `WALLET` | Destination channel type (`BANK`, `WALLET`, `CARD`, `AGENT`). |
| **destinationFI.name**| Mandatory| `MPESA` | Name of the destination carrier/bank. |
| **destinationFI.country**| Mandatory| `TZA` | Destination bank/institution country code (`TZA`). |
| **destinationFI.code**| Mandatory| `VMTZ` | Destination institution code. |
| **destinationFI.account**| Mandatory| `255700123456` | Recipient's bank account or wallet number. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function dispatchRemittance(SelcomService $selcom)
{
    $payload = [
        'messageId' => 'M-' . uniqid(),
        'end2endId' => 'E-' . uniqid(),
        'sender' => [
            'firstname' => 'John',
            'lastname' => 'White',
            'country' => 'USA',
            'mobile' => '25632223232',
            'idType' => 'PASSPORT',
            'idNo' => 'ABCDEFGH',
            'dateOfBirth' => '2011-02-26',
            'placeOfBirth' => 'Springfield',
            'nationality' => 'USA',
            'idIssuedCountry' => 'USA',
            'occupation' => 'Doctor',
            'address' => '1234 Elm Street, Apt 567, Springfield, IL 62704, USA',
            'city' => 'Springfield'
        ],
        'sourceOfFunds' => 'SALARY',
        'recipient' => [
            'firstname' => 'Benjamin',
            'lastname' => 'Sata',
            'country' => 'TZA',
            'mobile' => '255711223344'
        ],
        'vendor' => 'IMTHUB001',
        'pin' => '1212',
        'currency' => 'TZS',
        'amount' => '49200',
        'billingAmount' => '20',
        'billingCurrency' => 'USD',
        'purpose' => 'Personal',
        'personalMessage' => 'Remittance Transfer',
        'secretMessage' => '',
        'sourceFI' => [
            'type' => 'BANK',
            'name' => 'Citibank',
            'country' => 'USA',
            'code' => 'CITIBANKUSA',
            'account' => '5000123'
        ],
        'destinationFI' => [
            'type' => 'WALLET',
            'name' => 'MPESA',
            'account' => '255711223344',
            'code' => 'VMTZ',
            'country' => 'TZA'
        ]
    ];

    $response = $selcom->send('POST', '/v1/imt/send-money', $payload);

    return response()->json($response->json(), $response->status());
}
```

---

### 4. Query Remittance Transaction Status

* **HTTP Method**: `GET`
* **Route Path**: `/v1/imt/query`

#### Query Parameters

| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| **messageId** | Mandatory | `20200721001` | Unique transaction ID of the remittance request. |

#### Laravel Controller / Service Usage Code Example

```php
use App\Services\SelcomService;

public function checkRemittanceStatus(SelcomService $selcom, $messageId)
{
    $response = $selcom->send('GET', '/v1/imt/query', [
        'messageId' => $messageId
    ]);

    return response()->json($response->json(), $response->status());
}
```

---

### 5. Inbound Transaction Callback (Selcom to your Webhook)

When an IMT transaction finishes processing, Selcom will send an HTTP POST callback notification to your registered webhook URL.

#### Incoming Webhook JSON Payload
```json
{
  "messageId": "20200721001",
  "reference": "0289999288",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "Transaction successful",
  "data": [
    {
      "receipt": "12344"
    }
  ]
}
```

Your server must acknowledge receipt of this callback by returning an empty body with an HTTP status code of `200 OK`.

---

## Global System Error Code Mappings

### IMT Synchronous Response Error Codes

| Error Code | Error Description |
| :--- | :--- |
| `000` | Remittance process success. |
| `111`, `001`, `002`, `003` | Remittance is currently in progress. |
| `999` | Transaction status is ambiguous. |
| `010` | Invalid recipient mobile carrier or number is not supported. |
| `013` | Transaction amount exceeds the allowed limits. |
| `015` | Invalid transaction amount value. |
| `029` | Customer wallet/account is currently suspended. |
| `103` | Invalid recipient account or mobile number. |
| `151`, `218`, `889`, `900` | Remittance system is currently offline or unavailable. |
| `201`, `202` | Invalid account number or name validation failed. |
| `203` | Recipient registered name mismatch. |
| `400` | General transaction failure. |
| `415` | KYC Validation failed. |
| `611` | Source Financial Institution (FI) could not be resolved. |
| `012`, `612` | Destination Financial Institution (FI) could not be resolved. |

### Webhook & Callback Async Status Codes

| Callback Code | Description |
| :--- | :--- |
| `000` | Remittance delivered successfully to recipient account. |
| `200` | Transaction failed. Reversed manually. |
| `400`, `404` | Remittance failed to reach destination bank/carrier. |
| `500`, `501`, `701` | Transaction rejected by target carrier/bank. |
| `702` | Destination bank/carrier internal database error. |
| `703` | Account currency mismatch. |
| `704` | Transfer aborted because it exceeds target wallet maximum balance limits. |
