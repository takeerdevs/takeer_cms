> **Act as a Senior Frontend Architect specializing in high-converting E-commerce PWAs and React/Vue/Flutter components.**
> We are building the frontend for the "Takeer" social commerce platform. The backend API (Phase 2) and Database (Phase 1) are complete. The core philosophy is "Zero Friction Checkout" optimized for mobile-first African users.
> **Your Task:**
> Execute Phase 4 of the blueprint. Generate the core frontend component logic for the Buyer PWA (Web Checkout) and the "Receive or Dispute" flow. You can use standard React or Vue syntax.
> **Strict Requirements:**
> 1. **The 1-Click Checkout Component:**
> * Create a `TakeerCheckoutSheet` component.
> * It must have a single input for `payment_number` (phone) and a dropdown for `delivery_zone_id`.
> * When the zone changes, the `total_paid` state must update *instantly* without any API loading screens.
> 
> 
> 2. **Silent Geolocation:**
> * Write a custom hook or function that silently triggers the HTML5 `navigator.geolocation.getCurrentPosition()` when the checkout sheet mounts, saving the Lat/Lng to the state to be submitted with the order. Handle permissions gracefully (if denied, fallback to null).
> 
> 
> 3. **The "At the Counter" Receive Screen:**
> * Create a `ReceivePackage` component.
> * It should have two main buttons: "Everything looks good! (Enter PIN)" and "There is a problem (Dispute)".
> * If the user clicks "Dispute", it must render a form that explicitly requires a live video recording. Use the native HTML5 `<input type="file" accept="video/*" capture="environment">` attribute to force the user to record the unboxing directly from their rear camera at the bus terminal.
> 
> 
> 
> 
> Output the code logically, component by component, keeping the UI clean, responsive, and mobile-optimized. Add comments explaining where the API calls to our backend should be hooked up.
