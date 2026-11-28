FROM node:22-alpine
WORKDIR /app
COPY package.json collab-relay.mjs ./
RUN npm install --omit=dev
ENV PORT=8787 DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["node", "collab-relay.mjs"]
