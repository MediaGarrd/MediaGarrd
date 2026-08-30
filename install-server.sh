#!/usr/bin/env bash
set -euo pipefail
source ./install-util.sh

prompt server_port "MediaGarrd-Server host port [38471]: " "38471"
prompt backup_interval "Server automatic backup interval in ISO-8601 format [PT12H]: " "PT12H"
prompt backup_root_host "Server backup host path [./data/server/backups]: " "./data/server/backups"
prompt backup_retention "Maximum number of backups to keep [10]: " "10"

yes_no jellyfin_enabled "Enable Jellyfin backups? [Y/n]: " "y"
if [[ "$jellyfin_enabled" == "true" ]]; then
    prompt jellyfin_path "Jellyfin source base directory [/mnt/appdata/jellyfin]: " "/mnt/appdata/jellyfin"
else
    jellyfin_path=""
fi

yes_no radarr_enabled "Enable Radarr backups? [Y/n]: " "y"
if [[ "$radarr_enabled" == "true" ]]; then
    prompt radarr_path "Radarr source base directory [/mnt/appdata/radarr]: " "/mnt/appdata/radarr"
else
    radarr_path=""
fi

yes_no sonarr_enabled "Enable Sonarr backups? [Y/n]: " "y"
if [[ "$sonarr_enabled" == "true" ]]; then
    prompt sonarr_path "Sonarr source base directory [/mnt/appdata/sonarr]: " "/mnt/appdata/sonarr"
else
    sonarr_path=""
fi

yes_no prowlarr_enabled "Enable Prowlarr backups? [Y/n]: " "y"
if [[ "$prowlarr_enabled" == "true" ]]; then
    prompt prowlarr_path "Prowlarr source base directory [/mnt/appdata/prowlarr]: " "/mnt/appdata/prowlarr"
else
    prowlarr_path=""
fi

yes_no tdarr_enabled "Enable Tdarr backups? [Y/n]: " "y"
if [[ "$tdarr_enabled" == "true" ]]; then
    prompt tdarr_path "Tdarr source base directory [/mnt/appdata/tdarr]: " "/mnt/appdata/tdarr"
else
    tdarr_path=""
fi

yes_no qbittorrent_enabled "Enable qBittorrent backups? [Y/n]: " "y"
if [[ "$qbittorrent_enabled" == "true" ]]; then
    prompt qbittorrent_path "qBittorrent source base directory [/mnt/appdata/qbittorrent]: " "/mnt/appdata/qbittorrent"
    prompt qbittorrent_graveyard_path "qBittorrent graveyard source directory [/mnt/media/graveyard]: " "/mnt/media/graveyard"
else
    qbittorrent_path=""
    qbittorrent_graveyard_path=""
fi

{
    cat <<EOF_ENV
    SERVER_PORT=$server_port
    MEDIAGARRD_BACKUP_INTERVAL=$backup_interval
    BACKUP_ROOT_HOST_PATH=$backup_root_host
    MEDIAGARRD_RETENTION_COUNT=$backup_retention
EOF_ENV
    if [[ "$jellyfin_enabled" == "true" ]]; then
        echo "JELLYFIN_PATH=$jellyfin_path"
    fi
    if [[ "$radarr_enabled" == "true" ]]; then
        echo "RADARR_PATH=$radarr_path"
    fi
    if [[ "$sonarr_enabled" == "true" ]]; then
        echo "SONARR_PATH=$sonarr_path"
    fi
    if [[ "$prowlarr_enabled" == "true" ]]; then
        echo "PROWLARR_PATH=$prowlarr_path"
    fi
    if [[ "$tdarr_enabled" == "true" ]]; then
        echo "TDARR_PATH=$tdarr_path"
    fi
    if [[ "$qbittorrent_enabled" == "true" ]]; then
        echo "QBITTORRENT_PATH=$qbittorrent_path"
        echo "QBITTORRENT_GRAVEYARD_PATH=$qbittorrent_graveyard_path"
    fi
} > "$ENV_FILE"

  cat > "$SERVER_ENV_FILE" <<EOF_SERVER
SERVER_PORT=$server_port
MEDIAGARRD_BACKUP_INTERVAL=$backup_interval
MEDIAGARRD_BACKUP_ROOT=/var/lib/mediagarrd/backups
MEDIAGARRD_RETENTION_COUNT=$backup_retention
JELLYFIN_ENABLED=$jellyfin_enabled
RADARR_ENABLED=$radarr_enabled
SONARR_ENABLED=$sonarr_enabled
PROWLARR_ENABLED=$prowlarr_enabled
TDARR_ENABLED=$tdarr_enabled
QBITTORRENT_ENABLED=$qbittorrent_enabled
EOF_SERVER

  rm -f "$CLIENT_ENV_FILE"

{
    cat <<EOF_COMPOSE
services:
  mediagarrd-server:
    build:
      context: ./MediaGarrd-Server
      dockerfile: Dockerfile
    container_name: mediagarrd-server
    env_file:
      - ./secrets/server.env
    ports:
      - "$server_port:$server_port"
    volumes:
      - "$backup_root_host:/var/lib/mediagarrd/backups"
EOF_COMPOSE

    if [[ "$jellyfin_enabled" == "true" ]]; then
        echo "      - \"$jellyfin_path:/srv/sources/jellyfin:ro\""
    fi
    if [[ "$radarr_enabled" == "true" ]]; then
        echo "      - \"$radarr_path:/srv/sources/radarr:ro\""
    fi
    if [[ "$sonarr_enabled" == "true" ]]; then
        echo "      - \"$sonarr_path:/srv/sources/sonarr:ro\""
    fi
    if [[ "$prowlarr_enabled" == "true" ]]; then
        echo "      - \"$prowlarr_path:/srv/sources/prowlarr:ro\""
    fi
    if [[ "$tdarr_enabled" == "true" ]]; then
        echo "      - \"$tdarr_path:/srv/sources/tdarr:ro\""
    fi
    if [[ "$qbittorrent_enabled" == "true" ]]; then
        echo "      - \"$qbittorrent_path:/srv/sources/qbittorrent:ro\""
        echo "      - \"$qbittorrent_graveyard_path:/srv/sources/qbittorrent-graveyard:ro\""
    fi
    echo "    restart: unless-stopped"
} > "$COMPOSE_FILE"

echo ""
echo "Created: $COMPOSE_FILE"
echo "Created: $ENV_FILE"
echo "Created: $SERVER_ENV_FILE"
echo ""
echo "Next steps:"
echo "1. Review .env"
echo "2. Review secrets/server.env"
echo "3. Start services with: docker compose up --build -d"
