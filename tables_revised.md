posts
-id
-merchant_id
-caption
-likes_count
-click_count
-share_count
-comment_count
-views_count


post_products
-id
-post_id
-product_id

post_media
-id
-post_id
-media_url
-media_type //image, video, pdf
-likes_count

products
-id
-merchant_id
-title
-type //physical, digital, service
-slug
-price
-discounted_price
-inventory_count
-buffer_stock
-currency_id //default merchant set currency but merchant can set currency he/she want to sell the product to
-download_link //local downloads should have direct path not with http/https, http or https will be for external links only


merchants
-id
-user_id
-display_name
-avatar_url
-bio
-is_default
-successful_sales | 0
-unsuccessful_sales | 0
-is_verified
-is_suspended | false
-country_id
-currency_id


merchant_shipping_zones
-id
-merchant_id
-zone_name


product_sales
-id
-customer_id
-product_id
-sale_price
-currency_id
-quantity_sold
-downloads | 0
-shipping_zone_id | null
-merchant_packing_video | null
-merchant_shipping_proof | null
-customer_unboxing_video | null
-expected_receive_date | null

product_fulfillment_status
-id
-product_id
-status_name
-merchant_id
-customer_id



