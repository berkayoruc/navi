FROM node:slim
WORKDIR /deneme
COPY app/ .
RUN npm install -g live-server
EXPOSE 8080
CMD ["live-server", ""]