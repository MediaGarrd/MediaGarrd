#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$ROOT_DIR/secrets"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
SERVER_ENV_FILE="$SECRETS_DIR/server.env"
CLIENT_ENV_FILE="$SECRETS_DIR/client.env"

mkdir -p "$SECRETS_DIR"

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="${3:-}"
  local value=""

  read -r -p "$prompt_text" value
  if [[ -z "$value" ]]; then
    value="$default_value"
  fi

  printf -v "$var_name" '%s' "$value"
}

yes_no() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="${3:-y}"
  local response

  read -r -p "$prompt_text" response
  response="${response:-$default_value}"
  if [[ "$response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf -v "$var_name" 'true'
  else
    printf -v "$var_name" 'false'
  fi
}

