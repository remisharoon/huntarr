FROM node:22-alpine

WORKDIR /app
COPY apps/frontend/package.json /app/package.json
RUN npm install

COPY apps/frontend /app

EXPOSE 5173
CMD ["npm", "run", "dev"]
