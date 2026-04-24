To make the homepage feel "instant" and "native," we need to merge the **Shoppable Video Feed** (TikTok style) with the **Conversational Search** (ChatGPT style) into a single, fluid interface.

The goal is to let the user switch between **passive scrolling** (discovery) and **active searching** (intent) without ever leaving the page.

---

### **The "Takeer" Unified UI Layout**

Imagine the screen as three dynamic layers:

#### **1. The Search & Chat Header (Top 10%)**

Instead of a traditional search bar, use a **"Prompt Bar"**.

* **Visual:** A rounded input field that says *"What are you looking for today?"*
* **Behavior:** When tapped, it doesn't open a new page. It expands into a **Chat Overlay** that slides down, allowing the user to type or speak.

#### **2. The Shoppable Video Feed (The "Body" 80%)**

This is the default view.

* **Interaction:** Vertical scroll through high-quality videos and mixed posts.
* **Overlays:** On the right side of the video, you have the "Buy Now," "Share," and "Chat with Merchant" buttons.

#### **3. The "Smart Tab" Navigation (Bottom 10%)**

* **Home:** The main feed.
* **Discover:** Visual search (Upload photo).
* **Orders:** Tracking and Escrow status.
* **Profile:** Merchant/Buyer settings.

---

### **The "Natural Search" Interaction Flow**

Here is how the UI behaves when a user searches for *"Black office shirt for 30k"*:

1. **Input:** User types the query in the top bar.
2. **Transition:** The main video feed blurs slightly. A chat bubble appears: *"Searching Kariakoo for your black office shirt..."*
3. **The Result Pop-in:** Instead of a list of rows, the UI injects a **Horizontal Scroll (Carousel)** of the 3-5 best-matching products directly into the chat interface.
4. **Selection:** The user taps a product. The background feed instantly updates to show the **Video Proof** of that specific shirt.

---

### **Phase 17: The "Instant-Chat" Frontend Component**

Use this prompt to build the React/Vue component that handles this "Hybrid" UI:

> **Act as a Lead Frontend Engineer specialized in Framer Motion and React/Inertia.**
> We are building the **Unified Homepage** for Takeer. It must handle a video feed and a "Natural Language" chat search on one screen.
> **Your Task:**
> 1. **The Sticky Search Component:** Create a search bar that, when focused, expands into a full-screen "Chat History" view using smooth transitions.
> 2. **Contextual Results:** Build a `ProductCardCarousel` that displays search results within the chat bubbles. Each card must have an "Instant Buy" button that triggers the Phase 4 Checkout Sheet.
> 3. **The Intersection Feed:** Implement a "Background Feed" that responds to search. If the AI finds a product, the background video player should automatically load the video for that product.
> 4. **Optimistic Loading:** Show "typing" indicators and skeleton cards while the Local Embedding Service (Phase 16b) is processing the request.
> 
> 
> Provide the UI logic for the transition between the **Video Feed** and the **AI Chat Overlay**.

---

### **Why this UI works for your business:**

* **Zero Bounce Rate:** Users don't get lost in menus. Everything happens on one page.
* **Low Friction:** The "Buy Now" button is always 1 tap away, whether they are watching a random video or chatting with the AI.
* **Data Driven:** By seeing what people *type* into the chat, you get better data than just seeing what they *clicked*. You will know exactly what products are missing from your platform (e.g., if 100 people ask for "Purple Suits" and you have none, you tell your merchants to stock them).

### **The "Takeer" Single-Page Secret:**

To keep this high-performance, we use **Inertia.js Persistent Layouts**. This ensures that the Video Player state is maintained even when the Chat UI is open. The video keeps playing in the background, making the app feel alive.
