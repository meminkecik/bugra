#!/bin/bash

# VPS Deployment Script for Bugra Web App
# AlmaLinux 9 için optimize edilmiş

set -e

echo "🚀 Bugra Web App VPS Deployment başlatılıyor..."

# Sistem güncellemeleri
echo "📦 Sistem güncelleniyor..."
sudo dnf update -y

# Docker kurulumu (eğer yoksa)
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker kuruluyor..."
    sudo dnf install -y dnf-utils
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "✅ Docker kuruldu. Lütfen terminal'i yeniden başlatın ve script'i tekrar çalıştırın."
    exit 0
fi

# Docker Compose kurulumu (eğer yoksa)
if ! command -v docker-compose &> /dev/null; then
    echo "📋 Docker Compose kuruluyor..."
    sudo dnf install -y docker-compose-plugin
fi

# Firewall ayarları
echo "🔥 Firewall ayarları yapılıyor..."
sudo firewall-cmd --permanent --add-port=15000/tcp
sudo firewall-cmd --reload

# SELinux ayarları (eğer aktifse)
if command -v sestatus &> /dev/null && sestatus | grep -q "enabled"; then
    echo "🔒 SELinux ayarları yapılıyor..."
    sudo setsebool -P httpd_can_network_connect 1
fi

# Proje dizinine git
cd "$(dirname "$0")"

# Eski container'ları durdur ve sil
echo "🧹 Eski container'lar temizleniyor..."
docker-compose down --remove-orphans || true

# Docker image'larını temizle
echo "🗑️ Eski Docker image'ları temizleniyor..."
docker system prune -f

# Yeni build yap
echo "🔨 Docker image build ediliyor..."
docker-compose build --no-cache

# Container'ı başlat
echo "🚀 Container başlatılıyor..."
docker-compose up -d

# Health check
echo "🏥 Health check yapılıyor..."
sleep 10
if curl -f http://localhost:15000/health > /dev/null 2>&1; then
    echo "✅ Uygulama başarıyla çalışıyor!"
    echo "🌐 Uygulamaya erişim: http://$(curl -s ifconfig.me):15000"
    echo "🏠 Yerel erişim: http://localhost:15000"
else
    echo "❌ Uygulama başlatılamadı. Logları kontrol edin:"
    docker-compose logs
    exit 1
fi

echo "🎉 Deployment tamamlandı!"
echo ""
echo "📋 Faydalı komutlar:"
echo "  - Logları görüntüle: docker-compose logs -f"
echo "  - Container durumu: docker-compose ps"
echo "  - Container'ı durdur: docker-compose down"
echo "  - Container'ı yeniden başlat: docker-compose restart"
