#!/bin/sh
set +e  # Don't exit on errors

echo "🚀 Initializing Laravel Application..."
cd /var/www/html

# Debug: Check file permissions and structure
echo "📂 Checking file structure..."
ls -la /var/www/html/ | head -10
ls -la /var/www/html/public/ | head -10

echo "🔍 Checking if index.php exists and is readable..."
test -r /var/www/html/public/index.php && echo "✅ index.php is readable" || echo "❌ index.php not readable"

echo "🔧 Setting up Laravel directories and permissions..."
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/storage/framework/cache/data
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/app/public
mkdir -p /var/www/html/bootstrap/cache
touch /var/www/html/storage/logs/laravel.log
touch /var/log/php_errors.log
touch /var/log/php_access.log

# Set ownership to www-data user and group
chown -R www-data:www-data /var/www/html/storage
chown -R www-data:www-data /var/www/html/bootstrap/cache
chown www-data:www-data /var/www/html/public
chown www-data:www-data /var/log/php_errors.log
chown www-data:www-data /var/log/php_access.log

# Set permissions - 775 for directories, 664 for files
find /var/www/html/storage -type d -exec chmod 775 {} \;
find /var/www/html/storage -type f -exec chmod 664 {} \;
find /var/www/html/bootstrap/cache -type d -exec chmod 775 {} \;
find /var/www/html/bootstrap/cache -type f -exec chmod 664 {} \;
echo "✅ Directory permissions set"

echo "🔍 Checking environment variables..."
echo "DB_HOST: $DB_HOST"
echo "DB_DATABASE: $DB_DATABASE"
echo "DB_USERNAME: $DB_USERNAME"
echo "APP_ENV: $APP_ENV"

if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:vow4gIxrZceLu7ewYIlhYMfCYBm5AeKIYcfFNGnXvKo=" ]; then
    echo "🔑 Generating application key..."
    php artisan key:generate --force || echo "❌ Failed to generate key"
fi

# Passport Keys Generation
echo "🔑 Checking Passport keys..."
if [ ! -f storage/oauth-private.key ] || [ ! -f storage/oauth-public.key ]; then
    echo "Generating Passport keys..."
    php artisan passport:keys --force || echo "❌ Failed to generate Passport keys"
    # Set correct permissions
    chown www-data:www-data storage/oauth-*.key
    chmod 600 storage/oauth-*.key
    chmod 644 storage/oauth-public.key
else
    echo "✅ Passport keys exist"
fi

echo "⏳ Testing database connection..."
for i in {1..5}; do
    if php artisan tinker --execute="DB::connection()->getPdo();" 2>/dev/null; then
        echo "✅ Database connected"
        DB_CONNECTED=true
        break
    fi
    echo "⏳ Waiting for database ($i/5)..."
    sleep 3
done

if [ "$DB_CONNECTED" = "true" ]; then
    echo "🔄 Running migrations..."
    php artisan migrate --force || echo "❌ Migration failed"
else
    echo "⚠️  Skipping database operations - no connection"
fi

echo "🧹 Cleaning up old logs..."
# Clear old Laravel log files to start fresh
if [ -f "/var/www/html/storage/logs/laravel.log" ]; then
    echo "Clearing Laravel log file..."
    > /var/www/html/storage/logs/laravel.log
fi

# Clear PHP error logs
if [ -f "/var/log/php_errors.log" ]; then
    echo "Clearing PHP error log..."
    > /var/log/php_errors.log
fi

# Clear any other log files in storage/logs
find /var/www/html/storage/logs -name "*.log" -type f -exec sh -c "echo \"Clearing log: $1\" && > \"$1\"" _ {} \;
echo "✅ Log cleanup completed"

echo "🔧 Optimizing Laravel..."
rm -rf bootstrap/cache/packages.php bootstrap/cache/services.php || true
php artisan optimize:clear || echo "❌ Optimize clear failed"
php artisan config:cache || echo "❌ Config cache failed"
php artisan route:cache || echo "❌ Route cache failed"
php artisan view:cache || echo "❌ View cache failed"

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Remove existing storage symlink if it exists
rm -f /var/www/html/public/storage
# Create storage symlink for Docker environment
ln -sf /var/www/html/storage/app/public /var/www/html/public/storage
echo "✅ Storage symlink created for Docker"

echo "🔧 Testing application setup..."
echo "🔍 Testing PHP artisan..."
php artisan --version || echo "❌ Artisan command failed"

echo "🔍 Checking .env file..."
if [ -f "/var/www/html/.env" ]; then echo "✅ .env file exists"; else echo "❌ .env file missing"; fi

echo "📝 Checking for errors in logs..."
if [ -f "/var/www/html/storage/logs/laravel.log" ]; then echo "Recent Laravel errors:"; tail -10 /var/www/html/storage/logs/laravel.log 2>/dev/null || echo "No Laravel log content"; fi
if [ -f "/var/log/php_errors.log" ]; then echo "Recent PHP errors:"; tail -10 /var/log/php_errors.log 2>/dev/null || echo "No PHP error log content"; fi

echo "✅ Laravel initialized"
# Create a flag file to indicate initialization is complete
touch /tmp/laravel-init-complete
