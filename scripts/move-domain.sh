#!/usr/bin/env bash
# Moves the platform to a new address on the production server.
#
#   sudo bash scripts/move-domain.sh mr.x.aurexis.cc amr.aurexis.cc
#
# Run it on the server, as root, AFTER the new name's DNS A record points to
# this server. It:
#   1. serves the new name over HTTP so Let's Encrypt can verify it,
#   2. issues its HTTPS certificate (certbot, webroot),
#   3. installs the new name's HTTPS site in the host nginx (other sites on
#      this server are not touched; the old name's site is left as it was),
#   4. replaces the old https address in /opt/amr-platform/shared/.env
#      (a timestamped backup is kept next to it).
# Then set the GitHub variable PRODUCTION_SITE_URL to the new address and run
# the "Production pipeline" workflow: the deploy recreates the services with
# the new settings. Storage keeps its current name.
set -euo pipefail

new="${1:?Usage: move-domain.sh <new-domain> <old-domain>}"
old="${2:?Usage: move-domain.sh <new-domain> <old-domain>}"
domain='^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
[[ "$new" =~ $domain && "$old" =~ $domain ]] || { echo 'Give plain domain names, e.g. mr.x.aurexis.cc'; exit 1; }
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.'; exit 1; }

env_file=/opt/amr-platform/shared/.env
webroot=/var/www/letsencrypt
site=/etc/nginx/sites-available/platform-$new.conf
upstream=127.0.0.1:17080
test -s "$env_file" || { echo "Missing $env_file"; exit 1; }
command -v certbot >/dev/null || { echo 'certbot is not installed (apt install certbot).'; exit 1; }

server_ip=$(curl -fsS --max-time 10 https://api.ipify.org || true)
dns_ip=$(getent ahostsv4 "$new" | awk 'NR==1 {print $1}')
[ -n "$dns_ip" ] || { echo "$new does not resolve yet: add its DNS A record first."; exit 1; }
if [ -n "$server_ip" ] && [ "$dns_ip" != "$server_ip" ]; then
  echo "$new points to $dns_ip, but this server is $server_ip. Fix the DNS record first."
  exit 1
fi

echo "1/4 Serving http://$new for the certificate check"
mkdir -p "$webroot"
cat > "$site" <<EOF
server {
    listen 80;
    server_name $new;
    location /.well-known/acme-challenge/ { root $webroot; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
ln -sfn "$site" "/etc/nginx/sites-enabled/platform-$new.conf"
nginx -t
systemctl reload nginx

echo "2/4 Issuing the certificate"
certbot certonly --webroot -w "$webroot" -d "$new" --non-interactive --agree-tos \
  --register-unsafely-without-email --keep-until-expiring

echo "3/4 Installing the HTTPS site"
cat > "$site" <<EOF
# The platform at https://$new (written by scripts/move-domain.sh).
server {
    listen 80;
    server_name $new;
    location /.well-known/acme-challenge/ { root $webroot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $new;
    ssl_certificate /etc/letsencrypt/live/$new/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$new/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 50m;
    location / {
        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        # Replace incoming forwarding headers: clients cannot impersonate IPs.
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
EOF
nginx -t
systemctl reload nginx

echo "4/4 Pointing the platform settings at https://$new"
backup="$env_file.before-$new.$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$env_file" "$backup"
# Only exact https://<old> origins change; storage.<old> keeps working as is.
sed -i -E "s#https://${old//./\\.}([/,\"' ]|$)#https://$new\1#g" "$env_file"
echo "Changed lines:"
diff "$backup" "$env_file" || true

curl -fsS --max-time 20 "https://$new/api/health/ready" && echo
echo "Done. Backup of the old settings: $backup"
echo "Next: set PRODUCTION_SITE_URL=https://$new in GitHub and run the Production pipeline."
