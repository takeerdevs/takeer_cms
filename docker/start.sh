#!/bin/sh

# Wait for database to be ready with improved retry logic
echo "Waiting for database connection..."
max_attempts=30
attempt=1

until php artisan tinker --execute="DB::connection()->getPdo();" > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "Failed to connect to database after $max_attempts attempts"
        echo "Checking if postgres hostname resolves..."
        nslookup postgres || echo "DNS resolution failed for 'postgres'"
        echo "Attempting direct connection test..."
        nc -zv postgres 5432 || echo "Port 5432 not reachable on postgres"
        exit 1
    fi
    
    echo "Database not ready, waiting... (attempt $attempt/$max_attempts)"
    sleep 3
    attempt=$((attempt + 1))
done

echo "Database is ready!"

# Generate application key if not set
if [ "$APP_KEY" = "" ] || [ "$APP_KEY" = "base64:your-production-app-key-here" ]; then
    echo "Generating application key..."
    php artisan key:generate --force
fi

# Clear caches
echo "Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# Cache configurations for better performance
echo "Caching configurations..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Create storage link for Docker environment
echo "Creating storage link for Docker..."
# Remove existing symlink if it exists
rm -f /var/www/html/public/storage
# Create proper symlink for Docker volume mount
ln -sf /var/www/html/storage/app/public /var/www/html/public/storage
echo "Storage link created successfully"

# Run migrations
echo "Running migrations..."
php artisan migrate --force

# Check if we need to run seeders
if [ "$RUN_SEEDERS" = "true" ]; then
    echo "Running seeders..."
    php artisan db:seed --force
fi

# Start supervisor (which starts nginx and php-fpm)
echo "Starting services..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
