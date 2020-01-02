FROM node@sha256:744b156ec2dca0ad8291f80f9093273d45eb85378b6290b2fbbada861cc3ed01
# 12.10.0-alpine

RUN apk add --no-cache tini

ENV NODE_ENV production

ADD package.tar.gz /server

WORKDIR /server

CMD ["tini", "node", "app.js"]
