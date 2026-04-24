-- PostGIS and pgvector extension initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Create PostGIS extension for geographic features
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE takeer TO takeer;

-- Log the initialization
\echo 'PostGIS and pgvector extensions have been created successfully';
