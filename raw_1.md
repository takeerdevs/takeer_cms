
> **Act as a Senior Backend Architect specializing in Laravel and high-performance e-commerce platforms.**
> I am building a social commerce platform named Takeer. I have provided the "Master Blueprint" for the system architecture in the chat context above.
> **Your Task:**
> Execute Phase 1 of the blueprint. Generate the complete set of Laravel Migration files and their corresponding Eloquent Models for the 7 core tables outlined in the schema (`users`, `shipping_zones`, `products`, `posts` & `post_product_tags`, `one_click_profiles`, `orders`, `deliveries`, and `disputes`).
> **Strict Requirements:**
> 1. Write the migrations using Laravel 11 syntax (anonymous migration classes).
> 2. Include all necessary foreign key constraints, utilizing `cascadeOnDelete()` where appropriate (e.g., if a merchant is deleted, their products should be deleted).
> 3. In the Eloquent Models, define the `$fillable` arrays and write out all the relationship methods clearly (e.g., `hasMany`, `belongsTo`, `belongsToMany`).
> 4. Ensure data types match the blueprint strictly (e.g., `decimal` for TZS currency, `enum` for the specific statuses).
> 
> 
> Output the code clearly, separated by file names so I can copy and paste them directly into my project.