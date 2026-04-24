This API documentation focuses on the **"Zero-Friction Checkout"** flow. This is the heart of Takeer—integrating the **AI Shopping Assistant**, **M-Pesa payment**, and **Escrow initiation** into a single sequence.

---

## **Takeer Core API: The Checkout Flow**

### **1. Initiate AI-Powered Search**

**Endpoint:** `POST /api/v1/assistant/search`

**Description:** Converts natural language (English/Swahili) into filtered product results.

**Request Body:**

```json
{
  "query": "Natafuta shati la ofisi rangi nyeusi kwa 30k",
  "context_session_id": "optional-previous-chat-id"
}

```

**Success Response (`200 OK`):**

```json
{
  "reply": "Safi! Nimekupatia mashati 3 ya ofisi meusi chini ya 30k. Hili hapa ni chaguo bora:",
  "products": [
    {
      "id": "prod_882",
      "name": "Slim-fit Black Cotton",
      "price": 28000,
      "merchant": "Juma Collections",
      "video_url": "https://cdn.takeer.shop/v/prod_882.m3u8",
      "delivery_options": ["Boda", "Bus"]
    }
  ]
}

```

---

### **2. Create Order & Trigger M-Pesa**

**Endpoint:** `POST /api/v1/checkout/initiate`

**Description:** Locks the price, calculates delivery, and triggers the USSD Push to the buyer's phone.

**Request Body:**

```json
{
  "product_id": "prod_882",
  "payment_phone": "2557XXXXXXXX",
  "delivery_zone_id": 5, 
  "shipping_method": "intercity_bus",
  "buyer_lat": -6.7924,
  "buyer_lng": 39.2083
}

```

**Success Response (`201 Created`):**

```json
{
  "order_id": "TK-99021",
  "status": "pending_payment",
  "total_amount": 33000,
  "breakdown": {
    "product": 28000,
    "delivery": 5000
  },
  "message": "Tafadhali kamilisha malipo kwenye simu yako (M-Pesa USSD)."
}

```

---

### **3. Merchant Dispatch (The Proof of Life)**

**Endpoint:** `POST /api/v1/orders/{order_id}/dispatch`

**Description:** Once the merchant is notified of payment, they must upload the video and waybill to move funds into Escrow.

**Request Body (Multipart/Form-Data):**

```json
{
  "dispatch_video": "binary_file_data",
  "waybill_image": "binary_file_data",
  "transport_company": "Tashrif",
  "boda_phone": "optional-for-local"
}

```

**Internal Logic:**

* AI OCR scans `waybill_image` to extract the tracking number.
* The `escrow_release_pin` is generated and sent to the **Buyer via SMS**.

---

### **4. Order Finalization (The Handshake)**

**Endpoint:** `POST /api/v1/orders/{order_id}/complete`

**Description:** Buyer enters the PIN received via SMS to release funds.

**Request Body:**

```json
{
  "pin": "4321",
  "buyer_lat": -6.8234, 
  "buyer_lng": 39.2678
}

```

**Logic Check:** * If `buyer_lat/lng` matches the Bus Terminal or delivery zone, and `pin` is correct, the **Merchant Wallet** is credited immediately.

---

### **Implementation Notes for the Developer:**

1. **Security:** All endpoints must be wrapped in `auth:sanctum` middleware.
2. **Rate Limiting:** Limit the `resend-pin` endpoint to 3 hits per 10 minutes to avoid SMS costs.
3. **Idempotency:** Use the `X-Idempotency-Key` header on the checkout endpoint to prevent double-charging a customer if they tap "Buy" twice.

---
