# Services frontend reactivation runbook

Status: services are disabled in the frontend for the digital/physical product launch.

Date: 2026-08-09

## Scope

This change is frontend-only. No Laravel controller, route, model, migration, API endpoint, permission, or database behavior was changed. The backend still supports services so existing records and the later reactivation can be handled without a schema change.

The launch UI exposes digital and physical products. Service-provider creation, service setup, service-specific discovery filters, and service-provider credential onboarding are hidden or filtered in React. Dormant service code is intentionally retained where it is needed for compatibility with existing service records.

## Frontend files changed

The following files contain the launch switch or service UI comments:

- `resources/js/Pages/Merchant/Upload.jsx` — hides service product selection, ignores stale `?type=service` links, stops loading service categories, and leaves the full service form/components dormant in the file.
- `resources/js/Pages/Merchant/Products.jsx` — limits the visible merchant catalog and create/update/delete scope to physical and digital products. Existing service API logic remains available for reactivation.
- `resources/js/Pages/Merchant/Dashboard.jsx` — comments out service, booking, availability, and custom-order quick actions/workspace entries. Course and digital-learning tools remain available as digital features.
- `resources/js/Pages/Merchant/Modules.jsx` — hides service commerce modes and service scheduling/custom-order modules without removing already-saved service values from the payload sent back to the backend.
- `resources/js/Pages/Merchant/Overview.jsx` — hides service/booking report rows and booking navigation.
- `resources/js/Pages/Merchant/VerificationCenter.jsx` — hides service credential onboarding and comments out its API loading calls. Identity KYC and merchant legal acceptance remain active.
- `resources/js/Pages/Merchant/OfferingGroups.jsx` — hides the `service_package` creation template, filters service items out of the add-item catalog, and removes the service-only group checkout option. Existing service groups can still be read by the dormant compatibility logic.
- `resources/js/Pages/Merchant/Bundles.jsx` — hides service as a bundle filter and prevents service items from appearing in the item picker.
- `resources/js/Pages/Profile.jsx` — removes the services commerce hub tile, service sales row, and service onboarding tile from the visible launch profile.
- `resources/js/Layouts/AdminLayout.jsx` — hides service and service-category administration links from the frontend admin navigation. The admin pages and routes remain intact.
- `resources/js/Components/DiscoveryRails.jsx` — filters the service discovery rail from the feed.
- `resources/js/Components/MerchantOffersPanel.jsx` — removes the service offer filter and service offers from the visible merchant panel.
- `resources/js/Pages/PublicShop.jsx` — removes the services shop section and filters public shop products to physical/digital items.
- `resources/js/Pages/PublicCatalog.jsx` — removes the service catalog filter/stat and filters visible catalog records to physical/digital items.
- `resources/js/Pages/MiniStore.jsx` and `resources/js/Pages/MiniStoreSection.jsx` — remove services from mini-store navigation, sections, and visible product lists while retaining dormant service helpers.
- `resources/js/Pages/Search.jsx` — removes the service search filter and filters service records out of search results.
- `resources/js/Components/PostComposer.jsx` — limits product-link creation permissions to physical and digital product permissions.
- `resources/js/Pages/Welcome.jsx` and `resources/js/lib/i18n.jsx` — update launch marketing copy and selling choices to digital and physical products only.
- `resources/js/Pages/Merchant/Communications.jsx` — hides booking segmentation and removes service/booking language from launch copy; backend communication sources remain compatible.

## Files intentionally left dormant

These files still contain service display, checkout, booking, or domain logic because removing them would make reactivation harder or could break old service records:

- `resources/js/Components/CheckoutModal.jsx`
- `resources/js/Components/GenericSearchCard.jsx`
- `resources/js/Components/ProductDrawer.jsx`
- `resources/js/Components/ProductSearchCard.jsx`
- `resources/js/Components/PostCard.jsx`
- `resources/js/Components/PostItem.jsx`
- `resources/js/Components/public-templates/*`
- `resources/js/Components/Merchant/Service*.jsx`
- The service sections and helper functions retained inside `resources/js/Pages/Merchant/Upload.jsx`, `Products.jsx`, `Bundles.jsx`, `OfferingGroups.jsx`, `MiniStore.jsx`, and `MiniStoreSection.jsx`
- `resources/js/Pages/Admin/Services.jsx`, `resources/js/Pages/Admin/ServiceCategories.jsx`, and `resources/js/Pages/Admin/ServiceRisk.jsx`
- `resources/js/Pages/Merchant/Availability.jsx` and `resources/js/Pages/Merchant/BookingCalendar.jsx`
- `resources/js/Pages/OfferingGroupDetail.jsx` and service-compatible post/product detail renderers

These are not reachable through the launch creation/navigation surfaces described above, but they remain available for old data or a future reactivation.

## Reactivation steps

Use this order so the creation flow, setup flow, and discovery surfaces become available together:

1. In `Merchant/Upload.jsx`, restore `services.create` to `uploadableProfiles`, restore `service` in the accepted query types, uncomment `fetchServiceCategories()` and the service type card, and remove the stale-link guard in `handleTypeSelect`.
2. In `Merchant/Products.jsx`, restore `service` to the normalized type scope/resource mapping and remove the client-side physical/digital response filter. Restore the service permissions in the create/update/delete checks.
3. In `Merchant/Modules.jsx`, remove `DISABLED_SERVICE_MODE_KEYS` and `DISABLED_SERVICE_MODULE_KEYS`, restore the unfiltered module/mode maps, and restore the original preset behavior if service modes should be selectable again.
4. In `Merchant/Dashboard.jsx`, restore the commented service quick actions, service/custom-order/availability/booking workspace entries, and any service-specific tool copy needed for the new provider workflow.
5. In `Merchant/VerificationCenter.jsx`, set `servicesEnabled` to `true` and uncomment `fetchServiceCategories()` and `fetchServiceCredentials()` in the initial effect. This restores certificate/license onboarding without changing the backend.
6. In `Merchant/OfferingGroups.jsx`, stop filtering `service_package` from the server templates, restore the service catalog item filter and `book_group` option, and restore the original default template if service packages should be the default.
7. In `Merchant/Bundles.jsx`, restore the service filter and service item-picker branch.
8. Restore the service entries in `Profile.jsx`, `Overview.jsx`, `AdminLayout.jsx`, `Communications.jsx`, and the welcome copy if service navigation and marketing should return at the same time.
9. Restore service rails, filters, sections, and results in `DiscoveryRails.jsx`, `MerchantOffersPanel.jsx`, `PublicShop.jsx`, `PublicCatalog.jsx`, `MiniStore.jsx`, `MiniStoreSection.jsx`, and `Search.jsx`.
10. Restore the service permission in `PostComposer.jsx` only if service products should be linkable from posts again.
11. Run `npm run build`, then manually verify service creation, service search/detail, service checkout, booking/calendar, credentials, public shop filtering, and existing physical/digital product creation.

## Backend note

Do not remove or change service migrations, models, routes, controllers, policies, permissions, API resources, or database columns as part of this reactivation. This launch switch is intentionally reversible from the frontend.
