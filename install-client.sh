#!/usr/bin/env bash
set -euo pipefail
source ./install-util.sh

prompt client_port "MediaGarrd-Client host port [8081]: " "8081"
prompt pickup_interval "Client automatic pickup interval in ISO-8601 format [PT12H]: " "PT12H"
prompt server_ip "MediaGarrd-Server IP [192.168.1.10]: " "192.168.1.10"
prompt client_downloads_host "Client download host path [./data/client/downloads]: " "./data/client/downloads"
prompt client_state_host "Client state host path [./data/client]: " "./data/client"

cat > "$ENV_FILE" <<EOF_ENV
CLIENT_PORT=$client_port
CLIENT_PICKUP_INTERVAL=$pickup_interval
MEDIAGARRD_SERVER_PORT=38471
MEDIAGARRD_SERVER_IP=$server_ip
CLIENT_DOWNLOADS_HOST_PATH=$client_downloads_host
CLIENT_STATE_HOST_PATH=$client_state_host
EOF_ENV

cat > "$CLIENT_ENV_FILE" <<EOF_CLIENT
MEDIAGARRD_SERVER_PORT=38471
MEDIAGARRD_SERVER_IP=$server_ip
CLIENT_PORT=$client_port
CLIENT_PICKUP_INTERVAL=$pickup_interval
CLIENT_DOWNLOAD_DIRECTORY=/var/lib/mediagarrd/downloads
CLIENT_STATE_FILE=/var/lib/mediagarrd/client/state.json
EOF_CLIENT

rm -f "$SERVER_ENV_FILE"

cat > "$COMPOSE_FILE" <<EOF_COMPOSE
services:
  mediagarrd-client:
    build:
      context: .
      dockerfile: MediaGarrd-Client/Dockerfile
    container_name: mediagarrd-client
    env_file:
      - ./secrets/client.env
    ports:
      - "$client_port:$client_port"
    volumes:
      - "$client_downloads_host:/var/lib/mediagarrd/downloads"
      - "$client_state_host:/var/lib/mediagarrd/client"
    restart: unless-stopped
EOF_COMPOSE

echo ""
echo "Created: $COMPOSE_FILE"
echo "Created: $ENV_FILE"
echo "Created: $CLIENT_ENV_FILE"
echo ""
echo "Next steps:"
echo "1. Review .env"
echo "2. Review secrets/client.env"
echo "3. Start services with: docker compose up --build -d"
echo "4. Open MediaGarrd Client at: http://localhost:$client_port"
