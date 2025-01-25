FROM node:18-alpine as development
FROM buildkite/puppeteer:latest

WORKDIR /app
COPY . /app
RUN npm install npm@latest -g
CMD ["npm", "start"]
EXPOSE 8080
