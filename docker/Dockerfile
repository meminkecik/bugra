# Multi-stage build kullanarak önce projeyi build ediyoruz
FROM node:18-alpine AS builder

WORKDIR /app

# Package dosyalarını kopyalayıp dependencies'i yüklüyoruz
COPY package*.json ./
RUN npm ci --only=production

# Kaynak kodları kopyalayıp build ediyoruz
COPY . .
RUN npm run build

# Nginx stage
FROM nginx:alpine

# Build çıktısını kopyalıyoruz
COPY --from=builder /app/dist/ /usr/share/nginx/html/

# Nginx konfigürasyonunu kopyalıyoruz
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 80 portunu dışarıya açıyoruz
EXPOSE 80

# Nginx'i başlatıyoruz
CMD ["nginx", "-g", "daemon off;"]
