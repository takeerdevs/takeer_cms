Hapa ndivyo tutakavyoigawa:

### 1. Pre-Sale (Kabla ya Kununua): **Social Media (WhatsApp/IG)**

Hapa ndipo mteja anauliza maswali ya kawaida: *"Inapatikana rangi gani?"* au *"Inanitosha mimi mwenye mwili mkubwa?"*

* **Solution:** Kwenye **Link-in-Bio** yako, weka kitufe kikubwa cha **"Chat on WhatsApp"**.
* **Kwa nini?** Kuruhusu mazungumzo ya mwanzo yawe kule walikozoea kunapunguza uoga (friction).

### 2. Transactional (Wakati wa Kununua): **In-App & SMS**

Mara tu mteja anapobonyeza "Buy Now," mawasiliano lazima yawe ya **Takeer pekee**.

* **Automatic Status Updates:** Badala ya muuzaji kumtumia mteja picha ya waybill WhatsApp, Takeer inatuma **SMS ya kiotomatiki** na **Push Notification**.
* **Faida:** Hii inazuia muuzaji kusema "nimetuma" wakati hajatuma. Mfumo ndio unatoa ripoti.

### 3. Post-Sale & Dispute (Baada ya Kununua): **The "Safe-Chat" (Phase 11)**

Hapa ndipo **Takeer** inakuwa ya kipekee. Tukitokea mgogoro (Dispute), hatutaki wabishane WhatsApp ambako muuzaji anaweza ku-block mteja.

* **In-App Dispute Chat:** Ikiwa mteja amefungua "Dispute," dirisha la chat linafunguka ndani ya Takeer.
* **The "Silent Witness":** Admin wa Takeer anaweza kusoma hii chat. Hii inawafanya pande zote mbili wawe wastaarabu kwa sababu wanajua "Judge" anaona kila kitu.

---

### **Phase 11: The "Safe-Chat" & Contextual Messaging**

Hii ndiyo prompt ya mwisho ya kiufundi ya kuongeza mfumo wa chat ndani ya app yako:

> **Act as a Senior Backend Architect specializing in Real-Time Communication (WebSockets).**
> We need to implement a **Contextual Chat System** for Takeer. This is NOT a general messenger; it is a chat linked specifically to an `Order_ID`.
> **Your Task:**
> 1. **Order-Bound Chat:** Generate a `messages` table linked to `order_id`, `sender_id`, and `receiver_id`.
> 2. **Real-Time Engine:** Use **Laravel Reverb** (or Pusher/Socket.io) to ensure messages appear instantly without refreshing the page.
> 3. **Smart Quick-Replies:** For merchants, generate "Quick Actions" in the chat like:
> * *"I have dispatched your item."*
> * *"Please check the waybill photo attached."*
> 
> 
> 4. **Media Support:** Allow users to send photos directly in the chat (for showing defects or proof of arrival).
> 5. **Admin Supervision:** Ensure the Admin Portal (from Phase 6) can view these chats when an order is in "Disputed" status.
> 
> 
> Provide the Migration for `messages` and the `ChatController` logic.

---

### **Mnyororo wa Mawasiliano (The Communication Loop)**

| Stage | Platform | Purpose |
| --- | --- | --- |
| **Discovery** | Instagram/TikTok | Kuvutia mteja kwa video fupi. |
| **Inquiry** | WhatsApp | Maswali ya hapa na pale (Price/Size). |
| **Payment** | Takeer PWA | Malipo na Escrow (Hakuna chat hapa, ni Action tu). |
| **Logistics** | SMS / Push | Kumjulisha mteja mzigo uko wapi na PIN yake. |
| **Problem** | Takeer Safe-Chat | Kutatua migogoro mbele ya Admin. |

### **Kitu kimoja cha ziada: "The Shared Cart"**

Wateja wengi wa Tanzania hupenda kutuma picha ya kitu wanachotaka kununua kwa marafiki zao ili wapate maoni.

* **Feature:** Ongeza kitufe cha **"Share on WhatsApp"** kwenye kila bidhaa. Mteja akibonyeza, inatuma picha na link ya Takeer moja kwa moja.