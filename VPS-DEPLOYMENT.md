# VPS Deployment Guide - Bugra Web App

Bu rehber, projenizi AlmaLinux 9 VPS'de Docker üzerinden çalıştırmak için hazırlanmıştır.

## 🚀 Hızlı Başlangıç

### 1. Projeyi VPS'e Kopyalayın
```bash
# VPS'e bağlanın
ssh kullanici@vps-ip-adresi

# Projeyi kopyalayın (yerel makinenizden)
scp -r ./bugra kullanici@vps-ip-adresi:~/bugra

# VPS'de proje dizinine gidin
cd ~/bugra
```

### 2. Deployment Script'ini Çalıştırın
```bash
# Script'i çalıştırılabilir yapın
chmod +x deploy.sh

# Deployment'ı başlatın
./deploy.sh
```

## 📋 Manuel Kurulum

Eğer script kullanmak istemiyorsanız, adım adım kurulum:

### 1. Sistem Güncellemeleri
```bash
sudo dnf update -y
```

### 2. Docker Kurulumu
```bash
sudo dnf install -y dnf-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Terminal'i yeniden başlatın veya:
newgrp docker
```

### 3. Firewall Ayarları
```bash
sudo firewall-cmd --permanent --add-port=15000/tcp
sudo firewall-cmd --reload
```

### 4. SELinux Ayarları (Eğer Aktifse)
```bash
sudo setsebool -P httpd_can_network_connect 1
```

### 5. Uygulamayı Başlatın
```bash
# Build ve başlat
docker-compose up -d --build
```

## 🌐 Erişim

- **Yerel erişim**: http://localhost:15000
- **Dış erişim**: http://VPS-IP-ADRESI:15000
- **Health check**: http://VPS-IP-ADRESI:15000/health

## 🔧 Yönetim Komutları

### Container Durumu
```bash
# Container'ları listele
docker-compose ps

# Logları görüntüle
docker-compose logs -f

# Container durumunu kontrol et
docker-compose ps
```

### Güncelleme
```bash
# Yeni kodları çekin
git pull origin main

# Container'ı yeniden build edin
docker-compose down
docker-compose up -d --build
```

### Sorun Giderme
```bash
# Container loglarını kontrol edin
docker-compose logs

# Container'ı yeniden başlatın
docker-compose restart

# Container'ı durdurun
docker-compose down
```

## 🔒 Güvenlik Özellikleri

- **Read-only filesystem**: Container içinde dosya yazma koruması
- **Security headers**: XSS, clickjacking koruması
- **Port isolation**: Sadece gerekli port açık
- **Resource limits**: Docker resource sınırlamaları

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:15000/health
```

### Log Monitoring
```bash
# Real-time log takibi
docker-compose logs -f --tail=100

# Hata logları
docker-compose logs | grep ERROR
```

## 🚨 Sorun Giderme

### Port 15000 Açık Değil
```bash
# Firewall durumunu kontrol edin
sudo firewall-cmd --list-ports

# Port'u manuel olarak ekleyin
sudo firewall-cmd --permanent --add-port=15000/tcp
sudo firewall-cmd --reload
```

### SELinux Hatası
```bash
# SELinux durumunu kontrol edin
sestatus

# Gerekli izinleri verin
sudo setsebool -P httpd_can_network_connect 1
```

### Docker Permission Hatası
```bash
# Kullanıcıyı docker grubuna ekleyin
sudo usermod -aG docker $USER

# Yeni grup izinlerini aktif edin
newgrp docker
```

### Container Başlamıyor
```bash
# Logları kontrol edin
docker-compose logs

# Container'ı yeniden build edin
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📈 Performance Optimization

- **Gzip compression**: Aktif
- **Static file caching**: 1 yıl
- **HTML caching**: Devre dışı (SPA için)
- **Resource optimization**: Multi-stage Docker build

## 🔄 Otomatik Güncelleme

Cron job ile otomatik güncelleme için:

```bash
# Crontab'ı düzenleyin
crontab -e

# Her gün gece 2'de güncelleme yapın
0 2 * * * cd /home/kullanici/bugra && docker-compose pull && docker-compose up -d --build
```

## 📞 Destek

Sorun yaşarsanız:
1. `docker-compose logs` komutuyla logları kontrol edin
2. Container durumunu `docker-compose ps` ile kontrol edin
3. Health check endpoint'ini test edin: `curl http://localhost:15000/health`
