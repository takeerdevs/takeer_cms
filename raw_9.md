> **Act as a Senior Cloud Architect specializing in Video Processing and AWS S3 Storage.**
> We are optimizing the **Media Layer** for Takeer. We handle "Proof of Dispatch" and "Unboxing" videos. We need to save storage costs and ensure fast playback on slow Tanzanian mobile networks (3G/LTE).
> **Your Task:**
> Generate the Frontend Compression logic and the Backend File Upload Service.
> **Strict Requirements:**
> 1. **Client-Side Compression (JavaScript):** >    * Use a library like `browser-image-compression` for photos and provide a strategy for **video compression** (e.g., using `ffmpeg.wasm` or simply limiting recording quality) before the `POST` request to the API.
> 2. **Laravel Media Service:** >    * Create a `MediaUploadService` that uses the `Storage::disk('s3')` driver.
> * **Naming Convention:** Files must be stored as `merchants/{id}/orders/{order_id}/dispatch.mp4`.
> 
> 
> 3. **Public/Private Access:** >    * Ensure the videos are **Private** by default. Generate **Temporary Signed URLs** (valid for 24 hours) when an Admin or Buyer needs to view the video. This prevents random people from accessing the sensitive dispatch footage.
> 4. **Cleanup Logic:** >    * Create a Scheduled Command `CleanupExpiredMedia` to delete videos of "Completed" orders that are older than 30 days to keep storage costs low.
> 
> 
> **Output:**
> Please provide the Frontend JS logic for file handling and the Laravel `MediaUploadService`.
