FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 LIFEOS_DATA_DIR=/data
COPY --chown=node:node server.mjs package.json ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
