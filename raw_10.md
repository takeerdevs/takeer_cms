### **1. Jinsi "Link-in-Bio" Itakavyofanya Kazi**

Badala ya kumpa mteja link ndefu na mbaya, kila muuzaji anapata **Subdomain** au **Unique Slug**.

* **Muundo wa Link:** `takeer.shop/juma_collections` au `juma.takeer.shop`
* **User Flow:**
1. Mteja anabonyeza link kwenye Bio ya Instagram ya muuzaji.
2. Anatua kwenye **PWA (Progressive Web App)** ya Takeer inayofanana na "Mini-Store."
3. Anaona "Feed" ya video fupi (Shoppable Posts) za muuzaji huyo pekee.
4. Akiscroll chini, anaona bidhaa zingine. Akibonyeza video, inafungua **1-Click Checkout** hapo hapo.



---

### **2. Siri ya Video Ku-play "Instantly" (Kama TikTok)**

Ili video icheze bila "loading circle," huwezi kupakia faili nzima ya `.mp4` mara moja. Unahitaji mambo matatu:

#### **A. HLS Streaming (HTTP Live Streaming)**

Badala ya faili moja kubwa, video inakatwa katika vipande vidogo vya sekunde 2-5 (segments).

* **Faida:** Simu inaanza ku-play kipande cha kwanza wakati vipande vingine vinaendelea kujipakia nyuma (buffering).

#### **B. Adaptive Bitrate (ABR)**

Kama mteja yuko Kariakoo na 5G, anapata video ya **1080p**. Akisafiri kuelekea mikoani na internet ikawa ya kusuasua (3G), mfumo unabadilisha video iwe **360p** papo hapo bila video kukata.

#### **C. Video Edge Caching (CDN)**

Tunatumia **Cloudflare** au **Bunny.net**. Hawa wana server hapa hapa East Africa (Mombasa/Dar). Video haitoki Marekani; inatoka server ya jirani, hivyo inafika kwa mteja haraka sana.

---

### **3. Shoppable Post Types (Mixed Content)**

Kwenye Feed yako, kutakuwa na aina mbili za "interactions":

1. **Product Demo Video:** Video fupi (sekunde 15) ikionyesha bidhaa. Chini kuna kitufe cha "Buy Now."
2. **Social Proof/Review:** Video ya mteja mwingine akifungua mzigo wake (Unboxing). Hii inajenga hamu ya kununua.

---

### **Prompt ya Ziada: Phase 10 (High-Performance Video Engine)**

Tumia prompt hii kupata code ya kurekebisha video ziwe kama za Instagram:

> **Act as a Senior Media Engineer specializing in Video Streaming (HLS/DASH).**
> We need to implement an "Instant-Play" video feed for Takeer shoppable posts.
> **Your Task:**
> 1. **Video Transcoding:** Write a Laravel Job that uses `ffmpeg` to convert uploaded `.mp4` files into **HLS (.m3u8)** format with multiple resolutions (360p, 720p).
> 2. **Frontend Player:** Suggest a lightweight React/Vue video player component (like `video.js` or `shaka-player`) that supports HLS and "Intersection Observer" logic.
> 3. **Intersection Observer Logic:** The video should only start downloading and playing when it is **at least 50% visible** on the user's screen (to save data).
> 4. **Pre-fetching:** Automatically download the *first 2 seconds* of the **next** video in the feed so that when the user scrolls, it plays instantly.
> 
> 
> Provide the Laravel Job code and the Frontend Video Component logic.