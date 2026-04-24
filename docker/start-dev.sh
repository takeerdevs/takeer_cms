#!/bin/sh

echo "🚀 Starting Takeer Development Environment..."

# Wait for database to be ready with improved retry logic
echo "⏳ Waiting for database connection..."
max_attempts=30
attempt=1

until php artisan tinker --execute="DB::connection()->getPdo();" > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Failed to connect to database after $max_attempts attempts"
        echo "🔍 Checking if postgres hostname resolves..."
        nslookup postgres || echo "❌ DNS resolution failed for 'postgres'"
        echo "🔌 Attempting direct connection test..."
        nc -zv postgres 5432 || echo "❌ Port 5432 not reachable on postgres"
        exit 1
    fi
    
    echo "⏳ Database not ready, waiting... (attempt $attempt/$max_attempts)"
    sleep 3
    attempt=$((attempt + 1))
done

echo "✅ Database is ready!"

# Generate application key if not set
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "" ]; then
    echo "🔑 Generating application key..."
    php artisan key:generate --force
fi

# Clear caches for development
echo "🧹 Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# Create storage link for development
echo "🔗 Creating storage link for development..."
# Remove existing symlink if it exists
rm -f /var/www/html/public/storage
# Create proper symlink for Docker volume mount
ln -sf /var/www/html/storage/app/public /var/www/html/public/storage
echo "✅ Storage link created successfully"

# Run migrations in development
echo "📦 Running migrations..."
php artisan migrate --force

# Check if we need to run seeders
if [ "$RUN_SEEDERS" = "true" ]; then
    echo "🌱 Running seeders..."
    php artisan db:seed --force
fi

# Ensure proper permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

echo "🎉 Development environment ready!"
echo "🌐 Starting Laravel development server on 0.0.0.0:8000..."

# Start Laravel development server
exec php artisan serve --host=0.0.0.0 --port=8000
