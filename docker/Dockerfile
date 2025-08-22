# Nginx tabanlı bir image kullanıyoruz
FROM nginx:alpine

# Çalışma dizinini belirliyoruz
WORKDIR /usr/share/nginx/html

# Src klasöründeki dosyaları kopyalıyoruz
COPY src/ .

# Nginx konfigürasyonunu kopyalıyoruz
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 80 portunu dışarıya açıyoruz
EXPOSE 80 