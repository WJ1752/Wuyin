#!/bin/sh
# Run as root on Linux x86_64. Keeps the machine's existing Node and services intact.
set -eu
test "$(id -u)" = 0
test "$(uname -m)" = x86_64
install -d -m 0755 /opt/wuyin /opt/wuyin/runtimes /opt/wuyin/releases
if ! id wuyin >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/wuyin --shell /usr/sbin/nologin wuyin
fi
install -d -o wuyin -g wuyin -m 0700 /var/lib/wuyin /var/lib/wuyin/data /var/lib/wuyin/backups
install -d -o root -g wuyin -m 0750 /etc/wuyin
task_tmp=$(mktemp -d /tmp/wuyin-node.XXXXXXXX)
case "$task_tmp" in /tmp/wuyin-node.*) ;; *) exit 1 ;; esac
trap 'rm -rf -- "$task_tmp"' EXIT
cd "$task_tmp"
curl --fail --silent --show-error --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o SHASUMS256.txt
archive=$(awk '/ node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
test -n "$archive"
curl --fail --silent --show-error --location "https://nodejs.org/dist/latest-v24.x/$archive" -o "$archive"
grep "  $archive\$" SHASUMS256.txt | sha256sum --check -
runtime_dir=${archive%.tar.xz}
if ! test -d "/opt/wuyin/runtimes/$runtime_dir"; then
  tar -xJf "$archive" -C /opt/wuyin/runtimes
fi
ln -sfn "/opt/wuyin/runtimes/$runtime_dir" /opt/wuyin/runtime
/opt/wuyin/runtime/bin/node --version
