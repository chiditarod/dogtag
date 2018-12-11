#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER USER postgres WITH PASSWORD '';
  CREATE DATABASE dogtag_test;
  CREATE DATABASE dogtag_development;
  GRANT ALL PRIVILEGES ON DATABASE dogtag_test TO postgres;
  GRANT ALL PRIVILEGES ON DATABASE dogtag_development TO postgres;
EOSQL
