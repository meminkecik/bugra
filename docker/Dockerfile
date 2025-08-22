# Nginx tabanlı bir image kullanıyoruz
FROM nginx:alpine

# Build çıktısını kopyalıyoruz
COPY dist/ /usr/share/nginx/html/

# Nginx konfigürasyonunu kopyalıyoruz (SPA için index.html fallback)
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# 80 portunu dışarıya açıyoruz
EXPOSE 80
